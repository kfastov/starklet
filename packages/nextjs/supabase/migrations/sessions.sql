-- Create the sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_public_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    session_token TEXT NOT NULL,
    signature_r TEXT NOT NULL,
    signature_s TEXT NOT NULL,
    account_address TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to insert
CREATE POLICY "Enable insert for service role" ON sessions
    FOR INSERT 
    TO service_role
    WITH CHECK (true);

-- Create policy to allow service role to select
CREATE POLICY "Enable select for service role" ON sessions
    FOR SELECT 
    TO service_role
    USING (true);

-- Create policy to allow service role to update
CREATE POLICY "Enable update for service role" ON sessions
    FOR UPDATE
    TO service_role
    USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 