-- 관리자가 사용자를 삭제할 수 있는 RLS 정책 추가
CREATE POLICY "Admins can delete all profiles" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::user_role));