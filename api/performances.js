// /api/performances.js
// GET  ?clubId=&coachId=            → performances groupées par nageur_nom, triées date DESC
// PUT  { clubId, coachId, entries } → upsert entrées performances

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
      .from('performances')
      .select('nageur_nom, bassin, nage, distance, temps, date, note')
      .eq('club_id', clubId)
      .eq('coach_id', coachId)
      .order('date', { ascending: false });

    if (error) {
      console.error('[performances GET] supabase error', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }

    const map = {};
    (data || []).forEach((row) => {
      if (!map[row.nageur_nom]) map[row.nageur_nom] = { nageur_nom: row.nageur_nom, performances: [] };
      map[row.nageur_nom].performances.push({
        bassin: row.bassin,
        nage: row.nage,
        distance: row.distance,
        temps: row.temps,
        date: row.date,
        note: row.note || '',
      });
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
      nageur_nom: e.nageur_nom,
      bassin: e.bassin,
      nage: e.nage,
      distance: e.distance,
      temps: e.temps,
      date: e.date,
      note: e.note || '',
    }));

    const { error } = await supabase
      .from('performances')
      .upsert(rows, { onConflict: 'club_id,coach_id,nageur_nom,bassin,nage,distance,temps,date' });

    if (error) {
      console.error('[performances PUT] supabase error', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }
    return json(null, 200, { ok: true, count: rows.length });
  }

  return json(null, 405, { error: 'Method not allowed' });
}

export const config = { runtime: 'edge' };
