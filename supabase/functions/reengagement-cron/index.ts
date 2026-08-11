// supabase/functions/reengagement-cron/index.ts

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from "npm:web-push@3.6.4"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:your-email@example.com"

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

const CONFIG = {
  DRY_RUN: Deno.env.get('DRY_RUN') === 'true',
  BATCH_SIZE: 100,
  NOTIFICATION_TITLES: {
    1: "👋 We Miss You!",
    2: "💫 Come Back to StraunAI!",
    3: "🌟 Your Last Chance!"
  },
  NOTIFICATION_MESSAGES: {
    1: "It's been 10 days since your last visit. Check out what's new!",
    2: "We haven't seen you in a while. New deals and connections are waiting!",
    3: "This is your final reminder. Don't miss out on great opportunities!"
  }
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({ 
          status: 'healthy', 
          service: 'reengagement-cron',
          dry_run: CONFIG.DRY_RUN,
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await processReengagementNotifications();
    
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Error in reengagement cron:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processReengagementNotifications() {
  console.log('🚀 Starting reengagement notification cron...');
  console.log(`🔧 DRY RUN: ${CONFIG.DRY_RUN ? 'YES' : 'NO'}`);
  
  const startTime = Date.now();
  const results = {
    processed: 0,
    sent: 0,
    errors: 0,
    skipped: 0,
    details: []
  };

  try {
    // ✅ Using existing last_activity_at column
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        last_activity_at,
        last_reengagement_sent_at,
        reengagement_attempts,
        reengagement_stopped
      `)
      .eq('reengagement_stopped', false)
      .not('last_activity_at', 'is', null)
      .order('last_activity_at', { ascending: true });

    if (userError) {
      throw new Error(`Failed to fetch users: ${userError.message}`);
    }

    console.log(`👥 Found ${users?.length || 0} users to check`);

    if (!users || users.length === 0) {
      return {
        success: true,
        message: 'No users to process',
        processed: 0,
        sent: 0,
        errors: 0,
        skipped: 0,
        duration_ms: Date.now() - startTime
      };
    }

    // Process users in batches
    for (let i = 0; i < users.length; i += CONFIG.BATCH_SIZE) {
      const batch = users.slice(i, i + CONFIG.BATCH_SIZE);
      
      await Promise.allSettled(
        batch.map(user => processUser(user, results))
      );
    }

    // Stop permanently inactive users
    await stopPermanentlyInactiveUsers();

  } catch (error) {
    console.error('❌ Fatal error in reengagement cron:', error);
    results.errors++;
  }

  const duration = Date.now() - startTime;
  console.log(`✅ Reengagement cron completed in ${duration}ms`);
  console.log(`📊 Results: ${results.sent} sent, ${results.errors} errors, ${results.skipped} skipped`);

  return {
    success: true,
    ...results,
    duration_ms: duration,
    dry_run: CONFIG.DRY_RUN,
    timestamp: new Date().toISOString()
  };
}

async function processUser(user: any, results: any) {
  try {
    const daysInactive = getDaysInactive(user.last_activity_at);
    
    // Skip if less than 10 days inactive
    if (daysInactive < 10) {
      results.skipped++;
      return;
    }

    // Determine which attempt to send
    const attemptNumber = determineAttemptNumber(
      daysInactive,
      user.reengagement_attempts || 0,
      user.last_reengagement_sent_at
    );

    if (!attemptNumber) {
      results.skipped++;
      return;
    }

    // Check if user has push subscription
    const hasSubscription = await checkUserPushSubscription(user.user_id);
    if (!hasSubscription) {
      console.log(`⏭️ User ${user.user_id} has no push subscription - skipping`);
      results.skipped++;
      return;
    }

    // Check if user opted out of notifications
    const hasOptedOut = await checkUserOptedOut(user.user_id);
    if (hasOptedOut) {
      console.log(`⏭️ User ${user.user_id} has opted out - skipping`);
      results.skipped++;
      return;
    }

    // Send notification
    const sentResult = await sendReengagementNotification(
      user.user_id,
      attemptNumber,
      daysInactive
    );

    if (sentResult.success) {
      results.sent++;
      await updateUserTracking(user.user_id, attemptNumber, true);
      
      results.details.push({
        user_id: user.user_id,
        attempt: attemptNumber,
        days_inactive: daysInactive,
        status: 'sent'
      });
    } else {
      results.errors++;
      results.details.push({
        user_id: user.user_id,
        attempt: attemptNumber,
        days_inactive: daysInactive,
        status: 'error',
        error: sentResult.error
      });
    }

    results.processed++;

    // Rate limiting
    if (!CONFIG.DRY_RUN) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

  } catch (error) {
    console.error(`❌ Error processing user ${user.user_id}:`, error);
    results.errors++;
  }
}

function getDaysInactive(lastActivityAt: string): number {
  if (!lastActivityAt) return 0;
  const lastActive = new Date(lastActivityAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastActive.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function determineAttemptNumber(
  daysInactive: number,
  currentAttempts: number,
  lastSentAt: string | null
): number | null {
  // Already sent 3 times
  if (currentAttempts >= 3) return null;

  // Attempt 1: 10-29 days
  if (daysInactive >= 10 && daysInactive < 30 && currentAttempts === 0) {
    return 1;
  }
  
  // Attempt 2: 30-59 days
  if (daysInactive >= 30 && daysInactive < 60 && currentAttempts === 1) {
    return 2;
  }
  
  // Attempt 3: 60+ days
  if (daysInactive >= 60 && currentAttempts === 2) {
    return 3;
  }

  return null;
}

async function checkUserPushSubscription(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error checking subscription:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in checkUserPushSubscription:', error);
    return false;
  }
}

async function checkUserOptedOut(userId: string): Promise<boolean> {
  try {
    // Check if user has opted out of push notifications
    const { data, error } = await supabase
      .from('profiles')
      .select('push_notifications_enabled')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error checking opt-out:', error);
      return false;
    }

    // If column doesn't exist or is false, they haven't opted out
    return data?.push_notifications_enabled === false;
  } catch (error) {
    // Column might not exist, treat as not opted out
    return false;
  }
}

async function sendReengagementNotification(
  userId: string,
  attemptNumber: number,
  daysInactive: number
): Promise<{ success: boolean; error?: string }> {
  if (CONFIG.DRY_RUN) {
    console.log(`🔬 DRY RUN: Would send attempt ${attemptNumber} to user ${userId}`);
    return { success: true };
  }

  try {
    const { data: subscription, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (subError || !subscription) {
      return { 
        success: false, 
        error: 'No active subscription found' 
      };
    }

    const title = CONFIG.NOTIFICATION_TITLES[attemptNumber as keyof typeof CONFIG.NOTIFICATION_TITLES];
    const body = CONFIG.NOTIFICATION_MESSAGES[attemptNumber as keyof typeof CONFIG.NOTIFICATION_MESSAGES];
    
    const personalizedBody = `${body} (${daysInactive} days inactive)`;

    const payload = JSON.stringify({
      title,
      body: personalizedBody,
      icon: '/pwa-192x192.png',
      badge: '/favicon.ico',
      url: '/',
      data: {
        type: 'reengagement',
        attempt: attemptNumber,
        days_inactive: daysInactive,
        timestamp: new Date().toISOString(),
        action: 'open_app'
      }
    });

    await webpush.sendNotification(subscription.subscription, payload);

    await logNotification(userId, attemptNumber, daysInactive, true);

    console.log(`✅ Sent reengagement attempt ${attemptNumber} to user ${userId}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ Failed to send notification to user ${userId}:`, error);
    
    await logNotification(userId, attemptNumber, daysInactive, false, error.message);
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

async function logNotification(
  userId: string,
  attemptNumber: number,
  daysInactive: number,
  delivered: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from('reengagement_notifications')
      .insert({
        user_id: userId,
        attempt_number: attemptNumber,
        days_inactive: daysInactive,
        delivered,
        error_message: errorMessage || null,
        sent_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log notification:', error);
  }
}

async function updateUserTracking(
  userId: string,
  attemptNumber: number,
  sent: boolean
): Promise<void> {
  if (CONFIG.DRY_RUN) {
    console.log(`🔬 DRY RUN: Would update user ${userId} to attempt ${attemptNumber}`);
    return;
  }

  try {
    if (sent) {
      await supabase
        .from('profiles')
        .update({
          last_reengagement_sent_at: new Date().toISOString(),
          reengagement_attempts: attemptNumber
        })
        .eq('user_id', userId);
    }
  } catch (error) {
    console.error('Failed to update user tracking:', error);
  }
}

async function stopPermanentlyInactiveUsers(): Promise<void> {
  if (CONFIG.DRY_RUN) {
    console.log('🔬 DRY RUN: Would stop permanently inactive users');
    return;
  }

  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('user_id, last_activity_at, reengagement_attempts')
      .eq('reengagement_stopped', false)
      .gte('reengagement_attempts', 3)
      .not('last_activity_at', 'is', null);

    if (error) {
      console.error('Error finding permanently inactive users:', error);
      return;
    }

    for (const user of users || []) {
      const daysInactive = getDaysInactive(user.last_activity_at);
      
      if (daysInactive >= 60) {
        await supabase
          .from('profiles')
          .update({ reengagement_stopped: true })
          .eq('user_id', user.user_id);
        
        console.log(`🛑 Stopped notifications for permanently inactive user ${user.user_id}`);
      }
    }
  } catch (error) {
    console.error('Error stopping permanently inactive users:', error);
  }
}