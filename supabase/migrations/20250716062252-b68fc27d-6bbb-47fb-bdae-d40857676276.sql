-- 사용자 역할 enum 생성
CREATE TYPE public.user_role AS ENUM ('admin', 'user');

-- 승인 상태 enum 생성  
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- 사용자 프로필 테이블 생성
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'user',
    approval_status approval_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 역할 체크 함수 (보안 정의자 함수로 RLS 회피)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = _user_id 
        AND role = _role 
        AND approval_status = 'approved'
    )
$$;

-- 현재 사용자가 승인된 사용자인지 체크하는 함수
CREATE OR REPLACE FUNCTION public.is_approved_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = _user_id 
        AND approval_status = 'approved'
    )
$$;

-- RLS 정책들
-- 사용자는 자신의 프로필만 볼 수 있음
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 관리자는 모든 프로필 조회 가능
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 사용자는 자신의 프로필 업데이트 가능 (역할과 승인상태 제외)
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND approval_status = (SELECT approval_status FROM public.profiles WHERE id = auth.uid())
);

-- 관리자는 모든 프로필 업데이트 가능
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 신규 사용자 프로필 생성 허용
CREATE POLICY "Allow profile creation" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 프로필 생성 시 자동으로 정보 삽입하는 함수
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
            WHEN NEW.email = 'torogrr@kaka.com' THEN 'admin'::user_role
            ELSE 'user'::user_role
        END,
        -- 최고 관리자는 자동 승인, 나머지는 대기
        CASE 
            WHEN NEW.email = 'torogrr@kaka.com' THEN 'approved'::approval_status
            ELSE 'pending'::approval_status
        END
    );
    RETURN NEW;
END;
$$;

-- 사용자 생성 시 트리거 실행
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();