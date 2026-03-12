
import { GoogleGenAI, Type } from "@google/genai";
import { SurveyData, NPSMetric, NPSCategory } from "../types";

/**
 * NPS 성과 요약 (상단 섹션용)
 */
export const getAIInsights = async (data: SurveyData[], overallMetric: NPSMetric) => {
  // Create a new instance right before the call to ensure up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const channelPerformance = Array.from(new Set(data.map(d => d.channel))).map(ch => {
    const scores = data.filter(d => d.channel === ch).map(d => d.score);
    const promoters = scores.filter(s => s >= 9).length;
    const detractors = scores.filter(s => s <= 6).length;
    const nps = Math.round(((promoters - detractors) / scores.length) * 100);
    return `${ch}: NPS ${nps} (${scores.length}명)`;
  }).join(', ');

  const verbatims = data.filter(d => d.reason).slice(0, 15).map(d => `[${d.score}점] ${d.reason}`).join('\n');

  const prompt = `
    NPS(Net Promoter Score) 설문 데이터 분석 리포트를 작성해주세요.
    전체 NPS 점수: ${overallMetric.nps}, 참여자 수: ${overallMetric.total}
    채널별 성과: ${channelPerformance}
    
    고객 실제 답변 샘플:
    ${verbatims}

    데이터와 고객 답변 원문을 바탕으로 다음 3가지를 한국어로 작성해주세요:
    1. 현재 고객 충성도의 전반적인 상태 요약 (고객의 구체적인 불만이나 칭찬 포인트 포함)
    2. 성과가 가장 좋은 채널과 우려되는 채널의 실제 원인 분석
    3. NPS 향상을 위한 전략적 제언
    간결하고 전문적인 정자체 톤으로 작성해주세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Insight Error:", error);
    return "AI 인사이트를 불러오는 중 오류가 발생했습니다.";
  }
};

/**
 * 대시보드 최하단 [논의 사항] 도출 함수
 */
export const getDiscussionPoints = async (data: SurveyData[], npsTable: any[], trendData: Record<NPSCategory, any[]>) => {
  if (data.length === 0) return null;

  // Create a new instance right before the call to ensure up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1월 유의미한 데이터(컬러 코딩된 부분) 요약
  const significantPoints = npsTable.flatMap(group => 
    group.rows.filter((r: any) => r.sig !== 'none').map((r: any) => 
      `${group.channel} ${r.label} 지표가 1월에 ${r.sig === 'high' ? '유의미하게 상승' : '유의미하게 하락'}함 (최근 3개월 평균 대비)`
    )
  ).join('\n');

  // 최근 원문 텍스트 샘플
  const recentFeedback = data.filter(d => d.reason || d.improvement).slice(0, 20)
    .map(d => `[${d.score}점/${d.product}] ${d.reason || d.improvement}`).join('\n');

  const prompt = `
    당신은 숙련된 브랜드 전략가입니다. 10월부터 1월까지의 NPS 데이터와 '선택 이유' 트렌드를 분석하여 [논의 사항]을 도출하세요.
    
    분석 기초 자료:
    1. 1월 유의미한 지표 변화 (신뢰수준 80% 기반):
    ${significantPoints || '특이사항 없음'}
    
    2. 고객 최근 피드백:
    ${recentFeedback}
    
    다음 3가지 관점에서 전략적 논의 사항을 JSON으로 작성하세요. 각 항목은 2~3문장의 구체적인 분석 내용을 담은 리스트여야 합니다.
    - trendAnalysis: 지난 4개월간 눈에 띄는 지표 변화와 그 원인 추정
    - channelCharacteristics: 채널간(공식몰/외부몰/오프라인) 또는 그룹간(추천자/비방자) 경험 차이 분석
    - improvementTasks: NPS 개선을 위해 시급히 관리해야 할 항목 및 제언
    
    반드시 JSON 구조: { "trendAnalysis": ["내용1", "내용2"], "channelCharacteristics": ["내용1", "내용2"], "improvementTasks": ["내용1", "내용2"] }
    기울임 없이 전문적인 정자체 톤으로 작성하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Discussion Points Error:", error);
    return null;
  }
};

/**
 * 인구통계 상세 교차 테이블 분석
 */
export const getDemographicTableAnalysis = async (data: SurveyData[]) => {
  if (data.length === 0) return { summary: "데이터가 없습니다.", quotes: [] };

  // Create a new instance right before the call to ensure up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const detractors = data.filter(d => d.score <= 6 && d.improvement).slice(0, 10).map(d => `[비방자/${d.age}/${d.gender}/${d.product}] 개선요청: ${d.improvement}`);
  const promoters = data.filter(d => d.score >= 9 && d.reason).slice(0, 10).map(d => `[추천자/${d.age}/${d.gender}/${d.product}] 추천이유: ${d.reason}`);
  const combinedVerbatims = [...detractors, ...promoters].join('\n');

  const prompt = `
    다음은 채널 및 NPS 그룹별 인구통계 답변 원문입니다.
    ${combinedVerbatims}
    
    이 답변들을 바탕으로 인구통계적 특성(연령, 성별)에 따른 만족/불만족 패턴을 분석하여 JSON을 반환하세요:
    1. 특정 연령대나 성별에서 반복되는 제품 사용 경험상의 특징 분석
    2. 인구통계적 세그먼트별로 다르게 접근해야 할 서비스 포인트 제언
    3. 세그먼트의 특성을 가장 잘 대변하는 답변 원문 2개 추출 (반드시 원문에 성별, 연령, 제품 정보 포함)
    
    반드시 JSON 구조: { "summary": "내용", "quotes": ["문구1", "문구2"] }
    기울임 없이 정자로 작성하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    return { summary: "교차 테이블 분석 중 오류가 발생했습니다.", quotes: [] };
  }
};

/**
 * NPS 카테고리별 주관식 답변 상세 분석 (Point + Multiple Verbatims 구조)
 */
export const getDetailedCategoryAnalysis = async (category: NPSCategory, data: SurveyData[]) => {
  const categoryData = data.filter(d => {
    if (category === 'Promoter') return d.score >= 9;
    if (category === 'Passive') return d.score >= 7 && d.score <= 8;
    return d.score <= 6;
  });

  if (categoryData.length === 0) return { summary: "데이터가 존재하지 않습니다.", keyFindings: [] };

  // Create a new instance right before the call to ensure up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const verbatims = categoryData
    .map(d => `[${d.gender}/${d.age}/${d.product}] ${d.reason || d.improvement}`)
    .filter(t => t.length > 5)
    .slice(0, 60)
    .join('\n');
  
  const prompt = `
    당신은 브랜드 인사이트 분석가입니다. 다음은 NPS ${category === 'Promoter' ? '추천자' : category === 'Passive' ? '중립자' : '비방자'} 그룹의 실제 고객 답변 원문 리스트입니다.
    
    답변 리스트:
    ${verbatims}
    
    위 원문들을 분석하여 다음 구조의 JSON을 반환하세요:
    1. 요약(summary): 해당 그룹의 전반적인 감정과 핵심 만족/불만 요인을 3문장 이내로 요약.
    2. 주요 사항 및 원문(keyFindings): 3~5개의 핵심 발견 사항을 추출. 
       각 발견 사항은 'point'(요점)와 그 요점에 직접적으로 관련된 'verbatims'(실제 원문 리스트)로 구성.
       'verbatims' 리스트에는 해당 요점을 뒷받침하는 관련 원문을 리스트에서 찾아 최대한 모두 포함시켜야 함.
       원문을 발췌할 때는 반드시 리스트에 있는 [성별/연령/제품] 형식을 그대로 유지해야 함.
    
    반드시 JSON 구조: { "summary": "내용", "keyFindings": [ { "point": "요점1", "verbatims": ["원문1", "원문2", ...] }, ... ] }
    기울임 없이 정자로 작성하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Analysis Error:", error);
    return { summary: "AI 분석 중 오류가 발생했습니다.", keyFindings: [] };
  }
};

/**
 * 상세 실적 및 월별 추이 분석
 */
export const getPerformanceAnalysis = async (npsTable: any[], data: SurveyData[]) => {
  if (data.length === 0) return { summary: "데이터가 없습니다.", quotes: [] };

  // Create a new instance right before the call to ensure up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const tableSummary = npsTable.map(group => {
    const rowsSummary = group.rows.map((r: any) => `${r.label}: ${r.data[4]}${r.isPercent ? '%' : ''}`).join(', ');
    return `[${group.channel}] ${rowsSummary}`;
  }).join('\n');

  const recentFeedback = data.filter(d => d.reason || d.improvement).slice(0, 15)
    .map(d => `[${d.score}점/${d.channel}/${d.product}] ${d.reason || d.improvement}`).join('\n');

  const prompt = `
    당신은 비즈니스 데이터 분석가입니다. 다음 NPS 실적 테이블 요약과 고객 피드백을 분석하여 인사이트를 도출하세요.
    
    실적 요약 (1월 데이터 중심):
    ${tableSummary}
    
    고객 피드백 샘플:
    ${recentFeedback}
    
    위 데이터를 바탕으로 다음 내용을 포함한 JSON을 반환하세요:
    1. summary: 전체적인 실적 추이와 주요 채널별 성과 변화에 대한 분석 요약 (3-4문장)
    2. quotes: 실적 지표를 뒷받침하거나 설명해주는 가장 상징적인 고객 피드백 2개 추출 (반드시 원문 유지)
    
    반드시 JSON 구조: { "summary": "내용", "quotes": ["문구1", "문구2"] }
    기울임 없이 정자로 작성하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Performance Analysis Error:", error);
    return { summary: "실적 분석 중 오류가 발생했습니다.", quotes: [] };
  }
};

/**
 * 제품별 상세 분석
 */
export const getProductAnalysis = async (data: SurveyData[]) => {
  // 제품 관련 내용이 있는 피드백만 필터링
  const productFeedback = data
    .filter(d => d.product && d.product !== '기타' && (d.reason || d.improvement))
    .slice(0, 50)
    .map(d => `[${d.product}/${d.score}점/${d.categoryLabel}] ${d.reason || d.improvement}`)
    .join('\n');

  if (!productFeedback) return { summary: "제품 관련 피드백 데이터가 부족합니다.", keyFindings: [] };

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    다음은 시디즈 의자 제품별 고객 피드백 원문 리스트입니다.
    
    피드백 리스트:
    ${productFeedback}
    
    위 데이터를 바탕으로 제품별 만족도 및 품질 이슈를 분석하여 다음 구조의 JSON을 반환하세요:
    1. 요약(summary): 제품 전반에 대한 고객 인식, 특정 모델(T50, T80 등)의 강점 및 약점을 3문장으로 요약.
    2. 주요 사항 및 원문(keyFindings): 3~5개의 핵심 발견 사항(특정 모델의 착석감, 기능, 마감 등)을 추출.
       각 발견 사항은 'point'(요점)와 'verbatims'(관련 원문 리스트)로 구성.
       원문을 발췌할 때는 반드시 리스트에 있는 [제품명/점수] 정보를 포함해야 함.
    
    반드시 JSON 구조: { "summary": "내용", "keyFindings": [ { "point": "요점1", "verbatims": ["원문1", "원문2"] }, ... ] }
    기울임 없이 정자로 작성하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Product Analysis Error:", error);
    return { summary: "제품 분석 중 오류가 발생했습니다.", keyFindings: [] };
  }
};
