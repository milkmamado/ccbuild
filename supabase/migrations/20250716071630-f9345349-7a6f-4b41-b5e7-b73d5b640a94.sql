-- 사용자별 생성 제한 설정 테이블
CREATE TABLE public.user_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  daily_limit INTEGER NOT NULL DEFAULT 5,
  monthly_limit INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 캐릭터 생성 기록 테이블
CREATE TABLE public.character_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  character_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 정책 설정
ALTER TABLE public.user_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_generations ENABLE ROW LEVEL SECURITY;

-- user_limits 정책
CREATE POLICY "Admins can view all user limits" 
ON public.user_limits 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update all user limits" 
ON public.user_limits 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can insert user limits" 
ON public.user_limits 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view own limits" 
ON public.user_limits 
FOR SELECT 
USING (auth.uid() = user_id);

-- character_generations 정책
CREATE POLICY "Admins can view all generations" 
ON public.character_generations 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view own generations" 
ON public.character_generations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations" 
ON public.character_generations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 인덱스 추가
CREATE INDEX idx_user_limits_user_id ON public.user_limits(user_id);
CREATE INDEX idx_character_generations_user_id ON public.character_generations(user_id);
CREATE INDEX idx_character_generations_created_at ON public.character_generations(created_at);

-- 업데이트 트리거
CREATE TRIGGER update_user_limits_updated_at
BEFORE UPDATE ON public.user_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 새 사용자에 대한 기본 제한 설정을 위한 함수
CREATE OR REPLACE FUNCTION public.create_default_user_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_limits (user_id, daily_limit, monthly_limit)
    VALUES (NEW.id, 5, 50)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- 프로필 생성 시 기본 제한 설정 트리거
CREATE TRIGGER create_user_limits_on_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_default_user_limits();