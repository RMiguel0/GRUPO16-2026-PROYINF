CREATE TABLE IF NOT EXISTS credits (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  rut varchar(30) NOT NULL REFERENCES users(rut) ON UPDATE CASCADE ON DELETE CASCADE,

  status smallint NOT NULL DEFAULT 0,
  product varchar(100) NOT NULL DEFAULT 'Credito de Consumo',

  amount numeric NOT NULL,
  term_months integer NOT NULL,
  interest_rate_monthly numeric,
  interest_rate_annual numeric,
  monthly_payment numeric,
  total_payment numeric,
  total_interest numeric,

  score integer,
  risk varchar(30),
  rejection_reason text,

  source_application_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  confirmed_at timestamp,
  rejected_at timestamp,

  CONSTRAINT credits_status_check CHECK (status IN (0, 1, 2))
);

ALTER TABLE credits
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS rut varchar(30),
  ADD COLUMN IF NOT EXISTS status smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product varchar(100) NOT NULL DEFAULT 'Credito de Consumo',
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS term_months integer,
  ADD COLUMN IF NOT EXISTS interest_rate_monthly numeric,
  ADD COLUMN IF NOT EXISTS interest_rate_annual numeric,
  ADD COLUMN IF NOT EXISTS monthly_payment numeric,
  ADD COLUMN IF NOT EXISTS total_payment numeric,
  ADD COLUMN IF NOT EXISTS total_interest numeric,
  ADD COLUMN IF NOT EXISTS score integer,
  ADD COLUMN IF NOT EXISTS risk varchar(30),
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS source_application_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamp,
  ADD COLUMN IF NOT EXISTS rejected_at timestamp;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM credits WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'Existen creditos sin user_id. Completa credits.user_id antes de aplicar NOT NULL.';
  END IF;

  IF EXISTS (SELECT 1 FROM credits WHERE rut IS NULL OR trim(rut) = '') THEN
    RAISE EXCEPTION 'Existen creditos sin rut auxiliar. Completa credits.rut antes de aplicar NOT NULL.';
  END IF;

  IF EXISTS (SELECT 1 FROM credits WHERE amount IS NULL) THEN
    RAISE EXCEPTION 'Existen creditos sin amount. Completa credits.amount antes de aplicar NOT NULL.';
  END IF;

  IF EXISTS (SELECT 1 FROM credits WHERE term_months IS NULL) THEN
    RAISE EXCEPTION 'Existen creditos sin term_months. Completa credits.term_months antes de aplicar NOT NULL.';
  END IF;
END $$;

ALTER TABLE credits
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN rut SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN product SET NOT NULL,
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN term_months SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'credits'::regclass
      AND conname = 'credits_status_check'
  ) THEN
    ALTER TABLE credits
      ADD CONSTRAINT credits_status_check CHECK (status IN (0, 1, 2));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_rut ON credits(rut);
CREATE INDEX IF NOT EXISTS idx_credits_status ON credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_created_at ON credits(created_at DESC);
