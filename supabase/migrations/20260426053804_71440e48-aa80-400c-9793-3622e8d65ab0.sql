
-- Hide current_password column from regular SELECT (RLS is row-level; we use
-- column-level GRANT to keep supervisors from seeing student passwords).
REVOKE SELECT (current_password) ON public.profiles FROM authenticated;
REVOKE SELECT (current_password) ON public.profiles FROM anon;

-- Admin-only function to fetch passwords for the password-management page.
CREATE OR REPLACE FUNCTION public.admin_list_account_passwords()
RETURNS TABLE (
  id uuid,
  full_name text,
  national_id text,
  current_password text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.national_id,
    p.current_password,
    ur.role::text
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role <> 'admin'
  ORDER BY p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_account_passwords() TO authenticated;
