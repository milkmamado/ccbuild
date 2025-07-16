-- 트리거가 제대로 생성되었는지 확인하고 재생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE LOG 'handle_new_user triggered for user: %', NEW.email;
    
    INSERT INTO public.profiles (id, email, full_name, role, approval_status)
    VALUES (
        NEW.id, 
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        CASE 
            WHEN NEW.email = 'torogrr@kakao.com' THEN 'admin'::user_role
            ELSE 'user'::user_role
        END,
        CASE 
            WHEN NEW.email = 'torogrr@kakao.com' THEN 'approved'::approval_status
            ELSE 'pending'::approval_status
        END
    );
    
    RAISE LOG 'Profile created successfully for user: %', NEW.email;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error in handle_new_user for %: %', NEW.email, SQLERRM;
        RETURN NEW;
END;
$$;

-- 기존 트리거 삭제하고 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();