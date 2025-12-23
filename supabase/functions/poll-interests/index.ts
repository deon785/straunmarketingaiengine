import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ====================== TYPE DEFINITIONS ======================
interface Notification {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  status: string;  // This is required in the interface
}

interface Product {
  id: string;
  name: string;
  price: number;
  created_at: string;
  [key: string]: unknown;
}

interface WishlistItem {
  id: string;
  user_id: string;
  query: string;
  item_name: string;
  min_price?: number;
  max_price?: number;
  [key: string]: unknown;
}

// ====================== HELPER FUNCTIONS ======================
function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getYesterdayDate(): Date {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
}

function getTwentyFourHoursAgo(): Date {
  const date = new Date();
  date.setHours(date.getHours() - 24);
  return date;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ====================== MAIN HANDLER ======================
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables with validation
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseKey = getRequiredEnv('SUPABASE_ANON_KEY');
    
    // Setup Supabase Client
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // 1. Find notifications created in the last 24 hours that are still 'unread'
    const twentyFourHoursAgo = getTwentyFourHoursAgo().toISOString();
    const yesterday = getYesterdayDate().toISOString();

    // FIX: Add 'status' to the select query since it's required in Notification interface
    const { data: unreadNotifications, error: notificationsError } = await supabaseClient
      .from('notifications')
      .select('id, user_id, message, created_at, status')  // Added 'status' here
      .eq('status', 'unread')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });

    if (notificationsError) {
      console.error('Database error:', notificationsError);
      throw new Error(`Database query failed: ${notificationsError.message}`);
    }

    // 2. Get all new products from the last 24 hours
    const { data: newProducts, error: productsError } = await supabaseClient
      .from('products')
      .select('*')
      .gte('created_at', yesterday);

    if (productsError) {
      console.error('Database error:', productsError);
      throw new Error(`Products query failed: ${productsError.message}`);
    }

    // 3. Get everyone's wishlist
    const { data: allWishes, error: wishesError } = await supabaseClient
      .from('wishlist')
      .select('*');

    if (wishesError) {
      console.error('Database error:', wishesError);
      throw new Error(`Wishlist query failed: ${wishesError.message}`);
    }

    // 4. Process product-wishlist matching
    let matchesFound = 0;
    const notificationPromises = [];
    
    if (newProducts && newProducts.length > 0 && allWishes && allWishes.length > 0) {
      for (const product of newProducts) {
        const productName = product.name?.toString().toLowerCase() || '';
        const productPrice = Number(product.price) || 0;

        // Find matching wishlist items
        const matches = allWishes.filter((wish: WishlistItem) => {
          const wishQuery = wish.query?.toString().toLowerCase() || wish.item_name?.toString().toLowerCase() || '';
          const minPrice = Number(wish.min_price) || 0;
          const maxPrice = Number(wish.max_price) || 1000000;
          
          return productName.includes(wishQuery) && 
                 productPrice >= minPrice && 
                 productPrice <= maxPrice;
        });

        // Create notifications for matches
        if (matches.length > 0) {
          matchesFound += matches.length;
          
          for (const match of matches) {
            notificationPromises.push(
              supabaseClient.from('notifications').insert({
                user_id: match.user_id,
                message: `Match Found! A new ${product.name} was just listed for $${productPrice.toFixed(2)}.`,
                status: 'unread'
              })
            );
          }
        }
      }
      
      // Execute all notification inserts in parallel
      if (notificationPromises.length > 0) {
        const results = await Promise.allSettled(notificationPromises);
        
        // Check for any failed inserts
        const failedInserts = results.filter(result => result.status === 'rejected');
        if (failedInserts.length > 0) {
          console.warn(`Failed to create ${failedInserts.length} notifications`);
        }
      }
    }

    // 5. Log the results
    console.log(`Daily Poll: Found ${unreadNotifications?.length || 0} unread notifications from the last 24 hours.`);
    console.log(`Found ${newProducts?.length || 0} new products in the last 24 hours.`);
    console.log(`Found ${allWishes?.length || 0} wishlist items.`);
    console.log(`Created ${matchesFound} new match notifications.`);
    
    // FIX: The type assertion is now correct since we're including 'status' in the query
    if (unreadNotifications && unreadNotifications.length > 0) {
      unreadNotifications.forEach((notification: Notification) => {
        console.log(`- User ${notification.user_id}: ${notification.message} (Status: ${notification.status})`);
      });
    }

    // 6. Return successful response
    return new Response(
      JSON.stringify({ 
        success: true, 
        count: unreadNotifications?.length || 0,
        notifications: unreadNotifications || [],
        stats: {
          newProducts: newProducts?.length || 0,
          wishlistItems: allWishes?.length || 0,
          matchesFound: matchesFound,
          unreadNotifications: unreadNotifications?.length || 0
        }
      }), 
      { 
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        } 
      }
    );

  } catch (error: unknown) {
    console.error('Server error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }), 
      { 
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        } 
      }
    );
  }
});