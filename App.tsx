
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LabelList, ComposedChart, Line, LineChart
} from 'recharts';
import { 
  TrendingUp, Users, BrainCircuit, Activity, Database, LogOut, RefreshCw, Filter, Award,
  Table as TableIcon, Calendar, Package, Info, CheckCircle2, Link, Store, Save, ClipboardList,
  RefreshCcw, Download, ChevronRight, MessageSquare
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { generateMockData } from './services/dataGenerator';
import { 
  calculateNPS, 
  getCategory,
  getMonthKey,
  standardizeChannel,
  processProductNPS,
  processReasonByNPSGroup,
  getMonthlyTrendData,
  getFullTableData,
  getDemographicCrossTabData,
  cleanRegionName,
  getChannelTopReasons,
  getRollingThreeMonthNPS,
  getCombinedMonthlyNPSTrend
} from './services/dataProcessor';
import { getAIInsights } from './services/geminiService';
import { fetchSheetData, fetchMemoData } from './services/googleSheetsService';
import { SurveyData, NPSCategory, AnalysisMemo } from './types';
import { COLORS, REASON_CATEGORIES } from './constants';
import NPSGauge from './components/NPSGauge';

const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1R7Tqml0zTkOhbXvgqJSTVUzfBpczoU3Ynyaucpu0Blc/edit?resourcekey=&gid=2082769727#gid=2082769727";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-lg">
        <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1 text-xs">{label}</p>
        <div className="space-y-1.5">
          {payload.map((p: any, i: number) => {
            const nameStr = String(p.name || '');
            if (nameStr === 'NPS Label Position') return null;
            return (
              <div key={i} className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                  <span className="text-[10px] text-slate-500 font-medium">{nameStr.split(' (')[0]}</span>
                </div>
                <span className="text-xs font-bold text-slate-700">{p.value}{p.name === 'nps' ? '' : '%'}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const SimpleTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-lg">
        <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1 text-xs">{label}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#007AFF]"></div><span className="text-xs text-slate-500 font-medium">추천자</span></div>
            <span className="text-xs font-bold text-slate-700">{data.Promoters || 0}건</span>
          </div>
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#8E8E93]"></div><span className="text-xs text-slate-500 font-medium">중립자</span></div>
            <span className="text-xs font-bold text-slate-700">{data.Passives || 0}건</span>
          </div>
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#FF3B30]"></div><span className="text-xs text-slate-500 font-medium">비방자</span></div>
            <span className="text-xs font-bold text-slate-700">{data.Detractors || 0}건</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const TrendTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs min-w-[120px]">
        <p className="font-bold mb-2 text-slate-800 border-b border-slate-100 pb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex justify-between items-center gap-4">
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                 <span className="text-[10px] text-slate-500">{p.name}</span>
               </div>
               <span className="font-bold text-slate-700">{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const valStr = String(payload.value || '');
  const simplifiedLabel = valStr.split(' (')[0];
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={20} textAnchor="middle" fill="#64748b" className="text-[11px] font-bold">{simplifiedLabel}</text>
    </g>
  );
};

// --- NEW COMPONENT FOR BETTER TEXT READABILITY ---
const FormattedViewer = ({ content, className = "", isCardMode = false }: { content: string, className?: string, isCardMode?: boolean }) => {
  if (!content) return null;

  // Split lines but preserve empty lines to allow for paragraph spacing
  const lines = content.split('\n');

  // Helper function to process bold text (markdown **text** or Key: Value pattern)
  const renderText = (text: string, autoBoldColon: boolean = false) => {
    let parts: (string | React.ReactNode)[] = [text];
    
    // 1. Auto-bold before colon if applicable (e.g. "Term: Definition")
    if (autoBoldColon && text.includes(':')) {
       const splitIndex = text.indexOf(':');
       // Ensure colon isn't at the very end or beginning
       if (splitIndex > 0 && splitIndex < text.length - 1) {
          const key = text.substring(0, splitIndex + 1); // Include colon
          const val = text.substring(splitIndex + 1);
          parts = [<strong key="colon-key" className="font-bold text-slate-900">{key}</strong>, val];
       }
    }

    // 2. Parse **bold** markdown
    parts = parts.flatMap((part, i) => {
      if (typeof part !== 'string') return part;
      return part.split(/(\*\*.*?\*\*)/g).map((subPart, j) => {
        if (subPart.startsWith('**') && subPart.endsWith('**')) {
          return <strong key={`md-${i}-${j}`} className="font-bold text-slate-900">{subPart.slice(2, -2)}</strong>;
        }
        return subPart;
      });
    });

    // 3. Parse <b>bold</b> HTML tags
    parts = parts.flatMap((part, i) => {
      if (typeof part !== 'string') return part;
      return part.split(/(<b>.*?<\/b>)/g).map((subPart, j) => {
        if (subPart.startsWith('<b>') && subPart.endsWith('</b>')) {
          return <strong key={`html-${i}-${j}`} className="font-bold text-slate-900">{subPart.slice(3, -4)}</strong>;
        }
        return subPart;
      });
    });

    return parts;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        
        // Handle empty lines as explicit spacers
        if (trimmed.length === 0) {
            return <div key={i} className="h-4" role="separator" />;
        }
        
        // Header detection (e.g., ends with colon or enclosed in [])
        // Treat short lines ending in colon as headers
        const isHeader = /^\[.*\]$/.test(trimmed) || (trimmed.endsWith(':') && trimmed.length < 50);
        // Quote detection (starts with " or “)
        const isQuote = /^["“]/.test(trimmed);
        // Bullet detection
        const isBullet = /^[-•*]\s/.test(trimmed);
        // Number detection
        const isNumber = /^\d+[\.\)]\s/.test(trimmed);

        const baseCardClasses = "bg-white p-4 rounded-lg border border-slate-100 shadow-sm hover:border-slate-200 transition-colors";
        const baseTextClasses = "pl-1";

        if (isHeader) {
           return <h6 key={i} className="font-bold text-slate-800 mt-6 mb-3 text-sm flex items-center gap-2 border-b border-slate-100 pb-2"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>{trimmed.replace(/[:]/g, '')}</h6>
        }

        if (isQuote) {
           return (
             <div key={i} className={`${isCardMode ? baseCardClasses : 'ml-1 my-3'}`}>
                <div className={`pl-4 border-l-4 border-slate-300 text-slate-600 italic leading-relaxed ${isCardMode ? '' : 'bg-slate-50/80 py-3 pr-4 rounded-r-lg'}`}>
                   {renderText(trimmed)}
                </div>
             </div>
           )
        }

        if (isBullet) {
          const text = trimmed.replace(/^[-•*]\s/, '');
          return (
            <div key={i} className={`flex items-start gap-3 ${isCardMode ? baseCardClasses : baseTextClasses}`}>
               <div className={`mt-2.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCardMode ? 'bg-indigo-400' : 'bg-slate-400/60'}`} />
               <span className="leading-relaxed text-slate-700">{renderText(text, true)}</span>
            </div>
          )
        }

        if (isNumber) {
           const match = trimmed.match(/^(\d+)[\.\)]\s+(.*)/);
           const num = match ? match[1] : '•';
           const text = match ? match[2] : trimmed;
           return (
             <div key={i} className={`flex items-start gap-3 ${isCardMode ? baseCardClasses : baseTextClasses}`}>
               <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] min-w-[24px] text-center mt-0.5 ${isCardMode ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{num}</span>
               <span className="leading-relaxed text-slate-700">{renderText(text, true)}</span>
             </div>
           )
        }

        return <p key={i} className={`leading-relaxed ${isCardMode ? baseCardClasses + ' text-slate-700' : baseTextClasses + ' text-slate-700'}`}>{renderText(trimmed)}</p>;
      })}
    </div>
  );
};

const MemoSection = ({ id, title, selectedMonth, periodText, selectedChannels, memos }: { 
  id: string, 
  title: string, 
  selectedMonth: string, 
  periodText: string,
  selectedChannels: string[], 
  memos: AnalysisMemo[] 
}) => {
  
  if (!selectedChannels.includes('All')) {
    return null;
  }

  const content = useMemo(() => {
    const match = memos.find(m => 
      m.sectionId === id && 
      m.month === selectedMonth && 
      m.channel === 'All'
    );

    return match ? match.content : '';
  }, [memos, id, selectedMonth]);

  return (
    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-5 relative transition-all hover:bg-slate-100/80 group">
      <div className="flex justify-between items-center mb-3">
        <h5 className="text-xs font-bold text-slate-700 flex items-center gap-2">
          <MessageSquare className={`w-3.5 h-3.5 ${content ? 'text-indigo-500' : 'text-slate-300'}`} />
          {title} 분석 노트 <span className="text-slate-400 font-normal ml-1 text-[10px]">({periodText})</span>
        </h5>
      </div>
      <div className={`w-full text-xs leading-relaxed ${content ? 'text-slate-700' : 'text-slate-400 italic'}`}>
        {content ? <FormattedViewer content={content} /> : "등록된 분석 노트가 없습니다."}
      </div>
    </div>
  );
};

const DiscussionBoard = ({ selectedMonth, periodText, selectedChannels, memos }: { 
  selectedMonth: string, 
  periodText: string,
  selectedChannels: string[], 
  memos: AnalysisMemo[] 
}) => {
  
  if (!selectedChannels.includes('All')) {
    return null;
  }
  
  const content = useMemo(() => {
    const match = memos.find(m => 
      m.sectionId === 'discussion_board' && 
      m.month === selectedMonth && 
      m.channel === 'All'
    );
    return match ? match.content : '';
  }, [memos, selectedMonth]);

  return (
    <section className="bg-white p-8 rounded-sm border border-slate-200 shadow-sm mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2 text-slate-800">
             <ClipboardList className="w-5 h-5 text-indigo-600" /> 논의 사항
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">
             현재 선택된 필터(<span className="font-bold text-slate-600">{periodText}</span>, 
             <span className="font-bold text-slate-600"> 전체 채널</span>)에 대한 주요 의사결정 및 향후 실행 계획
          </p>
        </div>
      </div>
      
      <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-8 min-h-[200px]">
        {content ? (
          <FormattedViewer content={content} className="text-sm" isCardMode={false} />
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <Info className="w-6 h-6 opacity-50" />
            <p className="text-xs">스프레드 시트에 해당 조건의 논의 사항 데이터가 없습니다.</p>
            <p className="text-[10px] opacity-70">G시트 '논의사항' 탭 (GID: 2082769727) 데이터를 확인하세요.</p>
          </div>
        )}
      </div>
    </section>
  );
};

const App: React.FC = () => {
  const [data, setData] = useState<SurveyData[]>([]);
  const [memos, setMemos] = useState<AnalysisMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string>(localStorage.getItem('nps_sheet_url') || DEFAULT_SHEET_URL);
  const [isConnected, setIsConnected] = useState(false);
  
  // Filters
  const [filterType, setFilterType] = useState<'month' | 'period'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedStartMonth, setSelectedStartMonth] = useState<string>('All');
  const [selectedEndMonth, setSelectedEndMonth] = useState<string>('All');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['All']);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    data.forEach(d => {
      const key = getMonthKey(d.timestamp);
      if (key !== 'Unknown') months.add(key);
    });
    const sortedMonths = Array.from(months).sort();
    
    // Set default selectedMonth to the latest month if it's 'All'
    if (selectedMonth === 'All' && sortedMonths.length > 0) {
      setSelectedMonth(sortedMonths[sortedMonths.length - 1]);
    }
    
    return sortedMonths;
  }, [data, selectedMonth]);

  const effectiveEndMonth = filterType === 'month' ? selectedMonth : selectedEndMonth;
  const effectiveStartMonth = useMemo(() => {
    if (filterType === 'period') return selectedStartMonth;
    if (selectedMonth === 'All') return 'All';
    const index = availableMonths.indexOf(selectedMonth);
    if (index === -1) return 'All';
    const startIndex = Math.max(0, index - 5);
    return availableMonths[startIndex];
  }, [filterType, selectedMonth, selectedStartMonth, availableMonths]);
  
  const displayStartMonth = filterType === 'month' ? selectedMonth : selectedStartMonth;
  const periodText = filterType === 'month' 
    ? (selectedMonth === 'All' ? '전체 기간' : selectedMonth)
    : (selectedStartMonth === 'All' && selectedEndMonth === 'All' ? '전체 기간' : `${selectedStartMonth === 'All' ? '처음' : selectedStartMonth} ~ ${selectedEndMonth === 'All' ? '끝' : selectedEndMonth}`);

  const dashboardRef = useRef<HTMLDivElement>(null);

  const loadData = async (url: string) => {
    setLoading(true);
    try {
      // Load both raw data and memos in parallel
      const [liveData, memoData] = await Promise.all([
        fetchSheetData(url),
        fetchMemoData(url)
      ]);
      
      setData(liveData);
      setMemos(memoData);
      localStorage.setItem('nps_sheet_url', url);
      setIsConnected(true);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      // If loading failed, fallback to mock data
      setData(generateMockData(800));
      setMemos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlToLoad = localStorage.getItem('nps_sheet_url') || DEFAULT_SHEET_URL;
    loadData(urlToLoad);
  }, []);

  const handleRefresh = () => {
    if (sheetUrl) {
      loadData(sheetUrl);
    }
  };

  const handleDownloadPDF = async () => {
    if (!dashboardRef.current) return;
    
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 1.5, // Better resolution
        backgroundColor: '#F8FAFC',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfImgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfImgHeight; // top of next page
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
        heightLeft -= pdfHeight;
      }
      
      const periodLabel = filterType === 'month' ? selectedMonth : `${selectedStartMonth}_to_${selectedEndMonth}`;
      pdf.save(`NPS_Dashboard_${periodLabel}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("PDF 다운로드 중 오류가 발생했습니다.");
    }
  };

  // Filter 0: By Month ONLY (New) - Used for Baseline Data in Cross Tab
  const monthFilteredData = useMemo(() => {
    if (filterType === 'month') {
      if (selectedMonth === 'All') return data;
      return data.filter(d => getMonthKey(d.timestamp) === selectedMonth);
    } else {
      return data.filter(d => {
        const key = getMonthKey(d.timestamp);
        const afterStart = selectedStartMonth === 'All' ? true : key >= selectedStartMonth;
        const beforeEnd = selectedEndMonth === 'All' ? true : key <= selectedEndMonth;
        return afterStart && beforeEnd;
      });
    }
  }, [data, filterType, selectedMonth, selectedStartMonth, selectedEndMonth]);

  // Filter 1: By Channel (Used for Trend Charts & Tables that show timeline)
  const channelFilteredData = useMemo(() => {
    if (selectedChannels.includes('All')) return data;
    return data.filter(d => selectedChannels.includes(standardizeChannel(d.channel)));
  }, [data, selectedChannels]);

  // Filter 2: By Month (Used for Gauges, Breakdown Pie/Bar Charts, AI Insights)
  const fullyFilteredData = useMemo(() => {
    if (filterType === 'month') {
      if (selectedMonth === 'All') return channelFilteredData;
      return channelFilteredData.filter(d => getMonthKey(d.timestamp) === selectedMonth);
    } else {
      return channelFilteredData.filter(d => {
        const key = getMonthKey(d.timestamp);
        const afterStart = selectedStartMonth === 'All' ? true : key >= selectedStartMonth;
        const beforeEnd = selectedEndMonth === 'All' ? true : key <= selectedEndMonth;
        return afterStart && beforeEnd;
      });
    }
  }, [channelFilteredData, filterType, selectedMonth, selectedStartMonth, selectedEndMonth]);

  const metrics = useMemo(() => calculateNPS(fullyFilteredData.map(d => d.score)), [fullyFilteredData]);
  
  // Tables use channelFilteredData (contains all months) but filtered by Channel if selected
  const { headers: npsTableHeaders, tableData: npsFullTable } = useMemo(() => getFullTableData(data, effectiveEndMonth, effectiveStartMonth, selectedChannels), [data, effectiveEndMonth, effectiveStartMonth, selectedChannels]);
  
  const { headers: rollingHeaders, rows: rollingNpsData } = useMemo(() => getRollingThreeMonthNPS(data, effectiveEndMonth, effectiveStartMonth, selectedChannels), [data, effectiveEndMonth, effectiveStartMonth, selectedChannels]);
  
  // Trend Charts use channelFilteredData to show history, but sorted by selectedMonth context
  const monthlyTrendData = useMemo(() => getMonthlyTrendData(channelFilteredData, effectiveEndMonth, effectiveStartMonth), [channelFilteredData, effectiveEndMonth, effectiveStartMonth]);
  
  const combinedTrendData = useMemo(() => getCombinedMonthlyNPSTrend(data, effectiveEndMonth, effectiveStartMonth, selectedChannels), [data, effectiveEndMonth, effectiveStartMonth, selectedChannels]);

  const productMetrics = useMemo(() => processProductNPS(fullyFilteredData), [fullyFilteredData]);
  
  const productChartData = useMemo(() => {
    return productMetrics.map(p => ({
      ...p,
      labelPosition: Math.max(p.promoters, p.passives, p.detractors)
    }));
  }, [productMetrics]);

  const handleConnect = (e: React.FormEvent) => { e.preventDefault(); if (sheetUrl) loadData(sheetUrl); };
  const handleDisconnect = () => {
    if (window.confirm('구글 시트 연동을 해제하시겠습니까? (연동 해제 시 샘플 데이터로 전환됩니다)')) {
      localStorage.removeItem('nps_sheet_url');
      setSheetUrl(''); 
      setIsConnected(false); 
      setData(generateMockData(800));
      setMemos([]);
    }
  };

  const availableChannels = ['All', '외부몰', '공식몰', '오프라인'];

  const channelMetrics = useMemo(() => {
    const getM = (ch: string) => {
      const d = fullyFilteredData.filter(item => standardizeChannel(item.channel) === ch);
      return { nps: calculateNPS(d.map(i => i.score)).nps, count: d.length };
    };
    return { external: getM('외부몰'), official: getM('공식몰'), offline: getM('오프라인') };
  }, [fullyFilteredData]);

  const reasonGroupData = useMemo(() => processReasonByNPSGroup(fullyFilteredData), [fullyFilteredData]);
  
  // Updated call to pass monthFilteredData and selectedChannels
  const { groups: demoCrossTabData, regionLabels: demoRegionLabels } = useMemo(() => getDemographicCrossTabData(monthFilteredData, selectedChannels), [monthFilteredData, selectedChannels]);

  const demographicData = useMemo(() => {
    const countMap = (arr: string[], order: string[]) => {
      const counts: Record<string, number> = {};
      arr.forEach(val => counts[val] = (counts[val] || 0) + 1);
      return order.map(name => ({ name, percent: Math.round(((counts[name] || 0) / (arr.length || 1)) * 100), value: counts[name] || 0 }));
    };
    const getRegionData = () => {
      const counts: Record<string, number> = {};
      fullyFilteredData.forEach(d => {
        const r = cleanRegionName(d.region);
        counts[r] = (counts[r] || 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value, percent: Math.round((value / (fullyFilteredData.length || 1)) * 100) })).sort((a,b) => b.value - a.value);
    };
    return {
      ages: countMap(fullyFilteredData.map(d => d.age), ['만 24세 이하', '만 25 ~ 34세', '만 35 ~ 44세', '만 45 ~ 54세', '만 55세 이상']),
      genders: countMap(fullyFilteredData.map(d => d.gender), ['남성', '여성', '기타']),
      channels: countMap(fullyFilteredData.map(d => standardizeChannel(d.channel)), ['외부몰', '공식몰', '오프라인']),
      regions: getRegionData()
    };
  }, [fullyFilteredData]);

  const fetchAIInsights = async () => {
    setIsAiLoading(true);
    setAiInsight(await getAIInsights(fullyFilteredData, metrics));
    setIsAiLoading(false);
  };

  const renderPercentLabel = ({ x, y, width, value }: any) => (
    <text x={x + width / 2} y={y - 10} fill="#64748b" textAnchor="middle" fontSize={11} fontWeight="bold">{value}%</text>
  );

  const renderRegionLabel = ({ name, percent, x, y, cx }: any) => {
    return <text x={x} y={y} fill="#64748b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={9} fontWeight="bold">{`${name} (${percent}%)`}</text>;
  };

  const renderTrendChart = (group: NPSCategory, title: string) => {
    const chartData = monthlyTrendData[group];
    
    // Find the latest month's data to determine the sorting order.
    const latestData = chartData.length > 0 ? chartData[chartData.length - 1] : null;
    const totalCount = latestData?.groupTotal || 0;
    
    const sortedCategories = [...REASON_CATEGORIES].sort((a, b) => {
      const valA = latestData ? (latestData[a] || 0) : 0;
      const valB = latestData ? (latestData[b] || 0) : 0;
      if (valB !== valA) return valB - valA;
      return REASON_CATEGORIES.indexOf(a) - REASON_CATEGORIES.indexOf(b);
    });

    const groupFilteredSurveyData = fullyFilteredData.filter(d => getCategory(d.score) === group);
    // Use selectedChannels (array) instead of selectedChannel (string)
    const topReasonsForGroup = getChannelTopReasons(groupFilteredSurveyData, selectedChannels);
    
    const monthsList = chartData.map(d => d.month).join(', ');
    const latestMonth = latestData ? latestData.month : '';

    const chartKey = `${effectiveStartMonth}-${effectiveEndMonth}-${selectedChannels.join(',')}-${group}`;

    return (
      <div className="flex flex-col mb-10 last:mb-0">
        <div className="bg-white p-8 rounded-sm border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">{title} <span className="text-sm font-medium text-slate-300 bg-slate-100 px-2 py-0.5 rounded">{totalCount}</span></h3>
              <p className="text-xs text-slate-400 mt-1 italic font-medium">{monthsList} 요인별 선택 비율 (%) - <span className="font-bold text-slate-600 underline decoration-slate-300 underline-offset-2">{latestMonth} 기준</span> 빈도순 정렬</p>
            </div>
          </div>
          <div className="h-[550px] mb-12">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart key={chartKey} data={chartData} margin={{ top: 30, bottom: 40, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: '14px', fontWeight: 'bold' }} dy={10} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} style={{ fontSize: '10px' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                <Legend verticalAlign="top" align="left" layout="horizontal" iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' }}>{String(v || '').split(' (')[0]}</span>} wrapperStyle={{ paddingBottom: '40px' }} />
                {sortedCategories.map((cat) => {
                  const originalIdx = REASON_CATEGORIES.indexOf(cat);
                  return (
                    <Bar key={cat} dataKey={cat} name={cat} fill={COLORS.chart[originalIdx % COLORS.chart.length]} barSize={16} radius={[2, 2, 0, 0]}>
                      <LabelList dataKey={cat} position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} formatter={(v: any) => v > 0 ? `${v}%` : ''} />
                    </Bar>
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-slate-100 pt-8 pb-4">
            <div className="mb-6">
              <h4 className="text-md font-bold tracking-tight flex items-center gap-2 text-slate-700">
                <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mr-2">
                  <Award className="w-4 h-4 text-amber-600" />
                </span>
                {group === 'Promoter' ? '추천자' : group === 'Passive' ? '중립자' : '비방자'} 채널별 선택 이유 Top 3
              </h4>
              <p className="text-[10px] text-slate-400 mt-1 italic font-medium">선택된 기간({periodText}) {group === 'Promoter' ? '추천자' : group === 'Passive' ? '중립자' : '비방자'} 그룹 데이터 기준</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <th className="py-3 px-4 font-bold border-r border-slate-200 w-[12%]">채널</th>
                    <th className="py-3 px-4 font-bold border-r border-slate-200 w-[12%]">응답수</th>
                    <th className="py-3 px-4 font-bold text-[#007AFF] bg-blue-50/20 w-[26%]">1순위</th>
                    <th className="py-3 px-4 font-bold text-slate-600 bg-slate-50/20 w-[26%]">2순위</th>
                    <th className="py-3 px-4 font-bold text-slate-600 w-[26%]">3순위</th>
                  </tr>
                </thead>
                <tbody>
                  {topReasonsForGroup.map((item) => (
                    <tr key={item.channel} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-black bg-slate-50/20 border-r border-slate-200 text-slate-800 truncate">{String(item.channel || '')}</td>
                      <td className="py-3 px-4 font-bold border-r border-slate-200 text-slate-500">{Number(item.count || 0).toLocaleString()}</td>
                      <td className="py-3 px-2 font-bold text-slate-800 bg-blue-50/5 whitespace-pre-line leading-relaxed">{String(item.top1 || '')}</td>
                      <td className="py-3 px-2 text-slate-600 bg-slate-50/5 whitespace-pre-line leading-relaxed">{String(item.top2 || '')}</td>
                      <td className="py-3 px-2 text-slate-600 whitespace-pre-line leading-relaxed">{String(item.top3 || '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Memo Section for each Trend Chart */}
            <MemoSection 
              id={`factors_${group}`} 
              title={`${group === 'Promoter' ? '추천자' : group === 'Passive' ? '중립자' : '비방자'} 그룹 요인`} 
              selectedMonth={effectiveEndMonth} 
              periodText={periodText}
              selectedChannels={selectedChannels} 
              memos={memos}
            />

          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
      <RefreshCw className="w-8 h-8 text-[#007AFF] animate-spin" />
      <span className="italic text-slate-400 font-medium">데이터를 분석 중입니다...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans" ref={dashboardRef}>
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 print:hidden">
        <div className="px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><Activity className="text-[#007AFF] w-6 h-6" /><h1 className="font-bold text-lg tracking-tight">SIDIZ NPS DASHBOARD</h1>{isConnected && <span className="ml-4 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-bold border border-emerald-100">Live Connected</span>}</div>
          <div className="flex items-center gap-3">
             <button 
                onClick={handleRefresh} 
                className="p-2 text-slate-500 hover:text-[#007AFF] hover:bg-blue-50 rounded-full transition-colors"
                title="데이터 새로고침"
             >
               <RefreshCcw className="w-5 h-5" />
             </button>
             <button 
                onClick={handleDownloadPDF} 
                className="p-2 text-slate-500 hover:text-[#007AFF] hover:bg-blue-50 rounded-full transition-colors"
                title="PDF 다운로드"
             >
               <Download className="w-5 h-5" />
             </button>
             <div className="h-6 w-px bg-slate-200 mx-2"></div>
             <button onClick={fetchAIInsights} disabled={isAiLoading} className="bg-[#1D1D1F] text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm active:scale-95"><BrainCircuit className="w-4 h-4" /> AI 성과 분석</button>
          </div>
        </div>
        
        {/* Filter Section */}
        <div className="bg-slate-50 px-8 py-3 border-t border-slate-100 flex flex-col gap-3">
          
          {/* Filter Type Selection */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold whitespace-nowrap min-w-[80px]">
              <Filter className="w-3 h-3" /> 필터 방식:
            </div>
            <div className="flex bg-slate-200/50 p-1 rounded-lg">
              <button 
                onClick={() => setFilterType('month')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'month' ? 'bg-white text-[#007AFF] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                단일 월 선택
              </button>
              <button 
                onClick={() => setFilterType('period')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'period' ? 'bg-white text-[#007AFF] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                기간 선택
              </button>
            </div>
          </div>

          {/* Month Filter (Dropdown) */}
          {filterType === 'month' && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-bold whitespace-nowrap min-w-[80px]">
                <Calendar className="w-3 h-3" /> 월 선택:
              </div>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 outline-none focus:border-[#007AFF] shadow-sm"
              >
                {[...availableMonths].reverse().map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
          )}

          {/* Period Selection Filter */}
          {filterType === 'period' && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-bold whitespace-nowrap min-w-[80px]">
                <Calendar className="w-3 h-3" /> 기간 선택:
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedStartMonth} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedStartMonth(val);
                    if (val !== 'All' && selectedEndMonth !== 'All' && val > selectedEndMonth) {
                      setSelectedEndMonth(val);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 outline-none focus:border-[#007AFF] shadow-sm"
                >
                  <option value="All">처음부터</option>
                  {availableMonths.map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
                <span className="text-slate-400 text-xs font-bold">~</span>
                <select 
                  value={selectedEndMonth} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedEndMonth(val);
                    if (val !== 'All' && selectedStartMonth !== 'All' && val < selectedStartMonth) {
                      setSelectedStartMonth(val);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 outline-none focus:border-[#007AFF] shadow-sm"
                >
                  <option value="All">끝까지</option>
                  {availableMonths.map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Channel Filter (Multi-Select) */}
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold whitespace-nowrap min-w-[80px]">
              <Store className="w-3 h-3" /> 채널 선택:
            </div>
            {availableChannels.map(channel => {
              const isActive = selectedChannels.includes(channel);
              return (
                <button 
                  key={channel} 
                  onClick={() => {
                    if (channel === 'All') {
                      setSelectedChannels(['All']);
                    } else {
                      setSelectedChannels(prev => {
                        // If current state includes All, clear it and select the new one
                        if (prev.includes('All')) return [channel];
                        
                        // Toggle logic
                        let newSet;
                        if (prev.includes(channel)) {
                          newSet = prev.filter(c => c !== channel);
                        } else {
                          newSet = [...prev, channel];
                        }
                        
                        // If nothing left selected, revert to All
                        return newSet.length === 0 ? ['All'] : newSet;
                      });
                    }
                  }} 
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${isActive ? 'bg-[#AF52DE] text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:border-[#AF52DE]'}`}
                >
                  {channel === 'All' ? '전체 채널' : channel}
                </button>
              );
            })}
          </div>

        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-8 py-10 space-y-12">
        <section className="bg-white p-6 rounded-sm border border-slate-200 shadow-sm flex flex-col xl:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-4 w-full xl:w-auto">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-indigo-100">
              <Database className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                데이터 소스 연동
                {isConnected && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Live Connected</span>}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">구글 시트 URL을 입력하여 실시간 NPS 데이터를 분석하세요. (연동 해제 시 샘플 데이터로 전환됨)</p>
            </div>
          </div>
          
          <form onSubmit={handleConnect} className="flex-1 w-full xl:w-auto min-w-0 max-w-3xl flex items-center gap-2">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Link className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input 
                type="text" 
                value={sheetUrl} 
                onChange={e => setSheetUrl(e.target.value)} 
                placeholder="https://docs.google.com/spreadsheets/d/..." 
                className={`w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all ${isConnected ? 'text-slate-500 bg-slate-100 select-none' : 'text-slate-800'}`}
                disabled={isConnected}
              />
            </div>
            
            {!isConnected ? (
              <button type="submit" className="bg-[#007AFF] hover:bg-blue-600 text-white px-6 py-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap shadow-sm hover:shadow active:scale-95">
                연동하기
              </button>
            ) : (
              <button type="button" onClick={handleDisconnect} className="bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 px-6 py-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap active:scale-95">
                연동 해제
              </button>
            )}
          </form>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <NPSGauge score={metrics.nps} label="NPS (전체)" count={metrics.total} />
          {/* If a specific channel is selected, other channel gauges will naturally show 0 or subset, but we keep them for context or could conditionally hide */}
          <NPSGauge score={channelMetrics.external.nps} label="NPS (외부몰)" count={channelMetrics.external.count} />
          <NPSGauge score={channelMetrics.official.nps} label="NPS (공식몰)" count={channelMetrics.official.count} />
          <NPSGauge score={channelMetrics.offline.nps} label="NPS (오프라인)" count={channelMetrics.offline.count} />
        </section>

        <section className="bg-white p-8 rounded-sm border border-slate-200 grid grid-cols-4 gap-4 text-center divide-x divide-slate-100 shadow-sm">
          <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">전체 응답자</p><p className="text-2xl font-bold">{metrics.total.toLocaleString()} 명</p></div>
          <div><p className="text-[10px] font-black text-[#007AFF] uppercase mb-1">추천자 비율</p><p className="text-2xl font-bold text-[#007AFF]">{Math.round((metrics.promoters / (metrics.total || 1)) * 100)} %</p></div>
          <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">중립자 비율</p><p className="text-2xl font-bold text-slate-400">{Math.round((metrics.passives / (metrics.total || 1)) * 100)} %</p></div>
          <div><p className="text-[10px] font-black text-[#FF3B30] uppercase mb-1">비방자 비율</p><p className="text-2xl font-bold text-[#FF3B30]">{Math.round((metrics.detractors / (metrics.total || 1)) * 100)} %</p></div>
        </section>

        <div className="flex flex-col">
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-white p-8 rounded-sm border border-slate-200 shadow-sm">
            <div className="h-[300px]"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Users className="w-3 h-3" /> 성별 비율 (%)</h4><ResponsiveContainer width="100%" height="80%"><BarChart data={demographicData.genders} margin={{ top: 25, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" style={{ fontSize: '11px', fontWeight: 'bold' }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} hide /><Tooltip cursor={{fill: '#f8fafc'}} formatter={(v) => `${v}%`} /><Bar dataKey="percent" radius={[4,4,0,0]} barSize={32}>{demographicData.genders.map((entry, index) => (<Cell key={`c-${index}`} fill={entry.name === '남성' ? '#007AFF' : entry.name === '여성' ? '#FF3B30' : '#CBD5E1'} />))}<LabelList dataKey="percent" content={renderPercentLabel} /></Bar></BarChart></ResponsiveContainer></div>
            <div className="h-[300px]"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Calendar className="w-3 h-3" /> 연령대 비율 (%)</h4><ResponsiveContainer width="100%" height="80%"><BarChart data={demographicData.ages} layout="vertical" margin={{ left: 10, right: 40 }}><XAxis type="number" domain={[0, 100]} hide /><YAxis dataKey="name" type="category" style={{ fontSize: '10px', fontWeight: 'bold' }} width={80} axisLine={false} tickLine={false} /><Tooltip cursor={{fill: '#f8fafc'}} formatter={(v) => `${v}%`} /><Bar dataKey="percent" fill="#6366f1" radius={[0,4,4,0]} barSize={12}><LabelList dataKey="percent" position="right" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} formatter={(v: any) => `${v}%`} /></Bar></BarChart></ResponsiveContainer></div>
            <div className="h-[300px]"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><TrendingUp className="w-3 h-3" /> 배송 지역 비율 (%)</h4><ResponsiveContainer width="100%" height="85%"><PieChart><Pie data={demographicData.regions} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="percent" label={renderRegionLabel} labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}>{demographicData.regions.map((_, i) => <Cell key={`r-${i}`} fill={COLORS.chart[i % COLORS.chart.length]} />)}</Pie><Tooltip formatter={(v: any, n: any) => [`${v}%`, n]} /></PieChart></ResponsiveContainer></div>
            <div className="h-[300px]"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Database className="w-3 h-3" /> 구매처 비율 (%)</h4><ResponsiveContainer width="100%" height="80%"><BarChart data={demographicData.channels} margin={{ top: 25, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" style={{ fontSize: '11px', fontWeight: 'bold' }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} hide /><Tooltip cursor={{fill: '#f8fafc'}} formatter={(v) => `${v}%`} /><Bar dataKey="percent" radius={[4,4,0,0]} barSize={32}>{demographicData.channels.map((entry, index) => (<Cell key={`ch-${index}`} fill={entry.name === '공식몰' ? '#007AFF' : entry.name === '외부몰' ? '#FF9500' : '#5856D6'} />))}<LabelList dataKey="percent" content={renderPercentLabel} /></Bar></BarChart></ResponsiveContainer></div>
          </section>
        </div>

        {/* Demographic Cross-tab Section */}
        <section className="bg-white p-8 rounded-sm border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> 인구통계 교차 분석
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">NPS 그룹별 성별, 연령대, 지역 분포 현황 (Heatmap)</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs table-fixed min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200">
                  <th className="py-3 px-2 font-bold text-slate-700 w-24 border-r border-slate-200">구분</th>
                  <th className="py-3 px-2 font-bold text-slate-700 w-24 border-r border-slate-200">그룹</th>
                  
                  {/* Gender Headers */}
                  <th colSpan={3} className="py-2 px-2 font-bold text-slate-500 border-r border-slate-200 bg-slate-50/50">성별</th>
                  
                  {/* Age Headers */}
                  <th colSpan={5} className="py-2 px-2 font-bold text-slate-500 border-r border-slate-200">연령대</th>
                  
                  {/* Region Headers */}
                  <th colSpan={7} className="py-2 px-2 font-bold text-slate-500">거주 지역</th>
                </tr>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] text-slate-500">
                  <th className="border-r border-slate-200"></th>
                  <th className="border-r border-slate-200"></th>
                  
                  <th className="py-2 px-1 border-r border-slate-100">남성</th>
                  <th className="py-2 px-1 border-r border-slate-100">여성</th>
                  <th className="py-2 px-1 border-r border-slate-200">기타</th>
                  
                  <th className="py-2 px-1 border-r border-slate-100">24세↓</th>
                  <th className="py-2 px-1 border-r border-slate-100">25-34</th>
                  <th className="py-2 px-1 border-r border-slate-100">35-44</th>
                  <th className="py-2 px-1 border-r border-slate-100">45-54</th>
                  <th className="py-2 px-1 border-r border-slate-200">55세↑</th>

                  {demoRegionLabels && demoRegionLabels.map((r, i) => (
                    <th key={r} className={`py-2 px-1 ${i === demoRegionLabels.length - 1 ? '' : 'border-r border-slate-100'}`}>{r.replace('권', '')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demoCrossTabData.map((group) => (
                  <React.Fragment key={group.channel}>
                    {group.rows.map((row, idx) => {
                      const isTotal = row.label === '소계';
                      const rowClass = isTotal ? 'bg-slate-50 font-bold border-t border-slate-200 border-b-2' : 'border-b border-slate-100 hover:bg-slate-50/30';
                      const labelColor = row.label === '추천자' ? 'text-[#007AFF]' : row.label === '비방자' ? 'text-[#FF3B30]' : row.label === '중립자' ? 'text-slate-400' : 'text-slate-800';

                      return (
                        <tr key={row.label} className={rowClass}>
                          {idx === 0 && <td rowSpan={4} className="py-3 px-2 font-black text-slate-700 border-r border-slate-200">{group.channel}</td>}
                          <td className={`py-3 px-2 font-bold border-r border-slate-200 ${labelColor}`}>{row.label}</td>
                          
                          {/* Gender Cells */}
                          {row.genderCounts.map((g, i) => (
                               <td key={i} className={`py-2 px-1 border-r ${i===2?'border-slate-200':'border-slate-100'} ${g.sig === 'high' ? 'bg-red-50 text-red-900 font-bold' : g.sig === 'low' ? 'bg-blue-50 text-blue-900 font-bold' : ''}`}>
                                 <div className="flex flex-col items-center">
                                    <span>{g.percent}%</span>
                                 </div>
                               </td>
                          ))}

                          {/* Age Cells */}
                          {row.ageCounts.map((a, i) => (
                             <td key={i} className={`py-2 px-1 border-r ${i===4?'border-slate-200':'border-slate-100'} ${a.sig === 'high' ? 'bg-red-50 text-red-900 font-bold' : a.sig === 'low' ? 'bg-blue-50 text-blue-900 font-bold' : ''}`}>
                               <div className="flex flex-col items-center">
                                    <span>{a.percent}%</span>
                                 </div>
                             </td>
                          ))}

                          {/* Region Cells */}
                          {row.regionCounts.map((r, i) => (
                             <td key={i} className={`py-2 px-1 border-r ${i===6?'':'border-slate-100'} ${r.sig === 'high' ? 'bg-red-50 text-red-900 font-bold' : r.sig === 'low' ? 'bg-blue-50 text-blue-900 font-bold' : ''}`}>
                               <div className="flex flex-col items-center">
                                    <span>{r.percent}%</span>
                                 </div>
                             </td>
                          ))}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {/* Memo Section for Cross Tab */}
          <MemoSection 
            id="demographic_cross" 
            title="인구통계 교차 분석" 
            selectedMonth={effectiveEndMonth} 
            periodText={periodText}
            selectedChannels={selectedChannels} 
            memos={memos}
          />
        </section>

        <div className="flex flex-col">
          <div className="bg-white p-8 rounded-sm border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-6"><div><h3 className="text-xl font-bold tracking-tight flex items-center gap-2"><TableIcon className="w-5 h-5 text-[#007AFF]" /> 월별 NPS 상세 실적 통합 테이블</h3></div></div>
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse text-sm table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <th className="py-3 px-2 text-slate-600 font-bold border-r border-slate-200 w-[100px]">구분</th>
                    <th className="py-3 px-2 text-slate-600 font-bold border-r border-slate-200 w-[80px]">지표</th>
                    {npsTableHeaders.map((header, idx) => (
                      <th key={header} className={`py-3 px-2 text-slate-600 font-bold w-[90px] ${idx === npsTableHeaders.length - 1 ? 'bg-slate-100/50 text-slate-900 font-black' : ''}`}>
                        {header}
                      </th>
                    ))}
                    <th className="py-3 px-2 text-slate-600 font-bold border-l border-slate-200 w-[110px]">최근 3개월 평균</th>
                  </tr>
                </thead>
                <tbody>
                  {npsFullTable.map((group) => (
                    <React.Fragment key={group.channel}>
                      {group.rows.map((row, rIdx) => {
                        const isNpsRow = row.isNps;
                        return (
                          <tr key={row.label} className={`border-b border-slate-100 hover:bg-slate-50/30 transition-colors ${isNpsRow ? 'bg-amber-50/30 font-bold' : ''}`}>
                            {rIdx === 0 && <td rowSpan={4} className="py-4 px-2 font-black text-slate-700 bg-white border-r border-slate-200">{group.channel}</td>}
                            <td className={`py-3 px-2 text-xs font-medium border-r border-slate-100 ${isNpsRow ? 'text-blue-600' : 'text-slate-500'}`}>{row.label}</td>
                            {row.data.map((val: number, mIdx: number) => {
                              const isLast = mIdx === row.data.length - 1;
                              let cellBg = ''; 
                              let textColor = isLast ? 'text-slate-900' : 'text-slate-600';
                              
                              if (isLast) {
                                if (row.sig === 'high') { 
                                  cellBg = isNpsRow ? 'bg-red-200' : 'bg-red-100'; 
                                  textColor = 'text-red-900 font-bold'; 
                                } else if (row.sig === 'low') { 
                                  cellBg = isNpsRow ? 'bg-blue-200' : 'bg-blue-100'; 
                                  textColor = 'text-blue-900 font-bold'; 
                                }
                              }
                              
                              return <td key={mIdx} className={`py-3 px-2 ${cellBg} ${textColor} transition-all duration-300`}>{val}{row.isPercent ? '%' : ''}</td>;
                            })}
                            <td className="py-3 px-2 bg-slate-50/50 font-bold text-slate-700 border-l border-slate-200">{row.avg3}{row.isPercent ? '%' : ''}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Line Chart for Monthly Trends */}
            <div className="mt-8 border-t border-slate-100 pt-8">
              <div className="flex justify-between items-center mb-6 px-4">
                <h4 className="text-md font-bold text-slate-700 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-slate-500" /> 채널별 NPS 월별 추이
                </h4>
              </div>
              <div className="h-[300px] w-full px-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={combinedTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" style={{ fontSize: '11px', fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis style={{ fontSize: '11px', fontWeight: 'bold' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip content={<TrendTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="전체" stroke="#1D1D1F" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    {selectedChannels.includes('All') && (
                      <>
                        <Line type="monotone" dataKey="외부몰" stroke="#FF9500" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="공식몰" stroke="#007AFF" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="오프라인" stroke="#AF52DE" strokeWidth={2} dot={{ r: 3 }} />
                      </>
                    )}
                    {!selectedChannels.includes('All') && selectedChannels.map((channel, idx) => (
                      <Line key={channel} type="monotone" dataKey={channel} stroke={COLORS.chart[idx % COLORS.chart.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Memo Section for Monthly Trend Table */}
              <MemoSection 
                id="monthly_trend" 
                title="월별 NPS 실적" 
                selectedMonth={effectiveEndMonth} 
                periodText={periodText}
                selectedChannels={selectedChannels} 
                memos={memos}
              />

            </div>
          </div>
        </div>

        {/* 3-Month Rolling Average NPS Table */}
        <div className="flex flex-col mt-4">
          <div className="bg-white p-8 rounded-t-sm border-t border-x border-slate-200 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#AF52DE]" /> NPS 3개월 평균 (이동 평균)
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">단기적 변동을 배제한 브랜드 충성도 장기 추세 분석</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse text-sm table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <th className="py-3 px-2 text-slate-600 font-bold border-r border-slate-200 w-[180px]">채널</th>
                    {rollingHeaders.map(header => (
                      <th key={header} className="py-3 px-2 text-slate-600 font-bold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rollingNpsData.map((item) => (
                    <tr key={item.channel} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                      <td className="py-4 px-2 font-black text-slate-700 bg-white border-r border-slate-200">{item.channel}</td>
                      {item.windows.map((win, idx) => {
                        const isLast = idx === item.windows.length - 1;
                        return (
                          <td key={idx} className={`py-4 px-2 ${isLast ? 'bg-purple-50/30 font-bold text-purple-700' : 'text-slate-600'}`}>
                            {win.value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-0 p-6 border-x border-b border-slate-200 rounded-b-sm bg-slate-50/30 flex items-center gap-4">
            <Info className="w-4 h-4 text-slate-400" />
            <p className="text-xs text-slate-500 font-medium">3개월 평균은 각 월의 NPS 지표를 단순 평균하여 산출되었습니다. 데이터가 추가됨에 따라 우측에 다음 3개월 수치가 자동으로 업데이트됩니다.</p>
          </div>
        </div>

        {/* Product NPS Score Graph */}
        <div className="flex flex-col mt-4">
          <div className="bg-white p-8 rounded-sm border border-slate-200 shadow-sm overflow-hidden">
             <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" /> 제품별 NPS 점수
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">주요 제품군별 추천자, 중립자, 비방자 분포 및 NPS 지수 현황</p>
              </div>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={productChartData} 
                  layout="horizontal" 
                  margin={{ top: 30, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="product" style={{ fontSize: '12px', fontWeight: 'bold' }} tickLine={false} axisLine={false} dy={10} />
                  <YAxis style={{ fontSize: '11px', fontWeight: 'bold' }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs min-w-[120px]">
                            <p className="font-bold mb-2 text-slate-800 border-b border-slate-100 pb-1">{d.product}</p>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-slate-500">NPS</span>
                                <span className={`font-bold ${d.nps >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{d.nps}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-slate-500">총 응답</span>
                                <span className="font-bold text-slate-700">{d.count}명</span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#007AFF]"></div><span className="text-[10px] text-slate-500">추천</span></div>
                                    <span className="font-medium text-slate-700">{d.promoters}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#8E8E93]"></div><span className="text-[10px] text-slate-500">중립</span></div>
                                    <span className="font-medium text-slate-700">{d.passives}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#FF3B30]"></div><span className="text-[10px] text-slate-500">비방</span></div>
                                    <span className="font-medium text-slate-700">{d.detractors}</span>
                                </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                  {/* Reordered Bars: Promoters -> Passives -> Detractors */}
                  <Bar dataKey="promoters" fill={COLORS.promoter} name="추천자" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="passives" fill={COLORS.passive} name="중립자" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="detractors" fill={COLORS.detractor} name="비방자" radius={[2, 2, 0, 0]} />
                  
                  {/* Invisible Line for NPS Label on Top */}
                  <Line type="monotone" dataKey="labelPosition" stroke="none" dot={false} activeDot={false} name="NPS Label Position">
                    <LabelList 
                        dataKey="nps" 
                        position="top" 
                        formatter={(value: any) => `NPS : ${value}`} 
                        style={{ fontSize: '12px', fontWeight: '900', fill: '#1e293b' }}
                    />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

             {/* Memo Section for Product NPS */}
             <MemoSection 
                id="product_nps" 
                title="제품별 NPS" 
                selectedMonth={effectiveEndMonth} 
                periodText={periodText}
                selectedChannels={selectedChannels} 
                memos={memos}
             />

          </div>
        </div>

        <section className="bg-white p-8 rounded-sm border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-6"><div><h3 className="text-xl font-bold tracking-tight flex items-center gap-2"><TableIcon className="w-5 h-5 text-[#007AFF]" /> 요인별 응답 빈도 분석</h3></div></div>
          <div className="h-[450px] mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasonGroupData} margin={{ top: 20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" interval={0} axisLine={false} tickLine={false} tick={<CustomXAxisTick />} /><YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px' }} /><Tooltip content={<SimpleTooltip />} cursor={{fill: '#f8fafc'}} /><Legend verticalAlign="top" align="right" iconType="circle" iconSize={10} wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 'bold' }} /><Bar dataKey="Promoters" name="추천자" fill={COLORS.promoter} barSize={20} radius={[4, 4, 0, 0]}><LabelList dataKey="Promoters" position="top" style={{fontSize: '10px', fill:'#64748b'}} /></Bar><Bar dataKey="Passives" name="중립자" fill={COLORS.passive} barSize={20} radius={[4, 4, 0, 0]}><LabelList dataKey="Passives" position="top" style={{fontSize: '10px', fill:'#64748b'}} /></Bar><Bar dataKey="Detractors" name="비방자" fill={COLORS.detractor} barSize={20} radius={[4, 4, 0, 0]}><LabelList dataKey="Detractors" position="top" style={{fontSize: '10px', fill:'#64748b'}} /></Bar></BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>{renderTrendChart('Promoter', '추천자 그룹 주요 요인 (Promoters)')}{renderTrendChart('Passive', '중립자 그룹 주요 요인 (Passives)')}{renderTrendChart('Detractor', '비방자 그룹 주요 요인 (Detractors)')}</section>

        {aiInsight && (
          <section className="bg-slate-900 text-white p-8 rounded-xl shadow-lg">
             <div className="flex items-center gap-3 mb-6">
               <BrainCircuit className="w-6 h-6 text-purple-400" />
               <h3 className="text-xl font-bold">AI 성과 분석 인사이트</h3>
             </div>
             <div className="whitespace-pre-line leading-relaxed text-slate-300">
               {aiInsight}
             </div>
          </section>
        )}

        {/* Discussion Board Section */}
        <DiscussionBoard selectedMonth={effectiveEndMonth} periodText={periodText} selectedChannels={selectedChannels} memos={memos} />

      </main>
      <footer className="max-w-[1400px] mx-auto px-8 py-12 border-t border-slate-200 opacity-40 flex justify-between items-center"><p className="text-[10px] font-black uppercase tracking-widest">SIDIZ NPS DASHBOARD &copy; 2026</p></footer>
    </div>
  );
};

export default App;
