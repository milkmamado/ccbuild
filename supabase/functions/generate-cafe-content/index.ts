import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = await req.text();
    const { characterContent } = JSON.parse(body);

    if (!characterContent) {
      throw new Error('캐릭터 정보가 필요합니다.');
    }

    // Create Supabase client for authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('인증이 필요합니다.');
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);
    
    // Extract JWT token
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      throw new Error('유효하지 않은 인증 토큰입니다.');
    }

    // Check user role and approval status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('사용자 프로필을 찾을 수 없습니다.');
    }

    if (profile.approval_status !== 'approved') {
      throw new Error('계정 승인이 필요합니다. 관리자에게 문의하세요.');
    }

    // Check rate limits
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Get user limits
    const { data: userLimits } = await supabase
      .from('user_limits')
      .select('daily_limit, monthly_limit')
      .eq('user_id', user.id)
      .single();

    const limits = userLimits || { daily_limit: 5, monthly_limit: 50 };

    // Count today's cafe content generations only
    const { count: dailyCount } = await supabase
      .from('character_generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('character_data->type', 'cafe_content')
      .gte('created_at', today + 'T00:00:00.000Z')
      .lt('created_at', today + 'T23:59:59.999Z');

    // Count this month's cafe content generations only
    const { count: monthlyCount } = await supabase
      .from('character_generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('character_data->type', 'cafe_content')
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth);

    if ((dailyCount ?? 0) >= limits.daily_limit) {
      throw new Error(`일일 생성 한도(${limits.daily_limit}개)를 초과했습니다.`);
    }

    if ((monthlyCount ?? 0) >= limits.monthly_limit) {
      throw new Error(`월간 생성 한도(${limits.monthly_limit}개)를 초과했습니다.`);
    }

    // Parse character content to extract structured information
    const parseCharacterInfo = (content: string) => {
      const info: any = {};
      
      // Extract basic info - improved patterns
      const nameMatch = content.match(/(?:이름|환자명)[:\s*]+([가-힣]+)/i);
      const ageMatch = content.match(/(?:나이|연령)[:/\s*]+(\d+)세/i) || content.match(/(\d+)세\s*(?:남|여)/);
      const genderMatch = content.match(/(?:성별|나이\/성별)[:/\s*]+\d*세?\s*(남|여)성?/i) || content.match(/(\d+세)\s*(남|여)/);
      const hospitalMatch = content.match(/(?:진료\s*병원|병원)[:\s*]+([^\n]+)/i);
      
      // Extract cancer type - try multiple patterns
      let cancerType = '암';
      const cancerTypeMatch1 = content.match(/##\s*\d+\.\s*([가-힣]+암)\s+\d+기/);
      const cancerTypeMatch2 = content.match(/진단일자.*?\n.*?병기.*?\n.*?수술방법/s);
      
      if (cancerTypeMatch1) {
        cancerType = cancerTypeMatch1[1];
      } else {
        // Look at the title pattern
        const titleMatch = content.match(/#\s*([가-힣]+암)\s+\d+기\s+환자/);
        if (titleMatch) cancerType = titleMatch[1];
      }
      
      const stageMatch = content.match(/(?:병기|단계)[:\s*]+(\d+기|[IVX]+기?|Stage\s+[IVX]+[ABC]?)/i);
      
      // Extract treatment plan section
      const treatmentPlanMatch = content.match(/##\s*3\.\s*표준\s*치료계획[\s\S]*?(?=##\s*4\.|$)/i);
      
      info.name = nameMatch ? nameMatch[1].trim() : '환자';
      info.age = ageMatch ? ageMatch[1] : '30';
      info.gender = genderMatch ? genderMatch[2] : '여';
      info.hospital = hospitalMatch ? hospitalMatch[1].trim() : '병원';
      info.cancerType = cancerType;
      info.stage = stageMatch ? stageMatch[1].trim() : '초기';
      info.treatmentPlan = treatmentPlanMatch ? treatmentPlanMatch[0].substring(0, 500) : '표준 치료';
      
      return info;
    };

    const characterInfo = parseCharacterInfo(characterContent);

    // Create prompt for cafe content generation
    const prompt = `
네이버 ${characterInfo.cancerType} 커뮤니티 활동 콘텐츠 생성기 (제목 + 실제 게시글 본문)

**환자 정보:**
- 이름: ${characterInfo.name} (${characterInfo.age}세/${characterInfo.gender})
- 진단: ${characterInfo.cancerType} ${characterInfo.stage}
- 병원: ${characterInfo.hospital}
- 치료: ${characterInfo.treatmentPlan}

**중요: ${characterInfo.cancerType}의 고유한 치료 특성을 정확히 반영하세요**

**출력 형식 (반드시 이 구조를 따르세요):**

### 1. 활동 성격 (랜덤)
성격: [적극적/소극적, 낙관적/현실적 중 랜덤]
말투: [정중함/친근함, 이모티콘 사용도]

### 2. 진단~치료 전 단계 (7개)
각 항목은 아래 형식으로 작성:
**제목:** [실제 카페에 올릴 자연스러운 제목]
**글 내용:**
[실제 게시글 본문. 200~350자. 환자 본인 1인칭 시점. 네이버 카페 실제 글처럼 자연스럽게. 설정된 성격과 말투를 일관되게 유지]

### 3. 치료 진행 단계별 (15개)
**${characterInfo.cancerType} 특화 치료 과정에 맞춰**
각 항목은 위와 동일한 형식:
**제목:** [...]
**글 내용:**
[200~350자 본문. 수술 후 회복, 항암/방사선/약물 치료 중 겪는 구체적 경험, 부작용 관리, 병원 다니는 일상 등]

### 4. 회복/관리 단계 (8개)
각 항목은 위와 동일한 형식:
**제목:** [...]
**글 내용:**
[200~350자 본문. 추적 관찰, 식단/운동 관리, 일상 복귀, 같은 환우들에게 응원 등]

**필수 준수사항:**
- ${characterInfo.cancerType}에만 해당하는 치료/증상만 포함
- 다른 암종의 치료법 절대 포함 금지 (해당 암종에 쓰이지 않는 항암제 언급 금지)
- ${characterInfo.age}세 ${characterInfo.gender}성 환자 본인 관점의 1인칭 글
- 의학적 정확성 100% 준수
- '완치'라는 단어 사용 금지, 대신 '경과가 좋다', '잘 관리 중' 등 사용
- 각 게시글은 실제 사람이 쓴 것처럼 자연스럽게, 광고 티 나지 않게
- 질문 없이 바로 결과물만 출력하세요
- 모든 단계(총 30개 게시글)를 빠짐없이 끝까지 출력하세요
`;

    // Generate with continuation support to prevent truncation
    const MAX_CONTINUATIONS = 4;
    const callClaude = async (messages: any[]) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': claudeApiKey!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 8000,
          temperature: 0.7,
          messages
        })
      });
      if (!res.ok) {
        const errorData = await res.text();
        console.error('Claude API 오류:', errorData);
        throw new Error('AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
      return await res.json();
    };

    console.log('카페 콘텐츠 생성 시작:', user.id);

    const messages: any[] = [{ role: 'user', content: prompt }];
    let generatedContent = '';
    let totalTokenUsage = 0;

    for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
      const aiResponse = await callClaude(messages);
      const chunk: string = aiResponse.content[0].text;
      generatedContent += chunk;
      totalTokenUsage += (aiResponse.usage?.input_tokens || 0) + (aiResponse.usage?.output_tokens || 0);

      if (aiResponse.stop_reason !== 'max_tokens') {
        break; // 완성됨
      }

      // 끊겼으면 이어서 계속 작성 요청
      console.log(`응답이 잘렸습니다 (시도 ${attempt + 1}). 이어쓰기 진행...`);
      messages.push({ role: 'assistant', content: chunk });
      messages.push({
        role: 'user',
        content: '방금 출력이 중간에 끊겼습니다. 끊긴 지점 바로 다음부터 이어서 나머지 내용을 끝까지 완성해주세요. 앞 내용을 반복하지 말고, 마지막 게시글까지 빠짐없이 출력하세요.'
      });
    }

    const tokenUsage = totalTokenUsage;
    console.log('카페 콘텐츠 생성 완료. 토큰 사용량:', tokenUsage);

    // Log generation attempt to database
    const { error: logError } = await supabase
      .from('character_generations')
      .insert({
        user_id: user.id,
        character_data: {
          type: 'cafe_content',
          original_character: characterContent,
          generated_content: generatedContent,
          timestamp: new Date().toISOString()
        },
        success: true,
        token_usage: tokenUsage
      });

    if (logError) {
      console.error('로그 저장 오류:', logError);
    }

    return new Response(JSON.stringify({
      success: true,
      content: generatedContent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('카페 콘텐츠 생성 오류:', error);

    // Log failed generation attempt
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);
        const jwt = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(jwt);
        
        if (user) {
          await supabase
            .from('character_generations')
            .insert({
              user_id: user.id,
              character_data: {
                type: 'cafe_content',
                error: error.message
              },
              success: false,
              error_message: error.message
            });
        }
      }
    } catch (logError) {
      console.error('오류 로그 저장 실패:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});