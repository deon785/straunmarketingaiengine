// supabase/functions/delete-user/index.ts
import { createClient } from 'https://deno.land/x/supabase@mod.ts'

Deno.serve(async (req) => {
  try {
    const { userId } = await req.json()
    
    // Create Supabase client with SERVICE_ROLE_KEY (important!)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Delete the user from Auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (error) throw error
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})