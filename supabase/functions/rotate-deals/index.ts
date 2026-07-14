import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Call the rotation function
    const { data, error } = await supabase.rpc('rotate_daily_deals')
    
    if (error) throw error

    // ✅ FIXED: Get deals with proper query
    const { data: newDeals, error: dealsError } = await supabase
      .from('daily_deals')
      .select(`
        *,
        products:product_id (
          name,
          price,
          views
        )
      `)
      .eq('is_active', true)
      .gte('start_time', new Date().toISOString())
      // ✅ Add proper ordering if needed
      .order('created_at', { ascending: false })

    if (dealsError) {
      console.error('Error fetching deals:', dealsError)
    }

    if (newDeals && newDeals.length > 0) {
      // Notify eligible users about new deals
      const { data: eligibleUsers, error: usersError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('is_active', true)
        .limit(100) // ✅ Add limit to prevent too many notifications
      
      if (usersError) {
        console.error('Error fetching users:', usersError)
      }

      // ✅ Use bulk insert for better performance
      if (eligibleUsers && eligibleUsers.length > 0) {
        const notifications = eligibleUsers.map(user => ({
          user_id: user.user_id,
          message: `🔥 ${newDeals.length} new daily deals available! Check them out before they expire!`,
          link_type: 'daily_deals',
          created_at: new Date().toISOString()
        }))

        // Insert in batches to avoid rate limits
        const batchSize = 50
        for (let i = 0; i < notifications.length; i += batchSize) {
          const batch = notifications.slice(i, i + batchSize)
          await supabase.from('notifications').insert(batch)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        deals_count: newDeals?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in rotate_daily_deals:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})