import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe credentials not configured');
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);

    console.log('Stripe webhook event:', event.type);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const contactId = session.metadata?.contact_id;
        const tierId = session.metadata?.tier_id;

        if (!contactId || !tierId) {
          console.error('Missing contact_id or tier_id in session metadata');
          break;
        }

        console.log(`Creating subscription for contact ${contactId}, tier ${tierId}`);

        // Get tier details
        const { data: tier } = await supabase
          .from('subscription_tiers')
          .select('*')
          .eq('id', tierId)
          .single();

        // Create or update subscription
        const { error: upsertError } = await supabase
          .from('user_subscriptions')
          .upsert({
            contact_id: contactId,
            tier_id: tierId,
            stripe_subscription_id: session.subscription,
            stripe_customer_id: session.customer,
            status: 'active',
            credits_remaining: tier?.credits_per_month,
            credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            trial_used: true
          }, {
            onConflict: 'contact_id'
          });

        if (upsertError) {
          console.error('Failed to create subscription:', upsertError);
        }

        // Update contact
        await supabase
          .from('contacts')
          .update({ subscription_status: 'active' })
          .eq('id', contactId);

        console.log('✅ Subscription created successfully');
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        console.log(`Payment succeeded for customer ${customerId}`);

        // Find subscription by stripe customer ID
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('*, subscription_tiers(*)')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!subscription) {
          console.error('Subscription not found for customer:', customerId);
          break;
        }

        // Reset monthly credits
        if (subscription.subscription_tiers.credits_per_month !== null) {
          const creditsBefore = subscription.credits_remaining;
          const creditsAfter = subscription.subscription_tiers.credits_per_month;

          await supabase
            .from('user_subscriptions')
            .update({ 
              credits_remaining: creditsAfter,
              credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              status: 'active'
            })
            .eq('id', subscription.id);

          // Log the reset
          await supabase.from('analysis_credits_log').insert({
            contact_id: subscription.contact_id,
            subscription_id: subscription.id,
            credits_before: creditsBefore,
            credits_after: creditsAfter,
            credits_used: 0,
            action_type: 'monthly_reset'
          });

          console.log(`✅ Credits reset: ${creditsBefore} → ${creditsAfter}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        console.log(`Subscription cancelled for customer ${customerId}`);

        // Update subscription status
        await supabase
          .from('user_subscriptions')
          .update({ status: 'cancelled' })
          .eq('stripe_customer_id', customerId);

        // Update contact
        const { data: userSub } = await supabase
          .from('user_subscriptions')
          .select('contact_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (userSub) {
          await supabase
            .from('contacts')
            .update({ subscription_status: 'cancelled' })
            .eq('id', userSub.contact_id);
        }

        console.log('✅ Subscription cancelled');
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
