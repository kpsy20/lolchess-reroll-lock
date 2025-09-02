'use client';
import React, {useCallback, useEffect, useMemo, useState} from "react";
import Image from 'next/image';

type BaseUnit = {
    key: string;
    name: string;
    traits: string[];
    color: string;
    img?: string;
};

type Unit = BaseUnit & {
    cost: number;
    star: number; // 1성, 2성, 3성
};

// ---- Helpers ----
const clx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");
const coins = (n: number) => n.toLocaleString();

// XP needed per level (roughly TFT-like but simplified)
const XP_REQ = {3: 6, 4: 10, 5: 20, 6: 36, 7: 48, 8: 76, 9: 84, 10: 0};

// Shop odds by level (sum to 100)
const ODDS: Record<number, number[]> = {
    1: [100, 0, 0, 0, 0],
    2: [100, 0, 0, 0, 0],
    3: [75, 25, 0, 0, 0],
    4: [55, 30, 15, 0, 0],
    5: [45, 33, 20, 2, 0],
    6: [30, 40, 25, 5, 0],
    7: [19, 30, 40, 10, 1],
    8: [17, 24, 32, 24, 3],
    9: [15, 18, 25, 30, 12],
    10: [5, 10, 20, 40, 25],
};

// Minimal roster – replace/expand freely
const ROSTER: Record<number, BaseUnit[]> = {
    1: [
        {key: "Syndra", name: "신드라", traits: ["수정 갬빗", "별수호자", "신동"], color: "bg-emerald-500", img: "/syndra.jpg"},
        {key: "Rell", name: "렐", traits: ["별수호자", "요새"], color: "bg-emerald-500", img: "/rell.jpg"},
        {key: "Gnar", name: "나르", traits: ["프로레슬러", "저격수"], color: "bg-emerald-500", img: "/gnar.jpg"},
        {key: "Sivir", name: "시비르", traits: ["크루", "저격수"], color: "bg-emerald-500", img: "/sivir.jpg"},
        {key: "Kennen", name: "케넨", traits: ["슈프림 셀", "봉쇄자", "마법사"], color: "bg-emerald-500", img: "/kennen.jpg"},
        {key: "Malphite", name: "말파이트", traits: ["크루", "봉쇄자"], color: "bg-emerald-500", img: "/malphite.jpg"},
        {key: "Aatrox", name: "아트록스", traits: ["거대 메크", "전쟁기계", "헤비급"], color: "bg-emerald-500", img: "/aatrox.jpg"},
        {key: "Ezreal", name: "이즈리얼", traits: ["전투사관학교", "신동"], color: "bg-emerald-500", img: "/ezreal.jpg"},
        {key: "Garen", name: "가렌", traits: ["전투사관학교", "요새"], color: "bg-emerald-500", img: "/garen.jpg"},
        {key: "Kayle", name: "케일", traits: ["악령", "격투가"], color: "bg-emerald-500", img: "/kayle.jpg"},
        {key: "Naafiri", name: "나피리", traits: ["소울 파이터", "전쟁기계"], color: "bg-emerald-500", img: "/naafiri.jpg"},
        {key: "Zac", name: "자크", traits: ["악령", "헤비급"], color: "bg-emerald-500", img: "/zac.jpg"},
        {key: "Lucian", name: "루시안", traits: ["거대 메크", "마법사"], color: "bg-emerald-500", img: "/lucian.jpg"},
        {key: "Kalista", name: "칼리스타", traits: ["소울 파이터", "처형자"], color: "bg-emerald-500", img: "/kalista.jpg"},
    ],
    2: [
        {key: "Kobuko", name: "코부코", traits: ["멘토", "헤비급"], color: "bg-sky-500", img: "/kobuko.jpg"},
        {key: "Janna", name: "잔나", traits: ["수정 갬빗", "봉쇄자", "책략가"], color: "bg-sky-500", img: "/janna.jpg"},
        {key: "Xayah", name: "자야", traits: ["별 수호자", "이단아"], color: "bg-sky-500", img: "/xayah.jpg"},
        {key: "Vi", name: "바이", traits: ["수정 갬빗", "전쟁기계"], color: "bg-sky-500", img: "/vi.jpg"},
        {key: "Rakan", name: "라칸", traits: ["전투사관학교", "봉쇄자"], color: "bg-sky-500", img: "/rakan.jpg"},
        {key: "Jhin", name: "진", traits: ["악령", "저격수"], color: "bg-sky-500", img: "/jhin.jpg"},
        {key: "KaiSa", name: "카이사", traits: ["슈프림 셀", "격투가"], color: "bg-sky-500", img: "/kaisa.jpg"},
        {key: "Gangplank", name: "갱플랭크", traits: ["거대 메크", "격투가"], color: "bg-sky-500", img: "/gangplank.jpg"},
        {key: "Shen", name: "쉔", traits: ["크루", "요새", "이단아"], color: "bg-sky-500", img: "/shen.jpg"},
        {key: "Lux", name: "럭스", traits: ["소울 파이터", "마법사"], color: "bg-sky-500", img: "/lux.jpg"},
        {key: "DrMundo", name: "문도 박사", traits: ["프로레슬러", "전쟁기계"], color: "bg-sky-500", img: "/drmundo.jpg"},
        {key: "XinZhao", name: "신 짜오", traits: ["소울 파이터", "요새"], color: "bg-sky-500", img: "/xinzhao.jpg"},
        {key: "Katarina", name: "카타리나", traits: ["전투사관학교", "암살자"], color: "bg-sky-500", img: "/katarina.jpg"},
    ],
    3: [
        {key: "Neeko", name: "니코", traits: ["별 수호자", "봉쇄자"], color: "bg-violet-500", img: "/neeko.jpg"},
        {key: "Ahri", name: "아리", traits: ["별 수호자", "마법사"], color: "bg-violet-500", img: "/ahri.jpg"},
        {key: "Senna", name: "세나", traits: ["거대 메크", "처형자"], color: "bg-violet-500", img: "/senna.jpg"},
        {key: "Udyr", name: "우디르", traits: ["멘토", "전쟁기계", "격투가"], color: "bg-violet-500", img: "/udyr.jpg"},
        {key: "Swain", name: "스웨인", traits: ["수정 갬빗", "요새", "마법사"], color: "bg-violet-500", img: "/swain.jpg"},
        {key: "Yasuo", name: "야스오", traits: ["멘토", "이단아"], color: "bg-violet-500", img: "/yasuo.jpg"},
        {key: "Ziggs", name: "직스", traits: ["크루", "책략가"], color: "bg-violet-500", img: "/ziggs.jpg"},
        {key: "Malzahar", name: "말자하", traits: ["악령", "신동"], color: "bg-violet-500", img: "/malzahar.jpg"},
        {key: "Darius", name: "다리우스", traits: ["슈프림 셀", "헤비급"], color: "bg-violet-500", img: "/darius.jpg"},
        {key: "Viego", name: "비에고", traits: ["소울 파이터", "격투가"], color: "bg-violet-500", img: "/viego.jpg"},
        {key: "Caitlyn", name: "케이틀린", traits: ["전투사관학교", "저격수"], color: "bg-violet-500", img: "/caitlyn.jpg"},
        {key: "Jayce", name: "제이스", traits: ["전투사관학교", "헤비급"], color: "bg-violet-500", img: "/jayce.jpg"},
        {key: "Lulu", name: "룰루", traits: ["괴물 트레이너"], color: "bg-violet-500", img: "/lulu.jpg"},
    ],
    4: [
        {key: "JarvanIV", name: "자르반 4세", traits: ["거대 메크", "책략가"], color: "bg-amber-500", img: "/jarvaniv.jpg"},
        {key: "Ryze", name: "라이즈", traits: ["멘토", "처형자", "책략가"], color: "bg-amber-500", img: "/ryze.jpg"},
        {key: "Jinx", name: "징크스", traits: ["별 수호자", "저격수"], color: "bg-amber-500", img: "/jinx.jpg"},
        {key: "KSante", name: "크산테", traits: ["악령", "봉쇄자"], color: "bg-amber-500", img: "/ksante.jpg"},
        {key: "Akali", name: "아칼리", traits: ["슈프림 셀", "처형자"], color: "bg-amber-500", img: "/akali.jpg"},
        {key: "Poppy", name: "뽀삐", traits: ["별 수호자", "헤비급"], color: "bg-amber-500", img: "/poppy.jpg"},
        {key: "Ashe", name: "애쉬", traits: ["수정 갬빗", "격투가"], color: "bg-amber-500", img: "/ashe.jpg"},
        {key: "Yuumi", name: "유미", traits: ["전투사관학교", "신동"], color: "bg-amber-500", img: "/yuumi.jpg"},
        {key: "Leona", name: "레오나", traits: ["전투사관학교", "요새"], color: "bg-amber-500", img: "/leona.jpg"},
        {key: "Sett", name: "세트", traits: ["소울 파이터", "전쟁기계"], color: "bg-amber-500", img: "/sett.jpg"},
        {key: "Volibear", name: "볼리베어", traits: ["프로레슬러", "이단아"], color: "bg-amber-500", img: "/volibear.jpg"},
        {key: "Karma", name: "카르마", traits: ["거대 메크", "마법사"], color: "bg-amber-500", img: "/karma.jpg"},
        {key: "Samira", name: "사미라", traits: ["소울 파이터", "이단아"], color: "bg-amber-500", img: "/samira.jpg"},
    ],
    5: [
        {key: "Zyra", name: "자이라", traits: ["수정 갬빗", "장미 어머니"], color: "bg-yellow-400", img: "/zyra.jpg"},
        {
            key: "TwistedFate",
            name: "트위스티드 페이트",
            traits: ["해적선장", "크루"],
            color: "bg-yellow-400",
            img: "/twistedfate.jpg"
        },
        {key: "Braum", name: "브라움", traits: ["레슬링 챔피언", "프로레슬러", "요새"], color: "bg-yellow-400", img: "/braum.jpg"},
        {key: "LeeSin", name: "리 신", traits: ["텐색의 대가"], color: "bg-yellow-400", img: "/leesin.jpg"},
        {key: "Varus", name: "바루스", traits: ["악령", "저격수"], color: "bg-yellow-400", img: "/varus.jpg"},
        {key: "Seraphine", name: "세라핀", traits: ["별 수호자", "신동"], color: "bg-yellow-400", img: "/seraphine.jpg"},
        {key: "Yone", name: "요네", traits: ["거대 메크", "이단아"], color: "bg-yellow-400", img: "/yone.jpg"},
        {key: "Gwen", name: "그웬", traits: ["소울 파이터", "마법사"], color: "bg-yellow-400", img: "/gwen.jpg"},
    ],
};

const COST_COLORS: Record<number, string> = {
    1: "ring-gray-400",   // 1-cost: gray
    2: "ring-lime-400",   // 2-cost: light green
    3: "ring-blue-400",   // 3-cost: blue
    4: "ring-purple-400", // 4-cost: purple
    5: "ring-orange-400", // 5-cost: orange
};

const COST_TEXT: Record<number, string> = {
    1: "text-gray-400",
    2: "text-lime-400",
    3: "text-blue-400",
    4: "text-purple-400",
    5: "text-orange-400",
};

const COST_BG: Record<number, string> = {
    1: "bg-gray-600",
    2: "bg-lime-600",
    3: "bg-blue-600",
    4: "bg-purple-600",
    5: "bg-orange-600",
};

const STORAGE_KEY = "tft-reroll-bar-v1";
const BENCH_SIZE = 10;

function pickWeighted(odds: number[]): number {
    const r = Math.random() * 100;
    let acc = 0;
    for (let i = 0; i < odds.length; i++) {
        acc += odds[i];
        if (r < acc) return i + 1; // cost tier 1..5
    }
    return 5;
}

function randomUnit(cost: number): BaseUnit {
    const pool = ROSTER[cost];
    return pool[Math.floor(Math.random() * pool.length)];
}

function makeShop(level: number): (Unit | null)[] {
    const odds = ODDS[level] || ODDS[3];
    return new Array(5).fill(0).map(() => {
        const cost = pickWeighted(odds);
        return {...randomUnit(cost), cost, star: 1};
    });
}

function normalizeStar(u: Unit | null): Unit | null {
    if (!u) return u;
    return {...u, star: u.star ?? 1} as Unit;
}

function cloneUnits(arr: (Unit | null)[]): (Unit | null)[] {
    return arr.map((u) => (u ? {...u} : null));
}

// --- Merge prediction helpers ---
function maxStarForKeyAcross(key: string, board: (Unit | null)[], bench: (Unit | null)[]) {
    let m = 0;
    for (const u of board) if (u && u.key === key) m = Math.max(m, u.star ?? 1);
    for (const u of bench) if (u && u.key === key) m = Math.max(m, u.star ?? 1);
    return m;
}

function countByStarForKey(key: string, board: (Unit | null)[], bench: (Unit | null)[]) {
    let s1 = 0, s2 = 0, s3 = 0;
    for (const u of board) if (u && u.key === key) {
        const st = u.star ?? 1; if (st === 1) s1++; else if (st === 2) s2++; else if (st >= 3) s3++;
    }
    for (const u of bench) if (u && u.key === key) {
        const st = u.star ?? 1; if (st === 1) s1++; else if (st === 2) s2++; else if (st >= 3) s3++;
    }
    return { s1, s2, s3 };
}

function simulateBuyAndMerge(target: BaseUnit, board: (Unit | null)[], bench: (Unit | null)[]) {
    // Always simulate by adding one 1★ copy, even if bench is full.
    const added: Unit = { ...(target as Unit), cost: (target as any).cost ?? 1, star: 1 } as Unit;
    let nextBench: (Unit | null)[];
    const empty = bench.findIndex((s) => s === null);
    if (empty !== -1) {
        nextBench = bench.map((cell, i) => (i === empty ? added : cell));
    } else {
        // append a virtual slot to allow immediate merge; we'll normalize length after merge
        nextBench = [...bench, added];
    }
    const merged = mergeAllUnits(board, nextBench);
    // normalize bench length back to BENCH_SIZE by packing non-nulls left then padding with nulls
    const packed = merged.bench.filter(Boolean) as Unit[];
    const normalizedBench: (Unit | null)[] = [...packed.slice(0, BENCH_SIZE), ...Array(Math.max(0, BENCH_SIZE - packed.length)).fill(null)];
    return { board: merged.board, bench: normalizedBench };
}

function getSellGold(u: Unit): number {
    const star = u.star ?? 1;
    if (u.cost === 1) {
        // 1-cost: 1★=1, 2★=3, 3★=9
        if (star === 1) return 1;
        if (star === 2) return 3;
        return 9; // star 3
    }
    // 2~5 cost: sell = (cost * multiplier) - 1, where multiplier = 1,3,9 by star
    const mult = star === 1 ? 1 : star === 2 ? 3 : 9;
    return (u.cost * mult) - 1;
}

function mergeAllUnits(boardArr: (Unit | null)[], benchArr: (Unit | null)[]) {
    const board = cloneUnits(boardArr).map(normalizeStar);
    const bench = cloneUnits(benchArr).map(normalizeStar);

    // helper to get indices for a given key and star
    const indicesBy = (arr: (Unit | null)[], key: string, star: number) =>
        arr.map((u, i) => (u && u.key === key && (u.star ?? 1) === star ? i : -1)).filter((i) => i !== -1);

    // Merge pass for a given star: 1★→2★, then 2★→3★
    const mergeStar = (star: number) => {
        // collect all candidate keys at this star present on board or bench
        const keys = new Set<string>();
        for (const u of board) if (u && (u.star ?? 1) === star) keys.add(u.key);
        for (const u of bench) if (u && (u.star ?? 1) === star) keys.add(u.key);

        keys.forEach((key) => {
            while (true) {
                // fresh indices each loop so we account for previous edits
                let bIdxs = indicesBy(board, key, star);
                let tIdxs = indicesBy(bench, key, star);
                const total = bIdxs.length + tIdxs.length;
                if (total < 3) break;

                // number of promotions available right now
                const promos = Math.floor(total / 3);
                // do exactly one promotion per loop iteration

                // choose target: prefer board lowest index; otherwise bench lowest index
                let targetFrom: 'board' | 'bench';
                let targetIdx: number;
                if (bIdxs.length > 0) {
                    targetFrom = 'board';
                    targetIdx = bIdxs[0];
                    // remove chosen from list
                    bIdxs = bIdxs.slice(1);
                } else {
                    targetFrom = 'bench';
                    targetIdx = tIdxs[0];
                    tIdxs = tIdxs.slice(1);
                }

                // pick two to remove: prefer bench (leftmost), then board (leftmost)
                const toRemove: Array<{ from: 'board' | 'bench'; idx: number }> = [];
                while (toRemove.length < 2 && tIdxs.length > 0) toRemove.push({from: 'bench', idx: tIdxs.shift()!});
                while (toRemove.length < 2 && bIdxs.length > 0) toRemove.push({from: 'board', idx: bIdxs.shift()!});
                if (toRemove.length < 2) break; // safety

                // apply removals
                for (const r of toRemove) {
                    if (r.from === 'bench') bench[r.idx] = null; else board[r.idx] = null;
                }

                // apply promotion
                if (targetFrom === 'board') {
                    const u = board[targetIdx];
                    if (u) board[targetIdx] = {...u, star: (u.star ?? 1) + 1};
                } else {
                    const u = bench[targetIdx];
                    if (u) bench[targetIdx] = {...u, star: (u.star ?? 1) + 1};
                }

                // continue loop to see if another set of 3 exists
                // (since we only did one promotion this iteration)
            }
        });
    };

    mergeStar(1);
    mergeStar(2);

    return {board, bench};
}

export default function TFTShop() {
    const [gold, setGold] = useState(999);
    const [level, setLevel] = useState(3);
    const [xp, setXp] = useState(0);
    const [shop, setShop] = useState<(Unit | null)[]>(() => makeShop(3));
    const [locked, setLocked] = useState(false);
    const [bench, setBench] = useState<(Unit | null)[]>(Array.from({length: BENCH_SIZE}, () => null)); // 10 fixed slots

    // Load/Save
    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                const s = JSON.parse(raw);
                setGold(s.gold ?? 50);
                setLevel(s.level ?? 5);
                setXp(s.xp ?? 0);
                setShop(s.shop ?? makeShop(5));
                setLocked(!!s.locked);
                setBench(
                    Array.from({length: BENCH_SIZE}, (_, i) =>
                        s.bench && s.bench[i] ? {...s.bench[i], star: s.bench[i].star ?? 1} : null
                    )
                );
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
        setShop(makeShop(level));
    }, [canReroll, locked, level]);

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


    // Board: simple 4x7 grid (28 slots)
    const BOARD_ROWS = 4;
    const BOARD_COLS = 7;
    const BOARD_SIZE = BOARD_ROWS * BOARD_COLS;
    const [board, setBoard] = useState<(Unit | null)[]>(Array.from({length: BOARD_SIZE}, () => null));

    const boardCount = board.reduce((acc, x) => acc + (x ? 1 : 0), 0);

    const firstEmptyBoardIndex = () => board.findIndex((x) => x === null);

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
        const benchFull = bench.every((s) => s !== null);
        const card = shop[idx];
        if (!card) return;
        const cost = card.cost;
        if (gold < cost) return;
        const empty = bench.findIndex((s) => s === null);
        let nextBench: (Unit | null)[];
        let nextBoard: (Unit | null)[];
        if (empty === -1) {
            // bench full – allow buy only if it leads to an immediate merge
            const before = maxStarForKeyAcross(card.key, board, bench);
            const sim = simulateBuyAndMerge(card, board, bench);
            const after = maxStarForKeyAcross(card.key, sim.board, sim.bench);
            if (after <= before) return; // cannot merge, so don't buy
            nextBench = sim.bench;
            nextBoard = sim.board;
        } else {
            // normal path: place to first empty bench then merge
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

    const sellFromBench = useCallback((idx: number) => {
        const u = bench[idx];
        if (!u) return;
        const sell = getSellGold(u);
        setGold((g) => g + sell);
        setBench((b) => b.map((cell, i) => (i === idx ? null : cell)));
    }, [bench]);

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
        bench.forEach((u) => { if (u) s.add(u.key); });
        board.forEach((u) => { if (u) s.add(u.key); });
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
        const { s1, s2, s3 } = countByStarForKey(unit.key, board, bench);
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
                                        c && gold >= c.cost && !benchIsFull ? "cursor-pointer hover:ring-white/40" : "cursor-default",
                                        c && ownedKeys.has(c.key) && false
                                    )}
                                    onClick={() => {
                                        if (c && gold >= c.cost && !benchIsFull) buyFromShop(i);
                                    }}
                                >
                                    {c && ownedKeys.has(c.key) && (
                                        <div className="pointer-events-none absolute inset-0 rounded-xs bright-pulse z-30">
                                            <div className="absolute inset-0 bg-white/22" />
                                            <div className="absolute inset-0 ring-2 ring-yellow-300/70 shadow-[0_0_12px_rgba(234,179,8,0.65)] rounded-xs" />
                                        </div>
                                    )}
                                    {c ? (
                                        <>
                                            {(() => { const promo = getPromoStarBadge(c as Unit); return (
                                                promo ? (
                                                    <div className="absolute top-1 right-1 z-40 px-1.5 py-0.5 text-[10px] rounded bg-amber-500 text-black ring-1 ring-white/20">
                                                        {promo === 2 ? '★★' : '★★★'}
                                                    </div>
                                                ) : null
                                            ); })()}
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
  0% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 0; }
}
.bright-pulse { animation: brightPulse 1.2s ease-in-out infinite; }
`}</style>
        </div>
    );
}
