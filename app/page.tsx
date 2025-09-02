'use client';
import React, {useCallback, useEffect, useMemo, useState} from "react";
import Image from 'next/image';
import type {Unit} from "./lib/types";
import {
    XP_REQ, ODDS, COST_COLORS, COST_TEXT, COST_BG, STORAGE_KEY, BENCH_SIZE
} from "./lib/constants";
import {
    clx, coins, makeShop, normalizeStar, mergeAllUnits, maxStarForKeyAcross,
    simulateBuyAndMerge, getSellGold, countByStarForKey
} from "./lib/utils";

export default function TFTShop() {
    const [gold, setGold] = useState(999);
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
                setGold(s.gold ?? 50);
                setLevel(s.level ?? 5);
                setXp(s.xp ?? 0);
                // normalize bench first so we can compute a pool-aware shop
                const benchArr: (Unit | null)[] = Array.from({ length: BENCH_SIZE }, (_, i) =>
                  s.bench && s.bench[i] ? { ...s.bench[i], star: s.bench[i].star ?? 1 } : null
                );
                setBench(benchArr);
                setLocked(!!s.locked);
                // use the current board state (initially empty) and benchArr to rebuild shop if none saved
                setShop(s.shop ?? makeShop(s.level ?? 5, board, benchArr));
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
    const xpReq = XP_REQ[level] ?? 0;
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
            // Bench full – only proceed if buying this card immediately increases its star level via merge
            const before = maxStarForKeyAcross(card.key, board, bench);
            const sim = simulateBuyAndMerge(card, board, bench);
            const after = maxStarForKeyAcross(card.key, sim.board, sim.bench);
            const canMergeNow = after > before; // 1★->2★ or 2★->3★
            if (!canMergeNow) return;
            nextBench = sim.bench;
            nextBoard = sim.board;
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

    // ---- Drag & Drop state ----
    type DragSrc = { from: 'bench' | 'board'; index: number } | null;
    const [dragSrc, setDragSrc] = useState<DragSrc>(null);
    const [isDragging, setIsDragging] = useState(false);

    // ---- Hover state for W toggle ----
    type Hover = { over: 'bench' | 'board'; index: number } | null;
    const [hover, setHover] = useState<Hover>(null);

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
        if (board[bdIdx]) return; // only empty target
        if (dragSrc.from === 'bench') {
            if (boardCount >= level) {
                endDrag();
                return;
            }
            moveBenchToBoard(dragSrc.index, bdIdx);
        }
        if (dragSrc.from === 'board') {
            const u = board[dragSrc.index];
            if (!u) return;
            const nextBoard = board.map((cell, i) => (i === bdIdx ? cell ?? u : i === dragSrc.index ? null : cell));
            const merged = mergeAllUnits(nextBoard, bench);
            setBoard(merged.board);
            setBench(merged.bench);
            endDrag();
            return;
        }
        endDrag();
    };

    const dropToBench = (bIdx: number) => {
        if (!dragSrc) return;
        if (bench[bIdx]) return; // only drop to empty bench slot
        if (dragSrc.from === 'board') {
            const u = board[dragSrc.index];
            if (!u) return;
            const nextBench = bench.map((cell, i) => (i === bIdx ? normalizeStar(u) as Unit : cell));
            const nextBoard = board.map((cell, i) => (i === dragSrc.index ? null : cell));
            const merged = mergeAllUnits(nextBoard, nextBench);
            setBench(merged.bench);
            setBoard(merged.board);
            endDrag();
            return;
        }
        if (dragSrc.from === 'bench') {
            const u = bench[dragSrc.index];
            if (!u) return;
            setBench((b) => b.map((cell, i) => (i === dragSrc.index ? null : i === bIdx ? u : cell)));
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
