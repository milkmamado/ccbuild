-- 프로필 생성 시 자동으로 정보 삽입하는 함수 수정
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, approval_status)
    VALUES (
        NEW.id, 
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        -- 최고 관리자 계정 체크 (수정된 이메일)
        CASE 
            WHEN NEW.email = 'torogrr@kakao.com' THEN 'admin'::user_role
            ELSE 'user'::user_role
        END,
        -- 최고 관리자는 자동 승인, 나머지는 대기
        CASE 
            WHEN NEW.email = 'torogrr@kakao.com' THEN 'approved'::approval_status
            ELSE 'pending'::approval_status
        END
    );
    RETURN NEW;
END;
$$;