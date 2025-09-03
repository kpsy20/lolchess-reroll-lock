'use client';
import React from 'react';
import Image from 'next/image';
import type {Unit} from '../../lib/types';
import {clx} from '../../lib/utils';
import {COST_COLORS, COST_BG} from '../../lib/constants';

type Props = {
    shop: (Unit | null)[];
    gold: number;
    ownedKeys: Set<string>;
    wanted: Set<string>;
    canBuyXP: boolean;
    canReroll: boolean;
    onBuyXP: () => void;
    onReroll: () => void;
    onBuyFromShop: (index: number) => void;
    getPromoStarBadge: (u: Unit) => 0 | 2 | 3;
};

export default function ActionShop({
                                       shop,
                                       gold,
                                       ownedKeys,
                                       wanted,
                                       canBuyXP,
                                       canReroll,
                                       onBuyXP,
                                       onReroll,
                                       onBuyFromShop,
                                       getPromoStarBadge,
                                   }: Props) {
    return (
        <div className="flex gap-3">
            {/* Left Action Buttons */}
            <div className="w-32">
                <button
                    onClick={onBuyXP}
                    disabled={!canBuyXP}
                    className={clx(
                        'h-15 w-full rounded-xs ring-1 ring-teal-400/50 bg-teal-600/20 hover:bg-teal-600/30 text-sm font-semibold mb-2',
                        !canBuyXP && 'opacity-40 cursor-not-allowed'
                    )}
                    title="F 키로 구매"
                >
                    XP 구매
                </button>
                <button
                    onClick={onReroll}
                    disabled={!canReroll}
                    className={clx(
                        'h-15 w-full rounded-xs ring-1 ring-indigo-400/50 bg-indigo-600/20 hover:bg-indigo-600/30 text-sm font-semibold',
                        !canReroll && 'opacity-40 cursor-not-allowed'
                    )}
                    title="D 키로 리롤"
                >
                    새로고침
                </button>
            </div>

            {/* Shop Cards */}
            <div className="grid grid-cols-5 gap-3 flex-1">
                {shop.map((c, i) => (
                    <div
                        key={i}
                        className={clx(
                            'relative h-32 rounded-xs ring-2 bg-white/5 overflow-hidden p-0 flex flex-col',
                            c ? COST_COLORS[c.cost] : 'ring-white/10',

                        )}
                        onClick={() => {
                            onBuyFromShop(i);
                        }}
                    >
                        {/* Owned highlight */}
                        {c && ownedKeys.has(c.key) && (
                            <div className="pointer-events-none absolute inset-0 rounded-xs bright-pulse z-30">
                                <div className="absolute inset-0 bg-white/22"/>
                                <div
                                    className="absolute inset-0 ring-2 ring-yellow-300/70 shadow-[0_0_12px_rgba(234,179,8,0.65)] rounded-xs"/>
                            </div>
                        )}

                        {/* Wanted highlight (not owned) */}
                        {c && wanted.has(c.key) && !ownedKeys.has(c.key) && (
                            <div className="pointer-events-none absolute inset-0 rounded-xs bright-pulse z-30">
                                <div className="absolute inset-0 bg-white/14"/>
                                <div
                                    className="absolute inset-0 ring-2 ring-pink-400/70 shadow-[0_0_10px_rgba(244,114,182,0.6)] rounded-xs"/>
                            </div>
                        )}

                        {c ? (
                            <>
                                {/* Promo star badge */}
                                {(() => {
                                    const promo = getPromoStarBadge(c as Unit);
                                    return promo ? (
                                        <div
                                            className="absolute top-1 right-1 z-40 px-1.5 py-0.5 text-[10px] rounded bg-amber-500 text-black ring-1 ring-white/20">
                                            {promo === 2 ? '★★' : '★★★'}
                                        </div>
                                    ) : null;
                                })()}

                                {/* Wanted tag (top-left) */}
                                {wanted.has((c as Unit).key) && (
                                    <Image
                                        src="/tag.png"
                                        alt="원하는 표시"
                                        width={24}
                                        height={24}
                                        className="absolute top-0 left-1 z-40 pointer-events-none select-none bright-pulse"
                                        priority
                                    />
                                )}

                                <div className="relative flex-1">
                                    <Image src={c.img ?? '/garen.jpg'} alt={c.name} fill className="object-cover"/>
                                    <div className="absolute inset-0 bg-black/30"/>

                                    {/* Traits overlay (bottom-left) */}
                                    <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1">
                                        {c.traits.map((t) => (
                                            <span key={t}
                                                  className="text-[12px] leading-none px-2 py-1 text-white ring-1 ring-white/20 rounded-xs">
                        {t}
                      </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Bottom bar: cost-colored */}
                                <div
                                    className={clx('h-8 px-3 flex items-center justify-between text-sm font-semibold text-white', COST_BG[c.cost])}>
                                    <span className="truncate pr-2">{c.name}</span>
                                    <span className="flex items-center gap-1"><span
                                        className="opacity-90">G</span>{c.cost}</span>
                                </div>
                            </>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-white/40 text-sm"/>
                        )}
                    </div>
                ))}
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