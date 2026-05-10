// /api/coaches.js
// POST { clubId, initials, passwordHash }  → verify coach PIN, return coach row
// GET  ?clubId=                            → list coaches for a club (no hashes)

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const clubId = url.searchParams.get('clubId');
    if (!clubId) return json(400, { error: 'clubId required' });

    const { data, error } = await supabase()
      .from('coaches')
      .select('id, club_id, name, firstname, lastname, email, initials, color, has_pin, role, visitor_mode')
      .eq('club_id', clubId)
      .order('role', { ascending: true });

    if (error) return json(500, { error: error.message });
    return json(200, data);
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
    const { clubId, initials, passwordHash } = body;
    if (!clubId || !initials || !passwordHash) return json(400, { error: 'clubId, initials and passwordHash required' });

    const { data, error } = await supabase()
      .from('coaches')
      .select('id, club_id, name, firstname, lastname, email, initials, color, has_pin, role, visitor_mode, password_hash')
      .eq('club_id', clubId)
      .ilike('initials', initials.trim())
      .single();

    if (error) return json(error.code === 'PGRST116' ? 404 : 500, { error: error.message });
    if (!data.has_pin || data.password_hash !== passwordHash) return json(401, { error: 'Code PIN incorrect.' });

    const { password_hash: _, ...safe } = data;
    return json(200, safe);
  }

  return json(405, { error: 'Method not allowed' });
}

export const config = { runtime: 'edge' };
