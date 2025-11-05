import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// API 키 확인
if (!claudeApiKey) {
  console.error('CLAUDE_API_KEY가 설정되지 않았습니다.');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // API 키 체크
  if (!claudeApiKey) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Claude API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { formData } = await req.json();
    
    // 인증 확인
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 토큰으로 사용자 정보 가져오기
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '인증이 필요합니다.' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 마스터 관리자 확인 (torogrr@kakao.com은 무제한)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', user.id)
      .single();

    const isMasterAdmin = userProfile?.email === 'torogrr@kakao.com' && userProfile?.role === 'admin';

    // 마스터 관리자가 아닌 경우에만 제한 확인
    if (!isMasterAdmin) {
      // 사용자 제한 확인
      const { data: userLimit } = await supabase
        .from('user_limits')
        .select('daily_limit, monthly_limit')
        .eq('user_id', user.id)
        .single();

      if (!userLimit) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: '사용자 제한 설정을 찾을 수 없습니다.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 일일 사용량 확인
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: dailyCount } = await supabase
        .from('character_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString());

      if ((dailyCount || 0) >= userLimit.daily_limit) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `일일 생성 한도(${userLimit.daily_limit}회)를 초과했습니다.` 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 월간 사용량 확인
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const { count: monthlyCount } = await supabase
        .from('character_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString());

      if ((monthlyCount || 0) >= userLimit.monthly_limit) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `월간 생성 한도(${userLimit.monthly_limit}회)를 초과했습니다.` 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

const prompt = `

**중요: 당신은 의료 전문가로서 실제 암 치료 가이드라인을 정확히 준수해야 합니다.**

## 환자 정보 입력
- 이름: ${formData.name}
- 나이: ${formData.age}세
- 성별: ${formData.gender}
- 병원: ${formData.hospital}
- 진단일자: ${formData.diagnosisDate}
- 암종: ${formData.cancerType}
- 병기: ${formData.stage}
${formData.surgeryMethod ? `- 수술방법: ${formData.surgeryMethod}` : ''}

## AI 자동 치료 결정 원칙
**중요: 입력된 암종과 병기에 따라 AI가 의학적 가이드라인에 맞는 표준치료만 자동 선택해야 함**

### 치료 결정 규칙:
1. **병기별 1차 표준치료만 선택** - 과치료 금지
2. **해당 암종에 적용되지 않는 치료는 절대 포함하지 말 것**
3. **조기암에 불필요한 전신치료 금지**
4. **진행암에만 해당하는 치료를 조기암에 적용 금지**

## 암종별 병기별 정확한 표준치료 가이드라인

### 유방암
- **1기**: 수술 → 호르몬치료(ER/PR+) 또는 관찰
- **2기**: 수술 → 항암치료(AC-T 또는 TC) → 방사선치료 → 호르몬치료(ER/PR+)
- **3기**: 선행항암치료 → 수술 → 방사선치료 → 호르몬치료(ER/PR+) → 표적치료(HER2+)
- **4기**: 전신치료 (호르몬치료/항암치료/표적치료 중 적절한 조합)

### 대장암
- **1-2기**: 수술 → 관찰 (고위험 2기는 FOLFOX 보조항암)
- **3기**: 수술 → 보조항암치료(FOLFOX 또는 CAPOX 6개월)
- **4기**: 항암치료(FOLFOX + 베바시주맙) → 수술 고려

### 폐암 (비소세포)
- **1기**: 수술 → 관찰
- **2기**: 수술 → 보조항암치료(시스플라틴 기반)
- **3기**: 동시항암방사선치료 → 면역치료 유지(펜브롤리주맙)
- **4기**: 분자검사 후 표적치료(EGFR/ALK+) 또는 면역항암치료

### 위암
- **1기**: 수술 → 관찰
- **2-3기**: 수술 → 보조항암치료(S-1 또는 CAPOX)
- **4기**: 완화항암치료(CAPOX + 트라스투주맙 for HER2+)

### 간암 (BCLC 병기별)
- **조기(BCLC 0-A)**: 수술/RFA/간이식 중 선택
- **중기(BCLC B)**: TACE
- **진행(BCLC C)**: 1차 표적치료 (소라페닙/렌바티닙/아테졸리주맙+베바시주맙)
- **말기(BCLC D)**: 완화치료

### 갑상선암
- **1-2기**: 수술 → 관찰 (저위험군) 또는 방사성요오드(중위험군)
- **3기**: 수술 → 방사성요오드 → TSH억제요법
- **4기**: 수술 → 방사성요오드 → 표적치료(렌바티닙/소라페닙)

### 췌장암
- **절제 가능**: 수술 → 보조항암치료(젬시타빈+카페시타빈)
- **경계절제**: 선행항암치료(FOLFIRINOX) → 수술 → 보조항암치료
- **진행/전이**: 완화항암치료(FOLFIRINOX 또는 젬시타빈+나브-파클리탁셀)

### 전립선암
- **국소**: 수술 또는 방사선치료
- **고위험**: 수술 → 호르몬치료 또는 방사선치료 + 호르몬치료
- **전이**: 호르몬치료(ADT + 아비라테론/엔잘루타마이드)

### 자궁경부암
- **1A-1B1**: 수술
- **1B2-IVA**: 동시항암방사선치료(시스플라틴 기반) → 근접방사선치료
- **IVB**: 완화항암치료 + 면역치료(펨브롤리주맙)

### 난소암
- **1-2기**: 수술 → 항암치료(카보플라틴 + 파클리탁셀)
- **3-4기**: 수술 → 항암치료 → 유지치료(올라파립 for BRCA+ or 베바시주맙)

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
- 해당 암종의 전형적 발견 경위 (검진, 증상 등)
- 실제 발생하는 초기 증상만 포함

### 2. 의학적 진단 (100% 정확한 정보만)
- 정확한 ICD-10 코드와 병리명
- 병기에 정확히 부합하는 종양 크기/전이 상태
- 해당 암종의 표준 종양표지자와 합리적 수치
- 실제 시행되는 영상검사 조합

### 3. 표준 치료계획 (가이드라인 완벽 준수)
- 해당 암종의 표준 다학제팀 구성
- **반드시** 병기별 1차 표준치료만 선택
- ${formData.surgeryMethod ? `선택된 수술방법(${formData.surgeryMethod})을 치료계획에 반영` : '해당 암종에 적합한 수술방법 선택'}
- 정확한 항암제 프로토콜명과 용량 (암종별 표준 레지멘)
- 치료 순서는 절대 임의변경 금지
- **부적절한 치료 조합 절대 금지**

### 4. 정확한 치료 스케줄 (진단일 ${formData.diagnosisDate} 기준)
**의학적 회복기간 반드시 준수:**
- 수술 후 항암시작: 위 명시된 회복기간 준수
- 항암 주기: 해당 프로토콜의 정확한 간격  
- 방사선치료: 표준 분할횟수와 기간 (보통 5-7주)
- 실제 외래/입원 패턴 반영

**스케줄 형식:**
📅 ${formData.diagnosisDate}: 조직검사 및 확진
📅 [의학적 적절한 간격]: [병기별 표준 1차치료]
📅 [표준 프로토콜 주기]: [선택된 치료의 정확한 스케줄]

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
- 조기암에 불필요한 전신치료 (예: 1기 유방암에 표적치료)
- 해당 부위에 불필요한 방사선치료 (예: 결장암에 방사선치료)
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
- □ 조기암에 과치료가 포함되지 않았는가?

**모든 의학적 내용은 현재 NCCN, ESMO, 대한종양학회 가이드라인 및 한국 암 진료 권고안에 부합해야 합니다.**

## 필수 정보 표시 가이드라인
**중요: 환자 기본 프로필 섹션에 다음 정보들을 반드시 포함해야 합니다:**

### 1. 환자 기본 프로필
- 나이/성별/이름 정보
- 발견 경위 및 초기 증상 (기존 내용 유지)
- **진료 병원**: ${formData.hospital}
- **진단일자**: ${formData.diagnosisDate}
- **병기**: ${formData.stage}
${formData.surgeryMethod ? `- **수술방법**: ${formData.surgeryMethod}` : ''}

이 정보들은 환자 기본 프로필 섹션에서 누락되지 않고 반드시 명시되어야 합니다.
`;

    // Claude API 호출 (재시도 로직 포함)
    const callClaudeAPI = async (retryCount = 0) => {
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

      // 429 (Rate Limit), 529 (Overloaded) 등의 경우 재시도
      if (!response.ok && (response.status === 429 || response.status === 529) && retryCount < 3) {
        console.log(`Claude API error ${response.status}, retrying... (${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000)); // 점진적 대기
        return callClaudeAPI(retryCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Claude API error: ${response.status} - ${errorText}`);
        throw new Error(`Claude API 오류 (${response.status}): 서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.`);
      }

      return response;
    };

    const response = await callClaudeAPI();

    const data = await response.json();
    const generatedContent = data.content[0].text;

    // 토큰 사용량 계산 (입력 + 출력 토큰)
    const tokenUsage = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    // 생성 기록 저장 (토큰 사용량 포함)
    await supabase
      .from('character_generations')
      .insert({
        user_id: user.id,
        character_data: formData,
        token_usage: tokenUsage,
        success: true
      });

    return new Response(JSON.stringify({ 
      success: true, 
      content: generatedContent,
      characterData: formData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in generate-character function:', error);
    
    // 실패한 요청도 기록 (사용자 정보가 있는 경우에만)
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          await supabase
            .from('character_generations')
            .insert({
              user_id: user.id,
              character_data: {},
              token_usage: 0,
              success: false,
              error_message: error?.message || 'Unknown error'
            });
        }
      }
    } catch (logError) {
      console.error('Error logging failure:', logError);
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});