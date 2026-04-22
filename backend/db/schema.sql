-- OMI-TED: Telugu→English Translation Engine & Dubbing Platform
-- PostgreSQL schema
-- Run with: psql -d omited -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

CREATE TYPE transcript_source_enum  AS ENUM ('auto', 'manual');
CREATE TYPE fetch_status_enum        AS ENUM ('pending', 'fetching', 'complete', 'failed');
CREATE TYPE translation_version_enum AS ENUM ('google', 'refined', 'best_model', 'good_model', 'cheap_model');
CREATE TYPE review_status_enum       AS ENUM ('pending', 'approved', 'flagged', 'skipped');
CREATE TYPE job_status_enum          AS ENUM ('queued', 'running', 'complete', 'failed', 'partial');
CREATE TYPE model_tier_enum          AS ENUM ('best', 'good', 'cheap');
CREATE TYPE model_type_enum          AS ENUM ('translation', 'asr', 'tts', 'voice_clone');
CREATE TYPE export_format_enum       AS ENUM ('jsonl', 'csv', 'tmx', 'srt_aligned');
CREATE TYPE cultural_context_enum    AS ENUM ('telangana', 'andhra_pradesh', 'general');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  user_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role         TEXT NOT NULL DEFAULT 'reviewer' CHECK (role IN ('reviewer', 'admin')),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE videos (
  video_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_url            TEXT UNIQUE NOT NULL,
  youtube_video_id       TEXT UNIQUE NOT NULL,
  title                  TEXT,
  channel                TEXT,
  channel_id             TEXT,
  duration_ms            BIGINT,
  published_date         DATE,
  fetch_date             TIMESTAMPTZ,
  telugu_transcript_raw  TEXT,
  english_google_raw     TEXT,
  transcript_source      transcript_source_enum NOT NULL DEFAULT 'auto',
  fetch_status           fetch_status_enum NOT NULL DEFAULT 'pending',
  segment_count          INTEGER NOT NULL DEFAULT 0,
  thumbnail_url          TEXT,
  tags                   TEXT[],
  metadata               JSONB NOT NULL DEFAULT '{}',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_videos_fetch_status     ON videos(fetch_status);
CREATE INDEX idx_videos_youtube_video_id ON videos(youtube_video_id);
CREATE TRIGGER videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE segments (
  segment_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id                   UUID NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  sequence_index             INTEGER NOT NULL,
  start_ms                   BIGINT NOT NULL,
  end_ms                     BIGINT NOT NULL,
  telugu_raw                 TEXT,
  telugu_clean               TEXT,
  english_google             TEXT,
  english_refined            TEXT,
  english_best_model         TEXT,
  english_good_model         TEXT,
  english_cheap_model        TEXT,
  active_translation_version translation_version_enum NOT NULL DEFAULT 'google',
  is_song                    BOOLEAN NOT NULL DEFAULT FALSE,
  song_confidence            FLOAT NOT NULL DEFAULT 0.0 CHECK (song_confidence BETWEEN 0 AND 1),
  quality_score              FLOAT CHECK (quality_score BETWEEN 0 AND 1),
  review_status              review_status_enum NOT NULL DEFAULT 'pending',
  reviewer_id                UUID REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at                TIMESTAMPTZ,
  embedding                  vector(1536),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, sequence_index)
);

CREATE INDEX idx_segments_video_id      ON segments(video_id);
CREATE INDEX idx_segments_review_status ON segments(review_status);
CREATE INDEX idx_segments_is_song       ON segments(is_song);
CREATE TRIGGER segments_updated_at BEFORE UPDATE ON segments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE model_registry (
  model_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name                  TEXT NOT NULL,
  display_name                TEXT,
  provider                    TEXT NOT NULL CHECK (provider IN ('openai','anthropic','google','openrouter','sarvam','local')),
  model_type                  model_type_enum NOT NULL,
  tier                        model_tier_enum,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  endpoint_url                TEXT,
  api_key_env_var             TEXT NOT NULL,
  cost_per_1k_input_tokens    DECIMAL(10,6),
  cost_per_1k_output_tokens   DECIMAL(10,6),
  max_tokens                  INTEGER,
  context_window              INTEGER,
  supports_telugu             BOOLEAN NOT NULL DEFAULT FALSE,
  extra_params                JSONB NOT NULL DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_name, provider)
);

CREATE TRIGGER model_registry_updated_at BEFORE UPDATE ON model_registry FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE translations (
  translation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id      UUID NOT NULL REFERENCES segments(segment_id) ON DELETE CASCADE,
  model_id        UUID NOT NULL,
  tier            model_tier_enum,
  translated_text TEXT NOT NULL,
  source_lang     TEXT NOT NULL DEFAULT 'te',
  target_lang     TEXT NOT NULL DEFAULT 'en',
  tokens_input    INTEGER,
  tokens_output   INTEGER,
  cost_usd        DECIMAL(10,6),
  latency_ms      INTEGER,
  prompt_version  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_translations_segment_id ON translations(segment_id);

ALTER TABLE translations
  ADD CONSTRAINT fk_translations_model
  FOREIGN KEY (model_id) REFERENCES model_registry(model_id) ON DELETE RESTRICT;

CREATE TABLE reviews (
  review_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id    UUID NOT NULL REFERENCES segments(segment_id) ON DELETE CASCADE,
  reviewer_id   UUID REFERENCES users(user_id) ON DELETE SET NULL,
  action        TEXT NOT NULL CHECK (action IN ('approve', 'flag', 'skip', 'edit')),
  previous_text TEXT,
  new_text      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE glossary_terms (
  term_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telugu_term       TEXT NOT NULL,
  english_standard  TEXT NOT NULL,
  domain            TEXT DEFAULT 'general',
  confidence        FLOAT NOT NULL DEFAULT 1.0,
  source            TEXT NOT NULL DEFAULT 'staff',
  usage_count       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE idioms (
  idiom_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telugu_phrase      TEXT NOT NULL UNIQUE,
  english_literal    TEXT,
  english_contextual TEXT NOT NULL,
  cultural_context   cultural_context_enum NOT NULL DEFAULT 'general',
  usage_count        INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE batch_jobs (
  job_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        TEXT NOT NULL CHECK (job_type IN ('ingest', 'translate', 'export', 'benchmark')),
  status          job_status_enum NOT NULL DEFAULT 'queued',
  total_items     INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items    INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER batch_jobs_updated_at BEFORE UPDATE ON batch_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
