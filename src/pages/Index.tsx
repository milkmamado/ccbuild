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
    surgery: "",
    chemotherapy: "",
    radiation: "",
    additionalTreatment: ""
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

  // 암종별 치료 옵션 정의
  const treatmentOptions = {
    "유방암": {
      surgery: ["유방보존술", "유방전절제술", "없음"],
      chemotherapy: ["AC-T(8회)", "TC(4회)", "AC(4회)", "없음"],
      radiation: ["있음", "없음"],
      additional: ["호르몬치료", "표적치료", "없음"]
    },
    "갑상선암": {
      surgery: ["갑상선전절제술", "엽절제술", "없음"],
      chemotherapy: ["없음"],
      radiation: ["방사성요오드", "없음"],
      additional: ["TSH억제요법", "없음"]
    },
    "대장암": {
      surgery: ["근치적절제술", "복강경수술", "없음"],
      chemotherapy: ["FOLFOX(12회)", "CAPOX(8회)", "5-FU/LV", "없음"],
      radiation: ["있음", "없음"],
      additional: ["표적치료", "없음"]
    },
    "폐암": {
      surgery: ["폐엽절제술", "쐐기절제술", "없음"],
      chemotherapy: ["카보플라틴+파클리탁셀", "시스플라틴+페메트렉세드", "없음"],
      radiation: ["있음", "없음"],
      additional: ["표적치료", "면역항암제", "없음"]
    },
    "위암": {
      surgery: ["위전절제술", "위부분절제술", "없음"],
      chemotherapy: ["S-1보조요법", "CAPOX", "없음"],
      radiation: ["있음", "없음"],
      additional: ["표적치료", "없음"]
    },
    "간암": {
      surgery: ["부분절제술", "구역절제술", "간이식", "없음"],
      chemotherapy: ["TACE", "고주파열치료", "없음"],
      radiation: ["방사선치료", "없음"],
      additional: ["표적치료(소라페닙)", "표적치료(렌바티닙)", "면역항암제", "없음"]
    },
    "췌장암": {
      surgery: ["췌십이지장절제술", "원위부췌절제술", "없음"],
      chemotherapy: ["젬시타빈+납-파클리탁셀", "FOLFIRINOX", "젬시타빈", "없음"],
      radiation: ["있음", "없음"],
      additional: ["없음"]
    },
    "전립선암": {
      surgery: ["근치적전립선절제술", "없음"],
      chemotherapy: ["없음"],
      radiation: ["외부방사선", "근접방사선", "없음"],
      additional: ["호르몬치료", "없음"]
    },
    "자궁경부암": {
      surgery: ["근치적자궁절제술", "자궁절제술", "없음"],
      chemotherapy: ["시스플라틴", "카보플라틴+파클리탁셀", "없음"],
      radiation: ["외부방사선", "근접방사선", "없음"],
      additional: ["없음"]
    },
    "난소암": {
      surgery: ["종양감축술", "난소절제술", "없음"],
      chemotherapy: ["카보플라틴+파클리탁셀", "없음"],
      radiation: ["없음"],
      additional: ["유지치료", "없음"]
    }
  };

  // 선택된 암종에 따른 치료 옵션 가져오기
  const getCurrentTreatmentOptions = () => {
    if (!formData.cancerType) return null;
    return treatmentOptions[formData.cancerType as keyof typeof treatmentOptions];
  };

  const currentOptions = getCurrentTreatmentOptions();

  const handleRandomGenerate = () => {
    const randomName = ["김미영", "박순례", "최영수", "이정희", "홍길동"][Math.floor(Math.random() * 5)];
    const randomAge = Math.floor(Math.random() * 60) + 30;
    const randomGender = Math.random() > 0.5 ? "여" : "남";
    const randomCancerType = cancerTypes[Math.floor(Math.random() * cancerTypes.length)];
    const randomStage = stages[Math.floor(Math.random() * stages.length)];
    
    // 선택된 암종에 맞는 치료 옵션 사용
    const options = treatmentOptions[randomCancerType as keyof typeof treatmentOptions];
    
    setFormData({
      name: randomName,
      age: randomAge.toString(),
      gender: randomGender,
      hospital: hospitals[Math.floor(Math.random() * hospitals.length)],
      diagnosisDate: new Date(Date.now() - Math.floor(Math.random() * 365 * 2) * 24 * 60 * 60 * 1000),
      cancerType: randomCancerType,
      stage: randomStage,
      surgery: options.surgery[Math.floor(Math.random() * options.surgery.length)],
      chemotherapy: options.chemotherapy[Math.floor(Math.random() * options.chemotherapy.length)],
      radiation: options.radiation[Math.floor(Math.random() * options.radiation.length)],
      additionalTreatment: options.additional[Math.floor(Math.random() * options.additional.length)]
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
      surgery: "",
      chemotherapy: "",
      radiation: "",
      additionalTreatment: ""
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
              환자 기본 정보와 치료 계획을 입력해주세요
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

            {/* 치료 옵션 */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">치료 옵션</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>수술</Label>
                  <Select 
                    value={formData.surgery} 
                    onValueChange={(value) => setFormData({...formData, surgery: value})}
                    disabled={!currentOptions}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={currentOptions ? "수술 옵션 선택" : "먼저 암종을 선택하세요"} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentOptions?.surgery.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>항암치료</Label>
                  <Select 
                    value={formData.chemotherapy} 
                    onValueChange={(value) => setFormData({...formData, chemotherapy: value})}
                    disabled={!currentOptions}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={currentOptions ? "항암치료 옵션 선택" : "먼저 암종을 선택하세요"} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentOptions?.chemotherapy.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>방사선치료</Label>
                  <Select 
                    value={formData.radiation} 
                    onValueChange={(value) => setFormData({...formData, radiation: value})}
                    disabled={!currentOptions}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={currentOptions ? "방사선치료 옵션 선택" : "먼저 암종을 선택하세요"} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentOptions?.radiation.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>추가치료</Label>
                  <Select 
                    value={formData.additionalTreatment} 
                    onValueChange={(value) => setFormData({...formData, additionalTreatment: value})}
                    disabled={!currentOptions}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={currentOptions ? "추가치료 옵션 선택" : "먼저 암종을 선택하세요"} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentOptions?.additional.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
