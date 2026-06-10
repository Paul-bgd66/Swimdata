// /api/invite.js
// POST { email, role?, coachId?, clubId?, firstName?, lastName? }
//   role: 'swimmer' (défaut) ou 'coach'
// → invite via Supabase Auth admin API, stocke role/coachId/clubId/firstName/lastName dans user_metadata

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

  const { email, role, coachId, clubId, firstName, lastName } = body || {};
  if (!email) return json(400, { error: 'Email requis' });

  const _role = role === 'coach' ? 'coach' : 'swimmer';

  // Requires SUPABASE_SERVICE_KEY (not the anon key) for admin operations
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const meta = {
    role: _role,
    coachId: coachId || '',
    clubId: clubId || '',
    firstName: firstName || '',
    lastName: lastName || '',
  };

  const { data, error } = await sb.auth.admin.inviteUserByEmail(email, { data: meta });

  if (error) return json(400, { error: error.message });

  const userId = data?.user?.id;

  // Insert dans la table swimmers (uniquement pour le rôle swimmer)
  if (_role === 'swimmer' && userId) {
    const { error: insertErr } = await sb.from('swimmers').insert({
      id: userId,
      coach_id: coachId || null,
      club_id: clubId || null,
      first_name: firstName || '',
      last_name: lastName || '',
      email: email,
      status: 'invited',
    });
    if (insertErr) {
      console.error('[invite] swimmers insert error:', insertErr);
      return json(500, { error: 'Invitation envoyée mais profil nageur non créé : ' + insertErr.message, userId });
    }
  }

  return json(200, { success: true, userId });
}
