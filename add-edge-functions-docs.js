// add-edge-functions-docs.js
import fs from 'fs';
import path from 'path';

const docsDir = path.join(process.cwd(), 'docs');

const edgeFunctionsContent = `# ⚡ Edge Functions Documentation

## Overview

The app uses **Supabase Edge Functions** (Deno-based) for serverless backend operations. These functions handle:

- User management (delete user)
- Daily polling for matches
- Daily deals rotation
- Push notifications (web)

---

## Function 1: delete-user

### Purpose
Admin function to delete a user from the system (both auth and profile).

### Endpoint
\`\`\`
POST /functions/v1/delete-user
\`\`\`

### Request Body
\`\`\`json
{
  "userId": "uuid-of-user-to-delete"
}
\`\`\`

### Response
\`\`\`json
// Success
{
  "success": true
}

// Error
{
  "error": "Error message here"
}
\`\`\`

### Security
- Requires \`SUPABASE_SERVICE_ROLE_KEY\` in environment
- Should be protected by admin authentication

### Usage Example
\`\`\`javascript
// Call from client
const { data, error } = await supabase.functions.invoke('delete-user', {
  body: { userId: 'user-uuid-here' }
});

if (error) {
  console.error('Delete failed:', error);
} else {
  console.log('User deleted:', data);
}
\`\`\`

### Environment Variables Required
\`\`\`env
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
\`\`\`

---

## Function 2: daily-poll

### Purpose
Daily polling function that:
1. Finds unread notifications from the last 24 hours
2. Identifies new products
3. Matches products with wishlist items
4. Creates match notifications

### Endpoint
\`\`\`
POST /functions/v1/daily-poll
\`\`\`

### Request Body
No body required (runs as scheduled job).

### Response
\`\`\`json
{
  "success": true,
  "count": 5,
  "notifications": [...],
  "stats": {
    "newProducts": 12,
    "wishlistItems": 45,
    "matchesFound": 8,
    "unreadNotifications": 5
  }
}
\`\`\`

### What It Does

1. **Gets unread notifications** from last 24 hours
   \`\`\`sql
   SELECT * FROM notifications 
   WHERE status = 'unread' 
   AND created_at >= NOW() - INTERVAL '24 hours'
   \`\`\`

2. **Gets new products** from last 24 hours
   \`\`\`sql
   SELECT * FROM products 
   WHERE created_at >= NOW() - INTERVAL '24 hours'
   \`\`\`

3. **Gets wishlist items** for all users
   \`\`\`sql
   SELECT * FROM wishlist
   \`\`\`

4. **Matches new products with wishlist items**
   - Product name contains wishlist query
   - Product price is within min/max range

5. **Creates notifications** for matches

### Scheduling
Should be scheduled to run **daily** (e.g., at midnight or 6 AM).

### Usage Example
\`\`\`javascript
// Call from client (or via cron)
const { data, error } = await supabase.functions.invoke('daily-poll');

console.log('Matches found:', data.stats.matchesFound);
console.log('Notifications created:', data.count);
\`\`\`

### Environment Variables Required
\`\`\`env
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
\`\`\`

### Cron Schedule (Supabase)
\`\`\`bash
# In Supabase Dashboard → Edge Functions → Schedule
0 0 * * *  # Every day at midnight
\`\`\`

---

## Function 3: rotate-daily-deals

### Purpose
Rotates daily deals and notifies users about new deals.

### Endpoint
\`\`\`
POST /functions/v1/rotate-daily-deals
\`\`\`

### Request Body
No body required (runs as scheduled job).

### Response
\`\`\`json
{
  "success": true,
  "data": { ... },
  "deals_count": 8
}
\`\`\`

### What It Does

1. **Calls database function** \`rotate_daily_deals()\`
   - Rotates active deals
   - Updates start/end times

2. **Fetches new deals**
   \`\`\`sql
   SELECT * FROM daily_deals
   WHERE is_active = true
   AND start_time >= NOW()
   \`\`\`

3. **Notifies eligible users**
   - Gets active users (limit 100)
   - Creates bulk notifications (batch size 50)

### Database Function Required
\`\`\`sql
CREATE OR REPLACE FUNCTION rotate_daily_deals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deactivate old deals
  UPDATE daily_deals 
  SET is_active = false 
  WHERE end_time < NOW();
  
  -- Activate new deals
  UPDATE daily_deals 
  SET is_active = true 
  WHERE start_time <= NOW() 
  AND end_time >= NOW();
  
  RETURN jsonb_build_object(
    'success', true,
    'timestamp', NOW()
  );
END;
$$;
\`\`\`

### Scheduling
Should be scheduled to run **daily** (e.g., at 6 AM).

### Usage Example
\`\`\`javascript
// Call from client (or via cron)
const { data, error } = await supabase.functions.invoke('rotate-daily-deals');

console.log('Deals rotated:', data.deals_count);
\`\`\`

### Environment Variables Required
\`\`\`env
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
\`\`\`

---

## Function 4: send-push-notifications

### Purpose
Complete push notification service with multiple capabilities:
- Direct push notifications
- Database webhook handling
- Subscribe/unsubscribe management
- Health checks

### Endpoint
\`\`\`
POST /functions/v1/send-push-notifications
GET /functions/v1/send-push-notifications  (health check)
\`\`\`

### Request Types

#### 1. Health Check (GET)
\`\`\`bash
GET /functions/v1/send-push-notifications
\`\`\`

Response:
\`\`\`json
{
  "status": "healthy",
  "service": "push-notifications",
  "supports": ["direct-push", "database-webhooks"],
  "timestamp": "2025-01-01T00:00:00.000Z"
}
\`\`\`

#### 2. Subscribe (POST)
\`\`\`json
{
  "action": "subscribe",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "userId": "user-uuid-here",
  "userAgent": "Mozilla/5.0..."
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "message": "Successfully subscribed to push notifications",
  "userId": "user-uuid-here",
  "isNew": true,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
\`\`\`

#### 3. Unsubscribe (POST)
\`\`\`json
{
  "action": "unsubscribe",
  "userId": "user-uuid-here"
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "message": "Successfully unsubscribed from push notifications",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
\`\`\`

#### 4. Direct Push (POST)
\`\`\`json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "title": "Test Notification",
  "body": "Hello World!",
  "url": "/app",
  "icon": "/pwa-192x192.png",
  "badge": "/favicon.ico",
  "tag": "test-tag",
  "data": { "custom": "data" }
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "message": "Push notification sent",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
\`\`\`

#### 5. Database Webhook (POST)
\`\`\`json
{
  "type": "INSERT",
  "table": "notifications",
  "record": {
    "id": "uuid-here",
    "user_id": "user-uuid-here",
    "message": "New match found!",
    "link_type": "product_match"
  }
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "message": "Push notification sent via webhook",
  "notification_id": "uuid-here",
  "user_id": "user-uuid-here",
  "sent_at": "2025-01-01T00:00:00.000Z"
}
\`\`\`

### Database Webhook Setup

In Supabase Dashboard:
1. Go to **Database → Webhooks**
2. Create webhook for \`notifications\` table
3. Event: **INSERT**
4. URL: \`/functions/v1/send-push-notifications\`
5. Headers:
   \`\`\`
   Content-Type: application/json
   \`\`\`
6. Body: \`\`\`json
   {
     "type": "{{ event }}",
     "table": "{{ table }}",
     "record": "{{ record }}"
   }
   \`\`\`

### VAPID Key Generation

Generate VAPID keys for push notifications:

\`\`\`bash
# Install web-push globally
npm install -g web-push

# Generate keys
web-push generate-vapid-keys

# Output:
# Public Key: YOUR_PUBLIC_KEY
# Private Key: YOUR_PRIVATE_KEY
\`\`\`

### Environment Variables Required
\`\`\`env
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:deonmahachi8@gmail.com
\`\`\`

### Testing

#### Test Health Check
\`\`\`bash
curl https://your-project.supabase.co/functions/v1/send-push-notifications
\`\`\`

#### Test Direct Push
\`\`\`bash
curl -X POST https://your-project.supabase.co/functions/v1/send-push-notifications \\
  -H "Content-Type: application/json" \\
  -d '{
    "subscription": {
      "endpoint": "your-endpoint-here",
      "keys": {
        "p256dh": "your-p256dh-here",
        "auth": "your-auth-here"
      }
    },
    "title": "Test",
    "body": "Hello from Edge Function!"
  }'
\`\`\`

#### Test Subscription
\`\`\`bash
curl -X POST https://your-project.supabase.co/functions/v1/send-push-notifications \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "subscribe",
    "userId": "user-uuid-here",
    "subscription": {
      "endpoint": "your-endpoint-here",
      "keys": {
        "p256dh": "your-p256dh-here",
        "auth": "your-auth-here"
      }
    }
  }'
\`\`\`

### Error Handling

| Status Code | Meaning | Action |
|-------------|---------|--------|
| 200 | Success | Proceed |
| 400 | Bad Request | Check payload |
| 410 | Subscription Expired | Re-subscribe |
| 500 | Server Error | Retry later |

### Push Notification Payload Schema

\`\`\`typescript
interface PushPayload {
  title: string;          // Notification title
  body: string;           // Notification body text
  icon?: string;          // Icon URL
  badge?: string;         // Badge icon URL  
  url?: string;           // URL to navigate to on click
  tag?: string;           // Group ID for replacing notifications
  data?: {
    notificationId?: string;
    url?: string;
    type?: string;
    userId?: string;
    timestamp?: string;
    [key: string]: any;
  };
}
\`\`\`

---

## Deployment Instructions

### Deploy All Functions

\`\`\`bash
# Deploy a specific function
supabase functions deploy delete-user
supabase functions deploy daily-poll
supabase functions deploy rotate-daily-deals
supabase functions deploy send-push-notifications

# Deploy all functions
supabase functions deploy --all
\`\`\`

### Set Environment Variables

In Supabase Dashboard:
1. Go to **Edge Functions**
2. Select each function
3. Click **Settings** → **Environment Variables**
4. Add required variables

### Set Cron Schedules

For \`daily-poll\` and \`rotate-daily-deals\`:

In Supabase Dashboard:
1. Go to **Edge Functions**
2. Select the function
3. Click **Schedule**
4. Add cron expression:
   - \`0 0 * * *\` (Midnight daily)
   - \`0 6 * * *\` (6 AM daily)

---

## Troubleshooting

### "Missing environment variable"
Ensure all required env vars are set in Supabase Dashboard.

### "Subscription expired"
User needs to re-subscribe (handle 410 status code).

### "Function timeout"
- Check function execution time
- Optimize database queries
- Reduce batch sizes for notifications

### "Webhook not firing"
- Verify webhook configuration
- Check table name and event
- Test with Supabase CLI

---

## Logging

Each function logs:
- Request timestamp
- Processing steps
- Success/failure counts
- Error details

View logs in Supabase Dashboard → Edge Functions → Logs.

---

## Security Considerations

1. **Service Role Key**: Keep private, never expose to client
2. **VAPID Keys**: Keep private, required for push notifications
3. **Webhook Secret**: Optional, can validate in function
4. **Rate Limiting**: Implement in function for public endpoints
5. **CORS**: Configured for all origins (customize as needed)

---

## Related Documentation

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [VAPID Keys](https://web.dev/articles/push-notifications-web-push-protocol)
- [Deno Runtime](https://deno.land/manual)
`;

fs.writeFileSync(path.join(docsDir, 'EDGE_FUNCTIONS.md'), edgeFunctionsContent);
console.log('✅ Created: docs/EDGE_FUNCTIONS.md');
console.log('\n🎉 Edge Functions documentation complete!');