import { Button } from "@/components/ui/button";
import { User, LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UserProfile } from "@/types/patient";

interface HeaderProps {
  userProfile: UserProfile | null;
}

export const Header = ({ userProfile }: HeaderProps) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <User className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">환우 생성기</h1>
          <p className="text-sm text-muted-foreground">
            환영합니다, {userProfile?.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {userProfile?.role === 'admin' && (
          <Link to="/admin">
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              관리자 패널
            </Button>
          </Link>
        )}
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </div>
  );
};