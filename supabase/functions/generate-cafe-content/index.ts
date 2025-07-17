import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

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

    if (dailyCount >= limits.daily_limit) {
      throw new Error(`일일 생성 한도(${limits.daily_limit}개)를 초과했습니다.`);
    }

    if (monthlyCount >= limits.monthly_limit) {
      throw new Error(`월간 생성 한도(${limits.monthly_limit}개)를 초과했습니다.`);
    }

    // Create prompt for cafe content generation
    const prompt = `
네이버 암 커뮤니티 활동 콘텐츠 생성기

**생성된 캐릭터 정보:**
${characterContent}

**콘텐츠 생성 요청:**
위 캐릭터를 바탕으로 네이버 암 관련 카페에서 자연스럽게 활동할 수 있는 게시글들을 완성된 형태로 생성해주세요.

**출력 요구사항:**

### 1. 활동 캐릭터 설정 (랜덤)
- **성격**: [적극적/소극적, 낙관적/현실적, 꼼꼼함/대범함 중 랜덤 선택]
- **소통 스타일**: [질문 많은 타입/경험 공유 타입/조용한 관찰 타입]
- **말투**: [정중한 존댓말/친근한 반말 혼용/이모티콘 사용 빈도]

### 2. 시기별 게시글 로드맵
**[진단~치료 전 단계]**
- 질문글 아이디어 3개 (제목만)
- 고민/하소연글 아이디어 2개 (제목만)
- 정보 요청글 아이디어 2개 (제목만)

**[치료 진행 단계별]** (환자의 치료 일정에 맞춰)
- 각 치료 시점별 적합한 게시글 아이디어들
- 단계별로 5-7개씩 제목 생성

**[회복/관리 단계]**
- 경험 공유글 아이디어
- 후배 환자 격려글 아이디어
- 정기검진 관련 글 아이디어

### 3. 바로 사용 가능한 완성 게시글 (10개)
각각 다음 형식으로:
- **제목**: [실제 카페에 올릴 수 있는 제목]
- **본문**: [300-500자 완성된 게시글 내용]
- **시점**: [언제 올리면 적절한지]
- **예상 반응**: [다른 회원들이 남길 만한 댓글 3개]

### 4. 추가 활용 소재 (20개)
- 급하게 써야 할 때 사용할 수 있는 간단한 게시글 제목들
- 다양한 상황별 대응 가능한 주제들

**의학적 정확성 원칙:**
- 제공된 캐릭터의 치료 일정과 정확히 일치하는 내용만 사용
- "완치" 대신 "치료 잘 받고 있어요", "경과 좋아요" 등 표현 사용
- 구체적 의학 수치나 확률은 피하고 일반적 경험 위주로 작성
- 다른 환자에게 불안감을 주거나 잘못된 희망을 주지 않도록 균형잡힌 내용
- 개인 경험 공유 형태로 작성하여 의학적 조언으로 오해받지 않도록 주의

**네이버 카페 특성 반영:**
- 정중하고 진솔한 어조 유지
- 적절한 이모티콘 사용으로 친근함 표현
- 다른 회원들과의 상호작용을 유도하는 질문이나 공감 요소 포함
- 너무 전문적이지 않고 일반인이 이해하기 쉬운 표현 사용

위 가이드라인에 따라 완성된 콘텐츠를 생성하고, 추가 질문이나 확인 없이 바로 모든 내용을 출력해주세요.
`;

    console.log('카페 콘텐츠 생성 시작:', user.id);

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': claudeApiKey!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API 오류:', errorData);
      throw new Error('AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }

    const aiResponse = await response.json();
    const generatedContent = aiResponse.content[0].text;
    const tokenUsage = aiResponse.usage?.input_tokens + aiResponse.usage?.output_tokens || 0;

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