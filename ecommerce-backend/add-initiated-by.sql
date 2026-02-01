-- Add initiated_by column to refunds table if it doesn't exist
ALTER TABLE refunds ADD COLUMN initiated_by INTEGER;

-- Create foreign key constraint if needed
-- ALTER TABLE refunds ADD CONSTRAINT fk_refunds_initiated_by 
--   FOREIGN KEY (initiated_by) REFERENCES admins(id);
