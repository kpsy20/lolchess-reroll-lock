

'use client';
import React from 'react';
import Image from 'next/image';
import type { Unit } from '../../lib/types';
import { BENCH_SIZE, COST_COLORS } from '../../lib/constants';
import { clx } from '../../lib/utils';

export type BenchProps = {
  bench: (Unit | null)[];
  onHoverEnter: (index: number) => void;
  onHoverLeave: (index: number) => void;
  allowDrop: (e: React.DragEvent) => void;
  dropToBench: (index: number) => void;
  beginDragBench: (index: number) => (e: React.DragEvent) => void;
  endDrag: () => void;
};

export default function Bench({
  bench,
  onHoverEnter,
  onHoverLeave,
  allowDrop,
  dropToBench,
  beginDragBench,
  endDrag,
}: BenchProps) {
  return (
    <div className="mb-4 grid grid-cols-10 gap-2">
      {new Array(BENCH_SIZE).fill(0).map((_, i) => (
        <div
          key={i}
          className={clx(
            'aspect-square rounded-xl ring-1 ring-white/10 bg-white/5 overflow-hidden relative',
            bench[i] && COST_COLORS[bench[i]?.cost as 1 | 2 | 3 | 4 | 5]
          )}
          onMouseEnter={() => onHoverEnter(i)}
          onMouseLeave={() => onHoverLeave(i)}
          onDragOver={allowDrop}
          onDrop={() => dropToBench(i)}
        >
          {bench[i] ? (
            <>
              <Image src={bench[i]!.img ?? '/garen.jpg'} alt={bench[i]!.name} fill className="object-cover" />
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute top-1 right-1 z-20 px-1.5 py-0.5 text-[10px] rounded bg-black text-white ring-1 ring-white/10">
                {'★'.repeat(bench[i]!.star ?? 1)}
              </div>
              <div className="absolute bottom-1 left-2 right-2 text-[11px] font-semibold truncate">{bench[i]!.name}</div>
              <div draggable onDragStart={beginDragBench(i)} onDragEnd={endDrag} className="absolute inset-0" />
            </>
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-white/40 text-xs" />
          )}
        </div>
      ))}
    </div>
  );
}