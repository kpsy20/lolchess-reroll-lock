'use client';
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type {Unit} from "../lib/types";
import {
    XP_REQ, ODDS, COST_COLORS, COST_TEXT, COST_BG, STORAGE_KEY, BENCH_SIZE,
    TRAIT_BREAKPOINTS, GOLD_ALWAYS_TRAITS, BP_TIER_CLASS, TRAIT_DISPLAY_RANGE, ROSTER
} from "../lib/constants";
import {
    clx, coins, makeShop, normalizeStar, mergeAllUnits, maxStarForKeyAcross,
    simulateBuyAndMerge, getSellGold, countByStarForKey
} from "../lib/utils";
import {createHandlers, DragSrc} from './hooks/functions';

import HeaderBar from "./components/HeaderBar"
import ActionShop from './components/ActionShop';
import Bench from './components/Bench';
// Preset payload from /setting page
const TA_PRESET_KEY = 'TA_SELECTED_PRESET';
const TA_RESULTS_KEY = 'TA_HISTORY_V1';

export default function TFTShop() {
    const [gold, setGold] = useState(0);
    const [level, setLevel] = useState(3);
    const [xp, setXp] = useState(0);
    const [shop, setShop] = useState<(Unit | null)[]>(() => makeShop(3, [], []));
    const [locked, setLocked] = useState(false);
    const [bench, setBench] = useState<(Unit | null)[]>(Array.from({length: BENCH_SIZE}, () => null)); // 10 fixed slots

    // Board: simple 4x7 grid (28 slots)
    const BOARD_ROWS = 4;
    const BOARD_COLS = 7;
    const BOARD_SIZE = BOARD_ROWS * BOARD_COLS;
    const [board, setBoard] = useState<(Unit | null)[]>(Array.from({length: BOARD_SIZE}, () => null));

    const boardCount = board.reduce((acc, x) => acc + (x ? 1 : 0), 0);

    // --- SFX: reroll ---
    const rerollAudioRef = useRef<HTMLAudioElement | null>(null);
    const buyAudioRef = useRef<HTMLAudioElement | null>(null);
    const sellAudioRef = useRef<HTMLAudioElement | null>(null);
    const twoStarAudioRef = useRef<HTMLAudioElement | null>(null);
    const threeStarAudioRef = useRef<HTMLAudioElement | null>(null);
    const moveAudioRef = useRef<HTMLAudioElement | null>(null);
    const xpAudioRef = useRef<HTMLAudioElement | null>(null);
    // --- BGM audio ---
    const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

    // --- Time Attack: countdown + timer + spent + reroll count ---
    const [spent, setSpent] = useState(0);
    const [rerollCount, setRerollCount] = useState(0);
    const [countdown, setCountdown] = useState(3); // 3..2..1..0
    const [running, setRunning] = useState(false);
    const [timerSec, setTimerSec] = useState(0);

    // --- Preset targets ---
    const [targets, setTargets] = useState<Record<string, number> | null>(null);
    const [deckName, setDeckName] = useState<string | null>(null);

    // Overlap mode (겹치는 사람 옵션)
    type OverlapMode = 'none' | 'with';
    const [overlapMode, setOverlapMode] = useState<OverlapMode>('none');

    const router = useRouter();

    // BGM 상태 관리 추가
    const [bgmInitialized, setBgmInitialized] = useState(false);

    // BGM 초기화 및 재생 (한 번만 실행)
    useEffect(() => {
        const initBGM = () => {
            const el = bgmAudioRef.current;
            if (!el) return;

            try {
                // BGM 설정
                el.volume = 0.1;
                el.loop = true; // 반복 재생 설정

                // 즉시 재생 시도
                el.play().then(() => {
                    console.log('BGM 자동 재생 성공');
                    setBgmInitialized(true);
                }).catch(() => {
                    console.log('BGM 자동 재생 실패 - 사용자 상호작용 대기');
                });
            } catch (error) {
                console.log('BGM 초기화 오류:', error);
            }
        };

        // 첫 사용자 상호작용에서 BGM 시작
        const startBGMOnInteraction = () => {
            const el = bgmAudioRef.current;
            if (!el || !el.paused) return;

            el.play().then(() => {
                console.log('사용자 상호작용으로 BGM 재생 성공');
                setBgmInitialized(true);
                // 이벤트 리스너 제거
                document.removeEventListener('click', startBGMOnInteraction);
                document.removeEventListener('keydown', startBGMOnInteraction);
                document.removeEventListener('touchstart', startBGMOnInteraction);
            }).catch((error) => {
                console.log('BGM 재생 실패:', error);
            });
        };

        // 페이지 로드 후 즉시 시도
        const timer = setTimeout(() => {
            initBGM();
        }, 100);

            window.addEventListener('keydown', startBGMOnInteraction, {once: true});
        // 다양한 사용자 상호작용 이벤트에 리스너 추가
        document.addEventListener('click', startBGMOnInteraction, {once: true});
        document.addEventListener('keydown', startBGMOnInteraction, {once: true});
        document.addEventListener('touchstart', startBGMOnInteraction, {once: true});

        return () => {
            clearTimeout(timer);
            document.removeEventListener('click', startBGMOnInteraction);
            document.removeEventListener('keydown', startBGMOnInteraction);
            document.removeEventListener('touchstart', startBGMOnInteraction);
        };
    }, []); // 의존성 배열을 비워서 컴포넌트 마운트 시에만 실행

    // 카운트다운 타이머
    useEffect(() => {
        const t1 = setInterval(() => {
            setCountdown((c) => {
                if (c <= 1) {
                    clearInterval(t1);
                    setRunning(true);
                    return 0;
                }
                return c - 1;
            });
        }, 1000);
        
        return () => {
            clearInterval(t1);
        };
    }, []);

    // 게임 실행 타이머
    useEffect(() => {
        if (!running) return;
        

        const startMs = Date.now();
        
        const t2 = setInterval(() => {
            setTimerSec(Math.floor((Date.now() - startMs) / 1000));
        }, 200);
        
        return () => {
            clearInterval(t2);
        };
    }, [running]);

    const playAudio = (ref: React.RefObject<HTMLAudioElement | null>, vol = 0.2) => {
        const el = ref.current;
        if (!el) return;
        try {
            el.currentTime = 0;
            el.volume = vol;
            void el.play();
        } catch {
        }
    };

    // Load/Save
    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                const s = JSON.parse(raw);
                setGold(s.gold ?? 100);
                setLevel(s.level ?? 3);
                setXp(s.xp ?? 0);
                // normalize bench first so we can compute a pool-aware shop
                const benchArr: (Unit | null)[] = Array.from({length: BENCH_SIZE}, (_, i) =>
                    s.bench && s.bench[i] ? {...s.bench[i], star: s.bench[i].star ?? 1} : null
                );
                setBench(benchArr);
                setLocked(!!s.locked);
                // use the current board state (initially empty) and benchArr to rebuild shop if none saved
                setShop(s.shop ?? makeShop(s.level ?? 3, board, benchArr));
            } catch {
            }
        }
    }, []);
    useEffect(() => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({gold, level, xp, shop, locked, bench})
        );
    }, [gold, level, xp, shop, locked, bench]);

    const odds = ODDS[level] || ODDS[3];
    const xpReq = XP_REQ[level] ?? 2; // levels 1-2 use a minimal requirement so you can level up
    // Wanted units (for shop highlight)
    const [wanted, setWanted] = useState<Set<string>>(new Set());

    // Load preset wanted units from localStorage if present (from /setting)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(TA_PRESET_KEY);
            if (!raw) return;
            const p = JSON.parse(raw);
            if (Array.isArray(p?.units)) {
                setWanted(new Set(p.units));
            }
            if (p?.targets && typeof p.targets === 'object') {
                setTargets(p.targets as Record<string, number>);
            } else {
                setTargets(null);
            }
            setDeckName(typeof p?.name === 'string' ? p.name : null);
            const om = p?.overlapMode;
            if (om === 'none' || om === 'with') setOverlapMode(om);
        } catch {}
    }, []);
    // Per-unit pool (cost-based)
    const [pool, setPool] = useState<Map<string, number>>(() => {
        const m = new Map<string, number>();
        const byCost: Record<number, number> = { 1: 30, 2: 25, 3: 18, 4: 10, 5: 9 };
        Object.keys(ROSTER).forEach((ck) => {
            const cost = Number(ck);
            const cnt = byCost[cost] ?? 0;
            ROSTER[cost].forEach((u) => m.set(u.key, cnt));
        });
        return m;
    });

    // Flatten roster for the selector grid (right panel)
    const allUnits = useMemo(() => {
        const arr: Array<{ key: string; name: string; img?: string; cost: number }> = [];
        Object.keys(ROSTER).forEach((k) => {
            const cost = Number(k);
            ROSTER[cost].forEach((u) => arr.push({key: u.key, name: u.name, img: u.img, cost}));
        });
        // sort by cost asc, then name
        arr.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
        return arr;
    }, []);

    const toggleWanted = useCallback((key: string) => {
        setWanted((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, []);
    const benchIsFull = bench.every((slot) => slot !== null);
    // Derived flags for ActionShop props
    const canReroll = !locked;
    const canBuyXP = level < 10;


    useEffect(() => {
        // Level up once threshold reached
        const need = xpReq;
        if (level < 10 && xp >= need && need > 0) {
            setLevel(level + 1);
            setXp(xp - need);
        }
    }, [xp, level, xpReq]);


    // Owned keys (for highlighting shop cards)
    const ownedKeys = useMemo(() => {
        const s = new Set<string>();
        bench.forEach((u) => {
            if (u) s.add(u.key);
        });
        board.forEach((u) => {
            if (u) s.add(u.key);
        });
        return s;
    }, [bench, board]);

    // Keys present on board only
    const boardKeySet = useMemo(() => {
        const s = new Set<string>();
        board.forEach((u) => {
            if (u) s.add(u.key);
        });
        return s;
    }, [board]);

    // Precompute trait -> list of units (with cost), sorted by cost asc then name
    const traitUnitMap = useMemo(() => {
        const map = new Map<string, Array<{ key: string; name: string; img?: string; cost: number }>>();
        Object.keys(ROSTER).forEach((k) => {
            const cost = Number(k);
            ROSTER[cost].forEach((u) => {
                u.traits.forEach((t) => {
                    if (!map.has(t)) map.set(t, []);
                    map.get(t)!.push({key: u.key, name: u.name, img: u.img, cost});
                });
            });
        });
        for (const [t, arr] of map) {
            arr.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
        }
        return map;
    }, []);

    // Trait counts (board only) — count **unique champions** per trait (not copies)
    const traitCounts = useMemo(() => {
        const map = new Map<string, Set<string>>(); // trait -> set of unit keys
        board.forEach((u) => {
            if (!u) return;
            u.traits.forEach((t) => {
                if (!map.has(t)) map.set(t, new Set());
                map.get(t)!.add(u.key);
            });
        });
        const entries: Array<[string, number]> = Array.from(map.entries()).map(([t, set]) => [t, set.size]);
        // Sort by count desc, then name asc
        return entries.sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
    }, [board]);


    // Map for unique champion count per trait (board only)
    const traitUniqueMap = useMemo(() => {
        const map = new Map<string, Set<string>>();
        board.forEach((u) => {
            if (!u) return;
            u.traits.forEach((t) => {
                if (!map.has(t)) map.set(t, new Set());
                map.get(t)!.add(u.key);
            });
        });
        const num = new Map<string, number>();
        for (const [t, set] of map.entries()) num.set(t, set.size);
        return num;
    }, [board]);

    // 3★ units on board (instances). Used for the special "크루" synergy.
    const threeStarOnBoard = useMemo(() => {
        let n = 0;
        for (const u of board) {
            if (u && (u.star ?? 1) >= 3) n++;
        }
        return n;
    }, [board]);

    // ---- Trait tier helpers ----
    type TraitTier = 'none' | 'bronze' | 'silver' | 'gold';
    const tierForTrait = React.useCallback((trait: string, count: number): TraitTier => {
        // Special rule: "크루" tiers depend on the number of 3★ units on board
        if (trait === '크루') {
            const n = threeStarOnBoard;
            if (n >= 3) return 'gold';
            if (n >= 1) return 'silver';
            return 'bronze'; // 3★ 0개는 브론즈
        }
        // 항상 골드 처리되는 트레이트
        if (GOLD_ALWAYS_TRAITS.has(trait) && count >= 1) return 'gold';
        const bps = TRAIT_BREAKPOINTS[trait];
        if (!bps || count <= 0) return 'none';
        // 멘토 등 2단계짜리(예: [1,4]) 처리
        if (bps.length === 1) return count >= bps[0] ? 'gold' : 'none';
        if (bps.length === 2) {
            if (count >= bps[1]) return 'gold';
            if (count >= bps[0]) return 'bronze';
            return 'none';
        }
        // 3단계(브론즈/실버/골드)
        if (count >= bps[2]) return 'gold';
        if (count >= bps[1]) return 'silver';
        if (count >= bps[0]) return 'bronze';
        return 'none';
    }, [threeStarOnBoard]);

    // Sorted traits: active (tier != 'none') first, then inactive; sort by unique count desc, then name
    const sortedTraits = useMemo(() => {
        const rows = traitCounts.map(([trait, cnt]) => ({trait, cnt, tier: tierForTrait(trait, cnt)}));
        rows.sort((a, b) => {
            const aActive = a.tier !== 'none' ? 1 : 0;
            const bActive = b.tier !== 'none' ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive; // active first
            if (a.cnt !== b.cnt) return b.cnt - a.cnt;         // more champions first
            return a.trait.localeCompare(b.trait);
        });
        return rows;
    }, [traitCounts, tierForTrait]);

    // Helper: next breakpoint for a trait
    const nextBpForTrait = useCallback((trait: string, count: number): number | null => {
        // Crew handled separately in render
        if (GOLD_ALWAYS_TRAITS.has(trait)) return 1;
        const bps = TRAIT_BREAKPOINTS[trait];
        if (!bps) return null;
        for (let i = 0; i < bps.length; i++) {
            if (count < bps[i]) return bps[i];
        }
        // already at/over max tier; keep last bp for display
        return bps[bps.length - 1] ?? null;
    }, []);

    // Value used to evaluate a trait (crew uses 3★ count)
    const valueForTrait = useCallback((trait: string, cnt: number) => {
        return trait === '크루' ? threeStarOnBoard : cnt;
    }, [threeStarOnBoard]);

    // What numbers to show to the right for each trait (UI chips)
    const displayNumbersForTrait = useCallback((trait: string) => {
        if (TRAIT_DISPLAY_RANGE[trait]) return TRAIT_DISPLAY_RANGE[trait];
        if (trait === '크루') return [0, 1, 3];
        return TRAIT_BREAKPOINTS[trait] ?? [];
    }, []);

    // Given a trait and a number x (from the display list), return which tier color it should have
    const tierOfNumber = useCallback((trait: string, x: number): 'bronze' | 'silver' | 'gold' | null => {
        const bps = TRAIT_BREAKPOINTS[trait];
        if (!bps) return null;
        const idx = bps.findIndex((bp) => bp === x);
        if (idx === -1) return null; // not an official breakpoint; neutral color
        return (['bronze', 'silver', 'gold'] as const)[Math.min(idx, 2)];
    }, []);

    const tierClass = (tier: TraitTier) =>
        tier === 'gold' ? 'bg-yellow-400/25 ring-yellow-300/60 text-yellow-200' :
            tier === 'silver' ? 'bg-slate-300/20 ring-slate-200/50 text-slate-100' :
                tier === 'bronze' ? 'bg-amber-600/25 ring-amber-400/60 text-amber-200' :
                    'bg-black/40 ring-white/10 text-white/80';

    // ---- Drag & Drop state ----
    const [dragSrc, setDragSrc] = useState<DragSrc>(null);
    const [isDragging, setIsDragging] = useState(false);

    // ---- Hover state for W toggle ----
    type Hover = { over: 'bench' | 'board'; index: number } | null;
    const [hover, setHover] = useState<Hover>(null);

    // Hover state for trait tooltip
    const [hoveredTrait, setHoveredTrait] = useState<string | null>(null);
    const grayscaleIf = (cond: boolean) => (cond ? '' : 'grayscale opacity-60');


    // ---- Handlers (from createHandlers) ----
    const {
        reroll,
        buyXP,
        nudgeLevel,
        addGold,
        placeFromBench,
        returnToBench,
        beginDragBench,
        beginDragBoard,
        endDrag,
        allowDrop,
        dropToBoard,
        dropToBench,
        sellDragged,
        sellAt,
        buyFromShop,
        getPromoStarBadge,
    } = createHandlers({
        gold, setGold,
        level, setLevel,
        xp, setXp,
        shop, setShop,
        locked,
        bench, setBench,
        board, setBoard,
        dragSrc, setDragSrc,
        setIsDragging,
        spent, setSpent,
        rerollCount, setRerollCount,
        playAudio,
        refs: {moveAudioRef, buyAudioRef, sellAudioRef, rerollAudioRef, twoStarAudioRef, threeStarAudioRef, xpAudioRef},
        overlapMode,
        wanted,
        pool,
        setPool,
    });

    // Hotkeys
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const target = e.target as HTMLElement | null;
            // Don't fire when typing in inputs or contenteditables
            if (target) {
                const tag = target.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
            }
            const code = e.code; // physical key (e.g., 'KeyD')
            if (code === 'KeyD' || code === 'KeyF' || code === 'KeyX' || code === 'KeyW' || code === 'KeyE') {
                e.preventDefault();
            }
            if (code === 'KeyD') reroll();
            if (code === 'KeyF') buyXP();
            if (code === 'KeyW') {
                if (!hover) return;
                if (hover.over === 'bench') {
                    // Move hovered bench unit to the first empty board slot
                    placeFromBench(hover.index);
                } else if (hover.over === 'board') {
                    // Return hovered board unit to the first empty bench slot
                    returnToBench(hover.index);
                }
            }
            if (code === 'KeyE') {
                if (!hover) return;
                if (hover.over === 'bench' && bench[hover.index]) {
                    sellAt('bench', hover.index);
                } else if (hover.over === 'board' && board[hover.index]) {
                    sellAt('board', hover.index);
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [reroll, buyXP, placeFromBench, returnToBench, hover, sellAt, bench, board]);

    useEffect(() => {
        if (countdown > 0) return; // 아직 시작 전
        
        const req: Array<[string, number]> = targets
            ? Object.entries(targets)
            : Array.from(wanted).map((k) => [k, 2]); // 기본 목표: 원하는 유닛 전부 2성

        if (req.length === 0) return;

        let ok = true;
        for (const [k, t] of req) {
            const m = maxStarForKeyAcross(k, board, bench);
            if (m < (t || 1)) { ok = false; break; }
        }
        if (!ok) return;

        // 완료! end 페이지로 이동
        setRunning(false);
        
        // 결과 저장 (누적)
        try {
            const raw = localStorage.getItem(TA_RESULTS_KEY);
            const arr = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
            arr.push({
                deck: deckName || '(custom)',
                spent,
                rerollCount,
                timeSec: timerSec,
                date: new Date().toISOString(),
                targets: Object.fromEntries(req),
                overlapMode,
            });
            localStorage.setItem(TA_RESULTS_KEY, JSON.stringify(arr));
        } catch {
            const arr = [{
                deck: deckName || '(custom)',
                spent,
                rerollCount,
                timeSec: timerSec,
                date: new Date().toISOString(),
                targets: Object.fromEntries(req),
                overlapMode,
            }];
            localStorage.setItem(TA_RESULTS_KEY, JSON.stringify(arr));
        }
        
        // end 페이지로 이동
        router.push('/end');
    }, [board, bench, targets, wanted, countdown, deckName, spent, timerSec, rerollCount, router]);

    const OddsBar = useMemo(
        () => (
            <div className="flex gap-2 text-xs text-white/90">
                {[1, 2, 3, 4, 5].map((c, i) => (
                    <div
                        key={c}
                        className={clx(
                            "px-2 py-1 rounded-md",
                            COST_TEXT[c]
                        )}
                        title={`코스트 ${c}`}
                    >
                        • {odds[i]}%
                    </div>
                ))}
            </div>
        ),
        [odds]
    );



    return (
        <div
            className="w-full min-h-screen bg-slate-900 text-slate-100 flex items-start justify-center p-6 pt-16"
        >
            {countdown > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/60 grid place-items-center select-none">
                    <div className="text-[120px] font-black tracking-tight drop-shadow-2xl">{countdown}</div>
                </div>
            )}



            <audio ref={rerollAudioRef} src="/sound/reroll.mp3" preload="auto"/>
            <audio ref={buyAudioRef} src="/sound/buy.mp3" preload="auto"/>
            <audio ref={sellAudioRef} src="/sound/sell.mp3" preload="auto"/>
            <audio ref={twoStarAudioRef} src="/sound/2star.mp3" preload="auto"/>
            <audio ref={threeStarAudioRef} src="/sound/3star.mp3" preload="auto"/>
            <audio ref={moveAudioRef} src="/sound/move.mp3" preload="auto"/>
            <audio ref={xpAudioRef} src="/sound/xp.mp3" preload="auto"/>
            <audio ref={bgmAudioRef} src="/sound/bgm_modified.mp3" preload="auto"/>

            {/* Left Trait Panel (board-only) */}
            <div className="fixed left-4 top-24 z-40 w-44 select-none">
                {/* Right Wanted Panel */}
                <div className="fixed right-4 top-24 z-40 w-48 max-h-[70vh] overflow-auto select-none">
                    {/* Deck name (if coming from setting) */}
                    <div className="text-[11px] mb-1 px-2 py-1 rounded bg-black/30 ring-1 ring-white/10 text-white/70 truncate">
                        {deckName ? `덱: ${deckName}` : null}
                    </div>
                    <div
                        className="text-xs mb-2 px-2 py-1 rounded-md bg-black/40 ring-1 ring-white/10 text-white/80">원하는
                        유닛
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                        {allUnits.map((u) => (
                            <button
                                key={u.key}
                                type="button"
                                onClick={() => toggleWanted(u.key)}
                                className={clx(
                                    "relative w-8 h-8 rounded overflow-hidden ring-1 transition-all duration-200",
                                    wanted.has(u.key) 
                                        ? "ring-pink-400 opacity-100" 
                                        : "ring-white/10 opacity-40 hover:opacity-70"
                                )}
                                title={u.name}
                            >
                                <Image src={u.img ?? '/garen.jpg'} alt={u.name} fill className="object-cover" sizes="32px"/>
                                <div className="absolute bottom-0 right-0 text-[8px] px-0.5 bg-black/70">{u.cost}</div>
                                {wanted.has(u.key) && (
                                    <div className="absolute inset-0 ring-2 ring-pink-400/70"/>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    {traitCounts.length === 0 ? (
                        <div className="px-2 py-1 text-xs text-white/40"></div>
                    ) : (
                        sortedTraits.map(({trait, cnt, tier}) => {
                            const val = valueForTrait(trait, cnt);
                            const nums = displayNumbersForTrait(trait);

                            // Left small badge text
                            let leftBadge = '';
                            if (trait === '크루') {
                                const uniq = traitUniqueMap.get('크루') ?? 0;
                                leftBadge = String(uniq); // 유니크 크루 수
                                // name will show trait; progress chips will show nums as below
                            } else if (GOLD_ALWAYS_TRAITS.has(trait)) {
                                leftBadge = String(cnt > 0 ? 1 : 0);
                            } else {
                                leftBadge = String(cnt);
                            }

                            return (
                                <div
                                    key={trait}
                                    className={clx(
                                        'relative flex items-center justify-between px-2 py-1 rounded-md ring-1 text-xs',
                                        tierClass(tier)
                                    )}
                                    onMouseEnter={() => setHoveredTrait(trait)}
                                    onMouseLeave={() => setHoveredTrait((h) => (h === trait ? null : h))}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div
                                            className="shrink-0 w-5 h-5 rounded bg-black/50 ring-1 ring-white/10 grid place-items-center text-[10px] font-semibold">
                                            {leftBadge}
                                        </div>
                                        <span className="truncate">{trait}</span>
                                    </div>
                                    <div className="ml-2 flex items-center gap-1 shrink-0">
                                        {nums.map((x, i) => {
                                            const tierOfX = tierOfNumber(trait, x);
                                            const palette = tierOfX ? BP_TIER_CLASS[tierOfX] : {
                                                on: 'text-white/90',
                                                off: 'text-white/30'
                                            };
                                            const active = val >= x; // highlight if reached or exceeded
                                            return (
                                                <span key={i}
                                                      className={clx('text-[10px] tabular-nums', active ? palette.on : palette.off)}>
                                                    {x}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {hoveredTrait === trait && (
                                        <div
                                            className="absolute left-full top-0 ml-2 z-50 w-44 rounded-md bg-black/80 ring-1 ring-white/15 p-2 shadow-xl backdrop-blur">
                                            <div className="text-[10px] text-white/60 mb-1">{trait}</div>
                                            <div className="grid grid-cols-5 gap-1">
                                                {(traitUnitMap.get(trait) ?? []).map((u) => (
                                                    <div key={u.key}
                                                         className="relative w-8 h-8 rounded overflow-hidden ring-1 ring-white/10">
                                                        <Image
                                                            src={u.img ?? '/garen.jpg'}
                                                            alt={u.name}
                                                            fill
                                                            className={clx('object-cover', grayscaleIf(boardKeySet.has(u.key)))}
                                                        />
                                                        <div
                                                            className="absolute bottom-0 right-0 text-[8px] px-0.5 bg-black/70">{u.cost}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            <div className="w-[1100px] max-w-full">
                {/* Board (main field) – Hex (staggered) */}
                {(() => {
                    const HEX_W = 132;  // px
                    const HEX_H = 116;  // px
                    const HALF = HEX_W / 2; // indent for odd rows
                    const hexStyle = {clipPath: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)'} as const;

                    const rows = Array.from({length: BOARD_ROWS}, (_, r) => (
                        <div key={r} className="flex gap-2 mb-2" style={{marginLeft: r % 2 ? `${HALF}px` : 0}}>
                            {Array.from({length: BOARD_COLS}).map((__, c) => {
                                const i = r * BOARD_COLS + c;
                                const filled = !!board[i];
                                return (
                                    <div
                                        key={c}
                                        className={clx(
                                            'relative overflow-hidden ring-1 ring-white/10 bg-white/5 flex items-center justify-center',
                                            filled && COST_COLORS[board[i]!.cost]
                                        )}
                                        style={{width: HEX_W, height: HEX_H, ...hexStyle}}
                                        onMouseEnter={() => setHover({over: 'board', index: i})}
                                        onMouseLeave={() => setHover((h) => (h && h.over === 'board' && h.index === i ? null : h))}
                                        onDragOver={allowDrop}
                                        onDrop={() => dropToBoard(i)}
                                    >
                                        {board[i] ? (
                                            <>
                                                <Image src={board[i]!.img ?? '/garen.jpg'} alt={board[i]!.name} fill
                                                       className="object-cover"/>
                                                <div className="absolute inset-0 bg-black/30"/>
                                                <div
                                                    className="absolute top-1 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.5 text-[10px] rounded bg-black text-white ring-1 ring-white/10">
                                                    {"★".repeat((board[i]!.star ?? 1))}
                                                </div>
                                                <div draggable onDragStart={beginDragBoard(i)} onDragEnd={endDrag}
                                                     className="absolute inset-0"/>
                                            </>
                                        ) : (
                                            <span className="text-white/40 text-xs"></span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ));
                    return <div className="mb-4 flex flex-col items-center">{rows}</div>;
                })()}

                {/* Bench */}
                <Bench
                    bench={bench}
                    onHoverEnter={(i) => setHover({over: 'bench', index: i})}
                    onHoverLeave={(i) => setHover((h) => (h && h.over === 'bench' && h.index === i ? null : h))}
                    allowDrop={allowDrop}
                    dropToBench={dropToBench}
                    beginDragBench={beginDragBench}
                    endDrag={endDrag}
                />

                {/* Reroll Bar */}
                <div
                    className="rounded-2xl bg-gradient-to-b from-slate-800/70 to-slate-900/80 ring-1 ring-white/10 p-4 shadow-2xl">
                    <HeaderBar
                      level={level}
                      xp={xp}
                      xpReq={xpReq}
                      onNudgeLevel={nudgeLevel}
                      odds={odds}
                      timeAttack
                      timerSec={timerSec}
                      spent={spent}
                      overlapModeLabel={`겹침: ${overlapMode === 'with' ? '있음' : '없음'}`}
                    />

                    {/* Actions + Shop */}
                    <ActionShop
                        shop={shop}
                        gold={gold}
                        ownedKeys={ownedKeys}
                        wanted={wanted}
                        canBuyXP={canBuyXP}
                        canReroll={canReroll}
                        onBuyXP={buyXP}
                        onReroll={reroll}
                        onBuyFromShop={buyFromShop}
                        getPromoStarBadge={getPromoStarBadge}
                    />
                </div>
                {isDragging && (
                    <>
                        <div onDragOver={allowDrop} onDrop={sellDragged}
                             className="fixed bottom-4 left-4 w-48 h-48 rounded-xl bg-red-600/30 ring-2 ring-red-400 flex items-center justify-center text-sm font-bold text-red-100 select-none">판매
                        </div>
                        <div onDragOver={allowDrop} onDrop={sellDragged}
                             className="fixed bottom-4 right-4 w-48 h-48 rounded-xl bg-red-600/30 ring-2 ring-red-400 flex items-center justify-center text-sm font-bold text-red-100 select-none">판매
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
