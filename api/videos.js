// /api/videos.js
// GET  ?clubId=&coachId=                        → swimmers + métadonnées vidéos groupés
// GET  ?clubId=&coachId=&storagePath=           → signed URL (1h)
// POST { clubId, coachId, swimmerId, ... }      → insert métadonnées
// DELETE ?clubId=&coachId=&videoId=&storagePath= → supprime row + fichier storage

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(res, status, body) {
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
  const clubId = url.searchParams.get('clubId');
  const coachId = url.searchParams.get('coachId');

  // ── GET signed URL ─────────────────────────────────────────────────
  if (req.method === 'GET' && url.searchParams.get('storagePath')) {
    if (!clubId || !coachId) return json(null, 400, { error: 'clubId and coachId required' });
    const storagePath = url.searchParams.get('storagePath');

    const { data, error } = await supabase().storage
      .from('videos')
      .createSignedUrl(storagePath, 3600);

    if (error) {
      console.error('[videos signedUrl]', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }
    return json(null, 200, { signedUrl: data.signedUrl });
  }

  // ── GET list ───────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!clubId || !coachId) return json(null, 400, { error: 'clubId and coachId required' });

    const { data, error } = await supabase()
      .from('videos')
      .select('id, swimmer_id, swimmer_prenom, swimmer_nom, name, date, type, notes, storage_path, annotations')
      .eq('club_id', clubId)
      .eq('coach_id', coachId)
      .order('date', { ascending: false });

    if (error) {
      console.error('[videos GET]', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }

    const map = {};
    (data || []).forEach((row) => {
      const sid = row.swimmer_id;
      if (!map[sid]) map[sid] = { id: sid, prenom: row.swimmer_prenom, nom: row.swimmer_nom, videos: [] };
      map[sid].videos.push({
        id: row.id,
        name: row.name,
        date: row.date,
        type: row.type,
        notes: row.notes || '',
        storage_path: row.storage_path,
        annotations: row.annotations || [],
      });
    });

    return json(null, 200, Object.values(map));
  }

  // ── POST métadonnées ───────────────────────────────────────────────
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json(null, 400, { error: 'Invalid JSON' }); }
    const { clubId: cid, coachId: coid, swimmerId, swimmerPrenom, swimmerNom,
            videoId, name, date, type, notes, storagePath, annotations } = body;
    if (!cid || !coid || !swimmerId || !videoId || !storagePath) {
      return json(null, 400, { error: 'clubId, coachId, swimmerId, videoId, storagePath required' });
    }

    const { error } = await supabase().from('videos').insert({
      id: videoId,
      club_id: cid,
      coach_id: coid,
      swimmer_id: swimmerId,
      swimmer_prenom: swimmerPrenom || '',
      swimmer_nom: swimmerNom || '',
      name: name || '',
      date: date || new Date().toISOString().slice(0, 10),
      type: type || 'video/mp4',
      notes: notes || '',
      storage_path: storagePath,
      annotations: annotations || [],
    });

    if (error) {
      console.error('[videos POST]', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }
    return json(null, 201, { ok: true });
  }

  // ── DELETE row + storage ───────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!clubId || !coachId) return json(null, 400, { error: 'clubId and coachId required' });
    const videoId = url.searchParams.get('videoId');
    const storagePath = url.searchParams.get('storagePath');
    if (!videoId) return json(null, 400, { error: 'videoId required' });

    const sb = supabase();
    const { error: dbErr } = await sb.from('videos').delete()
      .eq('id', videoId).eq('club_id', clubId).eq('coach_id', coachId);
    if (dbErr) {
      console.error('[videos DELETE db]', JSON.stringify(dbErr));
      return json(null, 500, { error: dbErr.message });
    }

    if (storagePath) {
      const { error: storageErr } = await sb.storage.from('videos').remove([storagePath]);
      if (storageErr) console.error('[videos DELETE storage]', JSON.stringify(storageErr));
    }

    return json(null, 200, { ok: true });
  }

  return json(null, 405, { error: 'Method not allowed' });
}

export const config = { runtime: 'edge' };
