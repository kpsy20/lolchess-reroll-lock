'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clx } from '../lib/utils';
import { ROSTER } from '../lib/constants';
import { firestoreService } from '../lib/firebase';
import Image from 'next/image';

// Firestore 연동을 위한 타입 정의
type GameResult = {
    deck: string;
    spent: number;
    rerollCount: number;
    timeSec: number;
    date: string;
    targets: Record<string, number>;
    overlapMode: 'none' | 'with';
};

type FirestoreResult = GameResult & {
    id: string;
    createdAt: Date;
};



export default function EndPage() {
    const router = useRouter();
    const [currentResult, setCurrentResult] = useState<GameResult | null>(null);
    const [myResults, setMyResults] = useState<GameResult[]>([]);
    const [allResults, setAllResults] = useState<FirestoreResult[]>([]);
    const [loading, setLoading] = useState(true);
    const savedOnceRef = useRef(false);
    // pagination (my results)
    const PAGE_SIZE = 20;
    const [myPage, setMyPage] = useState(1);
    // overlap filter for viewing records
    const [viewOverlapMode, setViewOverlapMode] = useState<'none' | 'with' | 'all'>('none');
    // overlap filter for my results table
    const [myOverlapFilter, setMyOverlapFilter] = useState<'none' | 'with' | 'all'>('none');

    // 겹치는 사람 관련 useEffect 제거
    // useEffect(() => {
    //     if (currentResult) {
    //         setViewOverlapMode(currentResult.overlapMode === 'with' ? 'with' : 'none');
    //     }
    // }, [currentResult]);

    // key -> 한글 이름 매핑
    const keyToKoreanName = useMemo(() => {
        const map = new Map<string, string>();
        Object.keys(ROSTER).forEach((k) => {
            const cost = Number(k);
            ROSTER[cost].forEach((u) => map.set(u.key, u.name));
        });
        return map;
    }, []);

    // group all results by deck - Hook을 early return 전에 호출
    const deckGroups = useMemo(() => {
        if (!allResults || allResults.length === 0) return new Map<string, FirestoreResult[]>();
        const map = new Map<string, FirestoreResult[]>();
        for (const r of allResults) {
            if (!map.has(r.deck)) map.set(r.deck, []);
            map.get(r.deck)!.push(r);
        }
        for (const [, arr] of map) {
            arr.sort((a, b) => a.timeSec - b.timeSec);
        }
        return map;
    }, [allResults]);

    useEffect(() => {
        // localStorage에서 최근 결과 가져오기
        try {
            const raw = localStorage.getItem('TA_HISTORY_V1');
            if (raw) {
                const results = JSON.parse(raw);
                if (Array.isArray(results) && results.length > 0) {
                    setMyResults(results as GameResult[]);
                    const latest = results[results.length - 1] as GameResult;
                    setCurrentResult(latest);
                    // Firestore에 결과 저장 (익명) — 개발 모드/더블 마운트 중복 저장 방지
                    const saveKey = `saved:${latest.date}:${latest.deck}:${latest.timeSec}:${latest.spent}:${latest.rerollCount}`;
                    try {
                        if (typeof window !== 'undefined') {
                            if (savedOnceRef.current) {
                                console.log('메모리 가드로 저장 생략');
                            } else {
                                const alreadySaved = sessionStorage.getItem(saveKey);
                                if (alreadySaved) {
                                    console.log('세션 키 감지로 저장 생략');
                                    savedOnceRef.current = true;
                                } else {
                                    // 중복 방지를 위해 먼저 키를 기록하고 저장 시작
                                    try { sessionStorage.setItem(saveKey, '1'); } catch {}
                                    savedOnceRef.current = true;
                                    firestoreService.saveResult(latest)
                                        .then(id => {
                                            console.log('결과가 Firestore에 저장되었습니다:', id);
                                        })
                                        .catch(err => console.error(err));
                                }
                            }
                        }
                    } catch {}
                }
            }
        } catch (error) {
            console.error('결과 로드 실패:', error);
        }

        // 전체 결과 로드 (퍼센타일 계산용)
        loadAllResults();
    }, []);

    const loadAllResults = async () => {
        try {
            setLoading(true);
            const results = await firestoreService.getAllResults();
            // overlapMode가 없는 기존 데이터에 대한 기본값 처리
            const processedResults = results.map(r => ({
                ...r,
                overlapMode: r.overlapMode || 'none' as 'none' | 'with'
            })) as FirestoreResult[];
            setAllResults(processedResults);
        } catch (error) {
            console.error('전체 결과 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const getPercentile = (timeSec: number, allResults: FirestoreResult[]) => {
        if (allResults.length === 0) return null;
        
        const sortedResults = [...allResults].sort((a, b) => a.timeSec - b.timeSec);
        const index = sortedResults.findIndex(r => r.timeSec >= timeSec);
        
        if (index === -1) return 100; // 가장 빠름
        return Math.round((index / sortedResults.length) * 100);
    };

    if (!currentResult) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">결과를 찾을 수 없습니다</h1>
                    <button
                        onClick={() => router.push('/setting')}
                        className="px-4 py-2 bg-indigo-600 rounded-md hover:bg-indigo-500"
                    >
                        덱 선택하기
                    </button>
                </div>
            </div>
        );
    }

    const percentile = getPercentile(currentResult.timeSec, allResults);

    const percentileIn = (value: number, arr: number[]) => {
        if (arr.length === 0) return null;
        const sorted = [...arr].sort((a, b) => a - b);
        let i = sorted.findIndex(x => x >= value);
        if (i === -1) i = sorted.length - 1;
        return Math.round((i / sorted.length) * 100);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
            {/* Fixed Header */}
            <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur shadow px-4">
                <div className="mx-auto max-w-7xl h-16 flex items-center justify-between">
                    {/* Left logo (ground.jpg) */}
                    <button
                        type="button"
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2"
                    >
                        <div className="relative w-8 h-8 rounded overflow-hidden ring-1 ring-black/10">
                            <Image src="/ground.jpg" alt="홈" fill className="object-cover" sizes="32px"/>
                        </div>
                    </button>

                    <a href="https://www.youtube.com/@give_me_the_code">
                        <Image src="/youtube.webp" alt="YouTube Channel" width={40} height={20}/>
                    </a>
                </div>
            </header>

            <div className="max-w-6xl mx-auto pt-20">
                {/* 헤더 */}
                <header className="mb-8 text-center">
                    <h1 className="text-3xl font-bold mb-2">덱 구성 완료</h1>
                    <p className="text-slate-400">어떠신가요? 기물락을 못 느끼셨나요?</p>
                </header>

                {/* 현재 결과 카드 */}
                <div className="mb-8">
                    <div className="bg-slate-900/60 ring-1 ring-white/10 rounded-xl p-6">
                        <h2 className="text-xl font-semibold mb-4 text-center">이번 게임 결과</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-emerald-400 mb-2">
                                    {formatTime(currentResult.timeSec)}
                                </div>
                                <div className="text-sm text-slate-400">소요 시간</div>
                                {percentile !== null && (
                                    <div className="text-xs text-slate-500 mt-1">
                                        상위 {percentile}% (예상)
                                    </div>
                                )}
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-yellow-400 mb-2">
                                    {currentResult.spent.toLocaleString()}
                                </div>
                                <div className="text-sm text-slate-400">사용한 골드</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-blue-400 mb-2">
                                    {currentResult.rerollCount}
                                </div>
                                <div className="text-sm text-slate-400">리롤 횟수</div>
                            </div>
                            <div className="text-center">
                                <div className={`text-2xl font-bold mb-2 ${currentResult.overlapMode === 'with' ? 'text-orange-400' : 'text-purple-400'}`}>
                                    {currentResult.overlapMode === 'with' ? '있음' : '없음'}
                                </div>
                                <div className="text-sm text-slate-400">겹치는 사람</div>
                            </div>
                        </div>
                        <div className="mt-6 text-center">
                            <div className="text-lg font-semibold mb-2">{currentResult.deck}</div>
                            <div className="text-sm text-slate-400">
                                목표: {Object.entries(currentResult.targets).map(([key, star]) => {
                                    const name = keyToKoreanName.get(key) ?? key;
                                    return `${name} ${"★".repeat(star)}`;
                                }).join(', ')}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 내 기록 (LocalStorage) */}
                <div className="bg-slate-900/60 ring-1 ring-white/10 rounded-xl p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">내 기록</h2>

                        {/* 내 기록용 겹치는 사람 필터 버튼 */}
                        {myResults.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">겹치는 사람:</span>
                                <div className="flex rounded-md overflow-hidden ring-1 ring-white/10">
                                    {/*<button*/}
                                    {/*    onClick={() => setMyOverlapFilter('all')}*/}
                                    {/*    className={`px-3 py-1 text-xs font-medium transition-colors ${*/}
                                    {/*        myOverlapFilter === 'all' */}
                                    {/*            ? 'bg-indigo-600 text-white' */}
                                    {/*            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'*/}
                                    {/*    }`}*/}
                                    {/*>*/}
                                    {/*    전체*/}
                                    {/*</button>*/}
                                    {/*<button*/}
                                    {/*    onClick={() => setMyOverlapFilter('with')}*/}
                                    {/*    className={`px-3 py-1 text-xs font-medium transition-colors ${*/}
                                    {/*        myOverlapFilter === 'with' */}
                                    {/*            ? 'bg-orange-600 text-white' */}
                                    {/*            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'*/}
                                    {/*    }`}*/}
                                    {/*>*/}
                                    {/*    있음*/}
                                    {/*</button>*/}
                                    <button
                                        onClick={() => setMyOverlapFilter('none')}
                                        className={`px-3 py-1 text-xs font-medium transition-colors ${
                                            myOverlapFilter === 'none' 
                                                ? 'bg-purple-600 text-white' 
                                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                        }`}
                                    >
                                        없음
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {myResults.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">기록이 없습니다.</div>
                    ) : (
                        <div>
                            {(() => {
                                // 필터링된 내 기록 계산
                                const filteredMyResults = myOverlapFilter === 'all'
                                    ? myResults
                                    : myResults.filter(r => (r.overlapMode || 'none') === myOverlapFilter);

                                if (filteredMyResults.length === 0) {
                                    return (
                                        <div className="text-center py-12 text-slate-400">
                                            <div className="text-sm">
                                                {myOverlapFilter === 'with'
                                                    ? '겹치는 사람이 있는 기록이 없습니다'
                                                    : '겹치는 사람이 없는 기록이 없습니다'
                                                }
                                            </div>
                                            <div className="text-xs mt-1 text-slate-500">
                                                다른 필터를 선택해보세요
                                            </div>
                                        </div>
                                    );
                                }

                                const reversed = filteredMyResults.slice().reverse();
                                const totalPages = Math.max(1, Math.ceil(reversed.length / PAGE_SIZE));
                                const safePage = Math.min(Math.max(1, myPage), totalPages);
                                const start = (safePage - 1) * PAGE_SIZE;
                                const pageItems = reversed.slice(start, start + PAGE_SIZE);

                                return (
                                    <>
                                        {/* 필터링 정보 표시 */}
                                        {myOverlapFilter !== 'all' && (
                                            <div className="mb-3 text-xs text-slate-400">
                                                {filteredMyResults.length}개의 기록 (전체 {myResults.length}개 중)
                                            </div>
                                        )}

                                        <div className="max-h-80 overflow-auto rounded-md ring-1 ring-white/5">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-white/10">
                                                        <th className="text-left p-2">날짜</th>
                                                        <th className="text-left p-2">덱</th>
                                                        <th className="text-right p-2">시간</th>
                                                        <th className="text-right p-2">골드</th>
                                                        <th className="text-right p-2">리롤</th>
                                                        <th className="text-center p-2">겹침</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pageItems.map((r, i) => (
                                                        <tr
                                                            key={`${r.date}-${start+i}`}
                                                            className={clx(
                                                                "border-b border-white/5",
                                                                (r.date === currentResult?.date && r.deck === currentResult?.deck) ? "bg-indigo-600/20 ring-1 ring-indigo-400/50" : ""
                                                            )}
                                                        >
                                                            <td className="p-2 text-slate-400">{new Date(r.date).toLocaleString()}</td>
                                                            <td className="p-2 font-medium">{r.deck}</td>
                                                            <td className="p-2 text-right font-mono">{formatTime(r.timeSec)}</td>
                                                            <td className="p-2 text-right font-mono">{r.spent.toLocaleString()}</td>
                                                            <td className="p-2 text-right font-mono">{r.rerollCount ?? 0}</td>
                                                            <td className="p-2 text-center">
                                                                <span className={`text-xs px-2 py-1 rounded ${
                                                                    (r.overlapMode || 'none') === 'with' 
                                                                        ? 'bg-orange-600/20 text-orange-400' 
                                                                        : 'bg-purple-600/20 text-purple-400'
                                                                }`}>
                                                                    {(r.overlapMode || 'none') === 'with' ? '있음' : '없음'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="mt-3 flex items-center justify-center gap-2">
                                            <button
                                                className="px-2 py-1 rounded bg-black/40 ring-1 ring-white/10 text-xs disabled:opacity-40"
                                                onClick={() => setMyPage(p => Math.max(1, p - 1))}
                                                disabled={myPage <= 1}
                                            >이전</button>
                                            <div className="text-xs opacity-80">
                                                {myPage} / {totalPages}
                                            </div>
                                            <button
                                                className="px-2 py-1 rounded bg-black/40 ring-1 ring-white/10 text-xs disabled:opacity-40"
                                                onClick={() => setMyPage(p => {
                                                    return Math.min(totalPages, p + 1);
                                                })}
                                                disabled={myPage >= totalPages}
                                            >다음</button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* 전체 기록 (Firestore) + 덱별 백분위 그래프 */}
                <div className="bg-slate-900/60 ring-1 ring-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">전체 기록</h2>

                        {/* 겹치는 사람 필터 버튼 */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400">겹치는 사람:</span>
                            <div className="flex rounded-md overflow-hidden ring-1 ring-white/10">
                                {/*<button*/}
                                {/*    onClick={() => setViewOverlapMode('all')}*/}
                                {/*    className={`px-3 py-1 text-xs font-medium transition-colors ${*/}
                                {/*        viewOverlapMode === 'all' */}
                                {/*            ? 'bg-indigo-600 text-white' */}
                                {/*            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'*/}
                                {/*    }`}*/}
                                {/*>*/}
                                {/*    전체*/}
                                {/*</button>*/}
                                {/*<button*/}
                                {/*    onClick={() => setViewOverlapMode('with')}*/}
                                {/*    className={`px-3 py-1 text-xs font-medium transition-colors ${*/}
                                {/*        viewOverlapMode === 'with' */}
                                {/*            ? 'bg-orange-600 text-white' */}
                                {/*            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'*/}
                                {/*    }`}*/}
                                {/*>*/}
                                {/*    있음*/}
                                {/*</button>*/}
                                <button
                                    onClick={() => setViewOverlapMode('none')}
                                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                                        viewOverlapMode === 'none' 
                                            ? 'bg-purple-600 text-white' 
                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                >
                                    없음
                                </button>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-8 text-slate-400">로딩 중...</div>
                    ) : (
                        <div className="space-y-6">
                            {/* 현재 덱만 표시 */}
                            {(() => {
                                const deck = currentResult?.deck;
                                if (!deck || !deckGroups.has(deck)) return null;

                                // 필터링된 데이터 적용
                                const allRows = deckGroups.get(deck)!;
                                const filteredRows = viewOverlapMode === 'all'
                                    ? allRows
                                    : allRows.filter(r => r.overlapMode === viewOverlapMode);

                                const times = filteredRows.map(r => r.timeSec);
                                const spends = filteredRows.map(r => r.spent);
                                const rerolls = filteredRows.map(r => r.rerollCount ?? 0);

                                // 고정된 범위로 히스토그램 생성
                                const buildHistogramWithRange = (values: number[], min: number, max: number, bins = 24) => {
                                    const span = max - min;
                                    const counts = Array.from({ length: bins }, () => 0);
                                    for (const v of values) {
                                        // 최댓값을 초과하는 값들은 히스토그램에 포함하지 않음
                                        if (v > max) continue;
                                        const clampedValue = Math.min(max, Math.max(min, v));
                                        const idx = Math.min(bins - 1, Math.max(0, Math.floor(((clampedValue - min) / span) * bins)));
                                        counts[idx] += 1;
                                    }
                                    const maxCount = Math.max(...counts, 1);
                                    const bars = counts.map(c => (c / maxCount) * 100);
                                    return { bars, min, max } as const;
                                };

                                const histTime = buildHistogramWithRange(times, 0, 600); // 0초 ~ 10분
                                const histSpend = buildHistogramWithRange(spends, 0, 1000); // 0 ~ 1000골드
                                const histReroll = buildHistogramWithRange(rerolls, 0, 500); // 0 ~ 500리롤

                                const myDeck = currentResult;
                                const pTime = myDeck ? percentileIn(myDeck.timeSec, times) : null;
                                const pSpend = myDeck ? percentileIn(myDeck.spent, spends) : null;
                                const pReroll = myDeck ? percentileIn(myDeck.rerollCount ?? 0, rerolls) : null;

                                return (
                                    <div key={deck} className="rounded-lg ring-1 ring-white/10 p-4 bg-black/20">
                                        <div className="mb-3 flex items-center justify-between">
                                            <div className="text-lg font-semibold">{deck}</div>
                                            <div className="text-xs text-slate-400">
                                                {filteredRows.length > 0 ? (
                                                    <>
                                                        {filteredRows.length}명의 기록
                                                        {viewOverlapMode !== 'all' && (
                                                            <span className="text-slate-500">
                                                                (전체 {allRows.length}명 중)
                                                            </span>
                                                        )}
                                                        {myDeck && (
                                                            <> — 내 기록: 시간 {pTime ?? '-'}% · 골드 {pSpend ?? '-'}% · 리롤 {pReroll ?? '-'}%</>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>데이터 없음</>
                                                )}
                                            </div>
                                        </div>

                                        {filteredRows.length === 0 ? (
                                            <div className="text-center py-12 text-slate-400">
                                                <div className="text-sm">
                                                    {viewOverlapMode === 'with'
                                                        ? '겹치는 사람이 있는 기록이 없습니다'
                                                        : '겹치는 사람이 없는 기록이 없습니다'
                                                    }
                                                </div>
                                                <div className="text-xs mt-1 text-slate-500">
                                                    다른 필터를 선택해보세요
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* 시간 */}
                                                <div className="rounded-md bg-slate-800/40 ring-1 ring-white/10 p-3">
                                                    <div className="text-xs mb-2 text-slate-300">시간</div>
                                                    <div className="h-24 flex items-end gap-[1px] relative">
                                                        {histTime.bars.map((h, i) => {
                                                            const binMin = Math.floor((i / 24) * 600);
                                                            const binMax = Math.floor(((i + 1) / 24) * 600);
                                                            const isMyBin = myDeck && myDeck.timeSec >= binMin && myDeck.timeSec < binMax;
                                                            const countInBin = times.filter(t => {
                                                                const clampedTime = Math.min(600, Math.max(0, t));
                                                                const binIdx = Math.min(23, Math.max(0, Math.floor((clampedTime / 600) * 24)));
                                                                return binIdx === i;
                                                            }).length;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className={`flex-1 relative group ${isMyBin ? 'bg-green-400' : 'bg-slate-300/70'}`}
                                                                    style={{height: `${Math.max(2, h)}%`}}
                                                                >
                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                                        {formatTime(binMin)} ~ {formatTime(binMax)}<br/>{countInBin}명
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {/* 최댓값 초과 그룹 */}
                                                        {(() => {
                                                            const overMaxCount = times.filter(t => t > 600).length;
                                                            const isMyOverMax = myDeck && myDeck.timeSec > 600;
                                                            if (overMaxCount === 0) return null;
                                                            const overMaxHeight = (overMaxCount / Math.max(...histTime.bars.map((_, i) => {
                                                                return times.filter(t => {
                                                                    const clampedTime = Math.min(600, Math.max(0, t));
                                                                    const binIdx = Math.min(23, Math.max(0, Math.floor((clampedTime / 600) * 24)));
                                                                    return binIdx === i;
                                                                }).length;
                                                            }), 1)) * 100;
                                                            return (
                                                                <div
                                                                    className={`flex-1 relative group ml-1 ${isMyOverMax ? 'bg-green-400' : 'bg-red-400/70'}`}
                                                                    style={{height: `${Math.max(2, overMaxHeight)}%`}}
                                                                >
                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                                        10:00+<br/>{overMaxCount}명
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                        <span>00:00</span>
                                                        <span>10:00+</span>
                                                    </div>
                                                    {myDeck && (
                                                        <div className="mt-2 text-xs text-slate-400">상위 {pTime}% (내: {formatTime(myDeck.timeSec)})</div>
                                                    )}
                                                </div>
                                                {/* 골드 */}
                                                <div className="rounded-md bg-slate-800/40 ring-1 ring-white/10 p-3">
                                                    <div className="text-xs mb-2 text-slate-300">사용한 골드</div>
                                                    <div className="h-24 flex items-end gap-[1px] relative">
                                                        {histSpend.bars.map((h, i) => {
                                                            const binMin = Math.floor((i / 24) * 1000);
                                                            const binMax = Math.floor(((i + 1) / 24) * 1000);
                                                            const isMyBin = myDeck && myDeck.spent >= binMin && myDeck.spent < binMax;
                                                            const countInBin = spends.filter(s => {
                                                                const clampedSpend = Math.min(1000, Math.max(0, s));
                                                                const binIdx = Math.min(23, Math.max(0, Math.floor((clampedSpend / 1000) * 24)));
                                                                return binIdx === i;
                                                            }).length;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className={`flex-1 relative group ${isMyBin ? 'bg-green-400' : 'bg-slate-300/70'}`}
                                                                    style={{height: `${Math.max(2, h)}%`}}
                                                                >
                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                                        {binMin} ~ {binMax}<br/>{countInBin}명
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {/* 최댓값 초과 그룹 */}
                                                        {(() => {
                                                            const overMaxCount = spends.filter(s => s > 1000).length;
                                                            const isMyOverMax = myDeck && myDeck.spent > 1000;
                                                            if (overMaxCount === 0) return null;
                                                            const overMaxHeight = (overMaxCount / Math.max(...histSpend.bars.map((_, i) => {
                                                                return spends.filter(s => {
                                                                    const clampedSpend = Math.min(1000, Math.max(0, s));
                                                                    const binIdx = Math.min(23, Math.max(0, Math.floor((clampedSpend / 1000) * 24)));
                                                                    return binIdx === i;
                                                                }).length;
                                                            }), 1)) * 100;
                                                            return (
                                                                <div
                                                                    className={`flex-1 relative group ml-1 ${isMyOverMax ? 'bg-green-400' : 'bg-red-400/70'}`}
                                                                    style={{height: `${Math.max(2, overMaxHeight)}%`}}
                                                                >
                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                                        1000+<br/>{overMaxCount}명
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                        <span>0</span>
                                                        <span>1000+</span>
                                                    </div>
                                                    {myDeck && (
                                                        <div className="mt-2 text-xs text-slate-400">상위 {pSpend}% (내: {myDeck.spent.toLocaleString()})</div>
                                                    )}
                                                </div>
                                                {/* 리롤 */}
                                                <div className="rounded-md bg-slate-800/40 ring-1 ring-white/10 p-3">
                                                    <div className="text-xs mb-2 text-slate-300">리롤 횟수</div>
                                                    <div className="h-24 flex items-end gap-[1px] relative">
                                                        {histReroll.bars.map((h, i) => {
                                                            const binMin = Math.floor((i / 24) * 500);
                                                            const binMax = Math.floor(((i + 1) / 24) * 500);
                                                            const isMyBin = myDeck && (myDeck.rerollCount ?? 0) >= binMin && (myDeck.rerollCount ?? 0) < binMax;
                                                            const countInBin = rerolls.filter(r => {
                                                                const clampedReroll = Math.min(500, Math.max(0, r));
                                                                const binIdx = Math.min(23, Math.max(0, Math.floor((clampedReroll / 500) * 24)));
                                                                return binIdx === i;
                                                            }).length;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className={`flex-1 relative group ${isMyBin ? 'bg-green-400' : 'bg-slate-300/70'}`}
                                                                    style={{height: `${Math.max(2, h)}%`}}
                                                                >
                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                                        {binMin} ~ {binMax}<br/>{countInBin}명
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {/* 최댓값 초과 그룹 */}
                                                        {(() => {
                                                            const overMaxCount = rerolls.filter(r => r > 500).length;
                                                            const isMyOverMax = myDeck && (myDeck.rerollCount ?? 0) > 500;
                                                            if (overMaxCount === 0) return null;
                                                            const overMaxHeight = (overMaxCount / Math.max(...histReroll.bars.map((_, i) => {
                                                                return rerolls.filter(r => {
                                                                    const clampedReroll = Math.min(500, Math.max(0, r));
                                                                    const binIdx = Math.min(23, Math.max(0, Math.floor((clampedReroll / 500) * 24)));
                                                                    return binIdx === i;
                                                                }).length;
                                                            }), 1)) * 100;
                                                            return (
                                                                <div
                                                                    className={`flex-1 relative group ml-1 ${isMyOverMax ? 'bg-green-400' : 'bg-red-400/70'}`}
                                                                    style={{height: `${Math.max(2, overMaxHeight)}%`}}
                                                                >
                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                                        500+<br/>{overMaxCount}명
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                        <span>0</span>
                                                        <span>500+</span>
                                                    </div>
                                                    {myDeck && (
                                                        <div className="mt-2 text-xs text-slate-400">상위 {pReroll}% (내: {myDeck.rerollCount ?? 0})</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* ��션 버튼들 */}
                <div className="mt-8 flex justify-center gap-4">
                    <button
                        onClick={() => router.push('/setting')}
                        className="px-6 py-3 bg-indigo-600 rounded-lg hover:bg-indigo-500 font-semibold"
                    >
                        새로운 덱으로 시작
                    </button>
                    <button
                        onClick={() => router.push('/time-attack')}
                        className="px-6 py-3 bg-slate-700 rounded-lg hover:bg-slate-600 font-semibold"
                    >
                        같은 덱으로 다시
                    </button>
                </div>
            </div>
        </div>
    );
}
