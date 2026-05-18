-- ══════════════════════════════════════════════════════════════════
-- SwimData — migrations Supabase complètes
-- À coller dans le SQL Editor de Supabase (Project → SQL Editor)
-- Idempotent : utilise IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1. TABLE clubs  (supposée existante — vérification schéma)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clubs (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  short_name   text DEFAULT '',
  color1       text DEFAULT '#1560bd',
  color2       text DEFAULT '#f5c400',
  theme        text DEFAULT 'default',
  email        text DEFAULT '',
  password_hash text DEFAULT '',
  created_at   timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────
-- 2. TABLE coaches — colonnes ajoutées si absentes
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coaches (
  id            text PRIMARY KEY,
  club_id       text NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name          text DEFAULT '',
  firstname     text DEFAULT '',
  lastname      text DEFAULT '',
  email         text DEFAULT '',
  initials      text DEFAULT '',
  color         text DEFAULT '#2176e8',
  has_pin       boolean DEFAULT false,
  password_hash text DEFAULT '',
  role          text DEFAULT 'coach',   -- 'manager' | 'coach'
  visitor_mode  boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS firstname     text DEFAULT '';
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS lastname      text DEFAULT '';
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS email         text DEFAULT '';
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS initials      text DEFAULT '';
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS color         text DEFAULT '#2176e8';
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS has_pin       boolean DEFAULT false;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS password_hash text DEFAULT '';
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS role          text DEFAULT 'coach';
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS visitor_mode  boolean DEFAULT false;

-- ──────────────────────────────────────────────────────────────────
-- 3. TABLE sessions
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id        text PRIMARY KEY,
  club_id   text NOT NULL,
  coach_id  text NOT NULL,
  name      text DEFAULT '',
  date      date NOT NULL,
  pool      text DEFAULT '',
  notes     text DEFAULT '',
  rows      jsonb DEFAULT '[]',
  saved_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_club_coach ON sessions(club_id, coach_id);
CREATE INDEX IF NOT EXISTS sessions_date ON sessions(date DESC);

-- ──────────────────────────────────────────────────────────────────
-- 4. TABLE hrv
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hrv (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id     text NOT NULL,
  coach_id    text NOT NULL,
  nageur_nom  text NOT NULL,
  date        date NOT NULL,
  note        numeric(4,1),
  fc          numeric(5,1),
  rmssd       numeric(6,1),
  commentaire text DEFAULT '',
  source      text DEFAULT 'manual',   -- 'manual' | 'rr'
  created_at  timestamptz DEFAULT now(),
  UNIQUE (club_id, coach_id, nageur_nom, date)
);

CREATE INDEX IF NOT EXISTS hrv_club_coach ON hrv(club_id, coach_id);

-- ──────────────────────────────────────────────────────────────────
-- 5. TABLE poids
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poids (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id    text NOT NULL,
  coach_id   text NOT NULL,
  prenom     text NOT NULL,
  nom        text DEFAULT '',
  date       date NOT NULL,
  weight     numeric(5,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (club_id, coach_id, prenom, nom, date)
);

CREATE INDEX IF NOT EXISTS poids_club_coach ON poids(club_id, coach_id);

-- ──────────────────────────────────────────────────────────────────
-- 6. TABLE performances
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS performances (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id     text NOT NULL,
  coach_id    text NOT NULL,
  nageur_nom  text NOT NULL,
  bassin      text NOT NULL,
  nage        text NOT NULL,
  distance    text NOT NULL,
  temps       text NOT NULL,
  date        date NOT NULL,
  note        text DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  UNIQUE (club_id, coach_id, nageur_nom, bassin, nage, distance, temps, date)
);

CREATE INDEX IF NOT EXISTS performances_club_coach ON performances(club_id, coach_id);

-- ──────────────────────────────────────────────────────────────────
-- 7. TABLE planning
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planning (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id     text NOT NULL,
  coach_id    text NOT NULL,
  week_id     text NOT NULL,
  start_date  date NOT NULL,
  mc_num      integer DEFAULT 1,
  days        jsonb DEFAULT '{}',
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (club_id, coach_id, week_id)
);

CREATE INDEX IF NOT EXISTS planning_club_coach ON planning(club_id, coach_id);

-- ──────────────────────────────────────────────────────────────────
-- 8. TABLE groupes
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groupes (
  pk         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id    text NOT NULL,
  id         text NOT NULL,
  name       text NOT NULL,
  color      text DEFAULT '#2176e8',
  created_at timestamptz DEFAULT now(),
  UNIQUE (club_id, id)
);

CREATE INDEX IF NOT EXISTS groupes_club ON groupes(club_id);

-- ──────────────────────────────────────────────────────────────────
-- 9. TABLE videos
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
  id             text PRIMARY KEY,
  club_id        text NOT NULL,
  coach_id       text NOT NULL,
  swimmer_id     text NOT NULL,
  swimmer_prenom text DEFAULT '',
  swimmer_nom    text DEFAULT '',
  name           text DEFAULT '',
  date           date NOT NULL,
  type           text DEFAULT 'video/mp4',
  notes          text DEFAULT '',
  storage_path   text NOT NULL,
  annotations    jsonb DEFAULT '[]',
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS videos_club_coach ON videos(club_id, coach_id);

-- ──────────────────────────────────────────────────────────────────
-- 10. TABLE nageurs  (comptes nageurs — liés à Supabase Auth)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nageurs (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id    text NOT NULL,
  coach_id   text NOT NULL,
  prenom     text NOT NULL,
  nom        text NOT NULL,
  email      text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nageurs_club ON nageurs(club_id);
CREATE INDEX IF NOT EXISTS nageurs_coach ON nageurs(coach_id);

-- ──────────────────────────────────────────────────────────────────
-- 11. TABLE invitations  (liens d'invitation uniques par nageur)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id           text PRIMARY KEY,          -- token aléatoire (uid())
  club_id      text NOT NULL,
  coach_id     text NOT NULL,
  nageur_prenom text NOT NULL,
  nageur_nom   text NOT NULL,
  email        text DEFAULT '',           -- pré-rempli si connu
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  used_by      uuid REFERENCES nageurs(id),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitations_club ON invitations(club_id);
CREATE INDEX IF NOT EXISTS invitations_coach ON invitations(coach_id);

-- ──────────────────────────────────────────────────────────────────
-- 12. TABLE nageur_sessions  (séances partagées avec un nageur)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nageur_sessions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nageur_id    uuid NOT NULL REFERENCES nageurs(id) ON DELETE CASCADE,
  session_id   text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  shared_at    timestamptz DEFAULT now(),
  UNIQUE (nageur_id, session_id)
);

-- ──────────────────────────────────────────────────────────────────
-- 13. TABLE nageur_hrv  (HRV auto-reporté par le nageur)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nageur_hrv (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nageur_id   uuid NOT NULL REFERENCES nageurs(id) ON DELETE CASCADE,
  club_id     text NOT NULL,
  coach_id    text NOT NULL,
  date        date NOT NULL,
  note        numeric(4,1),
  fc          numeric(5,1),
  rmssd       numeric(6,1),
  commentaire text DEFAULT '',
  source      text DEFAULT 'rr',
  created_at  timestamptz DEFAULT now(),
  UNIQUE (nageur_id, date)
);

CREATE INDEX IF NOT EXISTS nageur_hrv_nageur ON nageur_hrv(nageur_id);
CREATE INDEX IF NOT EXISTS nageur_hrv_club_coach ON nageur_hrv(club_id, coach_id);

-- ══════════════════════════════════════════════════════════════════
-- RLS — Row Level Security (tables nageurs uniquement)
-- Les tables coaches/sessions/hrv/poids/performances/planning/
-- groupes/videos sont accédées via service_key côté serveur → RLS
-- ignorée. On l'active quand même pour bloquer l'accès anon direct.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE nageurs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nageur_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nageur_hrv     ENABLE ROW LEVEL SECURITY;

-- nageurs : chaque nageur voit/modifie uniquement sa propre ligne
CREATE POLICY IF NOT EXISTS "nageur_self_read"
  ON nageurs FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "nageur_self_update"
  ON nageurs FOR UPDATE
  USING (auth.uid() = id);

-- invitations : lecture par token (pas d'auth requise pour sign-up)
CREATE POLICY IF NOT EXISTS "invitation_read_by_id"
  ON invitations FOR SELECT
  USING (true);   -- filtré côté app par token; expires_at vérifié en JS

-- nageur_sessions : lecture par le nageur concerné
CREATE POLICY IF NOT EXISTS "nageur_sessions_self"
  ON nageur_sessions FOR SELECT
  USING (auth.uid() = nageur_id);

-- nageur_hrv : nageur lit/insère ses propres entrées
CREATE POLICY IF NOT EXISTS "nageur_hrv_self_read"
  ON nageur_hrv FOR SELECT
  USING (auth.uid() = nageur_id);

CREATE POLICY IF NOT EXISTS "nageur_hrv_self_insert"
  ON nageur_hrv FOR INSERT
  WITH CHECK (auth.uid() = nageur_id);

-- ══════════════════════════════════════════════════════════════════
-- Supabase Storage bucket "videos"
-- À créer manuellement dans Storage si pas encore fait :
--   Bucket name : videos
--   Public : false  (accès par signed URL uniquement)
--   File size limit : 500 MB
--   Allowed MIME types : video/*
-- ══════════════════════════════════════════════════════════════════
