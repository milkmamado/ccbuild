-- torogrr@kakao.com을 최고 관리자로 업데이트
UPDATE public.profiles 
SET 
    role = 'admin'::user_role,
    approval_status = 'approved'::approval_status
WHERE email = 'torogrr@kakao.com';

-- 혹시 프로필이 없다면 auth.users에서 확인해서 생성
INSERT INTO public.profiles (id, email, full_name, role, approval_status)
SELECT 
    au.id, 
    au.email,
    COALESCE(au.raw_user_meta_data ->> 'full_name', au.email) as full_name,
    'admin'::user_role as role,
    'approved'::approval_status as approval_status
FROM auth.users au
WHERE au.email = 'torogrr@kakao.com' 
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.email = au.email
    );