DROP FUNCTION IF EXISTS public.admin_list_account_passwords();

CREATE OR REPLACE FUNCTION public.admin_list_account_passwords()
RETURNS TABLE(
  id uuid,
  full_name text,
  national_id text,
  current_password text,
  whatsapp_number text,
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
    p.whatsapp_number,
    ur.role::text
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role <> 'admin'
  ORDER BY p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_account_passwords() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_account_passwords() TO authenticated;