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
**중요: 의학적 정확성 필수 - 마케팅용 가상 캐릭터 생성**
당신은 의료 전문가로서 실제 암 치료 가이드라인을 정확히 준수해야 합니다.

환자 정보:
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

**암종별 정확한 치료 가이드라인 준수 필수:**

**유방암:** 수술→항암(AC-T 또는 TC)→방사선→호르몬치료 순서
**대장암:** 수술→보조항암(FOLFOX/CAPOX)→추적관찰
**폐암:** 병기별 수술/항암/방사선/표적치료 조합
**위암:** 수술→보조항암(S-1 또는 CAPOX)
**간암:** BCLC 병기별 TACE/RFA/소라페닙/렌바티닙
**갑상선암:** 수술→방사성요오드→TSH억제요법
**췌장암:** 수술→보조항암(젬시타빈 기반)
**전립선암:** 수술/방사선→호르몬치료
**자궁경부암:** 수술 또는 항암방사선 동시치료
**난소암:** 수술→항암(카보플라틴+파클리탁셀)

다음 형식으로 **의학적 가이드라인에 정확히 부합하는** 내용 생성:

## 1. 환자 기본 프로필
- 연령대에 맞는 현실적 직업과 가족상황
- 해당 암종의 전형적 발견 경위 (검진, 증상 등)
- 실제 발생하는 초기 증상만 포함

## 2. 의학적 진단 (100% 정확한 정보만)
- 정확한 ICD-10 코드와 병리명
- 병기에 정확히 부합하는 종양 크기/전이 상태
- 해당 암종의 표준 종양표지자와 합리적 수치
- 실제 시행되는 영상검사 조합

## 3. 표준 치료계획 (가이드라인 준수)
- 해당 암종의 표준 다학제팀 구성
- **반드시** 병기별 1차 표준치료 선택
- 정확한 항암제 프로토콜명 (암종별 표준 레지멘)
- 치료 순서는 절대 임의변경 금지

## 4. 정확한 치료 스케줄 (진단일 ${formData.diagnosisDate} 기준)
**의학적 회복기간 반드시 준수:**
- 수술 후 항암시작: 4-6주 후
- 항암 주기: 해당 프로토콜의 정확한 간격
- 방사선치료: 표준 분할횟수와 기간
- 실제 외래/입원 패턴 반영

예시 형식:
📅 ${formData.diagnosisDate}: 조직검사 및 확진
📅 [의학적 적절한 간격]: [병기별 표준 1차치료]
📅 [표준 프로토콜 주기]: [정확한 항암 스케줄]

## 5. 현실적 환자 경험
- 연령/성별에 맞는 치료 반응
- **검증된 부작용만** 시기별로 포함
- 실제 회복 패턴과 사회복귀 과정

## 6. 의학적으로 검증된 증상 경험
- 해당 치료의 실제 부작용 발생률 고려
- 과장되지 않은 현실적 증상 정도
- 표준 지지요법 및 관리법 포함

## 7. 커뮤니티 활동 가이드
- 의학적 정확성을 해치지 않는 표현
- 해당 암종 환자들이 실제 사용하는 해시태그
- 민간요법/비과학적 치료법 언급 절대 금지

**절대 금지사항:**
- 비표준 치료 순서나 조합
- 해당 암종에 사용하지 않는 항암제
- 과도한 입원 기간이나 비현실적 스케줄
- 검증되지 않은 부작용이나 증상
- 의학적 근거가 없는 내용

모든 의학적 내용은 현재 NCCN, ESMO, 대한종양학회 가이드라인에 부합해야 합니다.
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