
-- New enum: gender_split (separated vs mixed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_split') THEN
    CREATE TYPE public.gender_split AS ENUM ('mixed', 'separated');
  END IF;
END$$;

-- Add column to assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS gender_split public.gender_split NOT NULL DEFAULT 'mixed';
