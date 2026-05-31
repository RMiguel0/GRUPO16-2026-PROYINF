CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  full_name varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  rut varchar(30) NOT NULL,
  phone varchar(50),
  role varchar(30) NOT NULL DEFAULT 'customer',
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT users_rut_unique UNIQUE (rut)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_application (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  identification varchar(30) NOT NULL,
  full_name varchar(255) NOT NULL,
  email varchar(255),
  phone varchar(50),
  monthly_income numeric NOT NULL,
  employment_status varchar(50),
  requested_amount numeric NOT NULL,
  requested_term_months integer NOT NULL,
  score integer,
  risk varchar(10),
  interest_rate_monthly numeric,
  interest_rate_annual numeric,
  monthly_payment numeric,
  rejected boolean NOT NULL DEFAULT false,
  signed boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_loan_application_user_id ON loan_application(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_rut ON credits(rut);
CREATE INDEX IF NOT EXISTS idx_credits_status ON credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_created_at ON credits(created_at DESC);
