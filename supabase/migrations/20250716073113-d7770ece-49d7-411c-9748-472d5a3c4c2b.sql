-- character_generations 테이블에 토큰 사용량 및 성공 여부 필드 추가
ALTER TABLE public.character_generations 
ADD COLUMN token_usage INTEGER DEFAULT 0,
ADD COLUMN success BOOLEAN DEFAULT true,
ADD COLUMN error_message TEXT;

-- 인덱스 추가로 성능 향상
CREATE INDEX idx_character_generations_created_at ON public.character_generations(created_at);
CREATE INDEX idx_character_generations_success ON public.character_generations(success);
CREATE INDEX idx_character_generations_user_date ON public.character_generations(user_id, DATE(created_at));