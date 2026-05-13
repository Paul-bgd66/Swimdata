// /api/groupes.js
// GET  ?clubId=            → [{ id, name, color }, ...] trié created_at ASC
// PUT  { clubId, groups[] } → upsert complet par club_id,id

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(res, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);

  // ── GET ?clubId= ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const clubId = url.searchParams.get('clubId');
    if (!clubId) return json(null, 400, { error: 'clubId required' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase
      .from('groupes')
      .select('id, name, color')
      .eq('club_id', clubId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[groupes GET] supabase error', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }

    return json(null, 200, data || []);
  }

  // ── PUT { clubId, groups[] } ──────────────────────────────────────
  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return json(null, 400, { error: 'Invalid JSON' }); }
    const { clubId, groups } = body;
    if (!clubId || !Array.isArray(groups) || !groups.length) {
      return json(null, 400, { error: 'clubId and groups[] required' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const rows = groups.map((g) => ({
      club_id: clubId,
      id: g.id,
      name: g.name,
      color: g.color,
    }));

    const { error } = await supabase
      .from('groupes')
      .upsert(rows, { onConflict: 'club_id,id' });

    if (error) {
      console.error('[groupes PUT] supabase error', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }
    return json(null, 200, { ok: true, count: rows.length });
  }

  return json(null, 405, { error: 'Method not allowed' });
}

export const config = { runtime: 'edge' };
