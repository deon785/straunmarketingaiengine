# 📡 API Documentation

## Supabase Client

The app uses **Supabase** as the backend with a custom client wrapper in `lib/supabase.js`.

### Client Initialization

```javascript
import { supabase } from './lib/supabase';

// Already configured with:
// - Persist session
// - Auto-refresh token
// - Realtime parameters
```

---

## Authentication API

### Sign Up

```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: { phone: '+263712345678' },
    emailRedirectTo: 'https://yourapp.com/app'
  }
});
```

### Sign In

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});
```

### Sign Out

```javascript
const { error } = await supabase.auth.signOut();
```

### Get Current User

```javascript
const { data: { user }, error } = await supabase.auth.getUser();
```

### Get Session

```javascript
const { data: { session }, error } = await supabase.auth.getSession();
```

### Reset Password

```javascript
const { error } = await supabase.auth.resetPasswordForEmail('user@example.com', {
  redirectTo: 'https://yourapp.com/reset-password'
});
```

---

## Profiles API

### Get Profile

```javascript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', userId)
  .maybeSingle();
```

### Update Profile

```javascript
const { data, error } = await supabase
  .from('profiles')
  .update({
    location: 'Harare',
    phone_number: '+263712345678',
    is_seller: true,
    seller_setup_completed: true,
    updated_at: new Date().toISOString()
  })
  .eq('user_id', userId);
```

### Upsert Profile

```javascript
const { data, error } = await supabase
  .from('profiles')
  .upsert({
    user_id: userId,
    username: 'john_doe',
    location: 'Harare',
    // ... other fields
  }, { onConflict: 'user_id' });
```

---

## Products API

### List Products

```javascript
// Basic query
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('status', 'active')
  .order('created_at', { ascending: false });

// With filters
let query = supabase.from('products').select('*');
query = query.gte('price', 10);
query = query.lte('price', 100);
query = query.ilike('location', '%Harare%');
const { data, error } = await query;
```

### Search Products

```javascript
const { data, error } = await supabase
  .from('products')
  .select(`
    id,
    name,
    price,
    location,
    description,
    phone_number,
    seller_id,
    created_at,
    image_url,
    profiles:seller_id (
      user_id,
      username,
      location,
      phone_number
    )
  `)
  .ilike('name', '%search_term%')
  .neq('seller_id', userId)
  .limit(50);
```

### Create Product

```javascript
const { data, error } = await supabase
  .from('products')
  .insert([{
    seller_id: userId,
    name: 'Product Name',
    price: 49.99,
    description: 'Product description',
    location: 'Harare',
    phone_number: '+263712345678',
    image_url: 'https://...',
    status: 'active',
    created_at: new Date().toISOString()
  }])
  .select();
```

### Update Product

```javascript
const { data, error } = await supabase
  .from('products')
  .update({
    name: 'New Name',
    price: 59.99,
    updated_at: new Date().toISOString()
  })
  .eq('id', productId);
```

### Increment Views

```javascript
const { error } = await supabase.rpc('increment_product_views', {
  p_product_id: productId
});
```

### Get Similar Products

```javascript
const { data, error } = await supabase
  .from('product_similarity')
  .select(`
    product_id_2,
    similarity_score,
    products:product_id_2 (
      id,
      name,
      price,
      location,
      description,
      image_url
    )
  `)
  .eq('product_id_1', productId)
  .order('similarity_score', { ascending: false })
  .limit(6);
```

---

## Notifications API

### Get Notifications

```javascript
const { data, error } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(50);
```

### Create Notification

```javascript
const { data, error } = await supabase
  .from('notifications')
  .insert([{
    user_id: targetUserId,
    sender_id: currentUserId,
    product_id: productId,
    message: 'New match found!',
    link_type: 'product_match',
    is_read: false,
    created_at: new Date().toISOString()
  }]);
```

### Mark as Read

```javascript
const { error } = await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('id', notificationId);
```

### Mark All as Read

```javascript
const { error } = await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('user_id', userId)
  .eq('is_read', false);
```

---

## Saved Items (Wishlist) API

### Get Saved Items

```javascript
const { data, error } = await supabase
  .from('saved_items')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

### Save Item

```javascript
const { data, error } = await supabase
  .from('saved_items')
  .insert([{
    user_id: userId,
    product_id: productId,
    item_type: 'product',
    product_name: 'Product Name',
    product_price: 49.99,
    product_image: 'https://...',
    seller_location: 'Harare',
    seller_phone: '+263712345678',
    created_at: new Date().toISOString()
  }]);
```

### Remove Saved Item

```javascript
const { error } = await supabase
  .from('saved_items')
  .delete()
  .eq('id', savedItemId);
```

### Check if Saved

```javascript
const { data, error } = await supabase
  .from('saved_items')
  .select('id')
  .eq('user_id', userId)
  .eq('product_id', productId)
  .maybeSingle();
```

---

## Saved Searches API

### Get Saved Searches

```javascript
const { data, error } = await supabase
  .from('saved_searches')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

### Save Search

```javascript
const { data, error } = await supabase
  .from('saved_searches')
  .insert([{
    user_id: userId,
    search_term: 'iPhone',
    min_price: 100,
    max_price: 500,
    location: 'Harare',
    is_active: true,
    created_at: new Date().toISOString()
  }]);
```

### Delete Saved Search

```javascript
const { error } = await supabase
  .from('saved_searches')
  .delete()
  .eq('id', searchId);
```

---

## Referrals API

### Create Referral

```javascript
const { data, error } = await supabase
  .from('referrals')
  .insert([{
    referrer_id: referrerId,
    referred_user_id: referredUserId,
    referral_code: 'ABC123',
    status: 'completed',
    points_earned: 50,
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  }]);
```

### Get Referral Count

```javascript
const { data, error } = await supabase
  .from('referrals')
  .select('id', { count: 'exact' })
  .eq('referrer_id', userId)
  .eq('status', 'completed');
```

### Get Referral Code

```javascript
const { data, error } = await supabase
  .from('profiles')
  .select('referral_code')
  .eq('user_id', userId)
  .maybeSingle();
```

---

## Price Alerts API

### Create Alert

```javascript
const { data, error } = await supabase
  .from('price_alerts')
  .insert([{
    user_id: userId,
    product_id: productId,
    target_price: 50,
    current_price: 100,
    is_active: true,
    created_at: new Date().toISOString()
  }]);
```

### Get Alerts

```javascript
const { data, error } = await supabase
  .from('price_alerts')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true);
```

### Deactivate Alert

```javascript
const { error } = await supabase
  .from('price_alerts')
  .update({ is_active: false })
  .eq('id', alertId);
```

---

## Push Notifications API

### Subscribe to Push

```javascript
const result = await callEdgeFunction('send-push-notifications', {
  action: 'subscribe',
  subscription: pushSubscription,
  userId: userId,
  userAgent: navigator.userAgent
});
```

### Send Notification

```javascript
const result = await callEdgeFunction('send-push-notifications', {
  userId: userId,
  title: 'New Match!',
  body: 'Someone is interested in your product',
  icon: '/pwa-192x192.png',
  url: '/app'
});
```

### Test Notification

```javascript
const registration = await navigator.serviceWorker.ready;
registration.showNotification('Test Notification', {
  body: '✅ Push notifications are working!',
  icon: '/pwa-192x192.png',
  badge: '/pwa-192x192.png',
  vibrate: [200, 100, 200]
});
```

---

## Helper Functions

### queryWithRetry

Retry failed Supabase queries with exponential backoff.

```javascript
const result = await queryWithRetry(async () => {
  return await supabase
    .from('products')
    .select('*')
    .limit(10);
}, 3); // max 3 retries
```

### callEdgeFunction

Call Supabase Edge Function with retry and timeout.

```javascript
const result = await callEdgeFunction('send-notification', {
  userId: userId,
  message: 'Hello!'
}, {
  retries: 3,
  timeout: 15000
});
```

### sendPushNotification

Send push notification with retry logic.

```javascript
const result = await sendPushNotification(userId, {
  title: 'New Notification',
  body: 'You have a new match!',
  url: '/app'
}, {
  retries: 2,
  retryDelay: 2000
});
```

### resilientSelect

Safe select with retry.

```javascript
const { data, error } = await resilientSelect('products', '*', {
  status: 'active',
  seller_id: userId
});
```

---

## Error Response Format

All functions return consistent error objects:

```javascript
// Success
{
  data: [...],
  error: null
}

// Error
{
  data: null,
  error: {
    message: 'Error message',
    code: 'ERROR_CODE',
    details: 'Additional details'
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `42501` | Permission denied (RLS) |
| `23502` | Missing required fields |
| `22P02` | Invalid data type |
| `23505` | Duplicate entry |
| `PGRST116` | No rows returned |
| `401` | Unauthorized (invalid JWT) |
| `404` | Not found |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Contact attempts | 5 | 1 hour |
| Profile setup | 3 | 1 day |
| Save to wishlist | 20 | 1 hour |
| Search queries | 100 | 1 hour |
| Image uploads | 10 | 1 hour |
