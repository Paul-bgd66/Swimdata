// /api/videos-upload.js
// GET ?clubId=&coachId=&videoId=&ext=&contentType=
// Génère une signed upload URL Supabase Storage → { signedUrl, storagePath }
// Le client uploade ensuite directement vers Supabase (PUT signedUrl, body: file)

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  if (req.method !== 'GET') return json(null, 405, { error: 'Method not allowed' });

  const url = new URL(req.url);
  const clubId = url.searchParams.get('clubId');
  const coachId = url.searchParams.get('coachId');
  const videoId = url.searchParams.get('videoId');
  const ext = (url.searchParams.get('ext') || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!clubId || !coachId || !videoId) {
    return json(null, 400, { error: 'clubId, coachId, videoId required' });
  }

  const storagePath = `${clubId}/${coachId}/${videoId}.${ext}`
    .replace(/[^a-zA-Z0-9/_.-]/g, '_');

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase.storage
    .from('videos')
    .createSignedUploadUrl(storagePath);

  if (error) {
    console.error('[videos-upload] createSignedUploadUrl error', JSON.stringify(error));
    return json(null, 500, { error: error.message });
  }

  return json(null, 200, { signedUrl: data.signedUrl, storagePath });
}

export const config = { runtime: 'edge' };
