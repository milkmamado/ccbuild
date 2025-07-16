import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, User, LogOut, ArrowLeft, Trash2, Settings, BarChart3, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface UserLimit {
  id: string;
  user_id: string;
  daily_limit: number;
  monthly_limit: number;
}

interface UserStats {
  user_id: string;
  email: string;
  full_name: string;
  daily_count: number;
  monthly_count: number;
  daily_limit: number;
  monthly_limit: number;
}

const Admin = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLimits, setEditingLimits] = useState<{[key: string]: UserLimit}>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
    fetchUserStats();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setProfiles(data || []);
    } catch (error: any) {
      toast({
        title: "오류",
        description: "사용자 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      // 사용자별 일일/월간 생성 횟수와 제한 조회
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          user_limits!inner(daily_limit, monthly_limit)
        `)
        .eq('role', 'user')
        .eq('approval_status', 'approved');

      if (error) throw error;

      const stats: UserStats[] = [];
      
      for (const profile of data || []) {
        // 일일 생성 횟수
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count: dailyCount } = await supabase
          .from('character_generations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .gte('created_at', today.toISOString());

        // 월간 생성 횟수  
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const { count: monthlyCount } = await supabase
          .from('character_generations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .gte('created_at', monthStart.toISOString());

        stats.push({
          user_id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          daily_count: dailyCount || 0,
          monthly_count: monthlyCount || 0,
          daily_limit: profile.user_limits?.[0]?.daily_limit || 5,
          monthly_limit: profile.user_limits?.[0]?.monthly_limit || 50
        });
      }

      setUserStats(stats);
    } catch (error: any) {
      toast({
        title: "오류",
        description: "사용자 통계를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const updateApprovalStatus = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: status })
        .eq('id', userId);

      if (error) {
        throw error;
      }

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
      const { error } = await supabase
        .from('user_limits')
        .upsert({ 
          user_id: userId, 
          daily_limit: dailyLimit, 
          monthly_limit: monthlyLimit 
        });

      if (error) throw error;

      toast({
        title: "성공",
        description: "사용자 제한이 업데이트되었습니다.",
      });

      fetchUserStats();
      setEditingLimits({});
    } catch (error: any) {
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

      if (error) {
        throw error;
      }

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
        return <Badge variant="default" className="bg-green-100 text-green-800">승인됨</Badge>;
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

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">사용자 관리</TabsTrigger>
            <TabsTrigger value="stats">사용 통계</TabsTrigger>
          </TabsList>

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
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  사용 통계 및 제한 관리
                </CardTitle>
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