// /api/groupes.js
// Auth: Authorization: Bearer <supabase_access_token>  (coachId déduit du token)
// GET    ?clubId=                              → groupes du coach (manager voit tout le club)
// POST   { clubId, nom, parentId?, couleur? }  → crée un groupe
// PATCH  { id, nom, couleur? }                 → renomme / recolorie
// DELETE ?id=                                  → supprime (409 si nageurs ou sous-groupes)

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

async function authenticate(req) {
  const auth = (req.headers.get('Authorization') || '').trim();
  if (!auth.startsWith('Bearer ')) return { coachId: null, error: 'Auth required' };
  const { data: { user }, error } = await sb().auth.getUser(auth.slice(7));
  if (error || !user) return { coachId: null, error: 'Token invalide' };
  return { coachId: user.id, error: null };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);

  // ── GET ?clubId= ──────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { coachId, error: authErr } = await authenticate(req);
    if (authErr) return json(401, { error: authErr });

    const clubId = url.searchParams.get('clubId');
    if (!clubId) return json(400, { error: 'clubId required' });

    const supabase = sb();
    const { data: coachRow } = await supabase
      .from('coaches').select('role').eq('id', coachId).maybeSingle();

    let q = supabase
      .from('groupes')
      .select('id, club_id, coach_id, parent_id, nom, couleur, created_at')
      .eq('club_id', clubId)
      .order('created_at', { ascending: true });

    if (coachRow?.role !== 'manager') q = q.eq('coach_id', coachId);

    const { data, error } = await q;
    if (error) {
      console.error('[groupes GET]', JSON.stringify(error));
      return json(500, { error: error.message });
    }

    const groupes = (data || []).map(r => ({
      id: r.id, clubId: r.club_id, coachId: r.coach_id,
      parentId: r.parent_id, nom: r.nom, couleur: r.couleur,
      createdAt: r.created_at,
    }));
    return json(200, { groupes });
  }

  // ── POST { clubId, nom, parentId?, couleur? } ─────────────────────────────
  if (req.method === 'POST') {
    const { coachId, error: authErr } = await authenticate(req);
    if (authErr) return json(401, { error: authErr });

    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
    const { clubId, nom, parentId, couleur } = body;
    if (!clubId || !nom?.trim()) return json(400, { error: 'clubId, nom required' });

    const supabase = sb();
    const { data: existing } = await supabase.from('groupes').select('id')
      .eq('coach_id', coachId).eq('club_id', clubId).eq('nom', nom.trim()).maybeSingle();
    if (existing) return json(409, { error: 'Un groupe avec ce nom existe déjà.' });

    const { data, error } = await supabase.from('groupes')
      .insert({
        coach_id:  coachId,
        club_id:   clubId,
        nom:       nom.trim(),
        parent_id: parentId || null,
        couleur:   couleur || null,
      })
      .select('id, club_id, coach_id, parent_id, nom, couleur, created_at')
      .single();

    if (error) {
      console.error('[groupes POST]', JSON.stringify(error));
      return json(500, { error: error.message });
    }

    return json(201, {
      id: data.id, clubId: data.club_id, coachId: data.coach_id,
      parentId: data.parent_id, nom: data.nom, couleur: data.couleur,
      createdAt: data.created_at,
    });
  }

  // ── PATCH { id, nom, couleur? } ───────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { coachId, error: authErr } = await authenticate(req);
    if (authErr) return json(401, { error: authErr });

    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
    const { id, nom, couleur } = body;
    if (!id || !nom?.trim()) return json(400, { error: 'id, nom required' });

    const supabase = sb();
    const { data: row } = await supabase.from('groupes')
      .select('coach_id').eq('id', id).maybeSingle();

    if (!row) return json(404, { error: 'Groupe introuvable.' });
    if (row.coach_id !== coachId) return json(403, { error: 'Non autorisé.' });

    const patch = { nom: nom.trim() };
    if (couleur !== undefined) patch.couleur = couleur || null;

    const { error } = await supabase.from('groupes').update(patch).eq('id', id);
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true });
  }

  // ── DELETE ?id= ───────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { coachId, error: authErr } = await authenticate(req);
    if (authErr) return json(401, { error: authErr });

    const id = url.searchParams.get('id');
    if (!id) return json(400, { error: 'id required' });

    const supabase = sb();
    const { data: row } = await supabase.from('groupes')
      .select('coach_id').eq('id', id).maybeSingle();

    if (!row) return json(404, { error: 'Groupe introuvable.' });
    if (row.coach_id !== coachId) return json(403, { error: 'Non autorisé.' });

    const { count: sgCount } = await supabase.from('groupes')
      .select('id', { count: 'exact', head: true }).eq('parent_id', id);
    if (sgCount && sgCount > 0)
      return json(409, { error: `Impossible de supprimer : ce groupe contient ${sgCount} sous-groupe(s). Supprimez-les d'abord.` });

    const { count: nagCount } = await supabase.from('nageurs')
      .select('id', { count: 'exact', head: true }).eq('groupe_id', id).eq('active', true);
    if (nagCount && nagCount > 0)
      return json(409, { error: `Impossible de supprimer : ${nagCount} nageur(s) sont dans ce groupe. Réaffectez-les d'abord.` });

    const { error } = await supabase.from('groupes').delete().eq('id', id);
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
}

export const config = { runtime: 'edge' };
