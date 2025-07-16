import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    // 인증 상태 리스너 설정
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // 사용자 승인 상태 확인
          setTimeout(async () => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('approval_status')
              .eq('id', session.user.id)
              .single();
            
            setIsApproved(profile?.approval_status === 'approved');
            setLoading(false);
          }, 0);
        } else {
          setIsApproved(false);
          setLoading(false);
        }
      }
    );

    // 기존 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // 사용자 승인 상태 확인
        supabase
          .from('profiles')
          .select('approval_status')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setIsApproved(profile?.approval_status === 'approved');
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !session) {
    return <Navigate to="/auth" replace />;
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">승인 대기 중</h1>
          <p className="text-muted-foreground">
            계정이 관리자 승인 대기 중입니다.<br />
            관리자가 승인하면 사용할 수 있습니다.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-primary hover:underline"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;