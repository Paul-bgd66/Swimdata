// /api/planning.js
// GET  ?clubId=&coachId=           → { weeks: [...] } triées start_date ASC
// PUT  { clubId, coachId, weeks[] } → upsert semaines par week_id

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
      .from('planning')
      .select('week_id, start_date, mc_num, days')
      .eq('club_id', clubId)
      .eq('coach_id', coachId)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('[planning GET] supabase error', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }

    const weeks = (data || []).map((row) => ({
      id: row.week_id,
      startDate: row.start_date,
      mcNum: row.mc_num,
      days: row.days,
    }));

    return json(null, 200, { weeks });
  }

  // ── PUT { clubId, coachId, weeks[] } ──────────────────────────────
  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return json(null, 400, { error: 'Invalid JSON' }); }
    const { clubId, coachId, weeks } = body;
    if (!clubId || !coachId || !Array.isArray(weeks) || !weeks.length) {
      return json(null, 400, { error: 'clubId, coachId, weeks[] required' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const now = new Date().toISOString();
    const rows = weeks.map((w) => ({
      club_id: clubId,
      coach_id: coachId,
      week_id: w.id,
      start_date: w.startDate,
      mc_num: w.mcNum,
      days: w.days,
      updated_at: now,
    }));

    const { error } = await supabase
      .from('planning')
      .upsert(rows, { onConflict: 'club_id,coach_id,week_id' });

    if (error) {
      console.error('[planning PUT] supabase error', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }
    return json(null, 200, { ok: true, count: rows.length });
  }

  return json(null, 405, { error: 'Method not allowed' });
}

export const config = { runtime: 'edge' };
