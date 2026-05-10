// /api/clubs.js
// POST { name, passwordHash }  → verify club credentials, return club row
// GET  ?id=                    → fetch club by id (public fields only)

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
    const id = url.searchParams.get('id');
    if (!id) return json(400, { error: 'id required' });

    const { data, error } = await supabase()
      .from('clubs')
      .select('id, name, short_name, color1, color2, theme, email')
      .eq('id', id)
      .single();

    if (error) return json(error.code === 'PGRST116' ? 404 : 500, { error: error.message });
    return json(200, data);
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
    const { name, passwordHash } = body;
    if (!name || !passwordHash) return json(400, { error: 'name and passwordHash required' });

    const { data, error } = await supabase()
      .from('clubs')
      .select('id, name, short_name, color1, color2, theme, email, password_hash')
      .ilike('name', name.trim())
      .single();

    if (error) return json(error.code === 'PGRST116' ? 404 : 500, { error: error.message });
    if (data.password_hash !== passwordHash) return json(401, { error: 'Mot de passe incorrect.' });

    const { password_hash: _, ...safe } = data;
    return json(200, safe);
  }

  return json(405, { error: 'Method not allowed' });
}

export const config = { runtime: 'edge' };
