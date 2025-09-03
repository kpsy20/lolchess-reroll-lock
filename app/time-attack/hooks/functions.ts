// app/time-attack/functions.ts
'use client';
import type {Unit} from '../../lib/types';
import {BENCH_SIZE, ROSTER} from '../../lib/constants';
import {
    normalizeStar,
    mergeAllUnits,
    makeShop,
    getSellGold,
    simulateBuyAndMerge,
    countByStarForKey,
    maxStarForKeyAcross,
} from '../../lib/utils';

export type DragSrc = { from: 'bench' | 'board'; index: number } | null;

export type HandlerDeps = {
    gold: number;
    setGold: React.Dispatch<React.SetStateAction<number>>;
    level: number;
    setLevel: React.Dispatch<React.SetStateAction<number>>;
    xp: number;
    setXp: React.Dispatch<React.SetStateAction<number>>;
    shop: (Unit | null)[];
    setShop: React.Dispatch<React.SetStateAction<(Unit | null)[]>>;
    locked: boolean;
    bench: (Unit | null)[];
    setBench: React.Dispatch<React.SetStateAction<(Unit | null)[]>>;
    board: (Unit | null)[];
    setBoard: React.Dispatch<React.SetStateAction<(Unit | null)[]>>;
    dragSrc: DragSrc;
    setDragSrc: React.Dispatch<React.SetStateAction<DragSrc>>;
    setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
    spent: number;
    setSpent: React.Dispatch<React.SetStateAction<number>>;
    // overlap/pool
    overlapMode?: 'none' | 'with';
    wanted?: Set<string>;
    pool?: Map<string, number>;
    setPool?: React.Dispatch<React.SetStateAction<Map<string, number>>>;
    playAudio: (ref: React.RefObject<HTMLAudioElement | null>, vol?: number) => void;
    refs: {
        moveAudioRef: React.RefObject<HTMLAudioElement | null>;
        buyAudioRef: React.RefObject<HTMLAudioElement | null>;
        sellAudioRef: React.RefObject<HTMLAudioElement | null>;
        rerollAudioRef: React.RefObject<HTMLAudioElement | null>;
        twoStarAudioRef: React.RefObject<HTMLAudioElement | null>;
        threeStarAudioRef: React.RefObject<HTMLAudioElement | null>;
        xpAudioRef: React.RefObject<HTMLAudioElement | null>;
    };
};

export function createHandlers(deps: HandlerDeps) {
    const {
        gold, setGold,
        level, setLevel,
        xp, setXp,
        shop, setShop,
        locked,
        bench, setBench,
        board, setBoard,
        dragSrc, setDragSrc, setIsDragging,
        spent, setSpent,
        // overlap/pool
        overlapMode = 'none',
        wanted = new Set<string>(),
        pool = new Map<string, number>(),
        setPool,
        playAudio,
        refs: {moveAudioRef, buyAudioRef, sellAudioRef, rerollAudioRef, twoStarAudioRef, threeStarAudioRef, xpAudioRef},
    } = deps;

    const boardCount = board.reduce((acc, x) => acc + (x ? 1 : 0), 0);
    const firstEmptyBoardIndex = () => board.findIndex((x) => x === null);

    const canReroll = true; // time-attack: 금액 제한 없음(locked만 확인)
    const canBuyXP = level < 10;


    const reroll = () => {
        if (!canReroll || locked) return;
        setSpent((s) => s + 2);
        setShop(makeShop(level, board, bench, pool));
        playAudio(rerollAudioRef);
    };

    const buyXP = () => {
        if (!canBuyXP) return;
        setSpent((s) => s + 4);
        setXp((v) => v + 4);
        playAudio(xpAudioRef);
    };

    const nudgeLevel = (delta: number) => {
        setLevel((prev) => {
            const next = Math.max(1, Math.min(10, prev + delta));
            if (next !== prev) setXp(0);
            return next;
        });
    };

    const addGold = (amt: number) => {
        setGold((g) => Math.min(10000, Math.max(0, g + amt)));
    };

    const placeFromBench = (benchIdx: number) => {
        if (boardCount >= level) return;
        const idx = firstEmptyBoardIndex();
        if (idx === -1) return;
        const u = bench[benchIdx];
        if (!u) return;
        const nextBoard = board.map((cell, i) => (i === idx ? (normalizeStar(u) as Unit) : cell));
        const nextBench = bench.map((cell, i) => (i === benchIdx ? null : cell));
        const merged = mergeAllUnits(nextBoard, nextBench);
        setBoard(merged.board);
        setBench(merged.bench);
        playAudio(moveAudioRef);
    };

    const returnToBench = (boardIdx: number) => {
        const u = board[boardIdx];
        if (!u) return;
        const empty = bench.findIndex((s) => s === null);
        if (empty === -1) return;
        setBench((b) => b.map((cell, i) => (i === empty ? u : cell)));
        setBoard((bd) => bd.map((cell, i) => (i === boardIdx ? null : cell)));
        playAudio(moveAudioRef);
    };

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

    const moveBenchToBoard = (bIdx: number, bdIdx: number) => {
        if (boardCount >= level) return;
        if (!bench[bIdx] || board[bdIdx]) return;
        const u = bench[bIdx]!;
        const nextBoard = board.map((cell, i) => (i === bdIdx ? (normalizeStar(u) as Unit) : cell));
        const nextBench = bench.map((cell, i) => (i === bIdx ? null : cell));
        const merged = mergeAllUnits(nextBoard, nextBench);
        setBoard(merged.board);
        setBench(merged.bench);
        playAudio(moveAudioRef);
    };

    const dropToBoard = (bdIdx: number) => {
        if (!dragSrc) return;
        const targetFilled = !!board[bdIdx];

        if (dragSrc.from === 'bench') {
            const u = bench[dragSrc.index];
            if (!u) return;
            if (!targetFilled) {
                if (boardCount >= level) {
                    endDrag();
                    return;
                }
                moveBenchToBoard(dragSrc.index, bdIdx);
                endDrag();
                return;
            }
            // swap without merging
            const nextBoard = board.map((cell, i) => (i === bdIdx ? (normalizeStar(u) as Unit) : cell));
            const nextBench = bench.map((cell, i) => (i === dragSrc.index ? board[bdIdx] : cell));
            setBoard(nextBoard);
            setBench(nextBench);
            endDrag();
            playAudio(moveAudioRef);
            return;
        }

        if (dragSrc.from === 'board') {
            const u = board[dragSrc.index];
            if (!u) return;
            if (!targetFilled) {
                const nextBoard = board.map((cell, i) => (i === bdIdx ? cell ?? u : i === dragSrc.index ? null : cell));
                const merged = mergeAllUnits(nextBoard, bench);
                setBoard(merged.board);
                setBench(merged.bench);
                endDrag();
                playAudio(moveAudioRef);
                return;
            }
            // swap without merging
            const aIdx = dragSrc.index;
            const bIdx2 = bdIdx;
            const ua = board[aIdx]!;
            const ub = board[bIdx2]!;
            const nextBoard = board.map((cell, i) => (i === aIdx ? ub : i === bIdx2 ? ua : cell));
            setBoard(nextBoard);
            endDrag();
            playAudio(moveAudioRef);
            return;
        }

        endDrag();
        playAudio(moveAudioRef);
    };

    const dropToBench = (bIdx: number) => {
        if (!dragSrc) return;
        const targetFilled = !!bench[bIdx];

        if (dragSrc.from === 'board') {
            const u = board[dragSrc.index];
            if (!u) return;
            if (!targetFilled) {
                const nextBench = bench.map((cell, i) => (i === bIdx ? (normalizeStar(u) as Unit) : cell));
                const nextBoard = board.map((cell, i) => (i === dragSrc.index ? null : cell));
                const merged = mergeAllUnits(nextBoard, nextBench);
                setBench(merged.bench);
                setBoard(merged.board);
                endDrag();
                playAudio(moveAudioRef);
                return;
            }
            // swap, no merge
            const nextBench = bench.map((cell, i) => (i === bIdx ? (normalizeStar(u) as Unit) : cell));
            const nextBoard = board.map((cell, i) => (i === dragSrc.index ? bench[bIdx] : cell));
            setBench(nextBench);
            setBoard(nextBoard);
            endDrag();
            playAudio(moveAudioRef);
            return;
        }

        if (dragSrc.from === 'bench') {
            const u = bench[dragSrc.index];
            if (!u) return;
            if (!targetFilled) {
                setBench((b) => b.map((cell, i) => (i === dragSrc.index ? null : i === bIdx ? u : cell)));
                endDrag();
                playAudio(moveAudioRef);
                return;
            }
            // swap
            setBench((b) => b.map((cell, i) => (i === dragSrc.index ? b[bIdx] : i === bIdx ? u : cell)));
            endDrag();
            playAudio(moveAudioRef);
            return;
        }

        endDrag();
        playAudio(moveAudioRef);
    };

    const clearBoardAt = (idx: number) => setBoard((bd) => bd.map((c, i) => (i === idx ? null : c)));

    const sellDragged = () => {
        if (!dragSrc) return;
        if (dragSrc.from === 'bench') {
            const u = bench[dragSrc.index];
            if (!u) return endDrag();
            const sell = getSellGold(u);
            /* time-attack: selling doesn't change spent */
            setSpent((s) => s - sell);
            setBench((b) => b.map((cell, i) => (i === dragSrc.index ? null : cell)));
            playAudio(moveAudioRef);
        } else if (dragSrc.from === 'board') {
            const u = board[dragSrc.index];
            if (!u) return endDrag();
            const sell = getSellGold(u);
            /* time-attack: selling doesn't change spent */
            setSpent((s) => s - sell);
            clearBoardAt(dragSrc.index);
            playAudio(moveAudioRef);
        }
        endDrag();
        playAudio(moveAudioRef);
    };

    const sellAt = (where: 'bench' | 'board', idx: number) => {
        if (where === 'bench') {
            const u = bench[idx];
            if (!u) return;
            const sell = getSellGold(u);
            /* time-attack: selling doesn't change spent */
            setSpent((s) => s - sell);
            setBench((b) => b.map((cell, i) => (i === idx ? null : cell)));
            playAudio(sellAudioRef);
        } else {
            const u = board[idx];
            if (!u) return;
            const sell = getSellGold(u);
            /* time-attack: selling doesn't change spent */
            setSpent((s) => s - sell);
            setBoard((bd) => bd.map((cell, i) => (i === idx ? null : cell)));
            playAudio(sellAudioRef);
        }
    };

    const buyFromShop = (idx: number) => {
        if (!bench) return;
        const card = shop[idx];
        if (!card) return;
        const cost = card.cost;

        const prevCnt = countByStarForKey(card.key, board, bench);
        const empty = bench.findIndex((s) => s === null);
        let nextBench: (Unit | null)[];
        let nextBoard: (Unit | null)[];

        if (empty === -1) {
            let sim = simulateBuyAndMerge(card, board, bench, 1);
            let afterCnt = countByStarForKey(card.key, sim.board, sim.bench);
            const mergedSingle = afterCnt.s3 > prevCnt.s3 || afterCnt.s2 > prevCnt.s2;
            if (mergedSingle) {
                nextBench = sim.bench;
                nextBoard = sim.board;
            } else {
                const j = shop.findIndex((s, k) => k !== idx && s && s.key === card.key);
                if (j === -1) return;
                // removed gold affordability check for double-buy in time-attack
                sim = simulateBuyAndMerge(card, board, bench, 2);
                afterCnt = countByStarForKey(card.key, sim.board, sim.bench);
                const mergedDouble = afterCnt.s3 > prevCnt.s3 || afterCnt.s2 > prevCnt.s2;
                if (!mergedDouble) return;
                nextBench = sim.bench;
                nextBoard = sim.board;
                setSpent((s) => s + cost * 2);
                const nextShopDouble = shop.map((c, k) => (k === idx || k === j ? null : c));
                setShop(nextShopDouble);
                setBoard(nextBoard);
                setBench(nextBench);
                playAudio(buyAudioRef);
                const newCntDouble = countByStarForKey(card.key, nextBoard, nextBench);
                if (newCntDouble.s3 > prevCnt.s3) playAudio(threeStarAudioRef, 1);
                else if (newCntDouble.s2 > prevCnt.s2) playAudio(twoStarAudioRef, 1);
                return;
            }
        } else {
            const tmpBench = bench.map((cell, i) => (i === empty ? {...card, star: 1} : cell));
            const merged = mergeAllUnits(board, tmpBench);
            nextBench = merged.bench;
            nextBoard = merged.board;
        }

        const nextShop = shop.map((c, i) => (i === idx ? null : c));

        setSpent((s) => s + cost);
        setShop(nextShop);
        setBoard(nextBoard);
        setBench(nextBench);

        playAudio(buyAudioRef);
        const afterCnt = countByStarForKey(card.key, nextBoard, nextBench);
        if (afterCnt.s3 > prevCnt.s3) playAudio(threeStarAudioRef, 1);
        else if (afterCnt.s2 > prevCnt.s2) playAudio(twoStarAudioRef, 1);
    };

    const getPromoStarBadge = (unit: Unit): 0 | 2 | 3 => {
        const {s1, s2, s3} = countByStarForKey(unit.key, board, bench);
        if (s3 > 0) return 0;
        if (s2 >= 2 && s1 >= 2) return 3;
        if (s1 >= 2) return 2;
        return 0;
    };

    return {
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
    } as const;
}

