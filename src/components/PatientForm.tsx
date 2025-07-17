import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Dice6, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PatientFormData } from "@/types/patient";
import { cancerTypes, stages, hospitals, getSurgeryOptions } from "@/data/medicalData";

interface PatientFormProps {
  formData: PatientFormData;
  setFormData: (data: PatientFormData) => void;
  onSubmit: () => void;
  onRandomGenerate: () => void;
  isGenerating: boolean;
}

export const PatientForm = ({ 
  formData, 
  setFormData, 
  onSubmit, 
  onRandomGenerate, 
  isGenerating 
}: PatientFormProps) => {
  const currentSurgeryOptions = getSurgeryOptions(formData.cancerType, formData.stage);

  return (
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
            <Select 
              value={formData.surgeryMethod} 
              onValueChange={(value) => setFormData({...formData, surgeryMethod: value})}
              disabled={!formData.cancerType || !formData.stage}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !formData.cancerType || !formData.stage 
                    ? "암종과 병기를 먼저 선택하세요" 
                    : currentSurgeryOptions.length === 0
                    ? "해당 조건에 수술옵션이 없습니다"
                    : "수술방법을 선택하세요 (선택사항)"
                } />
              </SelectTrigger>
              <SelectContent>
                {currentSurgeryOptions.map((method) => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
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
          <Button onClick={onSubmit} className="flex-1" disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : (
              "📝 캐릭터 생성하기"
            )}
          </Button>
          <Button onClick={onRandomGenerate} variant="outline" className="flex items-center gap-2">
            <Dice6 className="h-4 w-4" />
            랜덤 생성
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};