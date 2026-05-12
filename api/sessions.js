// /api/sessions.js
// GET  ?clubId=&coachId=           → list sessions
// POST { clubId, coachId, session }  → create session
// PUT  { clubId, coachId, session }  → update session (by session.id)
// DELETE ?clubId=&coachId=&id=     → delete session

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    const coachId = url.searchParams.get('coachId');
    if (!clubId || !coachId) return json(400, { error: 'clubId and coachId required' });

    const { data, error } = await supabase()
      .from('sessions')
      .select('*')
      .eq('club_id', clubId)
      .eq('coach_id', coachId)
      .order('date', { ascending: false });

    if (error) {
      console.error('[sessions GET] supabase error', JSON.stringify(error));
      return json(500, { error: error.message, details: error });
    }
    return json(200, data);
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch (e) {
      console.error('[sessions POST] Invalid JSON', e.message);
      return json(400, { error: 'Invalid JSON' });
    }
    const { clubId, coachId, session } = body;
    if (!clubId || !coachId || !session) return json(400, { error: 'clubId, coachId, session required' });

    const row = {
      id: session.id,
      club_id: clubId,
      coach_id: coachId,
      name: session.name || '',
      date: session.date || new Date().toISOString().slice(0, 10),
      pool: session.pool || '',
      notes: session.notes || '',
      rows: session.rows || [],
      saved_at: session.savedAt || new Date().toISOString(),
    };
    console.log('[sessions POST] inserting', JSON.stringify(row));

    const { data, error } = await supabase().from('sessions').insert(row).select().single();

    if (error) {
      console.error('[sessions POST] supabase error', JSON.stringify(error));
      return json(500, { error: error.message, details: error });
    }
    return json(201, data);
  }

  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch (e) {
      console.error('[sessions PUT] Invalid JSON', e.message);
      return json(400, { error: 'Invalid JSON' });
    }
    const { clubId, coachId, session } = body;
    if (!clubId || !coachId || !session?.id) return json(400, { error: 'clubId, coachId, session.id required' });

    const patch = {
      name: session.name || '',
      date: session.date || new Date().toISOString().slice(0, 10),
      pool: session.pool || '',
      notes: session.notes || '',
      rows: session.rows || [],
      saved_at: session.savedAt || new Date().toISOString(),
    };
    console.log('[sessions PUT] updating id=%s club=%s coach=%s patch=%s', session.id, clubId, coachId, JSON.stringify(patch));

    const { data, error } = await supabase().from('sessions').update(patch)
      .eq('id', session.id)
      .eq('club_id', clubId)
      .eq('coach_id', coachId)
      .select().single();

    if (error) {
      console.error('[sessions PUT] supabase error', JSON.stringify(error));
      return json(500, { error: error.message, details: error });
    }
    return json(200, data);
  }

  if (req.method === 'DELETE') {
    const clubId = url.searchParams.get('clubId');
    const coachId = url.searchParams.get('coachId');
    const id = url.searchParams.get('id');
    if (!clubId || !coachId || !id) return json(400, { error: 'clubId, coachId, id required' });

    const { error } = await supabase().from('sessions')
      .delete()
      .eq('id', id)
      .eq('club_id', clubId)
      .eq('coach_id', coachId);

    if (error) {
      console.error('[sessions DELETE] supabase error', JSON.stringify(error));
      return json(500, { error: error.message, details: error });
    }
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
}

export const config = { runtime: 'edge' };
