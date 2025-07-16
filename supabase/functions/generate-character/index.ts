import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formData } = await req.json();

    const prompt = `
# 의학적 정확성 필수 - 마케팅용 가상 캐릭터 생성 프롬프트

**중요: 당신은 의료 전문가로서 실제 암 치료 가이드라인을 정확히 준수해야 합니다.**

## 환자 정보 입력
- 이름: ${formData.name}
- 나이: ${formData.age}세
- 성별: ${formData.gender}
- 병원: ${formData.hospital}
- 진단일자: ${formData.diagnosisDate}
- 암종: ${formData.cancerType}
- 병기: ${formData.stage}
- 수술: ${formData.surgery}
- 항암치료: ${formData.chemotherapy}
- 방사선치료: ${formData.radiation}
- 추가치료: ${formData.additionalTreatment}

## 암종별 정확한 치료 가이드라인 (병기별 세분화)

### 유방암
- **1-2기**: 수술 → 항암(AC-T: A 60mg/m², C 600mg/m² q3w×4 → T 80mg/m² q3w×4 또는 TC) → 방사선 → 호르몬치료
- **3기**: 선행항암 → 수술 → 방사선 → 호르몬치료
- **4기**: 전신치료 (호르몬치료/항암치료/표적치료)

### 대장암
- **1-3기**: 수술 → 보조항암(FOLFOX: 옥살리플라틴 85mg/m², 류코보린 400mg/m², 5-FU 또는 CAPOX) → 추적관찰
- **4기**: 항암치료 → 수술 고려 (절제 가능시)

### 폐암 (비소세포)
- **1-2기**: 수술 → 보조항암(시스플라틴 기반) → 추적관찰
- **3기**: 동시항암방사선치료 → 면역치료 유지
- **4기**: 표적치료(EGFR/ALK 변이시) 또는 면역항암치료

### 위암
- **1-3기**: 수술 → 보조항암(S-1 또는 CAPOX: 카페시타빈 1000mg/m² bid + 옥살리플라틴 130mg/m²) → 추적관찰
- **4기**: 완화항암치료

### 간암 (BCLC 병기별)
- **조기(BCLC 0-A)**: 수술/RFA/간이식 중 선택
- **중기(BCLC B)**: TACE → 표적치료 (소라페닙/렌바티닙)
- **진행(BCLC C)**: 1차 표적치료 (소라페닙/렌바티닙/아테졸리주맙+베바시주맙)
- **말기(BCLC D)**: 완화치료
- **금기**: Child-Pugh C는 수술 불가

### 갑상선암
- **1-3기**: 수술 → 방사성요오드 (중고위험군) → TSH억제요법
- **4기**: 수술 → 방사성요오드 → 표적치료(렌바티닙/소라페닙)

### 췌장암
- **절제 가능**: 수술 → 보조항암(젬시타빈+카페시타빈 또는 FOLFIRINOX)
- **경계절제**: 선행항암 → 수술 → 보조항암
- **진행/전이**: 완화항암치료

### 전립선암
- **국소**: 수술 또는 방사선치료 → 호르몬치료 (고위험군)
- **전이**: 호르몬치료 → 항암치료 (거세저항성시)

### 자궁경부암
- **1A-1B1**: 수술 → 병리결과에 따라 보조치료 (외부방사선+항암)
- **1B2-IVA**: 동시항암방사선치료 → 근접방사선치료
- **IVB**: 완화항암치료

### 난소암
- **1-4기**: 수술 → 항암(카보플라틴 AUC 5 + 파클리탁셀 175mg/m² q3w×6) → 유지치료

## 의학적 회복기간 (수술 후 항암시작)
- **복부수술**: 4-6주
- **흉부수술**: 6-8주
- **뇌수술**: 2-4주
- **부인과수술**: 4-6주
- **비뇨기과수술**: 4-8주

## 표준 부작용 및 발생률 (CTCAE 등급 기준)
### 항암치료 공통 부작용
- **탈모**: 90% (Grade 1-2)
- **구역/구토**: 60% (Grade 1-3)
- **피로**: 80% (Grade 1-2)
- **백혈구감소**: 70% (Grade 1-4)
- **말초신경병증**: 30% (옥살리플라틴 사용시)

### 방사선치료 부작용
- **피로**: 60% (Grade 1-2)
- **피부반응**: 40% (Grade 1-2)
- **부위별 특이 부작용**: 소화관(설사), 두경부(구강건조), 골반(방광자극)

## 캐릭터 생성 형식

### 1. 환자 기본 프로필
- 연령대에 맞는 현실적 직업과 가족상황
- 해당 암종의 전형적 발견 경위 (검진, 증상 등)
- 실제 발생하는 초기 증상만 포함

### 2. 의학적 진단 (100% 정확한 정보만)
- 정확한 ICD-10 코드와 병리명
- 병기에 정확히 부합하는 종양 크기/전이 상태
- 해당 암종의 표준 종양표지자와 합리적 수치
- 실제 시행되는 영상검사 조합

### 3. 표준 치료계획 (가이드라인 준수)
- 해당 암종의 표준 다학제팀 구성
- **반드시** 병기별 1차 표준치료 선택
- 정확한 항암제 프로토콜명과 용량 (암종별 표준 레지멘)
- 치료 순서는 절대 임의변경 금지

### 4. 정확한 치료 스케줄 (진단일 ${formData.diagnosisDate} 기준)
**의학적 회복기간 반드시 준수:**
- 수술 후 항암시작: 위 명시된 회복기간 준수
- 항암 주기: 해당 프로토콜의 정확한 간격
- 방사선치료: 표준 분할횟수와 기간 (보통 5-7주)
- 실제 외래/입원 패턴 반영

**예시 형식:**
📅 ${formData.diagnosisDate}: 조직검사 및 확진
📅 [의학적 적절한 간격]: [병기별 표준 1차치료]
📅 [표준 프로토콜 주기]: [정확한 항암 스케줄]

### 5. 현실적 환자 경험
- 연령/성별에 맞는 치료 반응
- **검증된 부작용만** 시기별로 포함
- 실제 회복 패턴과 사회복귀 과정
- 한국 의료 환경 고려 (국민건강보험 적용 치료법 우선)

### 6. 의학적으로 검증된 증상 경험
- 해당 치료의 실제 부작용 발생률 고려
- CTCAE 등급에 맞는 현실적 증상 정도
- 표준 지지요법 및 관리법 포함
- 과장되지 않은 현실적 표현

### 7. 커뮤니티 활동 가이드
- 의학적 정확성을 해치지 않는 표현
- 해당 암종 환자들이 실제 사용하는 해시태그
- 민간요법/비과학적 치료법 언급 절대 금지

## 절대 금지사항
- 비표준 치료 순서나 조합
- 해당 암종에 사용하지 않는 항암제
- 의학적 회복기간을 무시한 비현실적 스케줄
- 검증되지 않은 부작용이나 증상
- 의학적 근거가 없는 내용
- 과도한 입원 기간 (대부분 항암치료는 외래)

## 최종 검증 단계
생성된 내용을 다시 한번 검토하여 다음 사항 확인:
- □ 병기와 치료법이 정확히 매칭되는가?
- □ 항암제가 해당 암종에 실제 사용되는가?
- □ 치료 순서가 가이드라인과 일치하는가?
- □ 부작용이 과장되지 않았는가?
- □ 회복기간이 의학적으로 적절한가?

**모든 의학적 내용은 현재 NCCN, ESMO, 대한종양학회 가이드라인 및 한국 암 진료 권고안에 부합해야 합니다.**
`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.content[0].text;

    return new Response(JSON.stringify({ 
      success: true, 
      content: generatedContent,
      characterData: formData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-character function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});