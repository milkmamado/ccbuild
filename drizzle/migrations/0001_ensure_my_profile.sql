CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _u auth.users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT * INTO _u FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.profiles (id, email, full_name, role, approval_status)
  VALUES (_u.id, _u.email,
    COALESCE(_u.raw_user_meta_data->>'full_name', _u.raw_user_meta_data->>'name', ''),
    CASE WHEN lower(_u.email)='johnsuckapp@gmail.com' THEN 'admin'::user_role ELSE 'user'::user_role END,
    CASE WHEN lower(_u.email)='johnsuckapp@gmail.com' THEN 'approved'::approval_status ELSE 'pending'::approval_status END)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_limits (user_id, daily_limit, monthly_limit)
  VALUES (_u.id, 10, 50) ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

INSERT INTO public.profiles (id, email, full_name, role, approval_status)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), 'user'::user_role,
  CASE WHEN lower(u.email)='dkswjd.5493@gmail.com' THEN 'approved'::approval_status
       WHEN lower(u.email)='torogrr@kakao.com' THEN 'rejected'::approval_status
       ELSE 'pending'::approval_status END
FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id WHERE p.id IS NULL;

INSERT INTO public.user_limits (user_id, daily_limit, monthly_limit)
SELECT p.id, 10, 50 FROM public.profiles p LEFT JOIN public.user_limits l ON l.user_id=p.id WHERE l.user_id IS NULL;