import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    
    // Normalize phone number for matching (remove spaces and special chars except +)
    const normalizePhone = (phone: string) => phone.replace(/[\s\-\(\)]/g, '');

    console.log('Incoming SMS:', { from, body, messageSid });

    // Check for opt-out keywords
    const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT'];
    const isOptOut = optOutKeywords.some(keyword => 
      body.toUpperCase().includes(keyword)
    );

    // Find existing contact by phone number (try both normalized and original)
    let { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone_number', from)
      .maybeSingle();
    
    // If not found, try with normalized phone number matching
    if (!existingContact) {
      const { data: allContacts } = await supabase
        .from('contacts')
        .select('*');
      
      existingContact = allContacts?.find(c => 
        c.phone_number && normalizePhone(c.phone_number) === normalizePhone(from)
      ) || null;
    }

    // Find or create conversation
    let { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', from)
      .maybeSingle();

    if (!conversation) {
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          phone_number: from,
          contact_id: existingContact?.id || null,
          contact_name: existingContact?.full_name || null,
          status: isOptOut ? 'opted_out' : 'active',
          last_message_at: new Date().toISOString(),
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
      
      if (existingContact && !conversation.contact_id) {
        updates.contact_id = existingContact.id;
        updates.contact_name = existingContact.full_name;
      }
      
      if (isOptOut) {
        updates.status = 'opted_out';
      }
      
      await supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversation.id);
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
    // HELP COMMAND OVERRIDE - Always route to customer service
    // ============================================
    const isHelpCommand = body.trim().toUpperCase() === 'HELP' || 
                          body.trim().toUpperCase() === '/HELP' ||
                          body.trim().toLowerCase().startsWith('help ');

    let routeToAgent = 'customer_service'; // Default to Casey
    let activeProductAgent = null;
    let agentContext = null;

    if (isHelpCommand && existingContact) {
      console.log('📞 HELP command detected - forcing customer service routing');
      
      // Find or create customer service agent
      let { data: csAgent } = await supabase
        .from('product_agents')
        .select('*')
        .eq('contact_id', existingContact.id)
        .eq('product_type', 'customer_service')
        .eq('status', 'active')
        .maybeSingle();
      
      if (!csAgent) {
        // Create customer service agent if doesn't exist
        const { data: newCSAgent } = await supabase
          .from('product_agents')
          .insert({
            contact_id: existingContact.id,
            product_type: 'customer_service',
            status: 'active',
            direction: 'inbound',
            expiration_date: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 100 years
            agent_context: { help_requested: true }
          })
          .select()
          .single();
        
        csAgent = newCSAgent;
      }
      
      // Temporarily override routing to customer service (don't change active_agent_id)
      routeToAgent = 'customer_service';
      agentContext = {
        agent_id: csAgent?.id,
        product_type: 'customer_service',
        context: { help_requested: true, temporary_override: true }
      };
      
      console.log('✅ Routing to customer service (temporary override for HELP)');
    }

    // ============================================
    // INTELLIGENT MESSAGE ROUTING LOGIC
    // ============================================
    
    // Only proceed with normal routing if NOT a help command override
    if (!isHelpCommand && existingContact) {
      // Look up conversation state to find active agent
      const { data: convState } = await supabase
        .from('conversation_state')
        .select('*, product_agents!conversation_state_active_agent_id_fkey(*)')
        .eq('contact_id', existingContact.id)
        .maybeSingle();

      if (convState?.active_agent_id && convState.product_agents) {
        activeProductAgent = convState.product_agents;
        
        // Check if agent is still active and not expired
        const now = new Date();
        const expirationDate = new Date(activeProductAgent.expiration_date);
        const isExpired = now > expirationDate;
        const isActive = activeProductAgent.status === 'active';

        if (isActive && !isExpired) {
          // Route to active product agent
          routeToAgent = activeProductAgent.product_type;
          agentContext = {
            agent_id: activeProductAgent.id,
            product_type: activeProductAgent.product_type,
            assigned_date: activeProductAgent.assigned_date,
            context: activeProductAgent.agent_context
          };
          
          console.log(`Routing to active product agent: ${routeToAgent}`);
          
          // Update last_engagement_at for both agent and conversation state
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
        } else {
          console.log(`Agent ${activeProductAgent.product_type} is expired/inactive, routing to customer service`);
          routeToAgent = 'customer_service';
          
          // Clear active agent if expired
          if (isExpired) {
            await supabase
              .from('conversation_state')
              .update({ active_agent_id: null })
              .eq('id', convState.id);
          }
        }
      } else {
        console.log('No active product agent found, routing to customer service');
      }
    } else if (!isHelpCommand) {
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
    console.log('Is Help Override:', isHelpCommand || false);
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
