'use client';
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ROSTER } from '../lib/constants';
import { clx } from '../lib/utils';

// time-attack 페이지가 읽을 저장 키
const TA_PRESET_KEY = 'TA_SELECTED_PRESET';

// ===== 프리셋 목록 (챔피언 이름 기준) =====
const PRESETS: Array<{ name: string; members: string[]; targetStar?: 1 | 2 | 3; threeStars?: string[] }> = [
    { name: '5전사관 5신동 유미', members: ['가렌','신드라','이즈리얼','라칸','말자하','레오나','유미','크산테','세라핀'] },
    { name: '6결투가 우디르 (거인화)', members: ['케일','갱플랭크','비에고','우디르','세트','애쉬','리 신','자이라'], targetStar: 2, threeStars: ['우디르']},
    { name: '별 수호자 징크스', members: ['렐','신드라','자야','코부코','니코','아리','뽀삐','징크스','세라핀'] },
    { name: '크루 저격수 진', members: ['나르','말파이트','시비르','케넨','진','니코','징크스','크산테'], targetStar: 2, threeStars: ['말파이트', '케넨', '시비르', '나르', '진'] },
    { name: '4멘토 라이즈 세나', members: ['아트록스','코부코','세나','야스오','우디르','라이즈','자르반 4세','리 신','자이라'], targetStar: 2, threeStars: ['야스오', '세나'] },
    { name: '4멘토 4슈프림 셀', members: ['케넨','카이사','코부코','다리우스','야스오','우디르','라이즈','아칼리','자르반 4세'], targetStar: 2, threeStars: ['코부코', '다리우스', '카이사'] },
    { name: '8소울 파이터', members: ['칼리스타','나피리','럭스','신 짜오','비에고','사미라','세트','그웬'] },
    { name: '7전사관 케틀 제이스', members: ['가렌','이즈리얼','라칸','코부코','제이스','케이틀린','레오나','유미'], targetStar: 2, threeStars: ['케이틀린', '제이스']},
    { name: '6법사 카르마', members: ['루시안','럭스','스웨인','아리','라이즈','자르반 4세','카르마','그웬','브라움'] },
    { name: '6전쟁기계 케일', members: ['나피리','아트록스','자크','케일','문도박사','우디르','세트','리 신','브라움'], targetStar: 2, threeStars: ['자크', '아트록스', '케일'] },
    { name: '7거대 메크 요네', members: ['루시안','아트록스','갱플랭크','세나','라이즈','자르반 4세','카르마','리 신','요네'] },
    { name: '고밸류 바루스', members: ['나르','잔나','스웨인','자르반 4세','크산테','바루스','브라움','자이라','트위스티드 페이트'] },
    { name: '고밸류 징크스', members: ['나르','렐','코부코','니코','뽀삐','징크스','크산테','바루스','브라움'] },
    { name: '6봉쇄자 자야', members: ['말파이트','케넨','라칸','자야','잔나','니코','야스오','크산테'], targetStar: 2, threeStars: ['자야', '라칸'] },
    { name: '6이단아 자야 리롤', members: ['렐','쉔','신 짜오','자야','야스오','볼리베어','사미라','브라움','요네'], targetStar: 2, threeStars: ['자야'] },
];

export default function SettingPage() {
    const router = useRouter();
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    type OverlapMode = 'none' | 'with';
    const [overlapMode, setOverlapMode] = useState<OverlapMode>('none');

    // 이름 -> 유닛 메타 매핑 (ROSTER 이용)
    const nameToUnit = useMemo(() => {
        const map = new Map<string, { key: string; name: string; img?: string; cost: number }>();
        (Object.keys(ROSTER) as Array<keyof typeof ROSTER>).forEach((k) => {
            const cost = Number(k);
            ROSTER[cost].forEach((u) => map.set(u.name, { key: u.key, name: u.name, img: u.img, cost }));
        });
        return map;
    }, []);

    const selectedPreset = PRESETS[selectedIdx];
    const selectedMembers = useMemo(() => {
        // 이름 매칭 실패하면 기본 이미지로라도 표시
        return selectedPreset.members.map((n) => nameToUnit.get(n) || { key: n, name: n, img: undefined, cost: 0 });
    }, [selectedPreset, nameToUnit]);

    const start = useCallback(() => {
        const baseStar = (selectedPreset.targetStar ?? 2);
        const targets: Record<string, 1 | 2 | 3> = {};
        selectedMembers.forEach((u) => {
          const star = (selectedPreset.threeStars?.includes(u.name) ? 3 : baseStar) as 1 | 2 | 3;
          targets[u.key] = star;
        });
        const payload = {
            name: selectedPreset.name,
            targetStar: baseStar, // backward compat
            targets,              // per-unit 목표 성급
            units: selectedMembers.map((u) => u.key),
            unitMeta: selectedMembers,
            overlapMode,
        };
        try {
            localStorage.setItem(TA_PRESET_KEY, JSON.stringify(payload));
        } catch {}
        router.push('/time-attack');
    }, [selectedPreset, selectedMembers, router, overlapMode]);

    // 돌아왔을 때 이전 선택 복구
    useEffect(() => {
        try {
            const raw = localStorage.getItem(TA_PRESET_KEY);
            if (raw) {
                const p = JSON.parse(raw);
                const idx = PRESETS.findIndex((x) => x.name === p?.name);
                if (idx >= 0) setSelectedIdx(idx);
                if (p?.overlapMode === 'none' || p?.overlapMode === 'with') setOverlapMode(p.overlapMode);
            }
        } catch {}
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto max-w-6xl px-4 py-8">
                <header className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">구성할 덱을 선택해 주세요.</h1>
                        <span>최대한 빠른 시간안에 덱을 구성하면 됩니다.</span>
                        <span className="text-xs"> (크루 효과는 아직 적용이 안됐어요 ㅠㅠ)</span>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* LEFT: 프리셋 목록 */}
                    <aside className="md:col-span-5 lg:col-span-4">
                        <div className="rounded-xl bg-slate-900/60 ring-1 ring-white/10 p-3 max-h-[70vh] overflow-auto">
                            <ul className="space-y-2">
                                {PRESETS.map((p, i) => (
                                    <li key={p.name}>
                                        <button
                                            onClick={() => setSelectedIdx(i)}
                                            className={clx(
                                                'w-full text-left px-3 py-3 rounded-lg border transition-colors',
                                                i === selectedIdx
                                                    ? 'border-indigo-400 bg-indigo-600/20'
                                                    : 'border-white/10 hover:bg-white/5'
                                            )}
                                        >
                                            <div className="text-sm font-semibold truncate">{p.name}</div>
                                            <div className="text-xs text-white/60 truncate mt-1">{p.members.join(' · ')}</div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>

                    {/* RIGHT: 선택 덱 미리보기 */}
                    <main className="md:col-span-7 lg:col-span-8">
                        <div className="rounded-xl bg-slate-900/60 ring-1 ring-white/10 p-4">
                            <h2 className="text-lg font-semibold mb-3">구성할 덱</h2>
                            <div className="text-sm text-white/70 mb-4">{selectedPreset.name}</div>
                            <div className="mb-4 flex items-center gap-3">
                              <label className="text-xs opacity-80">겹치는 사람</label>
                              <select
                                value={overlapMode}
                                onChange={(e) => setOverlapMode(e.target.value as OverlapMode)}
                                className="bg-slate-800 border border-white/20 rounded px-2 py-1 text-sm"
                                title="겹치는 사람 옵션"
                              >
                                <option value="none">없음</option>
                                <option value="with">있음</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3">
                                {selectedMembers.map((u) => (
                                    <div
                                        key={u.key}
                                        className="relative w-full aspect-square rounded-md overflow-hidden ring-1 ring-white/10"
                                        title={u.name}
                                    >
                                        <Image src={u.img ?? '/garen.jpg'} alt={u.name} fill className="object-cover" />
                                        <div className="absolute inset-0 bg-black/25" />
                                        <div className="absolute bottom-1 left-1 right-1 text-[12px] font-semibold truncate text-white drop-shadow">
                                            {u.name}
                                        </div>
                                        <div className="absolute top-1 left-1 text-[11px] bg-black/70 px-1 rounded">
                                            {(() => {
                                              const base = (selectedPreset.targetStar ?? 2);
                                              const star = selectedPreset.threeStars?.includes(u.name) ? 3 : base;
                                              return `목표 ${"★".repeat(star)}`;
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={start}
                                    className="px-5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 font-semibold"
                                >
                                    이 덱으로 시작 →
                                </button>
                            </div>
                        </div>

                        <div>
                            <p>

                            </p>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}