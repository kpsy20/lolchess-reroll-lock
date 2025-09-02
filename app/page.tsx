'use client';
import React, {useCallback, useEffect, useMemo, useState} from "react";
import Image from 'next/image';
import type {Unit} from "./lib/types";
import {
    XP_REQ, ODDS, COST_COLORS, COST_TEXT, COST_BG, STORAGE_KEY, BENCH_SIZE,
    TRAIT_BREAKPOINTS, GOLD_ALWAYS_TRAITS, BP_TIER_CLASS, TRAIT_DISPLAY_RANGE, ROSTER
} from "./lib/constants";
import {
    clx, coins, makeShop, normalizeStar, mergeAllUnits, maxStarForKeyAcross,
    simulateBuyAndMerge, getSellGold, countByStarForKey
} from "./lib/utils";

export default function TFTShop() {
    const [gold, setGold] = useState(100);
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

    const firstEmptyBoardIndex = () => board.findIndex((x) => x === null);

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
                const benchArr: (Unit | null)[] = Array.from({ length: BENCH_SIZE }, (_, i) =>
                  s.bench && s.bench[i] ? { ...s.bench[i], star: s.bench[i].star ?? 1 } : null
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

    // Flatten roster for the selector grid (right panel)
    const allUnits = useMemo(() => {
        const arr: Array<{ key: string; name: string; img?: string; cost: number }> = [];
        (Object.keys(ROSTER) as Array<keyof typeof ROSTER>).forEach((k) => {
            const cost = Number(k);
            ROSTER[cost].forEach((u) => arr.push({ key: u.key, name: u.name, img: u.img, cost }));
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

    // Actions
    const canReroll = gold >= 2;
    const canBuyXP = gold >= 4 && level < 10;

    const reroll = useCallback(() => {
        if (!canReroll || locked) return; // locked shop doesn't refresh
        setGold((g) => g - 2);
        setShop(makeShop(level, board, bench));
    }, [canReroll, locked, level, board, bench]);

    const buyXP = useCallback(() => {
        if (!canBuyXP) return;
        setGold((g) => g - 4);
        setXp((v) => v + 4);
    }, [canBuyXP]);

    // Level stepper: only allow up/down, resets XP on change
    const nudgeLevel = useCallback((delta: number) => {
        setLevel((prev) => {
            const next = Math.max(1, Math.min(10, prev + delta));
            if (next !== prev) {
                setXp(0); // manual level change resets XP
            }
            return next;
        });
    }, []);

    useEffect(() => {
        // Level up once threshold reached
        const need = xpReq;
        if (level < 10 && xp >= need && need > 0) {
            setLevel(level + 1);
            setXp(xp - need);
        }
    }, [xp, level, xpReq]);



    const placeFromBench = useCallback((benchIdx: number) => {
        if (boardCount >= level) return;
        const idx = firstEmptyBoardIndex();
        if (idx === -1) return; // no space on board
        const u = bench[benchIdx];
        if (!u) return;
        const nextBoard = board.map((cell, i) => (i === idx ? normalizeStar(u) as Unit : cell));
        const nextBench = bench.map((cell, i) => (i === benchIdx ? null : cell));
        const merged = mergeAllUnits(nextBoard, nextBench);
        setBoard(merged.board);
        setBench(merged.bench);
    }, [bench, board, boardCount, level]);

    const returnToBench = useCallback((boardIdx: number) => {
        const u = board[boardIdx];
        if (!u) return;
        const empty = bench.findIndex((s) => s === null);
        if (empty === -1) return; // bench full
        setBench((b) => b.map((cell, i) => (i === empty ? u : cell)));
        setBoard((bd) => bd.map((cell, i) => (i === boardIdx ? null : cell)));
    }, [board, bench]);

    const buyFromShop = useCallback((idx: number) => {
        if (!bench) return;
        const card = shop[idx];
        if (!card) return;
        const cost = card.cost;
        if (gold < cost) return;
        const empty = bench.findIndex((s) => s === null);
        let nextBench: (Unit | null)[];
        let nextBoard: (Unit | null)[];
        if (empty === -1) {
            // Bench full – allow:
            // (A) single-buy if it immediately increases star (with 1 virtual copy), or
            // (B) if not, but another same unit exists in the shop, try double-buy (2 virtual copies).
            const before = maxStarForKeyAcross(card.key, board, bench);
            // Try single-buy
            let sim = simulateBuyAndMerge(card, board, bench, 1);
            let after = maxStarForKeyAcross(card.key, sim.board, sim.bench);
            if (after > before) {
                nextBench = sim.bench;
                nextBoard = sim.board;
            } else {
                // Look for another same unit in current shop (excluding this index)
                const j = shop.findIndex((s, k) => k !== idx && s && s.key === card.key);
                if (j === -1) return; // cannot proceed; no merge path
                // Ensure we have enough gold for two copies
                if (gold < cost * 2) return;
                // Try double-buy using 2 virtual copies
                sim = simulateBuyAndMerge(card, board, bench, 2);
                after = maxStarForKeyAcross(card.key, sim.board, sim.bench);
                if (after <= before) return; // still cannot merge, abort
                nextBench = sim.bench;
                nextBoard = sim.board;

                // Apply both purchases atomically
                setGold(gold - cost * 2);
                const nextShopDouble = shop.map((c, k) => (k === idx || k === j ? null : c));
                setShop(nextShopDouble);
                setBoard(nextBoard);
                setBench(nextBench);
                return; // prevent single-buy finalizers below from running
            }
        } else {
            // Normal path: place on first empty bench slot then merge
            const tmpBench = bench.map((cell, i) => (i === empty ? { ...card, star: 1 } : cell));
            const merged = mergeAllUnits(board, tmpBench);
            nextBench = merged.bench;
            nextBoard = merged.board;
        }

        const newGold = gold - cost;
        const nextShop = shop.map((c, i) => (i === idx ? null : c));

        setGold(newGold);
        setShop(nextShop);
        setBoard(nextBoard);
        setBench(nextBench);
    }, [gold, shop, bench, board]);

    const sellAt = useCallback((where: 'bench' | 'board', idx: number) => {
        if (where === 'bench') {
            const u = bench[idx];
            if (!u) return;
            const sell = getSellGold(u);
            setGold((g) => g + sell);
            setBench((b) => b.map((cell, i) => (i === idx ? null : cell)));
        } else {
            const u = board[idx];
            if (!u) return;
            const sell = getSellGold(u);
            setGold((g) => g + sell);
            setBoard((bd) => bd.map((cell, i) => (i === idx ? null : cell)));
        }
    }, [bench, board]);

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
        board.forEach((u) => { if (u) s.add(u.key); });
        return s;
    }, [board]);

    // Precompute trait -> list of units (with cost), sorted by cost asc then name
    const traitUnitMap = useMemo(() => {
        const map = new Map<string, Array<{ key: string; name: string; img?: string; cost: number }>>();
        (Object.keys(ROSTER) as Array<keyof typeof ROSTER>).forEach((k) => {
            const cost = Number(k);
            ROSTER[cost].forEach((u) => {
                u.traits.forEach((t) => {
                    if (!map.has(t)) map.set(t, []);
                    map.get(t)!.push({ key: u.key, name: u.name, img: u.img, cost });
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
        const rows = traitCounts.map(([trait, cnt]) => ({ trait, cnt, tier: tierForTrait(trait, cnt) }));
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
    type DragSrc = { from: 'bench' | 'board'; index: number } | null;
    const [dragSrc, setDragSrc] = useState<DragSrc>(null);
    const [isDragging, setIsDragging] = useState(false);

    // ---- Hover state for W toggle ----
    type Hover = { over: 'bench' | 'board'; index: number } | null;
    const [hover, setHover] = useState<Hover>(null);

    // Hover state for trait tooltip
    const [hoveredTrait, setHoveredTrait] = useState<string | null>(null);
    const grayscaleIf = (cond: boolean) => (cond ? '' : 'grayscale opacity-60');

    const beginDragBench = (index: number) => (e: React.DragEvent) => {
        if (!bench[index]) return;
        setDragSrc({from: 'bench', index});
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
    };
    const beginDragBoard = (index: number) => (e: React.DragEvent) => {
        if (!board[index]) return;
        setDragSrc({from: 'board', index});
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
    };
    const endDrag = () => {
        setIsDragging(false);
        setDragSrc(null);
    };

    const allowDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // Moves
    const moveBenchToBoard = (bIdx: number, bdIdx: number) => {
        if (boardCount >= level) return; // respect level cap
        if (!bench[bIdx] || board[bdIdx]) return;
        const u = bench[bIdx]!;
        const nextBoard = board.map((cell, i) => (i === bdIdx ? normalizeStar(u) as Unit : cell));
        const nextBench = bench.map((cell, i) => (i === bIdx ? null : cell));
        const merged = mergeAllUnits(nextBoard, nextBench);
        setBoard(merged.board);
        setBench(merged.bench);
    };
    // moveBoardToBench is not used in drop logic, can be omitted or updated if needed

    const setBenchAt = (idx: number, u: Unit | null) => {
        setBench((prev) => prev.map((cell, i) => (i === idx ? u : cell)));
    };
    const clearBoardAt = (idx: number) => setBoard((bd) => bd.map((c, i) => (i === idx ? null : c)));
    const dropToBoard = (bdIdx: number) => {
        if (!dragSrc) return;
        const targetFilled = !!board[bdIdx];

        if (dragSrc.from === 'bench') {
            const u = bench[dragSrc.index];
            if (!u) return;
            if (!targetFilled) {
                if (boardCount >= level) { endDrag(); return; }
                // original path into empty board + merge
                moveBenchToBoard(dragSrc.index, bdIdx);
                endDrag();
                return;
            }
            // bench -> occupied board : swap without merging
            const nextBoard = board.map((cell, i) => (i === bdIdx ? (normalizeStar(u) as Unit) : cell));
            const nextBench = bench.map((cell, i) => (i === dragSrc.index ? board[bdIdx] : cell));
            setBoard(nextBoard);
            setBench(nextBench);
            endDrag();
            return;
        }

        if (dragSrc.from === 'board') {
            const u = board[dragSrc.index];
            if (!u) return;
            if (!targetFilled) {
                // original path board -> empty board + merge check
                const nextBoard = board.map((cell, i) => (i === bdIdx ? cell ?? u : i === dragSrc.index ? null : cell));
                const merged = mergeAllUnits(nextBoard, bench);
                setBoard(merged.board);
                setBench(merged.bench);
                endDrag();
                return;
            }
            // board -> occupied board : swap without merging
            const aIdx = dragSrc.index;
            const bIdx2 = bdIdx;
            const ua = board[aIdx]!;
            const ub = board[bIdx2]!;
            const nextBoard = board.map((cell, i) => (i === aIdx ? ub : i === bIdx2 ? ua : cell));
            setBoard(nextBoard);
            endDrag();
            return;
        }

        endDrag();
    };

    const dropToBench = (bIdx: number) => {
        if (!dragSrc) return;
        const targetFilled = !!bench[bIdx];

        if (dragSrc.from === 'board') {
            const u = board[dragSrc.index];
            if (!u) return;
            if (!targetFilled) {
                // original path: board -> empty bench then merge
                const nextBench = bench.map((cell, i) => (i === bIdx ? (normalizeStar(u) as Unit) : cell));
                const nextBoard = board.map((cell, i) => (i === dragSrc.index ? null : cell));
                const merged = mergeAllUnits(nextBoard, nextBench);
                setBench(merged.bench);
                setBoard(merged.board);
                endDrag();
                return;
            }
            // board -> occupied bench : swap, no merge
            const nextBench = bench.map((cell, i) => (i === bIdx ? (normalizeStar(u) as Unit) : cell));
            const nextBoard = board.map((cell, i) => (i === dragSrc.index ? bench[bIdx] : cell));
            setBench(nextBench);
            setBoard(nextBoard);
            endDrag();
            return;
        }

        if (dragSrc.from === 'bench') {
            const u = bench[dragSrc.index];
            if (!u) return;
            if (!targetFilled) {
                // move bench -> empty bench
                setBench((b) => b.map((cell, i) => (i === dragSrc.index ? null : i === bIdx ? u : cell)));
                endDrag();
                return;
            }
            // bench -> occupied bench : swap
            setBench((b) => b.map((cell, i) => (i === dragSrc.index ? b[bIdx] : i === bIdx ? u : cell)));
            endDrag();
            return;
        }

        endDrag();
    };

    const sellDragged = () => {
        if (!dragSrc) return;
        if (dragSrc.from === 'bench') {
            const u = bench[dragSrc.index];
            if (!u) return endDrag();
            setGold((g) => g + getSellGold(u));
            setBench((b) => b.map((cell, i) => (i === dragSrc.index ? null : cell)));
        } else if (dragSrc.from === 'board') {
            const u = board[dragSrc.index];
            if (!u) return endDrag();
            setGold((g) => g + getSellGold(u));
            clearBoardAt(dragSrc.index);
        }
        endDrag();
    };

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

    const getPromoStarBadge = useCallback((unit: Unit): 0 | 2 | 3 => {
        const {s1, s2, s3} = countByStarForKey(unit.key, board, bench);
        if (s3 > 0) return 0; // already 3★ owned – no badge
        // User rule: show 3★ if we currently have two 2★ and two 1★
        if (s2 >= 2 && s1 >= 2) return 3;
        // User rule: show 2★ if we currently have at least two 1★
        if (s1 >= 2) return 2;
        return 0;
    }, [board, bench]);

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
        <div className="w-full min-h-screen bg-slate-900 text-slate-100 flex items-end justify-center p-6">
            {/* Left Trait Panel (board-only) */}
            <div className="fixed left-4 top-24 z-40 w-44 select-none">
            {/* Right Wanted Panel */}
            <div className="fixed right-4 top-24 z-40 w-48 max-h-[70vh] overflow-auto select-none">
                <div className="text-xs mb-2 px-2 py-1 rounded-md bg-black/40 ring-1 ring-white/10 text-white/80">원하는 유닛</div>
                <div className="grid grid-cols-5 gap-1">
                    {allUnits.map((u) => (
                        <button
                            key={u.key}
                            type="button"
                            onClick={() => toggleWanted(u.key)}
                            className={clx(
                                "relative w-8 h-8 rounded overflow-hidden ring-1",
                                wanted.has(u.key) ? "ring-pink-400" : "ring-white/10 opacity-70"
                            )}
                            title={u.name}
                        >
                            <Image src={u.img ?? '/garen.jpg'} alt={u.name} fill className="object-cover" />
                            <div className="absolute bottom-0 right-0 text-[8px] px-0.5 bg-black/70">{u.cost}</div>
                            {wanted.has(u.key) && (
                                <div className="absolute inset-0 ring-2 ring-pink-400/70" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
                <div className="flex flex-col gap-1">
                    {traitCounts.length === 0 ? (
                        <div className="px-2 py-1 text-xs text-white/40"></div>
                    ) : (
                        sortedTraits.map(({ trait, cnt, tier }) => {
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
                                        <div className="shrink-0 w-5 h-5 rounded bg-black/50 ring-1 ring-white/10 grid place-items-center text-[10px] font-semibold">
                                            {leftBadge}
                                        </div>
                                        <span className="truncate">{trait}</span>
                                    </div>
                                    <div className="ml-2 flex items-center gap-1 shrink-0">
                                        {nums.map((x, i) => {
                                            const tierOfX = tierOfNumber(trait, x);
                                            const palette = tierOfX ? BP_TIER_CLASS[tierOfX] : { on: 'text-white/90', off: 'text-white/30' };
                                            const active = val >= x; // highlight if reached or exceeded
                                            return (
                                                <span key={i} className={clx('text-[10px] tabular-nums', active ? palette.on : palette.off)}>
                                                    {x}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {hoveredTrait === trait && (
                                        <div className="absolute left-full top-0 ml-2 z-50 w-44 rounded-md bg-black/80 ring-1 ring-white/15 p-2 shadow-xl backdrop-blur">
                                            <div className="text-[10px] text-white/60 mb-1">{trait}</div>
                                            <div className="grid grid-cols-5 gap-1">
                                                {(traitUnitMap.get(trait) ?? []).map((u) => (
                                                    <div key={u.key} className="relative w-8 h-8 rounded overflow-hidden ring-1 ring-white/10">
                                                        <Image
                                                            src={u.img ?? '/garen.jpg'}
                                                            alt={u.name}
                                                            fill
                                                            className={clx('object-cover', grayscaleIf(boardKeySet.has(u.key)))}
                                                        />
                                                        <div className="absolute bottom-0 right-0 text-[8px] px-0.5 bg-black/70">{u.cost}</div>
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
                <div className="mb-4 grid grid-cols-10 gap-2">
                    {new Array(BENCH_SIZE).fill(0).map((_, i) => (
                        <div
                            key={i}
                            className={clx(
                                "aspect-square rounded-xl ring-1 ring-white/10 bg-white/5 overflow-hidden relative",
                                bench[i] && COST_COLORS[bench[i]?.cost]
                            )}
                            onMouseEnter={() => setHover({over: 'bench', index: i})}
                            onMouseLeave={() => setHover((h) => (h && h.over === 'bench' && h.index === i ? null : h))}
                            onDragOver={allowDrop}
                            onDrop={() => dropToBench(i)}
                        >
                            {bench[i] ? (
                                <>
                                    <Image src={bench[i]!.img ?? ''} alt={bench[i]!.name} fill
                                           className="object-cover"/>
                                    <div className="absolute inset-0 bg-black/30"/>
                                    <div
                                        className="absolute top-1 right-1 z-20 px-1.5 py-0.5 text-[10px] rounded bg-black text-white ring-1 ring-white/10">
                                        {"★".repeat((bench[i]!.star ?? 1))}
                                    </div>
                                    <div
                                        className="absolute bottom-1 left-2 text-[11px] font-semibold truncate right-2">{bench[i]!.name}</div>
                                    <div draggable onDragStart={beginDragBench(i)} onDragEnd={endDrag}
                                         className="absolute inset-0"/>
                                </>
                            ) : (
                                <span
                                    className="absolute inset-0 flex items-center justify-center text-white/40 text-xs"></span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Reroll Bar */}
                <div
                    className="rounded-2xl bg-gradient-to-b from-slate-800/70 to-slate-900/80 ring-1 ring-white/10 p-4 shadow-2xl">
                    {/* Top controls */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="text-lg font-semibold">레벨 {level}</div>
                            <div className="w-56 h-3 bg-black/30 rounded-full overflow-hidden ring-1 ring-white/10">
                                <div
                                    className="h-full bg-teal-400"
                                    style={{width: `${xpReq ? Math.min(100, (xp / xpReq) * 100) : 100}%`}}
                                />
                            </div>
                            <div className="text-xs text-white/70">
                                {level < 10 ? (
                                    <span>
                    XP {xp}/{xpReq}
                  </span>
                                ) : (
                                    <span>최대 레벨</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {OddsBar}
                        </div>
                        <div className="flex items-center gap-3">
                            <div
                                className="px-3 py-1 rounded-md bg-black/40 ring-1 ring-white/10 text-yellow-300 font-bold">
                                골드 {coins(gold)}
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs opacity-80">Lv</label>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => nudgeLevel(-1)}
                                        className="px-2 py-1 rounded bg-black/40 ring-1 ring-white/10 text-xs disabled:opacity-40"
                                        disabled={level <= 1}
                                        title="레벨 내리기"
                                    >−</button>
                                    <div className="w-8 text-center text-xs select-none">{level}</div>
                                    <button
                                        type="button"
                                        onClick={() => nudgeLevel(1)}
                                        className="px-2 py-1 rounded bg-black/40 ring-1 ring-white/10 text-xs disabled:opacity-40"
                                        disabled={level >= 10}
                                        title="레벨 올리기"
                                    >+</button>
                                </div>
                                <label className="text-xs opacity-80">G</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={10000}
                                    value={gold}
                                    onChange={(e) => setGold(Math.min(10000, Math.max(0, Number(e.target.value) || 0)))}
                                    className="w-20 px-2 py-1 rounded bg-black/40 ring-1 ring-white/10 text-xs"
                                    title="골드 설정 (최대 10000)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions + Shop */}
                    <div className="flex gap-3">
                        <div className="grid grid-cols-6 gap-3 flex-1">
                            <div>
                                <button
                                    onClick={buyXP}
                                    disabled={!canBuyXP}
                                    className={clx(
                                        "h-15 w-full rounded-xs ring-1 ring-teal-400/50 bg-teal-600/20 hover:bg-teal-600/30 text-sm font-semibold mb-2",
                                        !canBuyXP && "opacity-40 cursor-not-allowed"
                                    )}
                                    title="F 키로 구매"
                                >
                                    XP 구매
                                </button>
                                <button
                                    onClick={reroll}
                                    disabled={!canReroll}
                                    className={clx(
                                        "h-15 w-full rounded-xs ring-1 ring-indigo-400/50 bg-indigo-600/20 hover:bg-indigo-600/30 text-sm font-semibold",
                                        !canReroll && "opacity-40 cursor-not-allowed"
                                    )}
                                    title="D 키로 리롤"
                                >
                                    새로고침
                                </button>
                            </div>
                            {shop.map((c, i) => (
                                <div
                                    key={i}
                                    className={clx(
                                        "relative h-32 rounded-xs ring-2 bg-white/5 overflow-hidden p-0 flex flex-col",
                                        c ? COST_COLORS[c.cost] : "ring-white/10",
                                        c && gold >= c.cost ? "cursor-pointer hover:ring-white/40" : "cursor-default",
                                        c && ownedKeys.has(c.key) && false
                                    )}
                                    onClick={() => {
                                        if (c && gold >= c.cost) buyFromShop(i);
                                    }}
                                >
                                    {c && ownedKeys.has(c.key) && (
                                        <div
                                            className="pointer-events-none absolute inset-0 rounded-xs bright-pulse z-30">
                                            <div className="absolute inset-0 bg-white/22"/>
                                            <div
                                                className="absolute inset-0 ring-2 ring-yellow-300/70 shadow-[0_0_12px_rgba(234,179,8,0.65)] rounded-xs"/>
                                        </div>
                                    )}
                                    {c ? (
                                        <>
                                            {(() => {
                                                const promo = getPromoStarBadge(c as Unit);
                                                return (
                                                    promo ? (
                                                        <div
                                                            className="absolute top-1 right-1 z-40 px-1.5 py-0.5 text-[10px] rounded bg-amber-500 text-black ring-1 ring-white/20">
                                                            {promo === 2 ? '★★' : '★★★'}
                                                        </div>
                                                    ) : null
                                                );
                                            })()}
                                            {/* Wanted badge (top-left) */}
                                            {wanted.has((c as Unit).key) && (
                                                <div className="absolute top-1 left-1 z-40 px-1.5 py-0.5 text-[10px] rounded bg-pink-500 text-black ring-1 ring-white/20">
                                                    원하는
                                                </div>
                                            )}
                                            <div className="relative flex-1">
                                                <Image src={c.img ?? '/garen.jpg'} alt={c.name} fill
                                                       className="object-cover"/>
                                                <div className="absolute inset-0 bg-black/30"/>
                                                {/* Traits overlay on image (top-left) */}
                                                <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1">
                                                    {c.traits.map((t) => (
                                                        <span key={t}
                                                              className="text-[12px] leading-none px-2 py-1 text-white ring-1 ring-white/20 rounded-xs">
                                                  {t}
                                                </span>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Bottom bar: cost-colored, name left / cost right */}
                                            <div
                                                className={clx("h-8 px-3 flex items-center justify-between text-sm font-semibold text-white", COST_BG[c.cost])}>
                                                <span className="truncate pr-2">{c.name}</span>
                                                <span className="flex items-center gap-1"><span
                                                    className="opacity-90">G</span>{c.cost}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div
                                            className="h-full w-full flex items-center justify-center text-white/40 text-sm">
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
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
            <style jsx>{`
                @keyframes brightPulse {
                    0% {
                        opacity: 0;
                    }
                    50% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 0;
                    }
                }

                .bright-pulse {
                    animation: brightPulse 1.2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
