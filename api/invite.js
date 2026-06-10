// /api/invite.js
// POST { email, coachId } → invite swimmer via Supabase Auth admin API

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }

  const { email, coachId } = body || {};
  if (!email) return json(400, { error: 'Email requis' });

  // Requires SUPABASE_SERVICE_ROLE_KEY (not the anon key) for admin operations
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
    data: { role: 'swimmer', coachId: coachId || '' },
  });

  if (error) return json(400, { error: error.message });
  return json(200, { success: true, userId: data?.user?.id });
}
