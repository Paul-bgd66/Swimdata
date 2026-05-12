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

// ── Upsert via PostgREST ────────────────────────────────────────────────────
async function upsert(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

// ── Colonnes via information_schema ────────────────────────────────────────
async function getColumns(table) {
  const url = `${SUPABASE_URL}/rest/v1/information_schema.columns?select=column_name,data_type,is_nullable&table_name=eq.${table}&table_schema=eq.public`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.json();
}

// ── DDL via rpc/exec_sql ────────────────────────────────────────────────────
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

  // ── 1. Colonnes actuelles de sessions ──────────────────────────────────────
  console.log('\n📋  Colonnes actuelles de la table sessions\n');
  const cols = await getColumns('sessions');
  if (cols && cols.length) {
    cols.forEach(c => console.log(`  • ${c.column_name.padEnd(20)} ${c.data_type}  (nullable: ${c.is_nullable})`));
  } else {
    console.log('  ⚠️  information_schema.columns non accessible via REST');
  }

  // ── 2. Migrations DDL coaches ───────────────────────────────────────────────
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
      console.log('⛔  rpc/exec_sql absent — copie ce SQL dans Dashboard → SQL Editor :\n');
      migrations.forEach(m => console.log(`  ${m};`));
      break;
    } else {
      console.log(`⚠️  status ${result.status} — ${result.body.slice(0, 120)}`);
    }
  }

  // ── 3. Upsert club ──────────────────────────────────────────────────────────
  console.log('\n🏊  Upsert club\n');

  const club = {
    id: 'moz9da6ny54zkojwig',
    name: 'canet66',
  };
  process.stdout.write(`  clubs ← ${JSON.stringify(club)}\n  → `);
  const clubResult = await upsert('clubs', club);
  if (clubResult.status === 200 || clubResult.status === 201) {
    console.log('✅  OK', clubResult.body.slice(0, 120));
  } else {
    console.log(`⚠️  status ${clubResult.status} — ${clubResult.body.slice(0, 200)}`);
  }

  // ── 4. Upsert coach ─────────────────────────────────────────────────────────
  console.log('\n👤  Upsert coach\n');

  const coach = {
    id: 'mozteq1ey1otbsnaq1',
    club_id: 'moz9da6ny54zkojwig',
    name: 'Paul',
    role: 'manager',
  };
  process.stdout.write(`  coaches ← ${JSON.stringify(coach)}\n  → `);
  const coachResult = await upsert('coaches', coach);
  if (coachResult.status === 200 || coachResult.status === 201) {
    console.log('✅  OK', coachResult.body.slice(0, 120));
  } else {
    console.log(`⚠️  status ${coachResult.status} — ${coachResult.body.slice(0, 200)}`);
  }

  console.log('\nDone.\n');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
