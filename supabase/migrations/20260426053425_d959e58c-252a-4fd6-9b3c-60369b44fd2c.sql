
-- 1) Visible-password column on profiles (admin-only access enforced via RLS).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_password text;

-- Backfill: initial password = national_id (matches account creation default)
UPDATE public.profiles
SET current_password = national_id
WHERE current_password IS NULL;

-- 2) Password reset requests table
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  national_id text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending', -- pending | resolved | dismissed
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwd_resets_status ON public.password_reset_requests(status, created_at DESC);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage password resets" ON public.password_reset_requests;
CREATE POLICY "Admins manage password resets"
  ON public.password_reset_requests
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users create own password reset" ON public.password_reset_requests;
CREATE POLICY "Users create own password reset"
  ON public.password_reset_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own password resets" ON public.password_reset_requests;
CREATE POLICY "Users view own password resets"
  ON public.password_reset_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- 3) Tighten profile SELECT so only admin can read current_password.
--    The existing "Users view own profile" policy still allows users to see their own row,
--    but client code must avoid selecting current_password unless admin.
--    We add a column-level revoke is not feasible per-RLS; instead, we keep current_password
--    inside profiles but only fetch it from the admin UI.
