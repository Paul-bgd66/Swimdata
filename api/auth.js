// /api/auth.js
// POST { action, clubId, ... }
//   action: 'createCoach' { clubId, coach }         → INSERT coaches
//   action: 'updateCoach' { clubId, coachId, changes } → UPDATE coaches by id + club_id

import { createClient } from '@supabase/supabase-js';

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

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }

  const { action, clubId } = body;
  if (!action || !clubId) return json(400, { error: 'action and clubId required' });

  const sb = supabase();

  // ── createCoach ────────────────────────────────────────────────────
  if (action === 'createCoach') {
    const { coach } = body;
    if (!coach || !coach.id) return json(400, { error: 'coach.id required' });

    const { error } = await sb.from('coaches').insert({
      id: coach.id,
      club_id: clubId,
      name: coach.name || '',
      firstname: coach.firstname || '',
      lastname: coach.lastname || '',
      email: coach.email || '',
      initials: coach.initials || '',
      color: coach.color || '#2176e8',
      has_pin: coach.hasPin || false,
      password_hash: coach.hash || '',
      role: coach.role || 'coach',
      visitor_mode: coach.visitorMode || false,
    });

    if (error) {
      console.error('[auth createCoach]', JSON.stringify(error));
      return json(500, { error: error.message });
    }
    return json(201, { ok: true });
  }

  // ── updateCoach ────────────────────────────────────────────────────
  if (action === 'updateCoach') {
    const { coachId, changes } = body;
    if (!coachId || !changes) return json(400, { error: 'coachId and changes required' });

    // Normalise camelCase → snake_case
    const patch = {};
    if (changes.hasPin !== undefined)    patch.has_pin       = changes.hasPin;
    if (changes.hash !== undefined)      patch.password_hash = changes.hash;
    if (changes.visitorMode !== undefined) patch.visitor_mode = changes.visitorMode;
    if (changes.role !== undefined)      patch.role          = changes.role;

    if (!Object.keys(patch).length) return json(400, { error: 'No valid fields in changes' });

    const { error } = await sb.from('coaches').update(patch)
      .eq('id', coachId)
      .eq('club_id', clubId);

    if (error) {
      console.error('[auth updateCoach]', JSON.stringify(error));
      return json(500, { error: error.message });
    }
    return json(200, { ok: true });
  }

  return json(400, { error: 'Unknown action: ' + action });
}

export const config = { runtime: 'edge' };
