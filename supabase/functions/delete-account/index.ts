import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const USER_TABLES = [
  'activity_logs', 'calendar_events', 'todos', 'memos', 'milestones',
  'habits', 'habit_logs', 'billing_records', 'billing_contracts',
  'deadlines', 'contacts', 'projects', 'clients', 'tax_intakes',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: '인증 정보가 없습니다.' }), { status: 401, headers: corsHeaders })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 현재 사용자 확인
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: '인증에 실패했습니다.' }), { status: 401, headers: corsHeaders })
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // 공개 테이블 데이터 삭제 (user_id 기준)
  for (const table of USER_TABLES) {
    await admin.from(table).delete().eq('user_id', user.id)
  }
  // profiles는 id가 PK
  await admin.from('profiles').delete().eq('id', user.id)

  // auth 계정 삭제
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return new Response(
      JSON.stringify({ error: '계정 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
