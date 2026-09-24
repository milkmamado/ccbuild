CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _is_master boolean := lower(NEW.email) = 'johnsuckapp@gmail.com';
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    CASE WHEN _is_master THEN 'admin'::user_role ELSE 'user'::user_role END,
    CASE WHEN _is_master THEN 'approved'::approval_status ELSE 'pending'::approval_status END
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_limits (user_id, daily_limit, monthly_limit)
  VALUES (NEW.id, 10, 50)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = _role AND approval_status = 'approved'
  )
$$;

-- Block non-admins from changing privileged profile fields
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Not allowed to modify role, approval status or email';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER protect_profile_privileged_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Generation logs are written only by backend functions (service role)
DROP POLICY IF EXISTS "Users can insert their own generations" ON public.character_generations;