-- Migration: Add initiated_by column to refunds table
-- Description: Track which admin initiated the refund (created it from Returns menu)
-- Status: Production
-- Date: February 2, 2026

-- Add initiated_by column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refunds' AND column_name = 'initiated_by'
    ) THEN
        ALTER TABLE refunds ADD COLUMN initiated_by INTEGER;
        RAISE NOTICE 'Column initiated_by added to refunds table';
    ELSE
        RAISE NOTICE 'Column initiated_by already exists in refunds table';
    END IF;
END $$;

-- Optional: Add foreign key constraint (commented out, uncomment if needed)
-- ALTER TABLE refunds 
-- ADD CONSTRAINT fk_refunds_initiated_by FOREIGN KEY (initiated_by) REFERENCES admins(id);
