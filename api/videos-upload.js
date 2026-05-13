// /api/videos-upload.js
// POST (raw binary body) ?clubId=&coachId=&videoId=&ext=
// Headers: Content-Type: video/mp4 (ou autre MIME)
// Body: fichier binaire brut
// Retourne: { storagePath }
//
// Note: limite Vercel Serverless = 4.5 MB. Pour des fichiers plus grands,
// utiliser un upload direct depuis le client vers Supabase Storage avec une signed upload URL.

export const config = { runtime: 'nodejs', maxDuration: 60 };

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (req.method !== 'POST') return json(null, 405, { error: 'Method not allowed' });

  const url = new URL(req.url);
  const clubId = url.searchParams.get('clubId');
  const coachId = url.searchParams.get('coachId');
  const videoId = url.searchParams.get('videoId');
  const ext = (url.searchParams.get('ext') || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!clubId || !coachId || !videoId) {
    return json(null, 400, { error: 'clubId, coachId, videoId required' });
  }

  const contentType = req.headers.get('content-type') || 'video/mp4';

  let arrayBuffer;
  try {
    arrayBuffer = await req.arrayBuffer();
  } catch (err) {
    return json(null, 400, { error: 'Lecture du body impossible : ' + err.message });
  }

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return json(null, 400, { error: 'Body vide' });
  }

  const storagePath = `${clubId}/${coachId}/${videoId}.${ext}`;
  const buffer = new Uint8Array(arrayBuffer);

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { error } = await supabase.storage
    .from('videos')
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) {
    console.error('[videos-upload] storage error', JSON.stringify(error));
    return json(null, 500, { error: error.message });
  }

  console.log('[videos-upload] uploaded', storagePath, buffer.byteLength, 'bytes');
  return json(null, 200, { storagePath });
}
