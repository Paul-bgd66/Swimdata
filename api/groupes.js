// /api/groupes.js
// GET    ?coachId=&clubId=                   → groupes du coach (manager voit tout le club)
// POST   { coachId, clubId, nom, parentId? } → crée un groupe
// PATCH  { id, coachId, nom }                → renomme
// DELETE ?id=&coachId=                       → supprime (409 si nageurs ou sous-groupes)

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);

  // ── GET ?coachId=&clubId= ─────────────────────────────────────────────────
  if (req.method === 'GET') {
    const coachId = url.searchParams.get('coachId');
    const clubId  = url.searchParams.get('clubId');
    if (!coachId || !clubId) return json(400, { error: 'coachId and clubId required' });

    const supabase = sb();

    const { data: coachRow } = await supabase
      .from('coaches')
      .select('role')
      .eq('id', coachId)
      .maybeSingle();

    let q = supabase
      .from('groupes')
      .select('id, club_id, coach_id, parent_id, nom, created_at')
      .eq('club_id', clubId)
      .order('created_at', { ascending: true });

    if (coachRow?.role !== 'manager') {
      q = q.eq('coach_id', coachId);
    }

    const { data, error } = await q;
    if (error) {
      console.error('[groupes GET]', JSON.stringify(error));
      return json(500, { error: error.message });
    }

    const groupes = (data || []).map(r => ({
      id:        r.id,
      clubId:    r.club_id,
      coachId:   r.coach_id,
      parentId:  r.parent_id,
      nom:       r.nom,
      createdAt: r.created_at,
    }));

    return json(200, { groupes });
  }

  // ── POST { coachId, clubId, nom, parentId? } ──────────────────────────────
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
    const { coachId, clubId, nom, parentId } = body;
    if (!coachId || !clubId || !nom?.trim())
      return json(400, { error: 'coachId, clubId, nom required' });

    const supabase = sb();

    const { data: existing } = await supabase
      .from('groupes')
      .select('id')
      .eq('coach_id', coachId)
      .eq('club_id', clubId)
      .eq('nom', nom.trim())
      .maybeSingle();

    if (existing) return json(409, { error: 'Un groupe avec ce nom existe déjà.' });

    const { data, error } = await supabase
      .from('groupes')
      .insert({ coach_id: coachId, club_id: clubId, nom: nom.trim(), parent_id: parentId || null })
      .select('id, club_id, coach_id, parent_id, nom, created_at')
      .single();

    if (error) {
      console.error('[groupes POST]', JSON.stringify(error));
      return json(500, { error: error.message });
    }

    return json(201, {
      id: data.id, clubId: data.club_id, coachId: data.coach_id,
      parentId: data.parent_id, nom: data.nom, createdAt: data.created_at,
    });
  }

  // ── PATCH { id, coachId, nom } ────────────────────────────────────────────
  if (req.method === 'PATCH') {
    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
    const { id, coachId, nom } = body;
    if (!id || !coachId || !nom?.trim())
      return json(400, { error: 'id, coachId, nom required' });

    const supabase = sb();

    const { data: row } = await supabase
      .from('groupes').select('coach_id').eq('id', id).maybeSingle();

    if (!row) return json(404, { error: 'Groupe introuvable.' });
    if (row.coach_id !== coachId) return json(403, { error: 'Non autorisé.' });

    const { error } = await supabase
      .from('groupes').update({ nom: nom.trim() }).eq('id', id);

    if (error) return json(500, { error: error.message });
    return json(200, { ok: true });
  }

  // ── DELETE ?id=&coachId= ──────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const id      = url.searchParams.get('id');
    const coachId = url.searchParams.get('coachId');
    if (!id || !coachId) return json(400, { error: 'id and coachId required' });

    const supabase = sb();

    const { data: row } = await supabase
      .from('groupes').select('coach_id').eq('id', id).maybeSingle();

    if (!row) return json(404, { error: 'Groupe introuvable.' });
    if (row.coach_id !== coachId) return json(403, { error: 'Non autorisé.' });

    const { count: sgCount } = await supabase
      .from('groupes')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', id);

    if (sgCount && sgCount > 0) {
      return json(409, {
        error: `Impossible de supprimer : ce groupe contient ${sgCount} sous-groupe(s). Supprimez-les d'abord.`,
      });
    }

    const { count: nagCount } = await supabase
      .from('nageurs')
      .select('id', { count: 'exact', head: true })
      .eq('groupe_id', id)
      .eq('active', true);

    if (nagCount && nagCount > 0) {
      return json(409, {
        error: `Impossible de supprimer : ${nagCount} nageur(s) sont dans ce groupe. Réaffectez-les d'abord.`,
      });
    }

    const { error } = await supabase.from('groupes').delete().eq('id', id);
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
}

export const config = { runtime: 'edge' };
