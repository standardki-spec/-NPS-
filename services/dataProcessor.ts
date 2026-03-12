
import { SurveyData, NPSMetric, NPSCategory } from '../types';
import { REASON_CATEGORIES } from '../constants';

export const calculateNPS = (scores: number[]): NPSMetric => {
  if (scores.length === 0) return { total: 0, promoters: 0, passives: 0, detractors: 0, nps: 0 };
  
  const total = scores.length;
  const promoters = scores.filter(s => s >= 9).length;
  const detractors = scores.filter(s => s <= 6).length;
  const passives = total - promoters - detractors;
  
  const nps = Math.round(((promoters - detractors) / total) * 100);
  
  return { total, promoters, passives, detractors, nps };
};

export const getCategory = (score: number): NPSCategory => {
  if (score >= 9) return 'Promoter';
  if (score >= 7) return 'Passive';
  return 'Detractor';
};

export const cleanFactorName = (name: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  
  const exactMatch = REASON_CATEGORIES.find(cat => cat === trimmed);
  if (exactMatch) return exactMatch;

  // Keyword mapping based on REASON_CATEGORIES
  const keywords = [
    { key: '내구성', full: '제품 품질/성능 (내구성, 마감, 성능 등)' },
    { key: '마감', full: '제품 품질/성능 (내구성, 마감, 성능 등)' },
    { key: '성능', full: '제품 품질/성능 (내구성, 마감, 성능 등)' },
    { key: '품질', full: '제품 품질/성능 (내구성, 마감, 성능 등)' },
    { key: '브랜드', full: '브랜드 (이미지, 신뢰도, 광고 등)' },
    { key: '이미지', full: '브랜드 (이미지, 신뢰도, 광고 등)' },
    { key: '신뢰', full: '브랜드 (이미지, 신뢰도, 광고 등)' },
    { key: '배송', full: '배송 및 조립' },
    { key: '조립', full: '배송 및 조립' },
    { key: '품질보증', full: '품질보증 및 AS 정책' },
    { key: 'AS', full: '품질보증 및 AS 정책' },
    { key: 'A/S', full: '품질보증 및 AS 정책' },
    { key: '정책', full: '품질보증 및 AS 정책' },
    { key: '디자인', full: '제품 디자인 (사이즈, 색상, 인테리어와 어울림 등)' },
    { key: '사이즈', full: '제품 디자인 (사이즈, 색상, 인테리어와 어울림 등)' },
    { key: '색상', full: '제품 디자인 (사이즈, 색상, 인테리어와 어울림 등)' },
    { key: '인테리어', full: '제품 디자인 (사이즈, 색상, 인테리어와 어울림 등)' },
    { key: '사용', full: '사용/관리 (사용 난이도, 관리 편의성, 다용도 활용 등)' },
    { key: '관리', full: '사용/관리 (사용 난이도, 관리 편의성, 다용도 활용 등)' },
    { key: '난이도', full: '사용/관리 (사용 난이도, 관리 편의성, 다용도 활용 등)' },
    { key: '편의성', full: '사용/관리 (사용 난이도, 관리 편의성, 다용도 활용 등)' },
    { key: '가격', full: '가격 (할인, 프로모션 등)' },
    { key: '할인', full: '가격 (할인, 프로모션 등)' },
    { key: '프로모션', full: '가격 (할인, 프로모션 등)' },
    { key: '정보', full: '제품 정보 탐색 (매장 방문, 온라인 페이지 제품 정보, 제품 후기 등)' },
    { key: '탐색', full: '제품 정보 탐색 (매장 방문, 온라인 페이지 제품 정보, 제품 후기 등)' },
    { key: '후기', full: '제품 정보 탐색 (매장 방문, 온라인 페이지 제품 정보, 제품 후기 등)' },
    { key: '매장', full: '제품 정보 탐색 (매장 방문, 온라인 페이지 제품 정보, 제품 후기 등)' },
    { key: '이지리페어', full: '이지리페어 (부품 구매)' },
    { key: '부품', full: '이지리페어 (부품 구매)' },
    { key: '결제', full: '결제 방식의 편의성 (현금, 카드, 페이, 이체 등 지불 방법)' },
    { key: '지불', full: '결제 방식의 편의성 (현금, 카드, 페이, 이체 등 지불 방법)' },
  ];

  for (const item of keywords) {
    if (trimmed.includes(item.key)) return item.full;
  }

  return ''; 
};

export const standardizeChannel = (channel: string): string => {
  if (channel.includes('공식몰')) return '공식몰';
  if (channel.includes('온라인') || channel.includes('외부')) return '외부몰';
  if (channel.includes('오프라인') || channel.includes('매장')) return '오프라인';
  return '기타';
};

export const cleanRegionName = (region: string): string => {
  if (!region) return '기타';
  return region.split(' (')[0].trim();
};

export const getMonthKey = (ts: string): string => {
  if (!ts) return 'Unknown';
  const parts = ts.split('.');
  if (parts.length >= 2) {
    const year = parts[0].trim();
    const month = parts[1].trim().padStart(2, '0');
    return `${year}.${month}`;
  }
  return 'Unknown';
};

const getMonthLabel = (key: string): string => {
  if (key === 'Unknown') return '';
  const parts = key.split('.');
  if (parts.length < 2) return key;
  return `${parseInt(parts[1])}월`;
};

export const checkSignificanceAgainstAvg = (val1: number, n1: number, val2: number, isNps: boolean = false): 'high' | 'low' | 'none' => {
  if (n1 < 2) return 'none';
  const z = 1.28;
  let se;
  if (!isNps) {
    const p1 = val1 / 100;
    se = Math.sqrt((p1 * (1 - p1) / n1));
  } else {
    se = (100 / Math.sqrt(n1)) * 0.45;
  }
  const diff = (val1 - val2) / 100;
  const margin = z * se;
  if (diff > margin) return 'high';
  if (diff < -margin) return 'low';
  return 'none';
};

const getTimelineKeys = (data: SurveyData[], selectedMonth: string, selectedStartMonth: string = 'All') => {
  const dataKeys = new Set<string>();
  data.forEach(d => {
    const key = getMonthKey(d.timestamp);
    if (key !== 'Unknown') dataKeys.add(key);
  });

  const allKeys = Array.from(dataKeys);
  allKeys.sort();

  if (selectedMonth !== 'All') {
    const endIndex = allKeys.indexOf(selectedMonth);
    const startIndex = selectedStartMonth !== 'All' ? allKeys.indexOf(selectedStartMonth) : 0;
    
    if (endIndex !== -1) {
      const actualStart = startIndex !== -1 ? startIndex : 0;
      return allKeys.slice(actualStart, endIndex + 1);
    }
  }

  return allKeys;
};

export const getFullTableData = (data: SurveyData[], selectedMonth: string = 'All', selectedStartMonth: string = 'All', selectedChannels: string[] = ['All']) => {
  const channels = selectedChannels.includes('All') 
    ? ["전체", "외부몰", "공식몰", "오프라인"] 
    : selectedChannels;

  const timelineKeys = getTimelineKeys(data, selectedMonth, selectedStartMonth);
  const headers = timelineKeys.map(k => getMonthLabel(k));
  
  const monthlyStats: Record<string, Record<string, { n: number, promoterP: number, passiveP: number, detractorP: number, nps: number }>> = {};

  timelineKeys.forEach(key => {
    monthlyStats[key] = {};
    channels.forEach(ch => {
      const channelData = (ch === "전체") 
        ? data 
        : data.filter(d => standardizeChannel(d.channel) === ch);
        
      const monthData = channelData.filter(d => getMonthKey(d.timestamp) === key);
      const metric = calculateNPS(monthData.map(d => d.score));
      monthlyStats[key][ch] = {
        n: metric.total,
        promoterP: metric.total > 0 ? Math.round((metric.promoters / metric.total) * 100) : 0,
        passiveP: metric.total > 0 ? Math.round((metric.passives / metric.total) * 100) : 0,
        detractorP: metric.total > 0 ? Math.round((metric.detractors / metric.total) * 100) : 0,
        nps: metric.nps
      };
    });
  });

  const finalTable: any[] = [];
  channels.forEach(ch => {
    const rowGroup = {
      channel: ch,
      rows: [
        { label: "추천자", data: timelineKeys.map(k => monthlyStats[k][ch].promoterP), isPercent: true },
        { label: "중립자", data: timelineKeys.map(k => monthlyStats[k][ch].passiveP), isPercent: true },
        { label: "비방자", data: timelineKeys.map(k => monthlyStats[k][ch].detractorP), isPercent: true },
        { label: "NPS", data: timelineKeys.map(k => monthlyStats[k][ch].nps), isPercent: false, isNps: true }
      ]
    };
    
    rowGroup.rows.forEach((row: any) => {
      const len = row.data.length;
      if (len === 0) {
        row.avg3 = 0;
        row.sig = 'none';
        return;
      }
      const lastVal = row.data[len - 1];
      const lastKey = timelineKeys[len - 1];
      const lastN = monthlyStats[lastKey][ch].n;

      const dataForAvg = row.data.slice(Math.max(0, len - 3));
      const avg = Math.round(dataForAvg.reduce((a: number, b: number) => a + b, 0) / dataForAvg.length);
      
      row.avg3 = avg;
      row.sig = checkSignificanceAgainstAvg(lastVal, lastN, avg, !!row.isNps);
    });
    finalTable.push(rowGroup);
  });
  
  return { headers, tableData: finalTable };
};

export const getRollingThreeMonthNPS = (data: SurveyData[], selectedMonth: string = 'All', selectedStartMonth: string = 'All', selectedChannels: string[] = ['All']) => {
  const channels = selectedChannels.includes('All') 
    ? ["전체", "외부몰", "공식몰", "오프라인"] 
    : selectedChannels;

  const timelineKeys = getTimelineKeys(data, selectedMonth, selectedStartMonth);
  
  if (timelineKeys.length < 3) return { headers: [], rows: [] };

  const channelMonthlyNPS: Record<string, number[]> = {};
  
  channels.forEach(ch => {
    channelMonthlyNPS[ch] = timelineKeys.map(key => {
      const channelData = (ch === "전체") 
        ? data 
        : data.filter(d => standardizeChannel(d.channel) === ch);

      const monthData = channelData.filter(d => getMonthKey(d.timestamp) === key);
      return calculateNPS(monthData.map(d => d.score)).nps;
    });
  });

  const windows: { label: string, startIndex: number }[] = [];
  for (let i = 2; i < timelineKeys.length; i++) {
    const startMonth = getMonthLabel(timelineKeys[i-2]);
    const endMonth = getMonthLabel(timelineKeys[i]);
    const cleanStart = startMonth.replace('월', '');
    windows.push({
      label: `${cleanStart}~${endMonth}`,
      startIndex: i - 2
    });
  }

  const rows = channels.map(ch => {
    const npsValues = channelMonthlyNPS[ch];
    const windowValues = windows.map(win => {
      const subset = npsValues.slice(win.startIndex, win.startIndex + 3);
      const avg = Math.round(subset.reduce((a, b) => a + b, 0) / subset.length);
      return { label: win.label, value: avg };
    });
    
    return {
      channel: ch,
      windows: windowValues
    };
  });

  return { 
    headers: windows.map(w => w.label), 
    rows 
  };
};

export const getDemographicCrossTabData = (data: SurveyData[], selectedChannels: string[] = ['All']) => {
  // Determine which channels to show in the output based on selection
  const targetChannels = selectedChannels.includes('All') 
    ? ["전체", "외부몰", "공식몰", "오프라인"] 
    : selectedChannels;
    
  const categories: NPSCategory[] = ['Promoter', 'Passive', 'Detractor'];
  const labelMap: Record<string, string> = { 'Promoter': '추천자', 'Passive': '중립자', 'Detractor': '비방자' };
  
  const genders = ['남성', '여성', '기타'];
  const ages = ['만 24세 이하', '만 25 ~ 34세', '만 35 ~ 44세', '만 45 ~ 54세', '만 55세 이상'];
  const regionPool = ['수도권', '충청권', '강원권', '경북권', '경남권', '전라권', '제주권'];

  // Global region sort based on total volume (using the full 'data' provided as baseline)
  const regionCountsGlobal: Record<string, number> = {};
  regionPool.forEach(r => regionCountsGlobal[r] = 0);
  data.forEach(d => {
    const r = cleanRegionName(d.region);
    if (regionPool.includes(r)) regionCountsGlobal[r]++;
  });
  const sortedRegions = [...regionPool].sort((a, b) => regionCountsGlobal[b] - regionCountsGlobal[a]);
  
  // Base N for the entire dataset (Total)
  const globalTotalN = data.length || 1;

  const channelGroups = targetChannels.map(ch => {
    const channelData = (ch === "전체") 
      ? data
      : data.filter(d => standardizeChannel(d.channel) === ch);

    const channelTotalN = channelData.length || 1;

    const rows: any[] = [];

    // Helper to calculate cell data
    // Comparison: 
    // p_hat = (Channel Specific Count of Segment) / (Channel Total N)
    // globalProp = (Global Total Count of Segment) / (Global Total N)
    // This compares "How prevalent is this segment in this channel" vs "How prevalent is this segment overall"
    const calc = (demographicMatcher: (d: SurveyData) => boolean, categoryMatcher: (d: SurveyData) => boolean) => {
      // 1. Channel Statistics
      const localCount = channelData.filter(d => categoryMatcher(d) && demographicMatcher(d)).length;
      const localPercent = channelTotalN > 0 ? Math.round((localCount / channelTotalN) * 100) : 0;
      
      // 2. Global Statistics (Baseline)
      const globalCount = data.filter(d => categoryMatcher(d) && demographicMatcher(d)).length;
      const globalProp = globalCount / globalTotalN;

      let sig = 'none';
      
      // Sig Check: One-proportion Z-test
      // We are testing if the proportion in this channel is significantly different from the global proportion
      // Skip for 'Total' channel as it compares against itself
      if (ch !== "전체" && channelTotalN > 10 && globalProp > 0 && globalProp < 1) {
          const p_hat = localCount / channelTotalN;
          // Standard Error based on Global Proportion (Null Hypothesis)
          const se = Math.sqrt((globalProp * (1 - globalProp)) / channelTotalN);
          const z = (p_hat - globalProp) / se;
          
          if (z >= 1.28) sig = 'high'; // 80% CI
          else if (z <= -1.28) sig = 'low';
      }
      return { count: localCount, percent: localPercent, sig };
    };

    // 1. Process NPS Groups (Promoter, Passive, Detractor)
    categories.forEach(cat => {
      const label = labelMap[cat];
      const catMatcher = (d: SurveyData) => getCategory(d.score) === cat;
      const groupN = channelData.filter(catMatcher).length;

      const genderCounts = genders.map(g => calc(d => d.gender === g, catMatcher));
      const ageCounts = ages.map(a => calc(d => d.age === a, catMatcher));
      const regionCounts = sortedRegions.map(r => calc(d => cleanRegionName(d.region) === r, catMatcher));
      
      rows.push({ label, groupN, genderCounts, ageCounts, regionCounts });
    });

    // 2. Process Subtotal (Total Channel Data)
    const subtotalLabel = "소계";
    const subtotalMatcher = () => true; 
    const subtotalN = channelData.length;
    
    const subtotalGenderCounts = genders.map(g => calc(d => d.gender === g, subtotalMatcher));
    const subtotalAgeCounts = ages.map(a => calc(d => d.age === a, subtotalMatcher));
    const subtotalRegionCounts = sortedRegions.map(r => calc(d => cleanRegionName(d.region) === r, subtotalMatcher));

    rows.push({ 
      label: subtotalLabel, 
      groupN: subtotalN, 
      genderCounts: subtotalGenderCounts, 
      ageCounts: subtotalAgeCounts, 
      regionCounts: subtotalRegionCounts 
    });

    return { channel: ch, rows };
  });

  return {
    groups: channelGroups,
    regionLabels: sortedRegions
  };
};

export const getChannelTopReasons = (data: SurveyData[], selectedChannels: string[] = ['All']) => {
  const channels = selectedChannels.includes('All') 
    ? ["전체", "외부몰", "공식몰", "오프라인"] 
    : selectedChannels;
  
  const results = channels.map(ch => {
    const channelData = (ch === "전체") 
        ? data
        : data.filter(d => standardizeChannel(d.channel) === ch);

    const counts: Record<string, number> = {};
    
    REASON_CATEGORIES.forEach(cat => counts[cat] = 0);
    
    channelData.forEach(d => {
      const factors = (d.factors || '').split(',').map(f => cleanFactorName(f));
      const uniqueFactorsInResponse = Array.from(new Set(factors));
      uniqueFactorsInResponse.forEach(f => {
        if (f && counts[f] !== undefined) counts[f]++;
      });
    });

    const sortedEntries = Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    const rankedEntries = sortedEntries.map((entry, index) => {
      const currentCount = entry[1];
      const previousCount = index > 0 ? sortedEntries[index - 1][1] : null;
      
      let rank = 1;
      if (index > 0) {
        if (currentCount === previousCount) {
          let r = 1;
          for(let j = index; j > 0; j--) {
            if(sortedEntries[j][1] !== sortedEntries[j-1][1]) {
              r = j + 1;
              break;
            }
          }
          rank = r;
        } else {
          rank = index + 1;
        }
      }

      return { name: entry[0], count: entry[1], rank };
    });

    const formatRankItems = (rank: number) => {
      const items = rankedEntries.filter(e => e.rank === rank);
      if (items.length === 0) return '-';
      
      return items.map(it => {
        const displayName = it.name.includes(' (') ? it.name.split(' (')[0] : it.name;
        return `${displayName} (${it.count})`;
      }).join('\n');
    };

    return {
      channel: ch,
      count: channelData.length,
      top1: formatRankItems(1),
      top2: formatRankItems(2),
      top3: formatRankItems(3)
    };
  });

  return results.sort((a, b) => b.count - a.count);
};

export const processProductNPS = (data: SurveyData[]) => {
  const productMap: Record<string, number[]> = {};
  data.forEach(d => {
    let productName = d.product;
    if (productName.includes('게이밍 체어')) productName = '게이밍 체어';
    if (!productMap[productName]) productMap[productName] = [];
    productMap[productName].push(d.score);
  });
  return Object.entries(productMap)
    .map(([product, scores]) => {
      const metric = calculateNPS(scores);
      return { product, nps: metric.nps, count: metric.total, promoters: metric.promoters, passives: metric.passives, detractors: metric.detractors };
    })
    .sort((a, b) => b.count - a.count);
};

export const processReasonByNPSGroup = (data: SurveyData[]) => {
  const reasonMap: Record<string, { Promoter: number, Passive: number, Detractor: number }> = {};
  REASON_CATEGORIES.forEach(cat => { reasonMap[cat] = { Promoter: 0, Passive: 0, Detractor: 0 }; });
  data.forEach(d => {
    const group = getCategory(d.score);
    const rawFragments = (d.factors || '').split(',').map(f => f.trim()).filter(f => f.length > 0);
    const matchedStandardCategories = new Set<string>();
    rawFragments.forEach(f => {
      const standardName = cleanFactorName(f);
      if (standardName) matchedStandardCategories.add(standardName);
    });
    matchedStandardCategories.forEach(standardName => {
      if (reasonMap[standardName]) reasonMap[standardName][group]++;
    });
  });
  return Object.entries(reasonMap)
    .map(([name, counts]) => ({ name, Promoters: counts.Promoter, Passives: counts.Passive, Detractors: counts.Detractor, total: counts.Promoter + counts.Passive + counts.Detractor }))
    .sort((a, b) => b.total - a.total);
};

export const getMonthlyTrendData = (data: SurveyData[], selectedMonth: string = 'All', selectedStartMonth: string = 'All') => {
  const timelineKeys = getTimelineKeys(data, selectedMonth, selectedStartMonth);
  const groups: NPSCategory[] = ['Promoter', 'Passive', 'Detractor'];
  const result: Record<NPSCategory, any[]> = { Promoter: [], Passive: [], Detractor: [] };

  groups.forEach(group => {
    const trend = timelineKeys.map(key => {
      const monthLabel = getMonthLabel(key);
      const obj: any = { month: monthLabel };
      
      const monthData = data.filter(d => getMonthKey(d.timestamp) === key && getCategory(d.score) === group);
      const totalInGroup = monthData.length;
      obj.groupTotal = totalInGroup;
      
      REASON_CATEGORIES.forEach(cat => {
        const count = monthData.filter(d => {
          const factors = (d.factors || '').split(',').map(f => cleanFactorName(f));
          return factors.includes(cat);
        }).length;
        obj[cat] = totalInGroup > 0 ? Math.round((count / totalInGroup) * 100) : 0;
      });
      return obj;
    });
    result[group] = trend;
  });
  return result;
};

export const getCombinedMonthlyNPSTrend = (data: SurveyData[], selectedMonth: string = 'All', selectedStartMonth: string = 'All', selectedChannels: string[] = ['All']) => {
  const timelineKeys = getTimelineKeys(data, selectedMonth, selectedStartMonth);
  // Filter which lines to show based on selected channel
  const channels = selectedChannels.includes('All') 
    ? ['전체', '외부몰', '공식몰', '오프라인'] 
    : selectedChannels;
  
  return timelineKeys.map(key => {
    const monthLabel = getMonthLabel(key);
    const item: any = { name: monthLabel }; // X-axis key
    
    channels.forEach(ch => {
      const channelData = (ch === "전체") 
        ? data 
        : data.filter(d => standardizeChannel(d.channel) === ch);
        
      const monthData = channelData.filter(d => getMonthKey(d.timestamp) === key);
      const nps = calculateNPS(monthData.map(d => d.score)).nps;
      item[ch] = nps;
    });
    
    return item;
  });
};
