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
**중요: 의학적 정확성 필수**
당신은 의료 전문가로서 실제 의학 가이드라인에 따라 암환자 캐릭터를 생성해야 합니다.

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

**의학적 정확성 가이드라인:**
1. 국내외 암 치료 가이드라인(NCCN, 대한종양학회) 준수
2. 병기에 따른 적절한 치료 순서 및 조합
3. 실제 의학 용어 및 검사명 사용
4. 연령대별 예후 및 치료 반응 고려
5. 부작용은 실제 발생 가능한 것만 포함

다음 형식으로 **의학적으로 검증된** 내용만 생성:

## 1. 환자 기본 프로필
- 현실적인 직업, 가족상황 (연령대 고려)
- 진단 당시 증상 및 발견 경위 (해당 암종 특성 반영)

## 2. 의학적 진단 상세 (실제 의학 기준)
- 정확한 병리학적 진단명 (ICD-10 기준)
- 병기 설정에 맞는 종양 크기, 림프절 전이, 원격전이 상태
- 해당 암종의 표준 종양표지자 수치
- 실제 시행되는 영상검사 결과

## 3. 표준 치료계획 (가이드라인 기준)
- 다학제 진료팀 구성
- 병기별 표준 1차 치료 선택
- 치료 순서 및 기간 (실제 프로토콜 반영)
- 근거기반 보조치료 계획

## 4. 정확한 치료 스케줄 (진단일 ${formData.diagnosisDate} 기준)
**중요: 진단일자를 기준으로 의학적 가이드라인에 따른 정확한 날짜 계산 필수**

다음 형식으로 실제 달력 날짜와 요일을 포함하여 작성:
📅 ${formData.diagnosisDate}: 조직검사 및 확진
📅 [진단일+3주 후 월요일]: 수술 (${formData.surgery})
📅 [수술일+4-6주 후 월요일]: 1차 항암 (${formData.chemotherapy})
📅 [이후 3주 간격으로 항암 스케줄]
📅 [항암 완료 후 3-4주]: 방사선치료 시작 (${formData.radiation})
📅 [방사선 시작일+6주 후]: 방사선치료 완료
📅 [해당되는 경우] ${formData.additionalTreatment} 시작일

- 실제 병원 일정에 맞는 월요일 위주 스케줄링
- 표준 항암 프로토콜 주기 (3주 간격)
- 각 치료 간 회복기간 고려
- 정기 검사 일정 포함 (혈액검사, 영상검사)

## 5. 환자 경험 시나리오
- 연령대와 성별에 맞는 현실적 반응
- 실제 부작용 발생 패턴 및 대처
- 사회복귀 과정의 현실적 묘사

## 6. 실제 증상 경험담 (시기별)
- 의학적으로 검증된 부작용만 포함
- 발생 시기와 정도의 현실적 묘사
- 실제 사용되는 지지요법 및 관리법

## 7. 커뮤니티 활동 가이드
- 의학적 오해를 주지 않는 표현
- 실제 환자들이 사용하는 용어
- 적절한 해시태그 (#암극복 #치료일기 등)
- 주의사항 및 피해야 할 표현

모든 의학적 내용은 현재 표준 치료 가이드라인에 부합해야 하며, 검증되지 않은 치료법이나 부정확한 정보는 절대 포함하지 마세요.
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