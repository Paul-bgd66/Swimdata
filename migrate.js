// migrate.js — à lancer avec :
// SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node migrate.js

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Manque SUPABASE_URL ou SUPABASE_SERVICE_KEY');
  console.error('    Usage : SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node migrate.js');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'apikey': SUPABASE_SERVICE_KEY,
};

// ── 1. Colonnes actuelles de la table sessions ──────────────────────────────
async function checkColumns(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?limit=0`;
  const res = await fetch(url, { method: 'GET', headers: { ...headers, 'Prefer': 'return=representation' } });
  // PostgREST renvoie les colonnes dans le header Content-Range ou via un OPTIONS
  const opt = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'OPTIONS', headers });
  const body = await opt.text();
  return body;
}

// ── 2. Colonnes via information_schema ─────────────────────────────────────
async function getColumns(table) {
  const url = `${SUPABASE_URL}/rest/v1/information_schema.columns?select=column_name,data_type,is_nullable&table_name=eq.${table}&table_schema=eq.public`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.json();
}

// ── 3. Exécuter DDL via rpc/exec_sql (si la fonction existe dans Supabase) ──
async function execSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function main() {
  console.log('\n📋  Colonnes actuelles de la table sessions\n');

  // Essai via information_schema (fonctionne si le schéma est exposé dans Supabase)
  const cols = await getColumns('sessions');
  if (cols && cols.length) {
    cols.forEach(c => console.log(`  • ${c.column_name.padEnd(20)} ${c.data_type}  (nullable: ${c.is_nullable})`));
  } else {
    console.log('  ⚠️  information_schema.columns non accessible via REST — utilise le Dashboard Supabase : Table Editor → sessions → Columns');
  }

  console.log('\n🔧  Migrations coaches\n');

  const migrations = [
    "ALTER TABLE coaches ADD COLUMN IF NOT EXISTS initials text",
    "ALTER TABLE coaches ADD COLUMN IF NOT EXISTS has_pin bool",
    "ALTER TABLE coaches ADD COLUMN IF NOT EXISTS color text",
  ];

  for (const sql of migrations) {
    process.stdout.write(`  ${sql}\n  → `);
    const result = await execSQL(sql);
    if (result.status === 200 || result.status === 204) {
      console.log('✅  OK');
    } else if (result.status === 404) {
      console.log('⛔  La fonction rpc/exec_sql n\'existe pas dans ce projet Supabase.');
      console.log('\n  ➡️  Copie ce SQL dans le Dashboard Supabase → SQL Editor :\n');
      migrations.forEach(m => console.log(`  ${m};`));
      break;
    } else {
      console.log(`⚠️  status ${result.status} — ${result.body.slice(0, 120)}`);
    }
  }

  console.log('\nDone.\n');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
