import type { BaseUnit, Unit } from "./types";
import { ODDS, ROSTER, PER_UNIT_POOL } from "./constants";

// ---- Helpers ----
export const clx = (...xs: Array<string | false | null | undefined>) =>
    xs.filter(Boolean).join(" ");
export const coins = (n: number) => n.toLocaleString();

export function pickWeighted(odds: number[]): number {
    const r = Math.random() * 100;
    let acc = 0;
    for (let i = 0; i < odds.length; i++) {
        acc += odds[i];
        if (r < acc) return i + 1; // cost tier 1..5
    }
    return 5;
}

// Count how many "copies" of a specific key are currently owned.
// 1★ counts as 1, 2★ as 3, 3★ as 9.
export function copiesOwnedForKey(key: string, board: (Unit | null)[], bench: (Unit | null)[]) {
  let copies = 0;
  const acc = (u: Unit | null) => {
    if (!u || u.key !== key) return 0;
    const st = u.star ?? 1;
    return st >= 3 ? 9 : st === 2 ? 3 : 1;
  };
  for (const u of board) copies += acc(u);
  for (const u of bench) copies += acc(u);
  return copies;
}

export function hasThreeStarOwned(key: string, board: (Unit | null)[], bench: (Unit | null)[]) {
  for (const u of board) if (u && u.key === key && (u.star ?? 1) >= 3) return true;
  for (const u of bench) if (u && u.key === key && (u.star ?? 1) >= 3) return true;
  return false;
}

export function poolRemainingFor(key: string, cost: number, board: (Unit | null)[], bench: (Unit | null)[]) {
  const total = PER_UNIT_POOL[cost] ?? 0;
  const held = copiesOwnedForKey(key, board, bench);
  return Math.max(0, total - held);
}

export function availableUnitsForCost(cost: number, board: (Unit | null)[], bench: (Unit | null)[]) {
  const pool = ROSTER[cost] ?? [];
  return pool.filter(u => !hasThreeStarOwned(u.key, board, bench) && poolRemainingFor(u.key, cost, board, bench) > 0);
}

export function randomUnitWithPools(cost: number, board: (Unit | null)[], bench: (Unit | null)[]) : BaseUnit | null {
  const avail = availableUnitsForCost(cost, board, bench);
  if (avail.length === 0) return null;
  return avail[Math.floor(Math.random() * avail.length)];
}

// New makeShop that respects pools and 3★ exclusion.
export function makeShop(level: number, board: (Unit | null)[], bench: (Unit | null)[]): (Unit | null)[] {
  const odds = ODDS[level] || ODDS[3];
  return new Array(5).fill(0).map(() => {
    const cost = pickWeighted(odds);
    const base = randomUnitWithPools(cost, board, bench);
    return base ? { ...base, cost, star: 1 } : null;
  });
}

export function normalizeStar(u: Unit | null): Unit | null {
    if (!u) return u;
    return { ...u, star: u.star ?? 1 } as Unit;
}

export function cloneUnits(arr: (Unit | null)[]): (Unit | null)[] {
    return arr.map((u) => (u ? { ...u } : null));
}

// --- Merge helpers ---
export function maxStarForKeyAcross(key: string, board: (Unit | null)[], bench: (Unit | null)[]) {
    let m = 0;
    for (const u of board) if (u && u.key === key) m = Math.max(m, u.star ?? 1);
    for (const u of bench) if (u && u.key === key) m = Math.max(m, u.star ?? 1);
    return m;
}

export function countByStarForKey(key: string, board: (Unit | null)[], bench: (Unit | null)[]) {
    let s1 = 0, s2 = 0, s3 = 0;
    for (const u of board) if (u && u.key === key) {
        const st = u.star ?? 1; if (st === 1) s1++; else if (st === 2) s2++; else if (st >= 3) s3++;
    }
    for (const u of bench) if (u && u.key === key) {
        const st = u.star ?? 1; if (st === 1) s1++; else if (st === 2) s2++; else if (st >= 3) s3++;
    }
    return { s1, s2, s3 };
}

export function getSellGold(u: Unit): number {
    const star = u.star ?? 1;
    if (u.cost === 1) {
        if (star === 1) return 1;
        if (star === 2) return 3;
        return 9;
    }
    const mult = star === 1 ? 1 : star === 2 ? 3 : 9;
    if (star === 1) {
        return u.cost
    }
    return (u.cost * mult) - 1;
}

export function mergeAllUnits(boardArr: (Unit | null)[], benchArr: (Unit | null)[]) {
    const board = cloneUnits(boardArr).map(normalizeStar);
    const bench = cloneUnits(benchArr).map(normalizeStar);

    const indicesBy = (arr: (Unit | null)[], key: string, star: number) =>
        arr.map((u, i) => (u && u.key === key && (u.star ?? 1) === star ? i : -1)).filter((i) => i !== -1);

    const mergeStar = (star: number) => {
        const keys = new Set<string>();
        for (const u of board) if (u && (u.star ?? 1) === star) keys.add(u.key);
        for (const u of bench) if (u && (u.star ?? 1) === star) keys.add(u.key);

        keys.forEach((key) => {
            while (true) {
                let bIdxs = indicesBy(board, key, star);
                let tIdxs = indicesBy(bench, key, star);
                const total = bIdxs.length + tIdxs.length;
                if (total < 3) break;

                // pick target position (prefer a board unit)
                let targetFrom: 'board' | 'bench';
                let targetIdx: number;
                if (bIdxs.length > 0) {
                    targetFrom = 'board';
                    targetIdx = bIdxs[0];
                    bIdxs = bIdxs.slice(1);
                } else {
                    targetFrom = 'bench';
                    targetIdx = tIdxs[0];
                    tIdxs = tIdxs.slice(1);
                }

                // remove two others (prefer bench)
                const toRemove: Array<{ from: 'board' | 'bench'; idx: number }> = [];
                while (toRemove.length < 2 && tIdxs.length > 0) toRemove.push({ from: 'bench', idx: tIdxs.shift()! });
                while (toRemove.length < 2 && bIdxs.length > 0) toRemove.push({ from: 'board', idx: bIdxs.shift()! });
                if (toRemove.length < 2) break;

                for (const r of toRemove) {
                    if (r.from === 'bench') bench[r.idx] = null; else board[r.idx] = null;
                }

                if (targetFrom === 'board') {
                    const u = board[targetIdx];
                    if (u) board[targetIdx] = { ...u, star: (u.star ?? 1) + 1 };
                } else {
                    const u = bench[targetIdx];
                    if (u) bench[targetIdx] = { ...u, star: (u.star ?? 1) + 1 };
                }
            }
        });
    };

    mergeStar(1);
    mergeStar(2);

    return { board, bench };
}

export function simulateBuyAndMerge(target: BaseUnit, boardArr: (Unit | null)[], benchArr: (Unit | null)[], addCopies: number = 1) {
  // Clone shallow and normalize stars; we'll mutate specific indices in place.
  const board = cloneUnits(boardArr).map(normalizeStar);
  const bench = cloneUnits(benchArr).map(normalizeStar);
  const key = target.key;

  // Helpers to find indices of the same key at a given star
  const indicesBy = (arr: (Unit | null)[], star: number) =>
    arr.map((u, i) => (u && u.key === key && (u.star ?? 1) === star ? i : -1)).filter((i) => i !== -1);

  // Merge three 1★ into one 2★, using up to `addCopies` virtual 1★ from shop
  const doStar1Merge = (): boolean => {
    let onesBoard = indicesBy(board, 1);
    let onesBench = indicesBy(bench, 1);
    const totalOnesWithVirtual = onesBoard.length + onesBench.length + Math.max(0, addCopies);
    if (totalOnesWithVirtual < 3) return false;

    // target prefers board, then bench
    let targetFrom: 'board' | 'bench' | null = null;
    let targetIdx = -1;
    if (onesBoard.length > 0) {
      targetFrom = 'board';
      targetIdx = onesBoard[0];
      onesBoard = onesBoard.slice(1);
    } else if (onesBench.length > 0) {
      targetFrom = 'bench';
      targetIdx = onesBench[0];
      onesBench = onesBench.slice(1);
    } else {
      return false;
    }

    // need two sources: prefer bench ones, then board ones, then virtual
    const toRemove: Array<{ from: 'board' | 'bench'; idx: number } | 'virtual'> = [];
    while (toRemove.length < 2 && onesBench.length > 0) toRemove.push({ from: 'bench', idx: onesBench.shift()! });
    while (toRemove.length < 2 && onesBoard.length > 0) toRemove.push({ from: 'board', idx: onesBoard.shift()! });
    while (toRemove.length < 2 && addCopies > 0) {
      toRemove.push('virtual');
      addCopies -= 1;
    }
    if (toRemove.length < 2) return false;

    // consume actual copies
    for (const r of toRemove) {
      if (r === 'virtual') continue;
      if (r.from === 'bench') bench[r.idx] = null; else board[r.idx] = null;
    }

    // upgrade target in place
    if (targetFrom === 'board') {
      const u = board[targetIdx]!;
      board[targetIdx] = { ...u, star: (u.star ?? 1) + 1 };
    } else if (targetFrom === 'bench') {
      const u = bench[targetIdx]!;
      bench[targetIdx] = { ...u, star: (u.star ?? 1) + 1 };
    }
    return true;
  };

  // Merge three 2★ into one 3★ (no virtual twos; must exist already)
  const doStar2Merge = (): boolean => {
    let twosBoard = indicesBy(board, 2);
    let twosBench = indicesBy(bench, 2);
    if (twosBoard.length + twosBench.length < 3) return false;

    let targetFrom: 'board' | 'bench' | null = null;
    let targetIdx = -1;
    if (twosBoard.length > 0) {
      targetFrom = 'board';
      targetIdx = twosBoard[0];
      twosBoard = twosBoard.slice(1);
    } else if (twosBench.length > 0) {
      targetFrom = 'bench';
      targetIdx = twosBench[0];
      twosBench = twosBench.slice(1);
    } else {
      return false;
    }

    const toRemove: Array<{ from: 'board' | 'bench'; idx: number }> = [];
    while (toRemove.length < 2 && twosBench.length > 0) toRemove.push({ from: 'bench', idx: twosBench.shift()! });
    while (toRemove.length < 2 && twosBoard.length > 0) toRemove.push({ from: 'board', idx: twosBoard.shift()! });
    if (toRemove.length < 2) return false;

    for (const r of toRemove) {
      if (r.from === 'bench') bench[r.idx] = null; else board[r.idx] = null;
    }

    if (targetFrom === 'board') {
      const u = board[targetIdx]!;
      board[targetIdx] = { ...u, star: (u.star ?? 1) + 1 };
    } else if (targetFrom === 'bench') {
      const u = bench[targetIdx]!;
      bench[targetIdx] = { ...u, star: (u.star ?? 1) + 1 };
    }
    return true;
  };

  // Try to use virtual 1★ copies (from shop buys) greedily
  while (addCopies > 0) {
    const merged = doStar1Merge();
    if (!merged) break;
    // after a 1★ merge, see if we can promote to 3★
    while (doStar2Merge()) {}
  }

  // Also resolve any remaining natural 2★ merges
  while (doStar2Merge()) {}

  return { board, bench };
}