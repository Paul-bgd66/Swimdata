// /api/nageurs.js
// GET ?coachId=xxx&clubId=yyy → liste des nageurs d'un coach

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });

  const url = new URL(req.url);
  const coachId = url.searchParams.get('coachId');
  const clubId = url.searchParams.get('clubId');

  if (!coachId && !clubId) return json(400, { error: 'coachId ou clubId requis' });

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  let query = sb.from('nageurs').select('id, prenom, nom, email, created_at');
  if (coachId) query = query.eq('coach_id', coachId);
  if (clubId) query = query.eq('club_id', clubId);

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) return json(500, { error: error.message });
  return json(200, data || []);
}
