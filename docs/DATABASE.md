# 🗄️ Database Schema

## Overview

The app uses **PostgreSQL** managed by **Supabase**. The database is designed for a social marketplace with buyer/seller matching, real-time notifications, and analytics.

---

## Table Definitions

### 1. profiles

User profiles with roles, settings, and preferences.

```sql
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT,
  phone_number TEXT,
  location TEXT,
  interests JSONB DEFAULT '[]',
  is_seller BOOLEAN DEFAULT false,
  is_buyer BOOLEAN DEFAULT false,
  seller_setup_completed BOOLEAN DEFAULT false,
  buyer_setup_completed BOOLEAN DEFAULT false,
  referral_code TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_location ON profiles(location);
CREATE INDEX idx_profiles_is_seller ON profiles(is_seller);
CREATE INDEX idx_profiles_is_buyer ON profiles(is_buyer);
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);
```

**Fields:**
- `user_id`: Primary key, links to auth.users
- `username`: Display name
- `email`: User email
- `phone_number`: Contact number (international format)
- `location`: City/area
- `interests`: JSON array of product interests (buyers)
- `is_seller`: True for seller mode
- `is_buyer`: True for buyer mode
- `seller_setup_completed`: Seller setup complete
- `buyer_setup_completed`: Buyer setup complete
- `referral_code`: Unique code for referrals
- `is_active`: Soft delete flag
- `created_at`: Timestamp
- `updated_at`: Timestamp

---

### 2. products

Product listings created by sellers.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  description TEXT,
  location TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'inactive')),
  views INTEGER DEFAULT 0,
  sold BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_location ON products(location);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at);
```

**Fields:**
- `id`: Primary key
- `seller_id`: Reference to profiles
- `name`: Product name (max 200 chars)
- `price`: Price in USD (max 999999.99)
- `description`: Product description (max 1000 chars)
- `location`: Seller's location
- `phone_number`: Seller's contact
- `image_url`: Product image URL
- `status`: active | sold | inactive
- `views`: View count
- `sold`: Flag for sold status
- `created_at`: Timestamp
- `updated_at`: Timestamp

---

### 3. notifications

User notifications for matches, messages, and alerts.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(user_id),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  link_type TEXT,
  is_read BOOLEAN DEFAULT false,
  buyer_phone TEXT,
  product_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

**Fields:**
- `id`: Primary key
- `user_id`: Recipient
- `sender_id`: Who triggered the notification
- `product_id`: Related product
- `message`: Notification text
- `link_type`: Type of notification (search_match, product_match, etc.)
- `is_read`: Read status
- `buyer_phone`: Buyer's phone (for matching)
- `product_image`: Product image (for display)
- `created_at`: Timestamp

---

### 4. saved_items (Wishlist)

Items saved by users to their wishlist.

```sql
CREATE TABLE saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  prospect_id UUID,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('product', 'prospect', 'notification')),
  product_name TEXT,
  product_price NUMERIC(10,2),
  product_image TEXT,
  seller_location TEXT,
  seller_phone TEXT,
  prospect_email TEXT,
  prospect_phone TEXT,
  interested_in TEXT,
  notification_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_saved_items_user_id ON saved_items(user_id);
CREATE INDEX idx_saved_items_item_type ON saved_items(item_type);
CREATE INDEX idx_saved_items_notification_id ON saved_items(notification_id);
```

**Fields:**
- `id`: Primary key
- `user_id`: User who saved
- `product_id`: Product ID (if product type)
- `prospect_id`: Prospect ID (if prospect type)
- `item_type`: product | prospect
- `product_name`: Snapshot of product name
- `product_price`: Snapshot of product price
- `product_image`: Snapshot of product image
- `seller_location`: Snapshot of seller location
- `seller_phone`: Snapshot of seller phone
- `prospect_email`: Prospect email (snapshot)
- `prospect_phone`: Prospect phone (snapshot)
- `interested_in`: What prospect is interested in
- `created_at`: Timestamp

---

### 5. saved_searches

Saved search queries for monitoring.

```sql
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  search_term TEXT NOT NULL,
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_term ON saved_searches(search_term);
```

---

### 6. referrals

Referral tracking for the referral program.

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  points_earned INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referral_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);
```

---

### 7. referral_rewards

Points earned from referrals.

```sql
CREATE TABLE referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
  points_earned INTEGER NOT NULL CHECK (points_earned >= 0),
  reward_type TEXT CHECK (reward_type IN ('referral', 'signup_bonus', 'daily_deal')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_referral_rewards_user_id ON referral_rewards(user_id);
```

---

### 8. price_alerts

Price drop alerts for products.

```sql
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_price NUMERIC(10,2) NOT NULL,
  current_price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX idx_price_alerts_product_id ON price_alerts(product_id);
CREATE INDEX idx_price_alerts_active ON price_alerts(is_active);
```

---

### 9. push_subscriptions

Push notification subscriptions for web.

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  device_info TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
```

---

### 10. searches

Search analytics.

```sql
CREATE TABLE searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  seller_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  product_name TEXT,
  search_type TEXT CHECK (search_type IN ('product', 'prospect')),
  prospects_found INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_searches_buyer_id ON searches(buyer_id);
CREATE INDEX idx_searches_seller_id ON searches(seller_id);
CREATE INDEX idx_searches_created_at ON searches(created_at);
```

---

### 11. feedback

User feedback submissions.

```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  feedback_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
```

---

### 12. product_similarity

Product similarity recommendations (optional).

```sql
CREATE TABLE product_similarity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id_1 UUID REFERENCES products(id) ON DELETE CASCADE,
  product_id_2 UUID REFERENCES products(id) ON DELETE CASCADE,
  similarity_score NUMERIC(3,2) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id_1, product_id_2)
);

-- Indexes
CREATE INDEX idx_similarity_product_1 ON product_similarity(product_id_1);
CREATE INDEX idx_similarity_product_2 ON product_similarity(product_id_2);
CREATE INDEX idx_similarity_score ON product_similarity(similarity_score);
```

---

## Row Level Security (RLS) Policies

### Profiles

```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Products

```sql
-- Anyone can read active products
CREATE POLICY "Anyone can read active products"
  ON products FOR SELECT
  USING (status = 'active');

-- Sellers can read their own products
CREATE POLICY "Sellers can read own products"
  ON products FOR SELECT
  USING (auth.uid() = seller_id);

-- Sellers can insert products
CREATE POLICY "Sellers can insert products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own products
CREATE POLICY "Sellers can update own products"
  ON products FOR UPDATE
  USING (auth.uid() = seller_id);

-- Sellers can delete their own products
CREATE POLICY "Sellers can delete own products"
  ON products FOR DELETE
  USING (auth.uid() = seller_id);
```

### Notifications

```sql
-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
```

### Saved Items

```sql
-- Users can read their own saved items
CREATE POLICY "Users can read own saved items"
  ON saved_items FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own saved items
CREATE POLICY "Users can insert own saved items"
  ON saved_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own saved items
CREATE POLICY "Users can update own saved items"
  ON saved_items FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own saved items
CREATE POLICY "Users can delete own saved items"
  ON saved_items FOR DELETE
  USING (auth.uid() = user_id);
```

---

## Database Functions

### increment_product_views

```sql
CREATE OR REPLACE FUNCTION increment_product_views(p_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET views = views + 1
  WHERE id = p_product_id;
END;
$$;
```

### track_user_activity

```sql
CREATE OR REPLACE FUNCTION track_user_activity(
  p_user_id UUID,
  p_activity_type TEXT,
  p_metadata JSONB,
  p_message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Your activity tracking logic
  INSERT INTO user_activity_logs (user_id, activity_type, metadata, message, created_at)
  VALUES (p_user_id, p_activity_type, p_metadata, p_message, NOW());
END;
$$;
```

### get_user_matches

```sql
-- Get matches for a user based on interests/products
CREATE OR REPLACE FUNCTION get_user_matches(p_user_id UUID)
RETURNS TABLE(
  matched_user_id UUID,
  match_type TEXT,
  match_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Your matching logic here
  ;
END;
$$;
```

---

## Views

### user_notification_count

```sql
CREATE OR REPLACE VIEW user_notification_count AS
SELECT 
  user_id,
  COUNT(*) FILTER (WHERE is_read = false) AS unread_count,
  COUNT(*) AS total_count
FROM notifications
GROUP BY user_id;
```

### product_with_seller

```sql
CREATE OR REPLACE VIEW product_with_seller AS
SELECT 
  p.*,
  pr.username AS seller_username,
  pr.location AS seller_location,
  pr.phone_number AS seller_phone
FROM products p
LEFT JOIN profiles pr ON p.seller_id = pr.user_id
WHERE p.status = 'active';
```

---

## Triggers

### update_updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ... other tables
```

### referral_code_on_insert

```sql
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_code TEXT;
  random_suffix TEXT;
BEGIN
  -- Generate code from email
  base_code := UPPER(SUBSTRING(SPLIT_PART(NEW.email, '@', 1), 1, 6));
  random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
  NEW.referral_code := base_code || random_suffix;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();
```

---

## Migration Script

### Initial Setup

```sql
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create all tables (in order)
-- 1. profiles
-- 2. products
-- 3. notifications
-- 4. saved_items
-- 5. saved_searches
-- 6. referrals
-- 7. referral_rewards
-- 8. price_alerts
-- 9. push_subscriptions
-- 10. searches
-- 11. feedback

-- Create all functions
-- Create all triggers
-- Create all policies
```

---

## Data Relationships

```
auth.users
  ↓
profiles (user_id)
  ↓
products (seller_id → profiles.user_id)
  ↓
notifications (user_id → profiles.user_id)
saved_items (user_id → profiles.user_id)
saved_searches (user_id → profiles.user_id)
referrals (referrer_id → profiles.user_id)
push_subscriptions (user_id → profiles.user_id)

products
  ↓
notifications (product_id → products.id)
saved_items (product_id → products.id)
price_alerts (product_id → products.id)
```

---

## Sample Queries

### Get Products with Seller Info

```sql
SELECT 
  p.*,
  pr.username,
  pr.location as seller_location,
  pr.phone_number as seller_phone
FROM products p
LEFT JOIN profiles pr ON p.seller_id = pr.user_id
WHERE p.status = 'active'
  AND p.location ILIKE '%Harare%'
  AND p.price BETWEEN 10 AND 100
ORDER BY p.created_at DESC
LIMIT 50;
```

### Get Unread Notifications Count

```sql
SELECT COUNT(*) as unread_count
FROM notifications
WHERE user_id = 'user-uuid'
  AND is_read = false;
```

### Get Matching Buyers for a Product

```sql
SELECT DISTINCT pr.user_id, pr.username, pr.interests
FROM profiles pr
WHERE pr.is_buyer = true
  AND pr.is_active = true
  AND pr.interests @> '[{"name": "iPhone"}]';
```

### Get Saved Items with Product Details

```sql
SELECT 
  si.*,
  p.name as current_product_name,
  p.price as current_product_price,
  p.image_url as current_product_image
FROM saved_items si
LEFT JOIN products p ON si.product_id = p.id
WHERE si.user_id = 'user-uuid'
  AND si.item_type = 'product'
ORDER BY si.created_at DESC;
```

---

## Database Maintenance

### Vacuum

```sql
-- Regular vacuum
VACUUM ANALYZE profiles;
VACUUM ANALYZE products;
VACUUM ANALYZE notifications;

-- Or all tables
VACUUM ANALYZE;
```

### Index Maintenance

```sql
-- Reindex
REINDEX INDEX idx_products_name;
REINDEX INDEX idx_notifications_user_id;
```

### Cleanup

```sql
-- Delete old notifications (older than 30 days)
DELETE FROM notifications
WHERE created_at < NOW() - INTERVAL '30 days';

-- Delete inactive alerts
DELETE FROM price_alerts
WHERE is_active = false
  AND created_at < NOW() - INTERVAL '90 days';
```
