import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { 
  User, 
  LogOut, 
  Check, 
  X, 
  Settings, 
  Save, 
  Trash2, 
  ArrowLeft,
  Users,
  Activity,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  approval_status: string;
  created_at: string;
}

interface UserStats {
  user_id: string;
  email: string;
  full_name: string;
  daily_count: number;
  monthly_count: number;
  daily_limit: number;
  monthly_limit: number;
  total_tokens: number;
}

interface EditingLimits {
  [key: string]: {
    id: string;
    user_id: string;
    daily_limit: number;
    monthly_limit: number;
  };
}

interface DashboardStats {
  total_users: number;
  total_generations: number;
  total_tokens: number;
  success_rate: number;
}

const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [editingLimits, setEditingLimits] = useState<EditingLimits>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, approval_status')
        .eq('id', session.user.id)
        .single();

      if (!profile || profile.role !== 'admin' || profile.approval_status !== 'approved') {
        navigate("/");
        return;
      }

      await Promise.all([
        fetchProfiles(),
        fetchUserStats(), 
        fetchDashboardStats()
      ]);
      setLoading(false);
    };

    checkAdmin();
  }, [navigate]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      toast({
        title: "오류",
        description: "사용자 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const fetchUserStats = async () => {
    try {
      // 사용자별 통계 조회
      const { data: statsData, error: statsError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          user_limits!inner(daily_limit, monthly_limit)
        `)
        .eq('approval_status', 'approved');

      if (statsError) throw statsError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const userStatsWithCounts = await Promise.all(
        statsData.map(async (user: any) => {
          // 일일 사용량
          const { count: dailyCount } = await supabase
            .from('character_generations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('success', true)
            .gte('created_at', today.toISOString());

          // 월간 사용량
          const { count: monthlyCount } = await supabase
            .from('character_generations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('success', true)
            .gte('created_at', monthStart.toISOString());

          // 총 토큰 사용량
          const { data: tokenData } = await supabase
            .from('character_generations')
            .select('token_usage')
            .eq('user_id', user.id)
            .eq('success', true);

          const totalTokens = tokenData?.reduce((sum, record) => sum + (record.token_usage || 0), 0) || 0;

          return {
            user_id: user.id,
            email: user.email,
            full_name: user.full_name,
            daily_count: dailyCount || 0,
            monthly_count: monthlyCount || 0,
            daily_limit: user.user_limits?.daily_limit || 5,
            monthly_limit: user.user_limits?.monthly_limit || 50,
            total_tokens: totalTokens
          };
        })
      );

      setUserStats(userStatsWithCounts);
    } catch (error: any) {
      console.error('사용자 통계 로드 오류:', error);
      toast({
        title: "오류",
        description: "사용자 통계를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const fetchDashboardStats = async () => {
    try {
      // 총 사용자 수
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'approved');

      // 총 생성 횟수
      const { count: totalGenerations } = await supabase
        .from('character_generations')
        .select('*', { count: 'exact', head: true });

      // 총 토큰 사용량
      const { data: tokenData } = await supabase
        .from('character_generations')
        .select('token_usage, success');

      const totalTokens = tokenData?.reduce((sum, record) => sum + (record.token_usage || 0), 0) || 0;
      const successfulRequests = tokenData?.filter(record => record.success).length || 0;
      const successRate = totalGenerations ? (successfulRequests / totalGenerations) * 100 : 0;

      setDashboardStats({
        total_users: totalUsers || 0,
        total_generations: totalGenerations || 0,
        total_tokens: totalTokens,
        success_rate: successRate
      });
    } catch (error: any) {
      console.error('대시보드 통계 로드 오류:', error);
    }
  };

  const updateApprovalStatus = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: status })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "성공",
        description: `사용자가 ${status === 'approved' ? '승인' : '거부'}되었습니다.`,
      });

      fetchProfiles();
      fetchUserStats();
    } catch (error: any) {
      toast({
        title: "오류",
        description: "상태 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const updateUserLimits = async (userId: string, dailyLimit: number, monthlyLimit: number) => {
    try {
      // 먼저 기존 레코드가 있는지 확인
      const { data: existingLimit } = await supabase
        .from('user_limits')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      let error;
      
      if (existingLimit) {
        // 기존 레코드가 있으면 업데이트
        ({ error } = await supabase
          .from('user_limits')
          .update({ 
            daily_limit: dailyLimit, 
            monthly_limit: monthlyLimit 
          })
          .eq('user_id', userId));
      } else {
        // 기존 레코드가 없으면 삽입
        ({ error } = await supabase
          .from('user_limits')
          .insert({ 
            user_id: userId, 
            daily_limit: dailyLimit, 
            monthly_limit: monthlyLimit 
          }));
      }

      if (error) {
        console.error('제한 업데이트 오류:', error);
        throw error;
      }

      toast({
        title: "성공",
        description: "사용자 제한이 업데이트되었습니다.",
      });

      fetchUserStats();
      setEditingLimits({});
    } catch (error: any) {
      console.error('updateUserLimits 오류:', error);
      toast({
        title: "오류",
        description: "제한 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const startEditingLimits = (stat: UserStats) => {
    setEditingLimits({
      ...editingLimits,
      [stat.user_id]: {
        id: '',
        user_id: stat.user_id,
        daily_limit: stat.daily_limit,
        monthly_limit: stat.monthly_limit
      }
    });
  };

  const cancelEditingLimits = (userId: string) => {
    const newEditingLimits = { ...editingLimits };
    delete newEditingLimits[userId];
    setEditingLimits(newEditingLimits);
  };

  const saveLimits = (userId: string) => {
    const limits = editingLimits[userId];
    if (limits) {
      updateUserLimits(userId, limits.daily_limit, limits.monthly_limit);
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "삭제 완료",
        description: `${userEmail} 사용자가 삭제되었습니다.`,
      });

      fetchProfiles();
      fetchUserStats();
    } catch (error: any) {
      toast({
        title: "오류",
        description: "사용자 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default">승인됨</Badge>;
      case 'rejected':
        return <Badge variant="destructive">거부됨</Badge>;
      case 'pending':
        return <Badge variant="secondary">대기중</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    return role === 'admin' ? 
      <Badge variant="default">관리자</Badge> : 
      <Badge variant="outline">사용자</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <User className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">관리자 패널</h1>
              <p className="text-muted-foreground">사용자 승인 관리</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                캐릭터 생성
              </Button>
            </Link>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">대시보드</TabsTrigger>
            <TabsTrigger value="users">사용자 관리</TabsTrigger>
            <TabsTrigger value="stats">사용 통계</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 사용자</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats?.total_users || 0}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 토큰 사용량</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats?.total_tokens?.toLocaleString() || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 생성 횟수</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats?.total_generations || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">성공률</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats?.success_rate.toFixed(1) || 0}%</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>사용자 목록</CardTitle>
                <CardDescription>
                  등록된 모든 사용자와 승인 상태를 확인할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>가입일</TableHead>
                      <TableHead>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell>{profile.full_name}</TableCell>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>{getRoleBadge(profile.role)}</TableCell>
                        <TableCell>{getStatusBadge(profile.approval_status)}</TableCell>
                        <TableCell>
                          {new Date(profile.created_at).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {profile.approval_status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => updateApprovalStatus(profile.id, 'approved')}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateApprovalStatus(profile.id, 'rejected')}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>사용자 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    정말로 "{profile.full_name} ({profile.email})" 사용자를 삭제하시겠습니까?
                                    이 작업은 되돌릴 수 없습니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteUser(profile.id, profile.email)}
                                  >
                                    삭제
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle>사용 통계 및 제한 관리</CardTitle>
                <CardDescription>
                  사용자별 AI 캐릭터 생성 현황과 일일/월간 제한을 관리할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>사용자</TableHead>
                      <TableHead>일일 사용량</TableHead>
                      <TableHead>월간 사용량</TableHead>
                      <TableHead>총 토큰 사용량</TableHead>
                      <TableHead>일일 제한</TableHead>
                      <TableHead>월간 제한</TableHead>
                      <TableHead>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userStats.map((stat) => (
                      <TableRow key={stat.user_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{stat.full_name}</div>
                            <div className="text-sm text-muted-foreground">{stat.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={stat.daily_count >= stat.daily_limit ? "destructive" : "secondary"}>
                            {stat.daily_count} / {stat.daily_limit}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={stat.monthly_count >= stat.monthly_limit ? "destructive" : "secondary"}>
                            {stat.monthly_count} / {stat.monthly_limit}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{stat.total_tokens.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          {editingLimits[stat.user_id] ? (
                            <Input
                              type="number"
                              min="1"
                              value={editingLimits[stat.user_id].daily_limit}
                              onChange={(e) => setEditingLimits({
                                ...editingLimits,
                                [stat.user_id]: {
                                  ...editingLimits[stat.user_id],
                                  daily_limit: parseInt(e.target.value) || 1
                                }
                              })}
                              className="w-20"
                            />
                          ) : (
                            <span>{stat.daily_limit}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingLimits[stat.user_id] ? (
                            <Input
                              type="number"
                              min="1"
                              value={editingLimits[stat.user_id].monthly_limit}
                              onChange={(e) => setEditingLimits({
                                ...editingLimits,
                                [stat.user_id]: {
                                  ...editingLimits[stat.user_id],
                                  monthly_limit: parseInt(e.target.value) || 1
                                }
                              })}
                              className="w-20"
                            />
                          ) : (
                            <span>{stat.monthly_limit}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingLimits[stat.user_id] ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveLimits(stat.user_id)}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelEditingLimits(stat.user_id)}
                              >
                                취소
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditingLimits(stat)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;