// supabase/functions/admin-users/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// ✅ FIXED: Use specific origin instead of wildcard
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://straun-ai.vercel.app',
  'https://your-production-domain.com'
];

function getCorsHeaders(origin: string) {
  // Check if the origin is allowed
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || 'http://localhost:5173';
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  try {
    const url = new URL(req.url);
    const method = req.method;
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'SERVICE_ROLE_KEY not set' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      );
    }
    
    // Create Supabase client with SERVICE_ROLE_KEY
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // ============================================
    // GET USER COUNT (GET /admin-users?action=count)
    // ============================================
    if (method === 'GET' && url.searchParams.get('action') === 'count') {
      console.log('📊 Getting user count...');
      
      try {
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
        
        if (error) {
          console.error('Error fetching users:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
        
        const { count: profileCount } = await supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        
        return new Response(
          JSON.stringify({ 
            auth_users: users?.users?.length || 0,
            profiles: profileCount || 0,
            missing_profiles: (users?.users?.length || 0) - (profileCount || 0)
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (err) {
        console.error('Count error:', err);
        return new Response(
          JSON.stringify({ error: err.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // ============================================
    // GET ALL USERS (GET /admin-users?action=list)
    // ============================================
    if (method === 'GET' && url.searchParams.get('action') === 'list') {
      console.log('📋 Fetching all auth users...');
      
      try {
        // Get all auth users
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 100,
          page: 1
        });
        
        if (error) {
          console.error('Error fetching users:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
        
        console.log(`✅ Found ${users?.users?.length || 0} users from auth`);
        
        // Get all profiles
        const { data: profiles, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('user_id, is_seller, is_buyer, seller_setup_completed, buyer_setup_completed, location, phone_number, username');
        
        if (profileError) {
          console.warn('Could not fetch profiles:', profileError);
        }
        
        // Create a map of profiles by user_id
        const profileMap = {};
        if (profiles) {
          profiles.forEach(p => {
            profileMap[p.user_id] = p;
          });
        }
        
        // Build user list
        const usersWithProfiles = (users?.users || []).map(authUser => {
          try {
            const profile = profileMap[authUser.id] || null;
            return {
              id: authUser.id || 'unknown',
              email: authUser.email || 'No email',
              created_at: authUser.created_at || new Date().toISOString(),
              last_sign_in_at: authUser.last_sign_in_at || null,
              has_profile: !!profile,
              is_seller: profile?.is_seller || false,
              is_buyer: profile?.is_buyer || false,
              seller_setup_completed: profile?.seller_setup_completed || false,
              buyer_setup_completed: profile?.buyer_setup_completed || false,
              location: profile?.location || null,
              phone_number: profile?.phone_number || null,
              username: profile?.username || authUser.email?.split('@')[0] || 'Unknown'
            };
          } catch (userErr) {
            console.warn('Error processing user:', authUser.id, userErr.message);
            return {
              id: authUser.id || 'unknown',
              email: authUser.email || 'Error',
              created_at: new Date().toISOString(),
              last_sign_in_at: null,
              has_profile: false,
              is_seller: false,
              is_buyer: false,
              seller_setup_completed: false,
              buyer_setup_completed: false,
              location: null,
              phone_number: null,
              username: 'Error'
            };
          }
        });
        
        const total = usersWithProfiles.length;
        const withProfiles = usersWithProfiles.filter(u => u.has_profile).length;
        const withoutProfiles = total - withProfiles;
        
        console.log(`✅ Processed ${total} users (${withProfiles} with profiles, ${withoutProfiles} without)`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            users: usersWithProfiles,
            total: total,
            with_profiles: withProfiles,
            without_profiles: withoutProfiles
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 200 
          }
        );
      } catch (listErr) {
        console.error('List error:', listErr);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: listErr.message,
            users: [],
            total: 0,
            with_profiles: 0,
            without_profiles: 0
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 500 
          }
        );
      }
    }

    // ============================================
    // DELETE USER (POST /admin-users)
    // ============================================
    if (method === 'POST') {
      try {
        const { userId } = await req.json();
        
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        
        console.log(`🗑️ Deleting user: ${userId}`);
        
        // Delete from all related tables
        const tables = [
          'products', 'notifications', 'saved_items', 'feedback',
          'user_activities', 'searches', 'saved_searches', 'search_alerts',
          'price_alerts', 'reports', 'push_subscriptions'
        ];
        
        for (const table of tables) {
          try {
            await supabaseAdmin
              .from(table)
              .delete()
              .or(`user_id.eq.${userId},sender_id.eq.${userId},seller_id.eq.${userId},buyer_id.eq.${userId},reporter_id.eq.${userId},reported_user_id.eq.${userId}`);
          } catch (err) {
            console.warn(`⚠️ Could not delete from ${table}:`, err.message);
          }
        }
        
        // Delete profile
        try {
          await supabaseAdmin.from('profiles').delete().eq('user_id', userId);
        } catch (err) {
          console.warn('⚠️ Could not delete profile:', err.message);
        }
        
        // Delete auth user
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (authError) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: authError.message,
              partial: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 207 }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'User deleted successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (deleteErr) {
        console.error('Delete error:', deleteErr);
        return new Response(
          JSON.stringify({ error: deleteErr.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Use ?action=count or ?action=list' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('❌ Edge Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});