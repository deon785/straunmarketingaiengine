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

    // Also trigger push notifications for new deals
    const { data: newDeals } = await supabase
      .from('daily_deals')
      .select('*, products(name, price)')
      .eq('is_active', true)
      .gte('start_time', new Date().toISOString())
    
    if (newDeals && newDeals.length > 0) {
      // Notify eligible users about new deals
      const { data: eligibleUsers } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('is_active', true)
      
      for (const user of eligibleUsers || []) {
        await supabase.from('notifications').insert({
          user_id: user.user_id,
          message: `🔥 ${newDeals.length} new daily deals available! Check them out before they expire!`,
          link_type: 'daily_deals'
        })
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})