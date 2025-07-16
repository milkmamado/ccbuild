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
암환자 캐릭터 생성 및 치료계획 수립

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

다음 형식으로 상세하고 현실적인 내용을 생성해주세요:

## 1. 환자 기본 프로필
- 직업, 가족상황, 성격 등 배경 설정
- 진단 당시 상황과 심경

## 2. 의학적 진단 상세내용
- 정확한 의학 용어 사용
- 병기에 맞는 종양 크기, 전이 상태
- 관련 검사 결과 (CEA, CA19-9 등)

## 3. 단계별 치료계획
- 진단일 기준 상세 치료 일정
- 각 치료 단계별 기간 및 내용
- 예상되는 부작용 및 관리 방법

## 4. 6개월간 상세 치료 스케줄
- 월별/주별 구체적인 일정
- 입원/외래 구분
- 검사 및 모니터링 계획

## 5. 커뮤니티 활동용 배경스토리
- 일상생활 변화
- 가족/지인과의 관계 변화
- 치료 과정에서의 감정 변화

## 6. 단계별 예상 증상 및 경험담
- 치료 시기별 구체적인 증상
- 실제 환자가 겪을 법한 생생한 경험
- 극복 과정과 대처 방법

## 7. 커뮤니티 활동 가이드
- 적절한 말투와 어조
- 사용 가능한 해시태그 10개
- 주의사항 및 피해야 할 표현

모든 내용은 의학적으로 정확하고 현실적이어야 하며, 실제 환자의 경험을 바탕으로 생성해주세요.
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