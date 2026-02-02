-- AI Features Database Schema
-- This migration adds tables for AI-powered features with approval workflow

-- 1. AI Generations Table - Store all AI generation requests
CREATE TABLE IF NOT EXISTS ai_generations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('image', 'description', 'both')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'generating', 'failed')),
  
  -- Request details
  prompt TEXT NOT NULL,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  requested_by INTEGER NOT NULL REFERENCES admins(id),
  
  -- AI Output
  generated_content TEXT,
  generated_image_url TEXT,
  ai_model VARCHAR(100) DEFAULT 'gemini-pro',
  
  -- Approval workflow
  approved_by INTEGER REFERENCES admins(id),
  rejected_by INTEGER REFERENCES admins(id),
  approval_notes TEXT,
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  
  -- Usage tracking
  tokens_used INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 4) DEFAULT 0.0000,
  generation_time_ms INTEGER,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_ai_gen_status (status),
  INDEX idx_ai_gen_type (type),
  INDEX idx_ai_gen_product (product_id),
  INDEX idx_ai_gen_requested_by (requested_by),
  INDEX idx_ai_gen_created (created_at DESC)
);

-- 2. AI Usage Logs Table - Track daily usage and costs
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id SERIAL PRIMARY KEY,
  
  -- Date and user
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  admin_id INTEGER NOT NULL REFERENCES admins(id),
  
  -- Usage metrics
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  
  -- Type breakdown
  image_requests INTEGER DEFAULT 0,
  description_requests INTEGER DEFAULT 0,
  
  -- Cost tracking
  total_tokens INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10, 4) DEFAULT 0.0000,
  
  -- Quotas
  daily_quota_limit INTEGER DEFAULT 100,
  quota_remaining INTEGER DEFAULT 100,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint: one record per admin per day
  UNIQUE(usage_date, admin_id),
  
  -- Indexes
  INDEX idx_usage_date (usage_date DESC),
  INDEX idx_usage_admin (admin_id),
  INDEX idx_usage_date_admin (usage_date, admin_id)
);

-- 3. AI Settings Table - System-wide AI configuration
CREATE TABLE IF NOT EXISTS ai_settings (
  id SERIAL PRIMARY KEY,
  
  -- API Configuration
  gemini_api_key TEXT,
  api_endpoint VARCHAR(255) DEFAULT 'https://generativelanguage.googleapis.com/v1beta',
  
  -- Rate limiting
  daily_quota_per_user INTEGER DEFAULT 100,
  max_concurrent_requests INTEGER DEFAULT 5,
  
  -- Cost configuration
  cost_per_image_usd DECIMAL(10, 4) DEFAULT 0.0200,
  cost_per_1k_tokens_usd DECIMAL(10, 4) DEFAULT 0.0010,
  
  -- Feature flags
  image_generation_enabled BOOLEAN DEFAULT TRUE,
  description_generation_enabled BOOLEAN DEFAULT TRUE,
  auto_approval_enabled BOOLEAN DEFAULT FALSE,
  
  -- Model configuration
  default_image_model VARCHAR(100) DEFAULT 'gemini-pro-vision',
  default_text_model VARCHAR(100) DEFAULT 'gemini-pro',
  
  -- Metadata
  updated_by INTEGER REFERENCES admins(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Only one settings row
  CHECK (id = 1)
);

-- Insert default AI settings
INSERT INTO ai_settings (id, gemini_api_key, daily_quota_per_user)
VALUES (1, NULL, 100)
ON CONFLICT (id) DO NOTHING;

-- 4. AI Audit Log - Track all AI-related actions
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id SERIAL PRIMARY KEY,
  
  -- Action details
  action_type VARCHAR(100) NOT NULL,
  action_description TEXT,
  
  -- Related entities
  generation_id INTEGER REFERENCES ai_generations(id) ON DELETE SET NULL,
  admin_id INTEGER NOT NULL REFERENCES admins(id),
  
  -- Action result
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  
  -- Metadata
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_audit_action (action_type),
  INDEX idx_audit_admin (admin_id),
  INDEX idx_audit_created (created_at DESC),
  INDEX idx_audit_generation (generation_id)
);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_generations_updated_at BEFORE UPDATE ON ai_generations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_usage_logs_updated_at BEFORE UPDATE ON ai_usage_logs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_settings_updated_at BEFORE UPDATE ON ai_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE ai_generations IS 'Stores all AI generation requests with approval workflow';
COMMENT ON TABLE ai_usage_logs IS 'Daily usage and cost tracking per admin user';
COMMENT ON TABLE ai_settings IS 'System-wide AI configuration and settings';
COMMENT ON TABLE ai_audit_log IS 'Audit trail for all AI-related actions';

COMMENT ON COLUMN ai_generations.status IS 'Current status: pending, approved, rejected, generating, failed';
COMMENT ON COLUMN ai_generations.type IS 'Type of generation: image, description, or both';
COMMENT ON COLUMN ai_usage_logs.daily_quota_limit IS 'Maximum requests allowed per day';
COMMENT ON COLUMN ai_settings.auto_approval_enabled IS 'If true, bypass manual approval (NOT RECOMMENDED)';
