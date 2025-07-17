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

    // Parse character content to extract structured information
    const parseCharacterInfo = (content: string) => {
      const lines = content.split('\n');
      const info: any = {};
      
      // Extract basic info
      const nameMatch = content.match(/이름:\s*([^\n\s]+)/);
      const ageMatch = content.match(/(\d+)세/);
      const genderMatch = content.match(/(남|여)/);
      const hospitalMatch = content.match(/병원:\s*([^\n]+)/);
      const diagnosisDateMatch = content.match(/진단일자:\s*([^\n]+)/);
      const cancerTypeMatch = content.match(/암종?:\s*([^\n]+)/);
      const stageMatch = content.match(/병기:\s*([^\n]+)/);
      
      info.name = nameMatch ? nameMatch[1].trim() : '환자';
      info.age = ageMatch ? ageMatch[1] : '30';
      info.gender = genderMatch ? genderMatch[1] : '여';
      info.hospital = hospitalMatch ? hospitalMatch[1].trim() : '병원';
      info.diagnosisDate = diagnosisDateMatch ? diagnosisDateMatch[1].trim() : '2025년';
      info.cancerType = cancerTypeMatch ? cancerTypeMatch[1].trim() : '암';
      info.stage = stageMatch ? stageMatch[1].trim() : '초기';
      
      return info;
    };

    const characterInfo = parseCharacterInfo(characterContent);

    // Create prompt for cafe content generation
    const prompt = `
네이버 암 커뮤니티 게시글 제목 생성기

**환자 정보:**
- 이름: ${characterInfo.name} (${characterInfo.age}세/${characterInfo.gender})
- 암종: ${characterInfo.cancerType} ${characterInfo.stage}
- 병원: ${characterInfo.hospital}
- 진단일: ${characterInfo.diagnosisDate}

**요청사항:**
위 ${characterInfo.cancerType} ${characterInfo.stage} 환자가 네이버 카페에서 시기별로 올릴 수 있는 게시글 제목들을 생성해주세요.

**출력 형식:**

### 1. 활동 성격 (랜덤)
성격: [적극적/소극적, 낙관적/현실적 중 랜덤]
말투: [정중함/친근함, 이모티콘 사용도]

### 2. 진단~치료 전 단계 (7개)
- 
- 
- 
- 
- 
- 
- 

### 3. 치료 진행 단계별 (15개)
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 

### 4. 회복/관리 단계 (8개)
- 
- 
- 
- 
- 
- 
- 
- 

**중요:** 
- ${characterInfo.cancerType} ${characterInfo.stage}에 맞는 제목만 생성
- ${characterInfo.age}세 ${characterInfo.gender}성의 현실적 고민 반영
- 제목만 간단히 나열
- 의학적으로 정확한 내용
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
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