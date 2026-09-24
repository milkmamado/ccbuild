import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, User, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogle = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("Google 로그인 중 오류가 발생했습니다.");
        return;
      }
      if (result.redirected) return;
      navigate("/");
    } catch {
      setError("Google 로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <User className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">환우 생성기</h1>
          </div>
          <p className="text-muted-foreground">로그인이 필요합니다</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>로그인</CardTitle>
            <CardDescription>Google 계정으로 로그인하세요. 처음 로그인 시 관리자 승인이 필요합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button onClick={handleGoogle} className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Google로 로그인
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
