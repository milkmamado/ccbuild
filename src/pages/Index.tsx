import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Dice6, User, Copy, RotateCcw, Loader2, LogOut, Settings } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const Index = () => {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    hospital: "",
    diagnosisDate: undefined as Date | undefined,
    cancerType: "",
    stage: "",
    surgeryMethod: ""
  });

  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [userProfile, setUserProfile] = useState<{ email: string; role: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, role')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setUserProfile(profile);
        }
      }
    } catch (error) {
      console.error('프로필 조회 오류:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const cancerTypes = [
    "유방암", "갑상선암", "대장암", "폐암", "위암", 
    "간암", "췌장암", "전립선암", "자궁경부암", "난소암"
  ];

  const stages = ["1기(초기)", "2기(중기)", "3기(진행)", "4기(말기)"];
  
  const hospitals = [
    "서울대병원", "삼성서울병원", "아산병원", "세브란스병원", 
    "서울성모병원", "고려대병원"
  ];

  const handleRandomGenerate = () => {
    const randomName = ["김미영", "박순례", "최영수", "이정희", "홍길동"][Math.floor(Math.random() * 5)];
    const randomAge = Math.floor(Math.random() * 60) + 30;
    const randomGender = Math.random() > 0.5 ? "여" : "남";
    const randomCancerType = cancerTypes[Math.floor(Math.random() * cancerTypes.length)];
    const randomStage = stages[Math.floor(Math.random() * stages.length)];
    
    setFormData({
      name: randomName,
      age: randomAge.toString(),
      gender: randomGender,
      hospital: hospitals[Math.floor(Math.random() * hospitals.length)],
      diagnosisDate: new Date(Date.now() - Math.floor(Math.random() * 365 * 2) * 24 * 60 * 60 * 1000),
      cancerType: randomCancerType,
      stage: randomStage,
      surgeryMethod: ["개복수술", "복강경수술", "로봇수술", "내시경수술"][Math.floor(Math.random() * 4)]
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.age || !formData.cancerType) {
      toast({
        title: "필수 정보 누락",
        description: "이름, 나이, 암종은 필수 입력 항목입니다.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-character', {
        body: { formData }
      });

      if (error) throw error;

      if (data.success) {
        setGeneratedContent(data.content);
        toast({
          title: "캐릭터 생성 완료",
          description: "암환자 캐릭터가 성공적으로 생성되었습니다.",
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('캐릭터 생성 오류:', error);
      toast({
        title: "생성 실패",
        description: "캐릭터 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    toast({
      title: "복사 완료",
      description: "생성된 내용이 클립보드에 복사되었습니다.",
    });
  };

  const handleReset = () => {
    setGeneratedContent("");
    setFormData({
      name: "",
      age: "",
      gender: "",
      hospital: "",
      diagnosisDate: undefined,
      cancerType: "",
      stage: "",
      surgeryMethod: ""
    });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">MZ비밀의방</h1>
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

        <Card>
          <CardHeader>
            <CardTitle>캐릭터 정보 입력</CardTitle>
            <CardDescription>
              환자 기본 정보를 입력하면 AI가 병기별 표준치료를 자동으로 결정합니다 (수술방법만 선택 가능)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">환자명 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="환자명을 입력하세요"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="age">나이 *</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  placeholder="나이를 입력하세요"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>성별 *</Label>
                <Select value={formData.gender} onValueChange={(value) => setFormData({...formData, gender: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="성별을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="남">남</SelectItem>
                    <SelectItem value="여">여</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>병원 *</Label>
                <Select value={formData.hospital} onValueChange={(value) => setFormData({...formData, hospital: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="병원을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {hospitals.map((hospital) => (
                      <SelectItem key={hospital} value={hospital}>{hospital}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>진단일자 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.diagnosisDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.diagnosisDate ? format(formData.diagnosisDate, "yyyy-MM-dd") : "진단일자를 선택하세요"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.diagnosisDate}
                      onSelect={(date) => setFormData({...formData, diagnosisDate: date})}
                      disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>암종 *</Label>
                <Select value={formData.cancerType} onValueChange={(value) => setFormData({...formData, cancerType: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="암종을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {cancerTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>병기 *</Label>
                <Select value={formData.stage} onValueChange={(value) => setFormData({...formData, stage: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="병기를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>수술방법</Label>
                <Select value={formData.surgeryMethod} onValueChange={(value) => setFormData({...formData, surgeryMethod: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="수술방법을 선택하세요 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="개복수술">개복수술</SelectItem>
                    <SelectItem value="복강경수술">복강경수술</SelectItem>
                    <SelectItem value="로봇수술">로봇수술</SelectItem>
                    <SelectItem value="내시경수술">내시경수술</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 안내 메시지 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <div className="text-blue-600 text-sm">
                  <strong>💡 자동 치료 결정:</strong>
                  <br />
                  선택하신 암종과 병기에 따라 AI가 의학적 가이드라인에 맞는 표준치료를 자동으로 결정합니다.
                  <br />
                  • 병기별 1차 표준치료만 선택
                  • 부적절한 치료 조합 방지  
                  • 과치료 예방
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-4 pt-6">
              <Button onClick={handleSubmit} className="flex-1" disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  "📝 캐릭터 생성하기"
                )}
              </Button>
              <Button onClick={handleRandomGenerate} variant="outline" className="flex items-center gap-2">
                <Dice6 className="h-4 w-4" />
                랜덤 생성
              </Button>
            </div>
          </CardContent>
        </Card>

        {generatedContent && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                생성된 캐릭터
              </CardTitle>
              <CardDescription>
                AI가 생성한 암환자 캐릭터 정보입니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button onClick={handleCopy} variant="outline" size="sm">
                  <Copy className="mr-2 h-4 w-4" />
                  복사
                </Button>
                <Button onClick={handleReset} variant="outline" size="sm">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  새로 생성
                </Button>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                  {generatedContent}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
