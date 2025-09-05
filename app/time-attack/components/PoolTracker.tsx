'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { ROSTER } from '../../lib/constants';
import { clx } from '../../lib/utils';

type Props = {
    pool: Map<string, number>;
    wanted: Set<string>;
};

export default function PoolTracker({ pool, wanted }: Props) {
    const [selectedCost, setSelectedCost] = useState<number | 'all'>('all');
    const [showOnlyWanted, setShowOnlyWanted] = useState(false);

    // 코스트별로 챔피언들을 그룹화
    const groupedChampions = React.useMemo(() => {
        const groups: Record<number, Array<{ key: string; name: string; remaining: number; isWanted: boolean }>> = {};

        Object.keys(ROSTER).forEach(costStr => {
            const cost = Number(costStr);
            groups[cost] = ROSTER[cost].map(unit => ({
                key: unit.key,
                name: unit.name,
                remaining: pool.get(unit.key) || 0,
                isWanted: wanted.has(unit.key)
            }));
        });

        return groups;
    }, [pool, wanted]);

    // 필터링된 챔피언들
    const filteredChampions = React.useMemo(() => {
        let champions = selectedCost === 'all'
            ? Object.values(groupedChampions).flat()
            : groupedChampions[selectedCost] || [];

        if (showOnlyWanted) {
            champions = champions.filter(champ => champ.isWanted);
        }

        return champions.sort((a, b) => {
            // 원하는 챔피언들을 먼저 표시
            if (a.isWanted && !b.isWanted) return -1;
            if (!a.isWanted && b.isWanted) return 1;
            // 남은 개수가 적은 순으로 정렬
            return a.remaining - b.remaining;
        });
    }, [groupedChampions, selectedCost, showOnlyWanted]);

    return (
        <div className="bg-slate-900/60 ring-1 ring-white/10 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">챔피언 풀 현황</h3>

                <div className="flex items-center gap-3">
                    {/* 원하는 챔피언만 보기 토글 */}
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={showOnlyWanted}
                            onChange={(e) => setShowOnlyWanted(e.target.checked)}
                            className="rounded"
                        />
                        <span className="text-slate-300">내 덱만</span>
                    </label>

                    {/* 코스트 필터 */}
                    <div className="flex rounded-md overflow-hidden ring-1 ring-white/10">
                        <button
                            onClick={() => setSelectedCost('all')}
                            className={clx(
                                'px-3 py-1 text-xs font-medium transition-colors',
                                selectedCost === 'all'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            )}
                        >
                            전체
                        </button>
                        {[1, 2, 3, 4, 5].map(cost => (
                            <button
                                key={cost}
                                onClick={() => setSelectedCost(cost)}
                                className={clx(
                                    'px-3 py-1 text-xs font-medium transition-colors',
                                    selectedCost === cost
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                )}
                            >
                                {cost}코
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 챔피언 그리드 */}
            <div className="grid grid-cols-12 gap-2 max-h-48 overflow-y-auto">
                {filteredChampions.map(champ => (
                    <div
                        key={champ.key}
                        className={clx(
                            'relative rounded-md overflow-hidden ring-1',
                            champ.isWanted
                                ? 'ring-pink-400/70 bg-pink-600/20'
                                : 'ring-slate-600 bg-slate-800/40',
                            champ.remaining === 0 && 'opacity-40'
                        )}
                        title={`${champ.name}: ${champ.remaining}개 남음`}
                    >
                        {/* 챔피언 이미지 */}
                        <div className="aspect-square relative">
                            <Image
                                src={`/${champ.key}.jpg`}
                                alt={champ.name}
                                fill
                                className="object-cover"
                            />

                            {/* 남은 개수 표시 */}
                            <div className={clx(
                                'absolute bottom-0 right-0 px-1 text-xs font-bold rounded-tl',
                                champ.remaining <= 3 ? 'bg-red-600 text-white' :
                                champ.remaining <= 7 ? 'bg-yellow-600 text-white' :
                                'bg-green-600 text-white'
                            )}>
                                {champ.remaining}
                            </div>

                            {/* 원하는 챔피언 표시 */}
                            {champ.isWanted && (
                                <div className="absolute top-0 left-0 w-3 h-3 bg-pink-400 rounded-br">
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filteredChampions.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                    표시할 챔피언이 없습니다.
                </div>
            )}
        </div>
    );
}
