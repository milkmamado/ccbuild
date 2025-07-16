-- character_generations 테이블에 토큰 사용량 및 성공 여부 필드 추가
ALTER TABLE public.character_generations 
ADD COLUMN IF NOT EXISTS token_usage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS error_message TEXT;