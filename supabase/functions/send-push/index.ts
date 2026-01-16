// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Import web-push for sending push notifications
import webpush from "npm:web-push@3.6.4"

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

console.log("Push Notification Function initialized")

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Parse request body
    const body = await req.json();
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

    // Validate required fields
    if (!subscription) {
      return new Response(
        JSON.stringify({ error: 'Missing subscription object' }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    if (!messageBody) {
      return new Response(
        JSON.stringify({ error: 'Missing notification body' }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    console.log('Sending push notification:', {
      title,
      body: messageBody,
      url,
      toEndpoint: subscription.endpoint.substring(0, 50) + '...'
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
        timestamp: new Date().toISOString()
      }
    });

    // Send the push notification
    try {
      await webpush.sendNotification(subscription, payload);
      
      console.log('Push notification sent successfully');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Push notification sent',
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
      
    } catch (pushError) {
      console.error('Error sending push notification:', pushError);
      
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
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }
      
      throw pushError;
    }

  } catch (error) {
    console.error('Function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send push notification',
        message: error.message,
        stack: error.stack
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

/* 
To invoke locally:

1. Generate VAPID keys:
   npx web-push generate-vapid-keys --json

2. Set environment variables (or replace in code):
   export VAPID_PUBLIC_KEY="your-public-key"
   export VAPID_PRIVATE_KEY="your-private-key"
   export VAPID_SUBJECT="mailto:your-email@example.com"

3. Run supabase start:
   supabase start

4. Make a test request:
   curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-push' \
     --header 'Authorization: Bearer YOUR_ANON_KEY' \
     --header 'Content-Type: application/json' \
     --data '{
       "subscription": {
         "endpoint": "https://fcm.googleapis.com/fcm/send/...",
         "keys": {
           "p256dh": "...",
           "auth": "..."
         }
       },
       "title": "Test Notification",
       "body": "Hello from StraunAI!",
       "url": "https://your-app.com",
       "icon": "/pwa-192x192.png"
     }'
*/