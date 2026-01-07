import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENT_PRIORITIES = {
  sales_agent: 10,
  webinar: 6,
  textbook: 5,
  flashcards: 4,
  algo_monthly: 4,
  ccta: 4,
  lead_nurture: 3,
  customer_service: 2
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Helper function to escape XML special characters
    const escapeXml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse incoming Twilio webhook data
    const formData = await req.formData();
    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const messageSid = formData.get('MessageSid')?.toString() || '';
    
    // Normalize phone number for matching (strip +1 prefix and all formatting)
    const normalizePhone = (phone: string) => {
      // Remove all spaces, dashes, parentheses, and dots
      let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
      // Strip +1 prefix if present (US country code)
      if (cleaned.startsWith('+1')) {
        cleaned = cleaned.substring(2);
      } else if (cleaned.startsWith('1') && cleaned.length === 11) {
        // Handle case where it's just '1' prefix without '+'
        cleaned = cleaned.substring(1);
      }
      return cleaned;
    };

    console.log('Incoming SMS:', { from, body, messageSid });

    // Check for opt-out keywords
    const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT'];
    const isOptOut = optOutKeywords.some(keyword => 
      body.toUpperCase().includes(keyword)
    );

    // Find existing contact by phone number with universal normalization
    const normalizedFrom = normalizePhone(from);
    console.log(`📞 Looking up contact: ${from} → normalized: ${normalizedFrom}`);
    
    // Single efficient query checking both original and normalized formats
    let { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .or(`phone_number.eq.${from},phone_number.eq.${normalizedFrom}`)
      .maybeSingle();
    
    if (existingContact) {
      console.log(`✅ Found contact: ${existingContact.id} (${existingContact.full_name})`);
    } else {
      console.log(`❌ No contact found for ${from} or ${normalizedFrom} - creating new contact`);
      
      // Auto-create a new contact for unknown numbers
      const defaultWorkspaceId = '00000000-0000-0000-0000-000000000002';
      const { data: newContact, error: createContactError } = await supabase
        .from('contacts')
        .insert({
          full_name: from, // Use phone number as initial name
          phone_number: normalizedFrom,
          workspace_id: defaultWorkspaceId,
          lead_source: 'inbound_sms',
          lead_status: 'new',
        })
        .select()
        .single();
      
      if (createContactError) {
        console.error('Failed to create contact:', createContactError);
      } else {
        existingContact = newContact;
        console.log(`✅ Created new contact: ${newContact.id} for ${from}`);
      }
    }

    // Find or create conversation
    let { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', from)
      .maybeSingle();

    if (!conversation) {
      // Get workspace_id from contact or use default workspace
      const workspaceId = existingContact?.workspace_id || '00000000-0000-0000-0000-000000000002';
      
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          phone_number: from,
          contact_id: existingContact?.id || null,
          contact_name: existingContact?.full_name || null,
          status: isOptOut ? 'opted_out' : 'active',
          last_message_at: new Date().toISOString(),
          workspace_id: workspaceId,
        })
        .select()
        .single();

      if (createError) throw createError;
      conversation = newConv;
    } else {
      // Update conversation with contact info if we found one
      const updates: any = {
        last_message_at: new Date().toISOString()
      };
      
      // ALWAYS sync contact_id if we found a contact (fixes product visibility issue)
      if (existingContact) {
        updates.contact_id = existingContact.id;
        updates.contact_name = existingContact.full_name;
        console.log(`🔗 Linking conversation ${conversation.id} to contact ${existingContact.id}`);
      }
      
      if (isOptOut) {
        updates.status = 'opted_out';
      }
      
      await supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversation.id);
      
      // Update local conversation object with the new contact_id
      if (existingContact) {
        conversation.contact_id = existingContact.id;
      }
    }

    // Store incoming message
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      direction: 'inbound',
      sender: 'customer',
      body: body,
      twilio_message_sid: messageSid,
      status: 'delivered',
    });

    // Track response in sales campaigns
    if (existingContact) {
      const { data: campaignContact } = await supabase
        .from('ai_sales_campaign_contacts')
        .select('id, campaign_id, responded')
        .eq('contact_id', existingContact.id)
        .in('status', ['active', 'pending'])
        .maybeSingle();

      if (campaignContact && !campaignContact.responded) {
        // Mark as responded
        await supabase
          .from('ai_sales_campaign_contacts')
          .update({ responded: true })
          .eq('id', campaignContact.id);
        
        // Increment campaign response count - simple direct update
        const { data: currentCampaign } = await supabase
          .from('ai_sales_campaigns')
          .select('responses_received')
          .eq('id', campaignContact.campaign_id)
          .single();
        
        if (currentCampaign) {
          await supabase
            .from('ai_sales_campaigns')
            .update({ responses_received: (currentCampaign.responses_received || 0) + 1 })
            .eq('id', campaignContact.campaign_id);
        }

        console.log(`✅ Marked campaign contact as responded: ${campaignContact.id}`);
      }
    }

    // ============================================
    // REAL-TIME SCORE UPDATE - Update contact scores immediately
    // ============================================
    if (existingContact) {
      try {
        console.log(`📊 Updating real-time scores for contact: ${existingContact.id}`);
        await supabase.functions.invoke('update-contact-scores-realtime', {
          body: {
            contactId: existingContact.id,
            messageBody: body
          }
        });
        console.log('✅ Real-time scores updated');
      } catch (scoreError) {
        console.error('⚠️ Failed to update real-time scores (non-blocking):', scoreError);
        // Don't block message processing if scoring fails
      }
    }

    // ============================================
    // TRADE ANALYSIS AGENT ROUTING
    // ============================================
    
    // Check if this contact has trade_analysis agent or subscription
    let isTradeAnalysisUser = false;
    if (existingContact) {
      const { data: tradeAgent } = await supabase
        .from('product_agents')
        .select('*')
        .eq('contact_id', existingContact.id)
        .eq('product_type', 'trade_analysis')
        .eq('status', 'active')
        .maybeSingle();

      if (tradeAgent) {
        isTradeAnalysisUser = true;
        console.log('Trade analysis user detected');
        
        // Classify intent using AI
        const { data: classification, error: classifyError } = await supabase.functions.invoke('classify-intent', {
          body: {
            message: body,
            contactProfile: {
              trading_experience: existingContact.trading_experience,
              trading_style: existingContact.trading_style,
              onboarding_phase: existingContact.onboarding_phase || 'Complete'
            }
          }
        });

        if (!classifyError && classification) {
          console.log('Intent classification:', classification);

          const { intent, confidence, entities, clarification_needed, clarification_question } = classification;

          // Handle clarification
          if (clarification_needed && clarification_question) {
            return new Response(
              `<?xml version="1.0" encoding="UTF-8"?>
              <Response>
                <Message>${escapeXml(clarification_question)}</Message>
              </Response>`,
              { 
                headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
                status: 200,
              }
            );
          }

          // Apply guardrails - redirect off-topic queries
          if (intent === 'off_topic' && confidence > 0.7) {
            const redirectMessage = "I only analyze stocks and manage watchlists. Please text a ticker symbol (like AAPL or TSLA) for analysis.";
            return new Response(
              `<?xml version="1.0" encoding="UTF-8"?>
              <Response>
                <Message>${escapeXml(redirectMessage)}</Message>
              </Response>`,
              { 
                headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
                status: 200,
              }
            );
          }

          // Route based on intent
          switch (intent) {
            case 'stock_analysis': {
              if (!entities.ticker_symbol) {
                return new Response(
                  `<?xml version="1.0" encoding="UTF-8"?>
                  <Response>
                    <Message>Please provide a ticker symbol (e.g., AAPL, TSLA) for analysis.</Message>
                  </Response>`,
                  { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
                );
              }

              const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-stock', {
                body: {
                  symbol: entities.ticker_symbol.toUpperCase(),
                  contactId: existingContact.id
                }
              });

              if (analysisError || analysisData?.error) {
                const errorMsg = analysisData?.error === 'no_credits' 
                  ? analysisData.message
                  : `Unable to analyze ${entities.ticker_symbol}. Please try again.`;
                
                return new Response(
                  `<?xml version="1.0" encoding="UTF-8"?>
                  <Response>
                    <Message>${escapeXml(errorMsg)}</Message>
                  </Response>`,
                  { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
                );
              }

              const { analysis, creditsRemaining } = analysisData;
              const smsResponse = `📊 ${entities.ticker_symbol} Analysis (Score: ${analysis.technical_score}/100)

SETUP: ${analysis.setup_type}
📈 Entry: $${analysis.entry_price}
🛑 Stop: $${analysis.stop_loss}
🎯 Targets: $${analysis.price_targets[0]} → $${analysis.price_targets[1]}

${analysis.reasoning}

RISKS: ${analysis.key_risks}

💾 Reply "WATCH ${entities.ticker_symbol} ${analysis.entry_price}" to get alerted.

Credits: ${creditsRemaining} remaining`;

              return new Response(
                `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                  <Message>${escapeXml(smsResponse)}</Message>
                </Response>`,
                { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
              );
            }

            case 'watchlist_add': {
              if (!entities.ticker_symbol || !entities.target_price) {
                return new Response(
                  `<?xml version="1.0" encoding="UTF-8"?>
                  <Response>
                    <Message>Format: WATCH [TICKER] [PRICE]
Example: WATCH AAPL 175</Message>
                  </Response>`,
                  { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
                );
              }

              const { error: watchlistError } = await supabase
                .from('user_watchlists')
                .upsert({
                  contact_id: existingContact.id,
                  symbol: entities.ticker_symbol.toUpperCase(),
                  target_entry_price: entities.target_price,
                  status: 'watching'
                }, {
                  onConflict: 'contact_id,symbol'
                });

              const watchlistMsg = watchlistError
                ? 'Failed to add to watchlist. Please try again.'
                : `✅ ${entities.ticker_symbol} added to watchlist at $${entities.target_price}. You'll get an SMS when it hits your target.`;

              return new Response(
                `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                  <Message>${escapeXml(watchlistMsg)}</Message>
                </Response>`,
                { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
              );
            }

            case 'watchlist_view': {
              const { data: watchlist } = await supabase
                .from('user_watchlists')
                .select('*')
                .eq('contact_id', existingContact.id)
                .eq('status', 'watching')
                .order('created_at', { ascending: false });

              if (!watchlist || watchlist.length === 0) {
                return new Response(
                  `<?xml version="1.0" encoding="UTF-8"?>
                  <Response>
                    <Message>Your watchlist is empty. Reply "WATCH [TICKER] [PRICE]" to add stocks.</Message>
                  </Response>`,
                  { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
                );
              }

              const watchlistText = watchlist.map((item, i) => 
                `${i + 1}. ${item.symbol} - Target: $${item.target_entry_price}`
              ).join('\n');

              return new Response(
                `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                  <Message>📋 Your Watchlist:\n\n${watchlistText}\n\nReply REMOVE [#] to delete</Message>
                </Response>`,
                { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
              );
            }

            case 'watchlist_remove': {
              if (!entities.ticker_symbol && !entities.watchlist_item_number) {
                return new Response(
                  `<?xml version="1.0" encoding="UTF-8"?>
                  <Response>
                    <Message>Reply "REMOVE [TICKER]" or "REMOVE [NUMBER]" to delete from watchlist.</Message>
                  </Response>`,
                  { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
                );
              }

              let deleteQuery = supabase
                .from('user_watchlists')
                .delete()
                .eq('contact_id', existingContact.id);

              if (entities.ticker_symbol) {
                deleteQuery = deleteQuery.eq('symbol', entities.ticker_symbol.toUpperCase());
              } else if (entities.watchlist_item_number) {
                // Get watchlist and delete by index
                const { data: watchlist } = await supabase
                  .from('user_watchlists')
                  .select('id')
                  .eq('contact_id', existingContact.id)
                  .eq('status', 'watching')
                  .order('created_at', { ascending: false });

                if (watchlist && watchlist[entities.watchlist_item_number - 1]) {
                  deleteQuery = deleteQuery.eq('id', watchlist[entities.watchlist_item_number - 1].id);
                }
              }

              const { error: deleteError } = await deleteQuery;

              const removeMsg = deleteError
                ? 'Failed to remove from watchlist.'
                : '✅ Removed from watchlist.';

              return new Response(
                `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                  <Message>${escapeXml(removeMsg)}</Message>
                </Response>`,
                { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
              );
            }

            case 'account_query': {
              const { data: subscription } = await supabase
                .from('user_subscriptions')
                .select('*, subscription_tiers(*)')
                .eq('contact_id', existingContact.id)
                .maybeSingle();

              const creditsInfo = subscription
                ? `Plan: ${subscription.subscription_tiers.name}\nCredits: ${subscription.credits_remaining ?? 'Unlimited'}`
                : 'No active subscription';

              return new Response(
                `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                  <Message>📊 Your Account:\n\n${creditsInfo}\n\nReply UPGRADE to see premium plans.</Message>
                </Response>`,
                { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
              );
            }

            case 'help': {
              const helpMsg = `📱 Commands:

TEXT ANY TICKER - Get analysis (AAPL, TSLA, etc)
WATCH [TICKER] [PRICE] - Add alert
WATCHLIST - View all alerts
REMOVE [TICKER] - Remove alert
BALANCE - Check credits
HELP - This message`;

              return new Response(
                `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                  <Message>${escapeXml(helpMsg)}</Message>
                </Response>`,
                { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
              );
            }

            case 'educational_question': {
              // Keep educational responses under 160 chars
              const eduResponse = "For in-depth technical analysis training, check out our full courses. Text a ticker for instant analysis!";
              return new Response(
                `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                  <Message>${escapeXml(eduResponse)}</Message>
                </Response>`,
                { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
              );
            }
          }
        }
      }
    }

    // If not a trade analysis user or intent not handled, continue with existing logic

    // Check if this phone number was part of any campaigns and increment reply count
    const { data: campaignMessages } = await supabase
      .from('campaign_messages')
      .select('campaign_id')
      .eq('phone_number', from)
      .eq('status', 'sent')
      .limit(1);

    if (campaignMessages && campaignMessages.length > 0) {
      // Increment the campaign's reply_count
      const campaignId = campaignMessages[0].campaign_id;
      
      const { data: currentCampaign } = await supabase
        .from('campaigns')
        .select('reply_count')
        .eq('id', campaignId)
        .single();

      if (currentCampaign) {
        await supabase
          .from('campaigns')
          .update({ reply_count: (currentCampaign.reply_count || 0) + 1 })
          .eq('id', campaignId);
        
        console.log(`Incremented reply count for campaign ${campaignId}`);
      }
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);

    if (isOptOut) {
      // Send opt-out confirmation
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>You have been unsubscribed. Reply START to opt back in.</Message>
        </Response>`,
        { 
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200,
        }
      );
    }

    // Get conversation history for AI context (last 20 messages for better context)
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(20);

    console.log(`Fetched ${recentMessages?.length || 0} messages for conversation history`);

    // ============================================
    // HELP COMMAND OVERRIDE - 24 Hour Temporary Priority Boost
    // ============================================
    const isHelpCommand = body.trim().toUpperCase() === 'HELP' || 
                          body.trim().toUpperCase() === '/HELP' ||
                          body.trim().toLowerCase().startsWith('help ');

    let routeToAgent = 'customer_service'; // Default
    let activeProductAgent = null;
    let agentContext = null;
    let isInHelpMode = false;

    if (existingContact) {
      // Check if currently in HELP mode (24hr window)
      const { data: convState } = await supabase
        .from('conversation_state')
        .select('help_mode_until, active_agent_id, product_agents!conversation_state_active_agent_id_fkey(*)')
        .eq('contact_id', existingContact.id)
        .maybeSingle();

      const now = new Date();
      
      // Check if help mode is still active
      if (convState?.help_mode_until) {
        const helpModeExpiry = new Date(convState.help_mode_until);
        isInHelpMode = now < helpModeExpiry;
        
        if (isInHelpMode) {
          console.log(`📞 HELP MODE ACTIVE (expires: ${helpModeExpiry.toISOString()})`);
        } else {
          console.log('⏰ HELP MODE EXPIRED - Clearing help_mode_until');
          // Clear expired help mode
          await supabase
            .from('conversation_state')
            .update({ help_mode_until: null })
            .eq('contact_id', existingContact.id);
        }
      }

      // If user types /HELP, activate help mode for 24 hours
      if (isHelpCommand) {
        const helpModeExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
        
        console.log(`📞 /HELP COMMAND DETECTED - Activating help mode until ${helpModeExpiry.toISOString()}`);
        
        await supabase
          .from('conversation_state')
          .update({ help_mode_until: helpModeExpiry.toISOString() })
          .eq('contact_id', existingContact.id);
        
        isInHelpMode = true;
      }

      // Route based on help mode status
      if (isInHelpMode) {
        // HELP MODE PRIORITIES: CS (10) > Sales (7) > Product (1)
        console.log('🔀 Using HELP MODE priorities');
        
        // Find or create customer service agent
        let { data: csAgent } = await supabase
          .from('product_agents')
          .select('*')
          .eq('contact_id', existingContact.id)
          .eq('product_type', 'customer_service')
          .eq('status', 'active')
          .maybeSingle();
        
        if (!csAgent) {
          const { data: newCSAgent } = await supabase
            .from('product_agents')
            .insert({
              contact_id: existingContact.id,
              product_type: 'customer_service',
              status: 'active',
              direction: 'inbound',
              expiration_date: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
              agent_context: { help_mode: true }
            })
            .select()
            .single();
          
          csAgent = newCSAgent;
        }
        
        routeToAgent = 'customer_service';
        agentContext = {
          agent_id: csAgent?.id,
          product_type: 'customer_service',
          context: { help_mode: true, help_mode_active: true }
        };
      }
    }

    // ============================================
    // INTELLIGENT MESSAGE ROUTING LOGIC
    // ============================================
    
    // Only proceed with normal routing if NOT in help mode
    if (!isInHelpMode && existingContact) {
      console.log('🔀 Using NORMAL MODE priorities');
      
      // Look up conversation state to find active agent
      const { data: convState } = await supabase
        .from('conversation_state')
        .select('*, agent_priority, product_agents!conversation_state_active_agent_id_fkey(*)')
        .eq('contact_id', existingContact.id)
        .maybeSingle();

      // PRIORITY LOGIC: Sales (10) > Product (4-6) > CS (2)
      console.log(`📊 Conversation State Priority: ${convState?.agent_priority || 'none'}`);
      console.log(`📋 Agent Priority Constants:`, AGENT_PRIORITIES);
      
      // Step 1: Check for active Sales Agent (priority 10)
      // Check BOTH product_agents and agent_conversations tables
      const { data: salesAgent } = await supabase
        .from('product_agents')
        .select('*')
        .eq('contact_id', existingContact.id)
        .eq('product_type', 'sales_agent')
        .eq('status', 'active')
        .maybeSingle();

      const { data: salesConversation } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('contact_id', existingContact.id)
        .eq('agent_type', 'sales_agent')
        .eq('status', 'active')
        .maybeSingle();

      const now = new Date();
      let salesAgentFound = false;
      let salesAgentSource: 'product_agents' | 'agent_conversations' | null = null;

      // Check product_agents first
      if (salesAgent) {
        const expirationDate = new Date(salesAgent.expiration_date);
        const isExpired = now > expirationDate;

        if (!isExpired) {
          console.log('✅ Routing to SALES AGENT from product_agents (priority 10)');
          routeToAgent = 'sales_agent';
          agentContext = {
            agent_id: salesAgent.id,
            product_type: 'sales_agent',
            assigned_date: salesAgent.assigned_date,
            context: salesAgent.agent_context
          };
          salesAgentFound = true;
          salesAgentSource = 'product_agents';
          
          // Update engagement stats in product_agents
          await supabase
            .from('product_agents')
            .update({ 
              last_engagement_at: now.toISOString(),
              replies_received: (salesAgent.replies_received || 0) + 1
            })
            .eq('id', salesAgent.id);

          // Update campaign response counter if linked to campaign
          if (salesAgent.agent_context?.campaign_id) {
            await supabase
              .from('ai_sales_campaign_contacts')
              .update({
                responded: true,
                updated_at: now.toISOString()
              })
              .eq('contact_id', existingContact.id)
              .eq('campaign_id', salesAgent.agent_context.campaign_id)
              .eq('responded', false);
          }
        }
      }

      // Check agent_conversations if not found in product_agents
      if (!salesAgentFound && salesConversation) {
        const expirationDate = new Date(salesConversation.expiration_date);
        const isExpired = now > expirationDate;

        if (!isExpired) {
          console.log('✅ Routing to SALES AGENT from agent_conversations (priority 10)');
          routeToAgent = 'sales_agent';
          agentContext = {
            agent_id: salesConversation.id,
            product_type: 'sales_agent',
            assigned_date: salesConversation.started_at,
            context: salesConversation.key_entities
          };
          salesAgentFound = true;
          salesAgentSource = 'agent_conversations';
          
          // Update engagement stats in agent_conversations
          await supabase
            .from('agent_conversations')
            .update({ 
              last_message_at: now.toISOString(),
              message_count: (salesConversation.message_count || 0) + 1,
              updated_at: now.toISOString()
            })
            .eq('id', salesConversation.id);

          // Update campaign response counter if linked to campaign
          if (salesConversation.key_entities?.campaign_id) {
            await supabase
              .from('ai_sales_campaign_contacts')
              .update({
                responded: true,
                updated_at: now.toISOString()
              })
              .eq('contact_id', existingContact.id)
              .eq('campaign_id', salesConversation.key_entities.campaign_id)
              .eq('responded', false);
          }
        }
      }

      // Step 2: If no sales agent, check for active Product Agent (priority 5-7)
      if (routeToAgent === 'customer_service' && convState?.active_agent_id && convState.product_agents) {
        activeProductAgent = convState.product_agents;
        
        const now = new Date();
        const expirationDate = new Date(activeProductAgent.expiration_date);
        const isExpired = now > expirationDate;
        const isActive = activeProductAgent.status === 'active';
        const isNotCS = activeProductAgent.product_type !== 'customer_service';

        if (isActive && !isExpired && isNotCS) {
          // Use database priority if available, fallback to hardcoded constants
          const dbPriority = convState?.agent_priority;
          const hardcodedPriority = AGENT_PRIORITIES[activeProductAgent.product_type as keyof typeof AGENT_PRIORITIES] || 1;
          const priority = dbPriority || hardcodedPriority;
          
          console.log(`✅ Routing to PRODUCT AGENT: ${activeProductAgent.product_type}`);
          console.log(`   📊 DB Priority: ${dbPriority || 'none'}, Hardcoded: ${hardcodedPriority}, Using: ${priority}`);
          
          routeToAgent = activeProductAgent.product_type;
          agentContext = {
            agent_id: activeProductAgent.id,
            product_type: activeProductAgent.product_type,
            assigned_date: activeProductAgent.assigned_date,
            context: activeProductAgent.agent_context
          };
          
          await supabase
            .from('product_agents')
            .update({ 
              last_engagement_at: now.toISOString(),
              replies_received: (activeProductAgent.replies_received || 0) + 1
            })
            .eq('id', activeProductAgent.id);
          
          await supabase
            .from('conversation_state')
            .update({ last_engagement_at: now.toISOString() })
            .eq('id', convState.id);
        } else if (isExpired) {
          console.log(`Agent ${activeProductAgent.product_type} is expired, routing to customer service`);
          await supabase
            .from('conversation_state')
            .update({ active_agent_id: null })
            .eq('id', convState.id);
        }
      }

      // Step 3: Fallback to Customer Service (priority 2)
      if (routeToAgent === 'customer_service') {
        console.log('ℹ️ No sales/product agent found, routing to CUSTOMER SERVICE (priority 2)');
      }
    } else if (!isInHelpMode && !existingContact) {
      console.log('No existing contact found, routing to customer service');
    }

    // ============================================
    // ROUTING DECISION LOGGING
    // ============================================
    console.log('═══════════════════════════════════════════════');
    console.log('ROUTING DECISION');
    console.log('═══════════════════════════════════════════════');
    console.log('Contact ID:', existingContact?.id);
    console.log('Incoming Message:', body.substring(0, 50));
    console.log('Route To Agent:', routeToAgent);
    console.log('Is In Help Mode:', isInHelpMode);
    console.log('Active Product Agent:', activeProductAgent?.product_type || 'None');
    console.log('Agent Context:', agentContext);
    console.log('═══════════════════════════════════════════════');

    // Store the routing decision in conversation
    await supabase
      .from('conversations')
      .update({ assigned_agent: routeToAgent })
      .eq('id', conversation.id);

    // Determine which AI agent to use
    const agentType = routeToAgent;
    
    // Map agent_type to message_sender enum
    const messageSender = agentType === 'sales_ai' ? 'ai_sales' : 
                          agentType === 'cs_ai' ? 'ai_cs' : 'human_team';

    // Call AI agent to generate response
    console.log('Calling AI agent with:', { conversationId: conversation.id, agentType });
    
    // Format messages correctly for AI agent (reverse to chronological order)
    const formattedMessages = (recentMessages || []).reverse().map(msg => ({
      sender: msg.sender,
      content: msg.body,
      body: msg.body,
      created_at: msg.created_at
    }));
    
    const aiResponse = await supabase.functions.invoke('ai-agent', {
      body: {
        conversationId: conversation.id,
        contactId: existingContact?.id || conversation.contact_id,
        agentType: agentType,
        incomingMessage: body,
        messages: formattedMessages, // ✅ Correct parameter name
        agentContext: agentContext
      },
    });

    console.log('AI agent response:', aiResponse);

    if (aiResponse.error) {
      console.error('AI agent error:', aiResponse.error);
      throw aiResponse.error;
    }

    const { response: aiMessage, needsHandoff } = aiResponse.data || {};

    console.log('Processing AI response:', { aiMessage: aiMessage?.substring(0, 100), needsHandoff });

    if (needsHandoff) {
      console.log('Handoff needed, marking conversation for human review');
      // Mark conversation for human review
      await supabase
        .from('conversations')
        .update({ status: 'needs_human' })
        .eq('id', conversation.id);

      // Store AI message indicating handoff
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        sender: messageSender,
        body: "Thanks for your message. A team member will get back to you shortly.",
        status: 'sent',
      });

      const handoffMessage = 'Thanks for your message. A team member will get back to you shortly.';
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${escapeXml(handoffMessage)}</Message>
        </Response>`,
        { 
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200,
        }
      );
    }

    // Store AI response in database
    console.log('Storing AI message in database...');
    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      direction: 'outbound',
      sender: messageSender,
      body: aiMessage,
      status: 'sent',
    });

    if (insertError) {
      console.error('Error inserting message:', insertError);
      throw insertError;
    }

    console.log('Message stored, returning TwiML response');

    // Send AI response via Twilio
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>${escapeXml(aiMessage)}</Message>
      </Response>`,
      { 
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Twilio webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
