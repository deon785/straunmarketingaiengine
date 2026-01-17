// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Import web-push for sending push notifications
import webpush from "npm:web-push@3.6.4"

// Import Supabase client for database access
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Set your VAPID keys (generate these once - keep private key secret!)
// Run: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:deonmahachi8@gmail.com"

// Configure web-push with your VAPID keys
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

// Initialize Supabase client for database access
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log("Push Notification Function initialized - Supports both direct pushes and database webhooks")

Deno.serve(async (req) => {
  // CORS headers for browser requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
  };

  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          service: 'push-notifications',
          supports: ['direct-push', 'database-webhooks'],
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Only allow POST requests for actual functionality
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const body = await req.json();
    console.log('📨 Request received:', {
      type: body.type || 'direct',
      table: body.table || 'N/A',
      timestamp: new Date().toISOString()
    });

    // ==================== HANDLE DATABASE WEBHOOK ====================
    if (body.type === 'INSERT' && body.table === 'notifications') {
      console.log('🔄 Processing database webhook for notification insert');
      
      const notification = body.record;
      console.log('📋 Notification details:', {
        id: notification.id,
        user_id: notification.user_id,
        message_preview: notification.message?.substring(0, 50) + '...'
      });

      // 1. Get user's push subscription from database
      try {
        const { data: subscription, error: subError } = await supabase
          .from('user_push_subscriptions')
          .select('subscription')
          .eq('user_id', notification.user_id)
          .single();

        if (subError || !subscription) {
          console.log('⚠️ No push subscription found for user:', notification.user_id);
          
          // Still return success so webhook doesn't retry
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Notification received but no subscription found',
              notification_id: notification.id,
              action: 'logged_only'
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        console.log('✅ Found subscription for user:', notification.user_id);

        // 2. Prepare notification payload for push
        const pushPayload = {
          title: 'StraunAI Notification',
          body: notification.message || 'You have a new notification',
          icon: '/pwa-192x192.png',
          badge: '/favicon.ico',
          data: {
            notificationId: notification.id,
            url: '/notifications',
            type: 'database_webhook',
            userId: notification.user_id,
            timestamp: new Date().toISOString()
          }
        };

        // 3. Send push notification
        console.log('🚀 Sending push notification...');
        const payloadString = JSON.stringify(pushPayload);
        
        await webpush.sendNotification(subscription.subscription, payloadString);
        
        console.log('✅ Push notification sent successfully for notification:', notification.id);

        // 4. Optional: Mark notification as sent in database
        try {
          await supabase
            .from('notifications')
            .update({ 
              is_read: false,
              sent: true,
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id);
          
          console.log('📝 Notification marked as sent in database');
        } catch (dbError) {
          console.log('⚠️ Could not update notification in database:', dbError.message);
          // Continue anyway - this is non-critical
        }

        // Return success
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Push notification sent via webhook',
            notification_id: notification.id,
            user_id: notification.user_id,
            sent_at: new Date().toISOString()
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      } catch (webhookError) {
        console.error('❌ Error processing webhook:', webhookError);
        
        // Return 200 even on error so Supabase doesn't retry endlessly
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to process webhook',
            message: webhookError.message,
            notification_id: notification?.id
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // ==================== HANDLE DIRECT PUSH REQUEST ====================
    console.log('🎯 Processing direct push request');
    
    const { 
      subscription, 
      title = "StraunAI Notification", 
      body: messageBody, 
      url = "/", 
      icon = "/pwa-192x192.png",
      badge = "/favicon.ico",
      tag,
      data = {}
    } = body;

    // Validate required fields for direct push
    if (!subscription) {
      return new Response(
        JSON.stringify({ error: 'Missing subscription object' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!messageBody) {
      return new Response(
        JSON.stringify({ error: 'Missing notification body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('📤 Sending direct push notification:', {
      title,
      body_preview: messageBody.substring(0, 50) + '...',
      toEndpoint: subscription.endpoint?.substring(0, 50) + '...'
    });

    // Prepare notification payload
    const payload = JSON.stringify({
      title,
      body: messageBody,
      icon,
      badge,
      url,
      tag,
      data: {
        ...data,
        url: url || "/",
        timestamp: new Date().toISOString(),
        source: 'direct_api_call'
      }
    });

    // Send the push notification
    try {
      await webpush.sendNotification(subscription, payload);
      
      console.log('✅ Direct push notification sent successfully');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Push notification sent',
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
      
    } catch (pushError) {
      console.error('❌ Error sending push notification:', pushError);
      
      // Check if subscription is expired/invalid
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        return new Response(
          JSON.stringify({ 
            error: 'Subscription expired or invalid',
            code: 'SUBSCRIPTION_EXPIRED',
            details: pushError.message
          }),
          {
            status: 410,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // For other errors, return 500
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send push notification',
          message: pushError.message,
          stack: pushError.stack
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('💥 Unhandled function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});

// Helper function to validate webhook secret (optional)
function validateWebhookSecret(request: Request): boolean {
  const secret = request.headers.get('X-Webhook-Secret');
  const expectedSecret = Deno.env.get('WEBHOOK_SECRET');
  
  if (!expectedSecret) return true; // No secret required
  if (!secret) return false;
  
  return secret === expectedSecret;
}

/* 
ENVIRONMENT VARIABLES REQUIRED:

1. VAPID Keys (for push notifications):
   VAPID_PUBLIC_KEY=your-public-key-here
   VAPID_PRIVATE_KEY=your-private-key-here
   VAPID_SUBJECT=mailto:deonmahachi8@gmail.com

2. Supabase Database Access:
   SUPABASE_URL=https://mmcwfoqajkfnohbonaqa.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

3. Optional Webhook Security:
   WEBHOOK_SECRET=your-webhook-secret-here

HOW TO TEST:

1. Direct Push Test:
   curl -X POST https://mmcwfoqajkfnohbonaqa.supabase.co/functions/v1/send-push-notifications \
     -H "Content-Type: application/json" \
     -d '{
       "subscription": {
         "endpoint": "https://fcm.googleapis.com/...",
         "keys": {
           "p256dh": "...",
           "auth": "..."
         }
       },
       "title": "Test",
       "body": "Hello World"
     }'

2. Database Webhook Test:
   curl -X POST https://mmcwfoqajkfnohbonaqa.supabase.co/functions/v1/send-push-notifications \
     -H "Content-Type: application/json" \
     -d '{
       "type": "INSERT",
       "table": "notifications",
       "record": {
         "id": "test-id-123",
         "user_id": "user-uuid-here",
         "message": "Test notification",
         "link_type": "test"
       }
     }'

3. Health Check:
   curl https://mmcwfoqajkfnohbonaqa.supabase.co/functions/v1/send-push-notifications
*/