
export type NPSCategory = 'Promoter' | 'Passive' | 'Detractor';

export interface SurveyData {
  timestamp: string;
  gender: string;
  age: string;
  region: string;
  product: string;
  channel: string;
  score: number;
  categoryLabel: string; // Col H (중립자, 비방자 등 문자열)
  factors: string; // Col I (선택 요인들)
  reason: string; // Col J
  improvement: string; // Col K
}

export interface AnalysisMemo {
  month: string;      // e.g. "2024.11" or "All"
  channel: string;    // e.g. "공식몰" or "All"
  sectionId: string;  // e.g. "product_nps", "discussion_board"
  content: string;    // The text content
}

export interface NPSMetric {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
}

export interface MonthlyChannelNPS {
  month: string;
  officialMall: number | null;
  externalMall: number | null;
  offline: number | null;
  avg3Months?: number;
}

export interface ProductBreakdown {
  product: string;
  Promoter: number;
  Passive: number;
  Detractor: number;
}
