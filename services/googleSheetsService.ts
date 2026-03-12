
import { SurveyData, AnalysisMemo } from '../types';

// Hardcoded GIDs to ensure correct data fetching regardless of the URL pasted
const RAW_DATA_GID = '303605781'; 
const MEMO_GID = '2082769727';

const getCsvUrl = (url: string, targetGid?: string): string | null => {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;
  const sheetId = match[1];
  
  // Use targetGid if provided, otherwise try to extract from URL, default to '0'
  let gid = targetGid;
  if (!gid) {
    const gidMatch = url.match(/gid=([0-9]+)/);
    gid = gidMatch ? gidMatch[1] : '0';
  }
  
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
};

/**
 * Robust CSV Parser that handles quoted fields, newlines within quotes, and correct column splitting.
 */
const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuote) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuote = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === ',') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        // Ignore CR
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }
  // Push last row if exists
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }
  return rows;
};

/**
 * Parsing logic for the Raw Data sheet:
 * Enforces RAW_DATA_GID (303605781)
 */
export const fetchSheetData = async (url: string): Promise<SurveyData[]> => {
  const csvUrl = getCsvUrl(url, RAW_DATA_GID); 
  if (!csvUrl) throw new Error('올바르지 않은 구글 시트 URL입니다.');

  const response = await fetch(csvUrl);
  if (!response.ok) throw new Error('시트 데이터를 가져오지 못했습니다. 공유 설정을 확인해주세요.');

  const text = await response.text();
  const rows = parseCSV(text);

  // Skip header and filter empty rows
  return rows.slice(1)
    .filter(row => row.length >= 7 && row[0]) // Ensure minimal valid row
    .map(row => ({
      timestamp: row[0] || '',
      gender: row[1] || '기타',
      age: row[2] || '알 수 없음',
      region: row[3] || '기타',
      product: row[4] || '기타',
      channel: row[5] || '기타',
      score: parseInt(row[6]) || 0,
      categoryLabel: row[7] || '',
      factors: row[8] || '',
      reason: row[9] || '',
      improvement: row[10] || ''
    }));
};

/**
 * Parsing logic for the Analysis Memos sheet.
 * Enforces MEMO_GID (2082769727)
 */
const SECTION_MAP: Record<string, string> = {
  // Normalize keys by removing all whitespace for robust matching
  "추천자그룹요인": "factors_Promoter",
  "중립자그룹요인": "factors_Passive",
  "비방자그룹요인": "factors_Detractor",
  "인구통계교차분석": "demographic_cross",
  "월별NPS실적": "monthly_trend",
  "제품별NPS": "product_nps",
  "논의사항": "discussion_board",
  
  // Extended Aliases for robustness (titles might vary slightly)
  "추천자그룹요인분석노트": "factors_Promoter",
  "중립자그룹요인분석노트": "factors_Passive",
  "비방자그룹요인분석노트": "factors_Detractor",
  "인구통계교차분석분석노트": "demographic_cross",
  "인구통계교차분석상세": "demographic_cross",
  "인구통계교차분석노트": "demographic_cross",
  "월별NPS실적분석노트": "monthly_trend",
  "월별NPS상세실적통합테이블": "monthly_trend",
  "제품별NPS분석노트": "product_nps",
  "제품별NPS점수": "product_nps",
  "전략적논의사항및실행과제": "discussion_board",
  "전략적논의사항": "discussion_board",
  "교차분석": "demographic_cross"
};

export const fetchMemoData = async (url: string): Promise<AnalysisMemo[]> => {
  const csvUrl = getCsvUrl(url, MEMO_GID);
  if (!csvUrl) return [];

  try {
    const response = await fetch(csvUrl);
    if (!response.ok) return [];

    const text = await response.text();
    const rows = parseCSV(text);

    if (rows.length < 2) return []; 

    // 1. Find Header Row (Look for Date patterns like 2026.01, 2024.11 etc)
    let headerIndex = -1;
    for (let i = 0; i < Math.min(20, rows.length); i++) {
        const r = rows[i];
        // Check for YYYY.MM or 'All'/'Total' with some date context in the row
        const hasDate = r.some(c => /(\d{4})[\.\-\s]+(\d{1,2})/.test(c) || ['전체', 'Total', 'All'].includes(c.trim()));
        if (hasDate) {
            headerIndex = i;
            break;
        }
    }
    // Fallback default
    if (headerIndex === -1) headerIndex = 0;

    const headerRow = rows[headerIndex];
    const dateMap: Record<number, string> = {};

    // 2. Identify Date Columns
    headerRow.forEach((cell, idx) => {
        if (!cell) return;
        const clean = cell.trim();
        const match = clean.match(/(\d{4})[\.\-\s]+(\d{1,2})/);
        if (match) {
            // Normalize to YYYY.MM format
            dateMap[idx] = `${match[1]}.${match[2].padStart(2, '0')}`;
        } else if (['전체', 'total', 'all'].includes(clean.toLowerCase())) {
            dateMap[idx] = 'All';
        }
    });

    const memoMap: Record<string, AnalysisMemo> = {}; // Key: month-sectionId

    // 3. Iterate Rows
    for (let i = headerIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        let sectionRaw = row[0] || ''; // Column A (Index 0)
        
        // Rule: Analysis Note Header is in Column A
        // Normalize whitespace to match keys in SECTION_MAP
        const cleanTitle = sectionRaw.replace(/\s+/g, '');
        const sectionId = SECTION_MAP[cleanTitle];

        // If no valid section mapped, skip this row
        // This implicitly handles the request to only fetch valid rows (4~9 and 10)
        if (!sectionId) continue;

        // Iterate through mapped Date columns to extract content
        Object.entries(dateMap).forEach(([colIdxStr, month]) => {
            const colIdx = parseInt(colIdxStr);
            const content = row[colIdx];
            
            if (content && content.trim()) {
                const key = `${month}-${sectionId}`;
                
                if (!memoMap[key]) {
                    memoMap[key] = {
                        month,
                        channel: 'All', // Enforce 'All' channel for this sheet
                        sectionId,
                        content: content.trim()
                    };
                } else {
                    // Accumulate content (useful if discussion points are split across multiple rows, though user mentioned 'only 10 rows')
                    memoMap[key].content += '\n' + content.trim();
                }
            }
        });
    }

    return Object.values(memoMap);

  } catch (e) {
    console.warn("Failed to fetch memos", e);
    return [];
  }
};
