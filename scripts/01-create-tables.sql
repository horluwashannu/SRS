-- Create branches table for branch management
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_code TEXT UNIQUE NOT NULL,
  branch_name TEXT NOT NULL,
  region TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table with roles
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  branch_code TEXT REFERENCES branches(branch_code),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reconciliation_data table
CREATE TABLE IF NOT EXISTS reconciliation_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  file_type TEXT, -- 'previous_pending' or 'current_transactions'
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create weekly_reports table
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  week_start DATE,
  week_end DATE,
  teller_data JSONB,
  customer_service_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create consolidated_proof table
CREATE TABLE IF NOT EXISTS consolidated_proof (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  date DATE,
  currency TEXT, -- 'naira', 'dollar', 'pounds', 'euro'
  balance_bf NUMERIC,
  teller_data JSONB,
  total_deposit NUMERIC,
  total_withdrawal NUMERIC,
  total_balance NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teller_proof table
CREATE TABLE IF NOT EXISTS teller_proof (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  date DATE,
  transaction_data JSONB,
  system_data JSONB,
  discrepancies JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create calculator_data table
CREATE TABLE IF NOT EXISTS calculator_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  branch_code TEXT,
  branch_name TEXT,
  country TEXT,
  currency TEXT,
  denomination_data JSONB,
  total_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reconciliations table as per specification
CREATE TABLE IF NOT EXISTS reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT,
  narration TEXT,
  amount NUMERIC,
  match_result TEXT,
  helper_key TEXT,
  branch_code TEXT REFERENCES branches(branch_code),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidated_proof ENABLE ROW LEVEL SECURITY;
ALTER TABLE teller_proof ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Create policies for reconciliation_data
CREATE POLICY "Users can view their own reconciliation data" ON reconciliation_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reconciliation data" ON reconciliation_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for weekly_reports
CREATE POLICY "Users can view their own weekly reports" ON weekly_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekly reports" ON weekly_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly reports" ON weekly_reports
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for consolidated_proof
CREATE POLICY "Users can view their own consolidated proof" ON consolidated_proof
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consolidated proof" ON consolidated_proof
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for teller_proof
CREATE POLICY "Users can view their own teller proof" ON teller_proof
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own teller proof" ON teller_proof
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for calculator_data
CREATE POLICY "Users can view their own calculator data" ON calculator_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calculator data" ON calculator_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for system_settings (admin only)
CREATE POLICY "Anyone can view system settings" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify system settings" ON system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create policies for branches table
CREATE POLICY "Anyone can view branches" ON branches
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify branches" ON branches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create policies for reconciliations table
CREATE POLICY "Users can view reconciliations from their branch" ON reconciliations
  FOR SELECT USING (
    branch_code IN (
      SELECT branch_code FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reconciliations" ON reconciliations
  FOR INSERT WITH CHECK (true);

-- Add reconciliation_results table for storing reconciliation output
CREATE TABLE IF NOT EXISTS reconciliation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT,
  narration TEXT,
  original_amount TEXT,
  signed_amount NUMERIC,
  is_negative BOOLEAN,
  first15 TEXT,
  last15 TEXT,
  helper_key1 TEXT,
  helper_key2 TEXT,
  side TEXT CHECK (side IN ('debit', 'credit')),
  status TEXT CHECK (status IN ('matched', 'pending')),
  branch_code TEXT REFERENCES branches(branch_code),
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE reconciliation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reconciliation results from their branch" ON reconciliation_results
  FOR SELECT USING (
    branch_code IN (
      SELECT branch_code FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reconciliation results" ON reconciliation_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete reconciliation results" ON reconciliation_results
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
