

'use client';
import React from 'react';
import { clx } from '../../lib/utils';
import { COST_TEXT } from '../../lib/constants';

type Props = {
  level: number;
  xp: number;
  xpReq: number;
  onNudgeLevel: (delta: number) => void;
  // 중앙: 코스트별 확률 (1~5코스트 순)
  odds: number[]; // e.g. [55, 30, 15, 0, 0]
  // 우측: 골드
  gold: number;
  onAddGold: (amt: number) => void;
  // (옵션) 겹침 모드 표시 배지 텍스트 (예: '겹침: 없음')
  overlapModeLabel?: string;
};

export default function HeaderBar({ level, xp, xpReq, onNudgeLevel, odds, gold, onAddGold, overlapModeLabel }: Props) {
  const xpPercent = (() => {
    if (level >= 10) return 100;
    if (!xpReq) return 0;
    return Math.min(100, (xp / xpReq) * 100);
  })();

  return (
    <div className="flex items-center justify-between mb-4">
      {/* LEFT: Level UI */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-md font-semibold tabular-nums min-w-[56px]">레벨 {level}</div>
          <div className="w-56 h-2 bg-black/30 rounded-full overflow-hidden ring-1 ring-white/10">
            <div className="h-full bg-teal-400" style={{ width: `${xpPercent}%` }} />
          </div>
          <div className="text-xs text-white/70 tabular-nums font-mono w-16 text-right">
            {level < 10 ? (
              <span>XP {xp}/{xpReq}</span>
            ) : (
              <span>최대 레벨</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs opacity-80">Lv</label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onNudgeLevel(-1)}
              className="px-2 py-1 rounded bg-black/40 ring-1 ring-white/10 text-xs disabled:opacity-40"
              disabled={level <= 1}
              title="레벨 내리기"
            >−</button>
            <div className="w-8 text-center text-xs select-none tabular-nums font-mono">{level}</div>
            <button
              type="button"
              onClick={() => onNudgeLevel(1)}
              className="px-2 py-1 rounded bg-black/40 ring-1 ring-white/10 text-xs disabled:opacity-40"
              disabled={level >= 10}
              title="레벨 올리기"
            >+</button>
          </div>
        </div>
      </div>

      {/* CENTER: Odds (cost probabilities) */}
      <div className="flex items-center gap-3">
        <div className="flex gap-2 text-xs text-white/90">
          {[1, 2, 3, 4, 5].map((c, i) => (
            <div key={c} className={clx('px-2 py-1 rounded-md', COST_TEXT[c])} title={`코스트 ${c}`}>
              • {odds[i] ?? 0}%
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Gold UI */}
      <div className="flex items-center gap-3">
        {overlapModeLabel && (
          <div
            className="px-2 py-1 rounded bg-black/30 ring-1 ring-white/10 text-[11px] text-white/70 select-none"
            title="겹치는 사람 옵션"
          >
            {overlapModeLabel}
          </div>
        )}
        <div className="px-3 py-1 rounded-md bg-black/40 ring-1 ring-white/10 text-yellow-300 font-bold tabular-nums font-mono min-w-[120px] text-right">
          G {gold.toLocaleString('en-US')}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs opacity-80">G</label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onAddGold(10)}
              className="px-2 py-1 rounded bg-black/40 ring-1 ring-white/10 text-xs"
              title="골드 +10"
            >+10</button>
            <button
              type="button"
              onClick={() => onAddGold(100)}
              className="px-2 py-1 rounded bg-black/40 ring-1 ring-white/10 text-xs"
              title="골드 +100"
            >+100</button>
            <button
              type="button"
              onClick={() => onAddGold(1000)}
              className="px-2 py-1 rounded bg-black/40 ring-1 ring-white/10 text-xs"
              title="골드 +1000"
            >+1000</button>
          </div>
        </div>
      </div>
    </div>
  );
}