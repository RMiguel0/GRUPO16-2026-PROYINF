CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  full_name varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  rut varchar(30),
  phone varchar(50),
  role varchar(30) NOT NULL DEFAULT 'customer',
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_loan_application_user_id ON loan_application(user_id);

CREATE TABLE IF NOT EXISTS processed_documents (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  document_type varchar(80) NOT NULL,
  raw_text text,
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source varchar(80),
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_documents_user_created
  ON processed_documents(user_id, created_at DESC);
