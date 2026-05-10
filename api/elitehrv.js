// /api/elitehrv.js
// POST { url }  → suit les redirections, télécharge le fichier RR EliteHRV, retourne { raw: string }

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

const ALLOWED_HOSTS = [
  'elitehrv.com',
  'app.elitehrv.com',
  'www.elitehrv.com',
  'elitehrv.s3.amazonaws.com',
  'elitehrv.s3-us-east-1.amazonaws.com',
];

function isAllowed(hostname) {
  return ALLOWED_HOSTS.some(
    (h) => hostname === h || hostname.endsWith('.' + h)
  );
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }

  const { url } = body;
  if (!url || typeof url !== 'string') return json(400, { error: 'url requis' });

  let parsed;
  try { parsed = new URL(url.trim()); } catch {
    return json(400, { error: 'URL invalide. Colle le lien complet depuis EliteHRV.' });
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    return json(400, { error: 'URL invalide (protocole non autorisé).' });
  }

  // SSRF protection — seuls les domaines EliteHRV autorisés
  if (!isAllowed(parsed.hostname)) {
    return json(400, { error: 'URL non autorisée. Seuls les liens elitehrv.com sont acceptés.' });
  }

  let res;
  try {
    res = await fetch(url.trim(), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SwimData/1.0)',
        'Accept': 'text/plain,text/csv,application/octet-stream,*/*',
      },
    });
  } catch (err) {
    return json(502, { error: 'Impossible de joindre EliteHRV : ' + err.message });
  }

  if (!res.ok) {
    return json(502, { error: `EliteHRV a répondu avec le code ${res.status}. Vérifiez que le lien est valide et non expiré.` });
  }

  const contentType = res.headers.get('content-type') || '';
  // Reject obvious non-data responses (HTML pages = login wall, error page, etc.)
  if (contentType.includes('text/html')) {
    return json(422, { error: 'Le lien pointe vers une page web au lieu d\'un fichier RR. Vérifiez que vous avez copié le lien d\'export direct.' });
  }

  let text;
  try { text = await res.text(); } catch (err) {
    return json(502, { error: 'Lecture du fichier impossible : ' + err.message });
  }

  if (!text || text.trim().length === 0) {
    return json(422, { error: 'Le fichier téléchargé est vide.' });
  }

  return new Response(JSON.stringify({ raw: text }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export const config = { runtime: 'edge' };
