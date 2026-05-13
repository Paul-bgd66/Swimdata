// /api/hrv.js
// POST { rr, nageur, historique, clubId, coachId, lang }
//   rr         : number[]  — intervalles RR en ms (calculés côté client depuis le fichier)
//   nageur     : string    — nom du nageur
//   historique : object[]  — [{ date, note, fc, rmssd }] 5 dernières mesures max
//   clubId     : string    — id du club (Supabase)
//   coachId    : string    — id du coach (Supabase)
//   lang       : string    — 'fr' | 'en' | 'es'
//
// Returns { note, commentaire, fc, rmssd, date }
//
// TODO Supabase : ajouter auth JWT pour valider clubId/coachId

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(res, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ── Calcul RMSSD + FC ────────────────────────────────────────────
function calcMetrics(rr) {
  const meanRR = rr.reduce((a, b) => a + b, 0) / rr.length;
  const fc = Math.round((60000 / meanRR) * 10) / 10;
  const diffs = rr.slice(1).map((v, i) => v - rr[i]);
  const rmssd =
    Math.round(
      Math.sqrt(diffs.reduce((a, b) => a + b * b, 0) / diffs.length) * 10
    ) / 10;
  return { fc, rmssd };
}

// ── Prompt Claude ─────────────────────────────────────────────────
function buildPrompt(nageur, fc, rmssd, rrCount, historique, lang) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const recentHist = (historique || []).filter((h) => new Date(h.date) >= cutoff);

  const histCtx =
    recentHist.length >= 2
      ? 'Historique récent (12 mois) : ' +
        recentHist
          .slice(-5)
          .map((h) => `${h.date} score=${h.note}/10`)
          .join(' | ')
      : `Pas encore d'historique suffisant (${recentHist.length}/7 mesures pour le profil personnel).`;

  const langInstr =
    lang === 'en'
      ? 'Reply in English.'
      : lang === 'es'
      ? 'Responde en español.'
      : 'Réponds en français.';

  return `Nageur : ${nageur}. Test HRV orthostatique.
FC moyenne : ${fc} bpm. RMSSD : ${rmssd} ms. Battements analysés : ${rrCount}.
${histCtx}

Note /10 seuils absolus + contexte historique si disponible :
FC : <50→10 | 50-55→8.5 | 55-60→7 | 60-65→5.5 | 65-70→4 | >70→2.5
RMSSD : >60→10 | >45→8.5 | >35→7 | >25→5.5 | >15→4 | <15→2.5
Score = moyenne FC + RMSSD (pondéré avec historique perso si dispo).
Commentaire 1-2 phrases, style coach, orienté performance.
${langInstr}
JSON UNIQUEMENT : {"note":7.5,"commentaire":"…","fc":${fc},"rmssd":${rmssd}}`;
}

// ── Handler principal ─────────────────────────────────────────────
export default async function handler(req) {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // ── GET ?clubId=&coachId= → historique groupé par nageur ──
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const clubId = url.searchParams.get('clubId');
    const coachId = url.searchParams.get('coachId');
    if (!clubId || !coachId) return json(null, 400, { error: 'clubId and coachId required' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase
      .from('hrv')
      .select('nageur_nom, date, note, fc, rmssd, commentaire, source')
      .eq('club_id', clubId)
      .eq('coach_id', coachId)
      .order('date', { ascending: false });

    if (error) return json(null, 500, { error: error.message });

    const map = {};
    (data || []).forEach((row) => {
      if (!map[row.nageur_nom]) map[row.nageur_nom] = [];
      map[row.nageur_nom].push({
        date: row.date, note: row.note, fc: row.fc,
        rmssd: row.rmssd, commentaire: row.commentaire, source: row.source,
      });
    });
    const result = Object.entries(map).map(([nageur_nom, historique]) => ({ nageur_nom, historique }));
    return json(null, 200, result);
  }

  // ── PUT { clubId, coachId, entries } → bulk insert entrées pré-calculées ──
  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return json(null, 400, { error: 'Invalid JSON' }); }
    const { clubId, coachId, entries } = body;
    if (!clubId || !coachId || !Array.isArray(entries) || !entries.length) {
      return json(null, 400, { error: 'clubId, coachId, entries[] required' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const rows = entries.map((e) => ({
      club_id: clubId,
      coach_id: coachId,
      nageur_nom: e.nageur_nom,
      date: e.date,
      note: e.note,
      fc: e.fc || null,
      rmssd: e.rmssd || null,
      commentaire: e.commentaire || '',
      source: e.source || 'manual',
    }));

    const { error } = await supabase.from('hrv').upsert(rows, { onConflict: 'club_id,coach_id,nageur_nom,date' });
    if (error) {
      console.error('[hrv PUT] supabase error', JSON.stringify(error));
      return json(null, 500, { error: error.message });
    }
    return json(null, 200, { ok: true, count: rows.length });
  }

  if (req.method !== 'POST') {
    return json(null, 405, { error: 'Method not allowed' });
  }

  // ── Parse body ──
  let body;
  try {
    body = await req.json();
  } catch {
    return json(null, 400, { error: 'Invalid JSON body' });
  }

  const { rr, nageur, historique = [], clubId, coachId, lang = 'fr' } = body;

  // ── Validation ──
  if (!Array.isArray(rr) || rr.length < 50) {
    return json(null, 400, {
      error: `Fichier invalide — ${(rr || []).length} intervalles (minimum 50 requis).`,
    });
  }
  const validRR = rr.filter((v) => typeof v === 'number' && v >= 300 && v <= 2000);
  if (validRR.length < 50) {
    return json(null, 400, {
      error: `Seulement ${validRR.length} intervalles valides (300–2000 ms). Minimum 50 requis.`,
    });
  }
  if (!nageur) {
    return json(null, 400, { error: 'Champ nageur requis.' });
  }

  // ── Calcul métriques ──
  const { fc, rmssd } = calcMetrics(validRR);

  // ── Appel Claude (API key côté serveur uniquement) ──
  let parsed;
  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: buildPrompt(nageur, fc, rmssd, validRR.length, historique, lang),
          },
        ],
      }),
    });

    const data = await anthropicRes.json();
    let raw = (data.content || []).find((b) => b.type === 'text')?.text || '';
    raw = raw.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(raw);
  } catch (err) {
    return json(null, 502, { error: 'Erreur analyse Claude : ' + err.message });
  }

  const entry = {
    date: new Date().toISOString().slice(0, 10),
    note: parsed.note,
    commentaire: parsed.commentaire || '',
    source: 'rr',
    fc: parsed.fc || fc,
    rmssd: parsed.rmssd || rmssd,
  };

  // ── Sauvegarde Supabase ──
  if (clubId && coachId) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      const { error: dbErr } = await supabase.from('hrv').insert({
        club_id: clubId,
        coach_id: coachId,
        nageur_nom: nageur,
        date: entry.date,
        note: entry.note,
        fc: entry.fc,
        rmssd: entry.rmssd,
        commentaire: entry.commentaire,
        source: entry.source,
      });

      if (dbErr) {
        // On log l'erreur mais on retourne quand même le résultat calculé
        console.error('Supabase insert error:', dbErr.message);
      }
    } catch (err) {
      console.error('Supabase error:', err.message);
    }
  }

  return json(null, 200, entry);
}

export const config = { runtime: 'edge' };
