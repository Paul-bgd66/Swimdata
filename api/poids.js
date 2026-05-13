// /api/poids.js
// GET  ?clubId=&coachId=            → swimmers + entries triées par date DESC
// PUT  { clubId, coachId, entries } → upsert entrées poids

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

  // ── GET ?clubId=&coachId= ──────────────────────────────────────────
  if (req.method === 'GET') {
    const clubId = url.searchParams.get('clubId');
    const coachId = url.searchParams.get('coachId');
    if (!clubId || !coachId) return json(null, 400, { error: 'clubId and coachId required' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase
      .from('poids')
      .select('prenom, nom, date, weight')
      .eq('club_id', clubId)
      .eq('coach_id', coachId)
      .order('date', { ascending: false });

    if (error) {
      console.error('[poids GET] supabase error', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }

    // Grouper par (prenom, nom)
    const map = {};
    (data || []).forEach((row) => {
      const key = row.prenom + '|' + (row.nom || '');
      if (!map[key]) map[key] = { prenom: row.prenom, nom: row.nom || '', entries: [] };
      map[key].entries.push({ date: row.date, weight: row.weight });
    });

    return json(null, 200, Object.values(map));
  }

  // ── PUT { clubId, coachId, entries[] } ────────────────────────────
  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return json(null, 400, { error: 'Invalid JSON' }); }
    const { clubId, coachId, entries } = body;
    if (!clubId || !coachId || !Array.isArray(entries) || !entries.length) {
      return json(null, 400, { error: 'clubId, coachId, entries[] required' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const rows = entries.map((e) => ({
      club_id: clubId,
      coach_id: coachId,
      prenom: e.prenom,
      nom: e.nom || '',
      date: e.date,
      weight: e.weight,
    }));

    const { error } = await supabase
      .from('poids')
      .upsert(rows, { onConflict: 'club_id,coach_id,prenom,nom,date' });

    if (error) {
      console.error('[poids PUT] supabase error', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }
    return json(null, 200, { ok: true, count: rows.length });
  }

  return json(null, 405, { error: 'Method not allowed' });
}

export const config = { runtime: 'edge' };
