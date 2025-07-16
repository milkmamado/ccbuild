-- 기존 트리거가 있다면 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 프로필 생성 함수 재생성
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
        -- 최고 관리자 계정 체크
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
EXCEPTION
    WHEN OTHERS THEN
        -- 오류 로깅
        RAISE LOG 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW; -- 오류가 발생해도 사용자 생성은 계속 진행
END;
$$;

-- 트리거 재생성
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();