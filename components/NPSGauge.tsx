
import React from 'react';

interface NPSGaugeProps {
  score: number;
  label: string;
  count: number;
  color?: string; // 기본 색상이 제공되지만 점수에 따라 내부에서 재계산됨
}

const NPSGauge: React.FC<NPSGaugeProps> = ({ score, label, count }) => {
  // 점수를 0~100 범위로 제한
  const normalizedScore = Math.max(0, Math.min(100, score));
  
  // 점수 구간별 색상 결정
  // 0~20: 빨간색, 20~50: 주황색, 50~80: 보라색, 80~100: 파란색
  let gaugeColor = '#FF3B30'; // Red (0-20)
  if (normalizedScore >= 80) {
    gaugeColor = '#007AFF'; // Blue (80-100)
  } else if (normalizedScore >= 50) {
    gaugeColor = '#AF52DE'; // Purple (50-80)
  } else if (normalizedScore >= 20) {
    gaugeColor = '#FF9500'; // Orange (20-50)
  }

  // 상태 레이블 결정 (사용자 요청 기준)
  let statusLabel = '노력 필요'; // 0 이하일 경우 기본값
  if (score > 80) {
    statusLabel = '세계적인 수준';
  } else if (score > 50) {
    statusLabel = '훌륭함';
  } else if (score > 20) {
    statusLabel = '양호';
  } else if (score > 0) {
    statusLabel = '좋음';
  }

  // 3/4 원형 트랙에서 게이지가 차지할 비율 계산
  // 전체 원 둘레가 282.7일 때, 3/4 원은 약 212.0
  const circumference = 282.7;
  const trackLength = circumference * 0.75; 
  const activeOffset = circumference - (normalizedScore / 100) * trackLength;

  return (
    <div className="bg-white p-6 rounded-sm border border-slate-200 flex flex-col items-center relative h-full min-h-[300px] shadow-sm transition-all hover:shadow-md justify-center">
      <div className="w-full flex justify-between items-start mb-4">
        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          {label} 
          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[10px] rounded font-medium">N={count}</span>
        </h4>
      </div>
      
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-[225deg]">
          {/* Background Track (Gray) */}
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="#F1F1F1"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.25}
            strokeLinecap="round"
          />
          {/* Active Progress Arc (Dynamic Color) */}
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke={gaugeColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={activeOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease' }}
          />
        </svg>
        
        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="text-4xl font-light text-slate-800 tracking-tighter" style={{ color: gaugeColor }}>
            {score}
          </span>
          <span className="text-xs text-slate-500 mt-1 font-bold tracking-tight">
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

export default NPSGauge;
