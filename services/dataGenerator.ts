import { SurveyData } from '../types';
import { CHANNELS, PRODUCTS, REASON_CATEGORIES } from '../constants';

const GENDERS = ['남성', '여성'];
const AGES = ['만 24세 이하', '만 25 ~ 34세', '만 35 ~ 44세', '만 45 ~ 54세', '만 55세 이상'];
const REGIONS = [
  '수도권 (서울/경기/인천)',
  '충청권 (대전/세종/충북/충남)',
  '강원권 (강원)',
  '경북권 (대구/경북)',
  '경남권 (부산/울산/경남)',
  '전라권 (광주/전북/전남)',
  '제주권 (제주)'
];

export const generateMockData = (count: number = 300): SurveyData[] => {
  const data: SurveyData[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(now.getTime() - Math.random() * 180 * 24 * 60 * 60 * 1000);
    const score = Math.floor(Math.random() * 11);
    
    const tsStr = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
    
    const numFactors = Math.random() > 0.7 ? 2 : 1;
    const selectedFactors = [];
    const tempCategories = [...REASON_CATEGORIES];
    for(let j=0; j<numFactors; j++) {
      const idx = Math.floor(Math.random() * tempCategories.length);
      selectedFactors.push(tempCategories.splice(idx, 1)[0]);
    }

    data.push({
      timestamp: tsStr,
      gender: GENDERS[Math.floor(Math.random() * GENDERS.length)],
      age: AGES[Math.floor(Math.random() * AGES.length)],
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
      product: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
      channel: CHANNELS[Math.floor(Math.random() * CHANNELS.length)],
      score: score,
      categoryLabel: score >= 9 ? '추천자' : score >= 7 ? '중립자' : '비방자',
      factors: selectedFactors.join(', '),
      reason: "디자인이 깔끔하고 브랜드 이미지가 좋아서 구매했습니다.",
      improvement: "가격이 조금 더 합리적이었으면 좋겠습니다."
    });
  }

  return data.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
};