-- Add cancelled status to races
-- Migration: 0001_add_cancelled_status

-- Drop the existing check constraint
ALTER TABLE public.races DROP CONSTRAINT IF EXISTS races_status_check;

-- Add the new check constraint with cancelled status
ALTER TABLE public.races ADD CONSTRAINT races_status_check
  CHECK (status IN ('upcoming', 'locked', 'completed', 'scored', 'cancelled'));