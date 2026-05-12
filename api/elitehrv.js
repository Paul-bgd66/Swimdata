export const config = { runtime: 'nodejs' };

// /api/elitehrv.js
// POST { url }  → suit les redirections, télécharge le ZIP EliteHRV, extrait le fichier RR le plus récent, retourne { raw: string }

import JSZip from 'jszip';

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  const fetchStart = Date.now();

  let res;
  try {
    res = await fetch(url.trim(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SwimData/1.0)',
        'Accept': 'text/plain,text/csv,application/octet-stream,*/*',
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return json(502, {
      error: isTimeout
        ? 'Timeout — EliteHRV n\'a pas répondu en 8 secondes.'
        : 'Impossible de joindre EliteHRV : ' + err.message,
      debug: { fetchDurationMs: Date.now() - fetchStart },
    });
  }
  clearTimeout(timeoutId);

  const debug = {
    fetchDurationMs: Date.now() - fetchStart,
    status: res.status,
    finalUrl: res.url,
    contentType: res.headers.get('content-type') || '',
    headers: Object.fromEntries(res.headers.entries()),
  };

  let arrayBuffer;
  try { arrayBuffer = await res.arrayBuffer(); } catch (err) {
    return json(502, { error: 'Lecture du fichier impossible : ' + err.message, debug });
  }

  if (!res.ok) {
    debug.bodyPreview = new TextDecoder().decode(arrayBuffer).slice(0, 200);
    console.log('[elitehrv] debug', JSON.stringify(debug));
    return json(502, {
      error: `EliteHRV a répondu avec le code ${res.status}. Vérifiez que le lien est valide et non expiré.`,
      debug,
    });
  }

  if (debug.contentType.includes('text/html')) {
    debug.bodyPreview = new TextDecoder().decode(arrayBuffer).slice(0, 200);
    console.log('[elitehrv] debug', JSON.stringify(debug));
    return json(422, {
      error: "Le lien pointe vers une page web au lieu d'un fichier RR. Vérifiez que vous avez copié le lien d'export direct.",
      debug,
    });
  }

  // ── Tentative de décompression ZIP ──────────────────────────────
  let raw;
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    const txtFiles = Object.keys(zip.files).filter(
      (name) => !zip.files[name].dir && name.endsWith('.txt')
    );

    debug.filesFound = txtFiles.length;

    if (txtFiles.length === 0) {
      debug.bodyPreview = '(ZIP valide mais aucun .txt trouvé)';
      console.log('[elitehrv] debug', JSON.stringify(debug));
      return json(422, { error: 'Le ZIP ne contient aucun fichier .txt avec des intervalles RR.', debug });
    }

    // Tri décroissant par nom → le plus récent en premier (YYYY-MM-DD HH-MM-SS.txt)
    txtFiles.sort((a, b) => b.localeCompare(a));
    const selectedFile = txtFiles[0];
    debug.selectedFile = selectedFile;

    raw = await zip.files[selectedFile].async('string');
  } catch {
    // Pas un ZIP — on essaie en texte brut (fichier .txt direct)
    raw = new TextDecoder().decode(arrayBuffer);
    debug.filesFound = 0;
    debug.selectedFile = '(texte brut)';
  }

  debug.bodyPreview = raw.slice(0, 200);
  console.log('[elitehrv] debug', JSON.stringify(debug));

  if (!raw || raw.trim().length === 0) {
    return json(422, { error: 'Le fichier RR sélectionné est vide.', debug });
  }

  return new Response(JSON.stringify({ raw, debug }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
