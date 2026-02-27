// This is a reference implementation for a Supabase Edge Function to clean up old data.
// In practice, for the MVP, the Frontend filters by `expires_at > now()`, which effectively "deletes" them from view.
// This script would be used with a cron job to physically delete rows to save space.

/*
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  try {
    // Delete hangouts expired more than 24 hours ago (keep them for a bit for history if needed, or delete immediately)
    const { error } = await supabase
      .from('hangouts')
      .delete()
      .lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (error) throw error

    return new Response(JSON.stringify({ message: 'Cleanup successful' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
*/