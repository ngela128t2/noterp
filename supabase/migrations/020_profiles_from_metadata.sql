-- 020: 회원가입 시 입력한 기본정보를 profiles에 자동 반영
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company, role, phone)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    company   = COALESCE(EXCLUDED.company,   profiles.company),
    role      = COALESCE(EXCLUDED.role,      profiles.role),
    phone     = COALESCE(EXCLUDED.phone,     profiles.phone);
  RETURN new;
END;
$$;
