import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLAUDE_MODEL = 'claude-sonnet-4-5';
const CLAUDE_MAX_TOKENS = 8000;
const MAX_CONTINUATIONS = 4;
const CONTINUATION_INSTRUCTION = '방금 응답이 길이 제한으로 중간에 끊겼습니다. 이미 작성한 내용은 절대 반복하지 말고, 마지막 미완성 문장의 바로 다음 부분부터 이어서 작성하세요. 새로운 제목이나 처음 섹션을 다시 쓰지 말고 남은 내용만 같은 마크다운 형식으로 끝까지 완성하세요.';

if (!claudeApiKey) {
  console.error('CLAUDE_API_KEY가 설정되지 않았습니다.');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ClaudeMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const extractTextFromClaudeResponse = (data: any): string => {
  if (!Array.isArray(data?.content)) return '';

  return data.content
    .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
    .map((block: any) => block.text)
    .join('');
};

const mergeContinuationText = (existingText: string, nextChunk: string): string => {
  if (!existingText) return nextChunk;

  const maxOverlap = Math.min(existingText.length, nextChunk.length, 300);

  for (let size = maxOverlap; size >= 20; size--) {
    if (existingText.slice(-size) === nextChunk.slice(0, size)) {
      return existingText + nextChunk.slice(size);
    }
  }

  return existingText + nextChunk;
};

const callClaudeAPI = async (messages: ClaudeMessage[], retryCount = 0): Promise<Response> => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeApiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
  });

  if (!response.ok && (response.status === 429 || response.status === 529) && retryCount < 3) {
    console.log(`Claude API error ${response.status}, retrying... (${retryCount + 1}/3)`);
    await new Promise((resolve) => setTimeout(resolve, (retryCount + 1) * 2000));
    return callClaudeAPI(messages, retryCount + 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Claude API error: ${response.status} - ${errorText}`);
    throw new Error(`Claude API 오류 (${response.status}): 서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.`);
  }

  return response;
};

const generateCompleteCharacter = async (prompt: string) => {
  const initialMessages: ClaudeMessage[] = [{ role: 'user', content: prompt }];
  let messages = [...initialMessages];
  let fullContent = '';
  let totalTokenUsage = 0;
  let continuationCount = 0;
  let finalStopReason = 'unknown';

  while (continuationCount <= MAX_CONTINUATIONS) {
    const response = await callClaudeAPI(messages);
    const data = await response.json();
    const chunk = extractTextFromClaudeResponse(data);

    if (!chunk) {
      throw new Error('AI 응답이 비어 있습니다.');
    }

    fullContent = mergeContinuationText(fullContent, chunk);
    totalTokenUsage += (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    finalStopReason = data.stop_reason ?? data.stopReason ?? 'unknown';

    console.log(
      `Claude chunk ${continuationCount + 1}: stop_reason=${finalStopReason}, chunk_chars=${chunk.length}, total_chars=${fullContent.length}`,
    );

    if (finalStopReason !== 'max_tokens') {
      console.log(
        `Claude generation completed: stop_reason=${finalStopReason}, continuations=${continuationCount}, total_chars=${fullContent.length}`,
      );

      return {
        content: fullContent,
        tokenUsage: totalTokenUsage,
      };
    }

    continuationCount += 1;

    if (continuationCount > MAX_CONTINUATIONS) {
      break;
    }

    messages = [
      ...initialMessages,
      { role: 'assistant', content: fullContent },
      { role: 'user', content: CONTINUATION_INSTRUCTION },
    ];
  }

  throw new Error('AI 응답이 너무 길어 자동 이어쓰기를 완료하지 못했습니다. 내용을 조금 줄여 다시 시도해주세요.');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!claudeApiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Claude API 키가 설정되지 않았습니다. 관리자에게 문의하세요.',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { formData } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: '인증이 필요합니다.',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', user.id)
      .single();

    const isMasterAdmin = userProfile?.email === 'torogrr@kakao.com' && userProfile?.role === 'admin';

    if (!isMasterAdmin) {
      const { data: userLimit } = await supabase
        .from('user_limits')
        .select('daily_limit, monthly_limit')
        .eq('user_id', user.id)
        .maybeSingle();

      const dailyLimit = userLimit?.daily_limit || 5;
      const monthlyLimit = userLimit?.monthly_limit || 50;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: dailyCount } = await supabase
        .from('character_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString());

      if ((dailyCount || 0) >= dailyLimit) {
        return new Response(JSON.stringify({
          success: false,
          error: `일일 생성 한도(${dailyLimit}회)를 초과했습니다.`,
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const { count: monthlyCount } = await supabase
        .from('character_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString());

      if ((monthlyCount || 0) >= monthlyLimit) {
        return new Response(JSON.stringify({
          success: false,
          error: `월간 생성 한도(${monthlyLimit}회)를 초과했습니다.`,
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const prompt = `

**중요: 당신은 의료 전문가로서 실제 암 치료 가이드라인을 정확히 준수해야 합니다.**
**근거: NCCN v1-3.2026, ESMO 2025, ASCO 2025, 대한종양학회 가이드라인 및 2024-2026년 FDA 승인 정보 기반**

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
5. **바이오마커/분자검사 결과에 따른 맞춤치료 반영**

## 암종별 병기별 정확한 표준치료 가이드라인 (2026 최신)

### 유방암 (Breast Cancer)
- **1기**: 수술(보존술/전절제) → 방사선(보존술 시) → 호르몬치료(ER/PR+) 또는 관찰
- **2기**: 수술 → 항암(AC-T 60/600→80mg/m² 또는 TC 75/600mg/m²) → 방사선 → 호르몬(ER/PR+)
- **3기**: 선행항암 → 수술 → 방사선 → 호르몬(ER/PR+)
  · HER2+: THP(선행) → 잔존시 T-DM1(Kadcyla) 3.6mg/kg
  · TNBC: Pembrolizumab+항암(KEYNOTE-522) → 잔존시 Capecitabine
- **4기**: 전신치료 (아형별)
  · HR+/HER2-: CDK4/6억제제(팔보시클립125mg/리보시클립600mg/아베마시클립150mg bid)+호르몬
  · HER2+: 표적+항암, T-DXd(Enhertu) 5.4mg/kg (HER2+/low/ultralow)
  · TNBC: 면역+항암 또는 Sacituzumab govitecan(Trodelvy) 10mg/kg
  · ESR1변이: Elacestrant 345mg 또는 Imlunestrant 400mg
  · PIK3CA/AKT1/PTEN변이: Capivasertib(Truqap)+Fulvestrant
- **호르몬치료 약물**:
  · 타목시펜(Tamoxifen) 20mg/일 5-10년 (폐경전/후) - 부작용: 안면홍조, 자궁내막비후, 혈전증
  · 레트로졸(Letrozole) 2.5mg/일 5-10년 (폐경후) - 부작용: 관절통, 골밀도감소
  · 아나스트로졸(Anastrozole) 1mg/일 (폐경후)
  · 엑세메스탄(Exemestane) 25mg/일 (폐경후)
  · 고세렐린(Goserelin) 3.6mg 피하 4주마다 (폐경전 난소억제)
  · 풀베스트란트(Fulvestrant) 500mg 근주 월1회 (전이성)
- ★ MammaPrint 70-gene assay: HR+/HER2- 조기유방암 안트라사이클린 사용 여부 결정 (NCCN v1.2026)

### 갑상선암 (Thyroid Cancer)
- **1-2기**: 수술(엽절제/전절제) → 관찰(저위험) 또는 방사성요오드(중위험)
- **3기**: 갑상선전절제술+림프절절제 → 방사성요오드 → TSH억제요법
- **4기**: 수술 → 방사성요오드 → 표적치료
- **약물**: 레보티록신(TSH억제), 렌바티닙 24mg/일, 소라페닙 400mg bid
  · RET융합/변이: Selpercatinib(Retevmo) 160mg bid
  · 진행성 수질암: Cabozantinib(Cabometyx) 60mg/일, Pralsetinib(Gavreto) 400mg/일
  · 방사성요오드(I-131) 30-200 mCi

### 대장암 (Colorectal Cancer)
- **1기**: 수술 → 관찰, 정기 대장내시경
- **2기**: 수술 → 관찰 (고위험시 FOLFOX 보조항암)
- **3기**: 수술 → 보조항암(FOLFOX 400/400/85mg/m² 2주x12 또는 CAPOX 3주x8)
  · dMMR/MSI-H: FOLFOX+Atezolizumab 6개월 → Atezo 유지 6개월 (ATOMIC)
- **4기**: MSS: FOLFOX/FOLFIRI+베바시주맙(5-10mg/kg) 또는 세툭시맙(RAS wt 좌측)
  · MSI-H/dMMR: Pembrolizumab 200mg 3주 단독(1차) 또는 Nivo+Ipi(1차)
  · dMMR 직장암: Dostarlimab(Jemperli) 500mg→1000mg (완전관해 가능)
  · BRAF V600E: Encorafenib+Cetuximab ±mFOLFOX6
  · KRAS G12C: Sotorasib+Panitumumab
  · 3차+: Fruquintinib 5mg/일, TAS-102±Bev, 레고라페닙 160mg
- **표적/면역치료제**: 베바시주맙, 세툭시맙, 파니투무맙, 레고라페닙, Fruquintinib

### 폐암 (비소세포, NSCLC)
- **1기**: 수술 → 관찰
  · EGFR+: 보조 Osimertinib 3년 (ADAURA)
  · ALK+: 보조 Alectinib 2년 (ALINA)
- **2기**: 수술 → 보조항암(시스플라틴 기반) · EGFR+: 보조 Osimertinib
- **3기 절제가능**: 수술전 면역+항암 → 수술 → 보조면역
  · Durvalumab(AEGEAN), Nivolumab(CM77T)
- **3기 절제불가**: 동시항암방사선 → Durvalumab 유지 1년 (PACIFIC)
- **4기**: 분자검사 후 맞춤치료
  · EGFR+: Osimertinib+항암(FLAURA2) 또는 Amivantamab+Lazertinib(MARIPOSA)
  · ALK+: Alectinib(1차) 또는 Lorlatinib(CROWN, preferred)
  · ROS1+: Crizotinib 또는 Taletrectinib(뇌전이 활성)
  · EGFR Exon20 ins: Sunvozertinib
  · HER2변이: Sevabertinib 또는 T-DXd
  · PD-L1≥50%: Pembrolizumab 단독 / <50%: Pembrolizumab+항암

### 위암 (Gastric Cancer)
- ★ 4기 1차 치료 전 필수 바이오마커검사: HER2, PD-L1 CPS, CLDN18.2, MSI/dMMR
- **1기**: 수술 → 관찰
- **2-3기**: 수술 → 보조항암(S-1 4주/2주 x8 또는 CAPOX 3주x8)
  · 수술전후: FLOT(5-FU+LV+Oxaliplatin+Docetaxel) 2주 x4+4
  · PD-L1 CPS≥1: FLOT+Durvalumab (NCCN Cat.1)
- **4기**: 
  · HER2- PD-L1 CPS≥5: Nivo+FOLFOX/CAPOX (CheckMate 649)
  · HER2- PD-L1 CPS≥10: Pemb+FP/CAPOX (KEYNOTE-859)
  · HER2-: Tislelizumab+항암 (RATIONALE-305)
  · CLDN18.2+ HER2-: Zolbetuximab+CAPOX/mFOLFOX6 (SPOTLIGHT/GLOW)
  · HER2+: Pemb+Trastuzumab+FP/CAPOX (KEYNOTE-811)
  · 2차: Ramucirumab+Paclitaxel
  · HER2+ 3차+: T-DXd(Enhertu) (DESTINY-Gastric01)
  · 3차+: TAS-102 (TAGS), Nivolumab 단독

### 간암 (Liver Cancer, BCLC 기준)
- **BCLC 0-A(초기)**: 수술/RFA/간이식 (간기능 보존 필수)
- **BCLC B(중기)**: TACE (간동맥화학색전술)
- **BCLC C(진행)**: Child-Pugh A
  · 1차 Preferred: ①Atezolizumab+Bevacizumab(IMbrave150) ②Tremelimumab+Durvalumab STRIDE(HIMALAYA)
  · Other: Nivolumab+Ipilimumab(CheckMate 9DW)
  · 대안(ICI 부적합): Sorafenib 400mg bid 또는 Lenvatinib 8-12mg/일
  · 2차: Regorafenib(소라페닙 후), Cabozantinib 60mg/일, Ramucirumab(AFP≥400)
  · ★ 1차 Atezo+Bev 후 진행: TKI 또는 Treme+Durva 또는 Nivo+Ipi 고려
- **BCLC D(말기)**: 완화치료

### 췌장암 (Pancreatic Cancer)
- **절제가능(1-2기)**: 수술 → 보조항암(mFOLFIRINOX 또는 Gem+Capecitabine)
- **경계절제**: 선행항암(FOLFIRINOX) → 수술 → 보조항암
- **국소진행(3기)**: 항암(FOLFIRINOX/Gem+nab-PTX/NALIRIFOX) → 재평가
- **전이(4기)**: 완화항암(FOLFIRINOX/Gem+nab-PTX/NALIRIFOX)
  · NALIRIFOX: Liposomal Irinotecan+5-FU+LV+Oxaliplatin 2주 (NAPOLI-3)
  · BRCA+: Platinum 기반 → Olaparib 300mg bid 유지 (POLO)
  · MSI-H: Pembrolizumab

### 전립선암 (Prostate Cancer)
- **국소(1-2기)**: 수술 또는 방사선치료, 적극적 감시(저위험)
- **고위험(3기)**: 수술+호르몬 또는 방사선+호르몬(ADT 2-3년)
- **nmCRPC(비전이 거세저항성)**: ADT+차세대 AR억제제
  · Apalutamide(Erleada) 240mg/일, Enzalutamide(Xtandi) 160mg/일, Darolutamide(Nubeqa) 600mg bid
- **mHSPC(전이 호르몬감수성)**: 
  · ADT+AR억제제(Abiraterone/Apalutamide/Enzalutamide)
  · ADT+Darolutamide+Docetaxel (ARASENS 삼중요법)
  · BRCA+: PARP억제제 병용 고려
- **mCRPC(전이 거세저항성)**:
  · AR억제제(Abiraterone 1000mg+프레드니손 / Enzalutamide)
  · BRCA+: Olaparib+Abiraterone / Talazoparib+Enzalutamide / Niraparib+Abiraterone
  · 항암: Docetaxel 75mg/m² → Cabazitaxel 25mg/m²
  · PSMA+: 177Lu-PSMA-617(Pluvicto) 7.4GBq q6w x6

### 자궁경부암 (Cervical Cancer)
- **IA-IB1**: 수술(원추절제/근치적 자궁절제)
- **IB2-IVA**: 동시항암방사선(시스플라틴 40mg/m² 주간)+근접방사선
- **IVB/재발**:
  · PD-L1 CPS≥1: Pembrolizumab+Cisplatin+Paclitaxel → Pemb±Bev 유지 (KEYNOTE-826)
  · PD-L1 무관: Cemiplimab+Cisplatin/Carboplatin+Paclitaxel → Cemiplimab 유지 (EMPOWER-Cervical 3)
  · 2차: Tisotumab vedotin(Tivdak) 2mg/kg 3주

### 난소암 (Ovarian Cancer)
- **1-2기**: 수술(병기설정술) → 항암(카보플라틴AUC5-6+파클리탁셀175mg/m²) (IA G1 제외)
- **3-4기 BRCA+**: 수술(종양감축술) → 항암±Bev → Olaparib 유지 300mg bid (SOLO-1)
- **3-4기 BRCA wt/HRD+**: 수술 → 항암+Bev → Olaparib(Cat.2B) 또는 Niraparib 200-300mg/일 또는 Bev 유지
- **3-4기 HRP**: 수술 → 항암+Bev → Bev 유지
- **재발**: PLD 40-50mg/m², Gem+Carbo, Mirvetuximab soravtansine(Elahere, FRα+)
  · KRAS변이 저등급 장액성: Avutometinib+Defactinib
  · ★ Rucaparib(Rubraca): 2024년 유지치료 적응증 철회. BRCA+ 치료 목적만 유지

## 의학적 회복기간 (수술 후 항암시작)
- **복부수술(위/대장/간/췌장)**: 4-6주 (장운동 회복 확인)
- **흉부수술(폐)**: 6-8주 (폐기능 회복 확인)
- **뇌수술**: 2-4주 (신경학적 평가)
- **부인과수술(자궁/난소)**: 4-6주 (상처 회복 확인)
- **비뇨기과수술(전립선)**: 4-8주 (요실금 관리 병행)
- **유방수술**: 2-4주 (재건술 시 4-6주)
- **갑상선수술**: 2-3주 (성대기능 확인)

## 표준 부작용 및 발생률 (CTCAE 등급 기준)
### 항암치료 공통 부작용
- **탈모**: 90% 안트라사이클린 (Grade 1-2) - 두피냉각, 가발/모자 준비
- **구역/구토**: 60% (Grade 1-3) - 5-HT3 차단제, NK1 차단제, 덱사메타손
- **피로**: 80% (Grade 1-2) - 적절한 휴식+가벼운 운동 병행
- **백혈구감소**: 70% (Grade 1-4) - G-CSF(필그라스팀), 감염 예방
- **말초신경병증**: 30% 옥살리플라틴/탁산 (Grade 1-3) - 용량 조절, 비타민B, 보온
- **구내염**: 30-40% (Grade 1-3) - 구강세정, 얼음조각, 통증관리
- **설사**: 20-40% (Grade 1-3) - 로페라마이드, 수분보충
- **수족증후군**: 20-30% 카페시타빈 (Grade 1-3) - 보습, 자극 피하기, 용량 조절
- **빈혈**: 30-50% (Grade 1-3) - EPO, 수혈(Hb<7)
- **간기능이상**: 10-30% (Grade 1-3) - 정기 모니터링, 용량 조절
- **면역관련 이상반응(irAE)**: 30-60% ICI 사용 시 (Grade 1-4)
  · 갑상선기능이상, 폐렴, 간염, 대장염, 피부발진, 부신부전 등
  · 스테로이드/면역억제제 기반 관리 (NCCN irAE Guideline 참고)

### 방사선치료 부작용
- **피로**: 60% (Grade 1-2)
- **피부반응(발적/색소침착)**: 40% (Grade 1-2)
- **유방/흉부**: 폐렴 5-10%
- **복부/골반**: 설사 30-50%
- **두경부**: 구강건조 70-80%
- **골반**: 방광자극 30-40%, 질건조/협착(여성) 40-50%

## 주요 종양표지자 참고치
- CEA: <5.0 ng/mL (대장암, 위암, 폐암)
- CA 19-9: <37 U/mL (췌장암, 담도암)
- CA 125: <35 U/mL (난소암)
- AFP: <10 ng/mL (간암)
- PSA: <4.0 ng/mL (전립선암)
- CA 15-3: <30 U/mL (유방암, 전이 모니터링)
- CA 72-4: <6.9 U/mL (위암, 특이도 높음)
- HE4: <150 pmol/L (난소암, CA125보다 특이도 높음)
- SCC: <1.5 ng/mL (자궁경부암, 폐편평세포암)
- Thyroglobulin: <0.2 ng/mL (분화갑상선암, 전절제 후 재발모니터링)
- PIVKA-II: <40 mAU/mL (간암, AFP 보완)
- ctDNA(Liquid Biopsy): 수술 후 MRD 평가, 치료반응 모니터링 (DYNAMIC trial 등 근거 확보 중)

## 캐릭터 생성 형식

### 1. 환자 기본 프로필
- 해당 암종의 전형적 발견 경위 (검진, 증상 등)
- 실제 발생하는 초기 증상만 포함
- **진료 병원**: ${formData.hospital}
- **진단일자**: ${formData.diagnosisDate}
- **병기**: ${formData.stage}
${formData.surgeryMethod ? `- **수술방법**: ${formData.surgeryMethod}` : ''}

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
- 바이오마커 검사 결과에 따른 맞춤치료 반영
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
- 면역관련 이상반응(irAE) 발생 시 적절한 관리 포함
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
- 철회된 적응증의 약물 사용 (예: Rucaparib 유지치료)

## 최종 검증 단계
생성된 내용을 다시 한번 검토하여 다음 사항 확인:
- □ 병기와 치료법이 정확히 매칭되는가?
- □ 항암제가 해당 암종에 실제 사용되는가?
- □ 바이오마커 기반 맞춤치료가 적절히 반영되었는가?
- □ 치료 순서가 가이드라인과 일치하는가?
- □ 부작용이 과장되지 않았는가?
- □ 회복기간이 의학적으로 적절한가?
- □ 조기암에 과치료가 포함되지 않았는가?
- □ 면역관련 이상반응(irAE) 관리가 포함되었는가? (ICI 사용 시)

**모든 의학적 내용은 NCCN v1-3.2026, ESMO 2025, ASCO 2025 가이드라인 및 한국 암 진료 권고안에 부합해야 합니다.**
`;

    const { content: generatedContent, tokenUsage } = await generateCompleteCharacter(prompt);

    await supabase
      .from('character_generations')
      .insert({
        user_id: user.id,
        character_data: formData,
        token_usage: tokenUsage,
        success: true,
      });

    return new Response(JSON.stringify({
      success: true,
      content: generatedContent,
      characterData: formData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in generate-character function:', error);

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
              error_message: error?.message || 'Unknown error',
            });
        }
      }
    } catch (logError) {
      console.error('Error logging failure:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
