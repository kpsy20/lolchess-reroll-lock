import type { BaseUnit } from "./types";

// XP needed per level (roughly TFT-like but simplified)
export const XP_REQ: Record<number, number> = {3: 6, 4: 10, 5: 20, 6: 36, 7: 48, 8: 76, 9: 84, 10: 0} as const;

// Shop odds by level (sum to 100)
export const ODDS: Record<number, number[]> = {
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

// Per-unit shop pool (number of copies for each unique unit at a given cost)
export const PER_UNIT_POOL: Record<number, number> = {
  1: 30,
  2: 25,
  3: 18,
  4: 10,
  5: 9,
};

// Minimal roster – replace/expand freely
export const ROSTER: Record<number, BaseUnit[]> = {
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
        {key: "TwistedFate", name: "트위스티드 페이트", traits: ["해적선장", "크루"], color: "bg-yellow-400", img: "/twistedfate.jpg"},
        {key: "Braum", name: "브라움", traits: ["레슬링 챔피언", "프로레슬러", "요새"], color: "bg-yellow-400", img: "/braum.jpg"},
        {key: "LeeSin", name: "리 신", traits: ["텐색의 대가"], color: "bg-yellow-400", img: "/leesin.jpg"},
        {key: "Varus", name: "바루스", traits: ["악령", "저격수"], color: "bg-yellow-400", img: "/varus.jpg"},
        {key: "Seraphine", name: "세라핀", traits: ["별 수호자", "신동"], color: "bg-yellow-400", img: "/seraphine.jpg"},
        {key: "Yone", name: "요네", traits: ["거대 메크", "이단아"], color: "bg-yellow-400", img: "/yone.jpg"},
        {key: "Gwen", name: "그웬", traits: ["소울 파이터", "마법사"], color: "bg-yellow-400", img: "/gwen.jpg"},
    ],
};

export const COST_COLORS: Record<number, string> = {
    1: "ring-gray-400",
    2: "ring-lime-400",
    3: "ring-blue-400",
    4: "ring-purple-400",
    5: "ring-orange-400",
};

export const COST_TEXT: Record<number, string> = {
    1: "text-gray-400",
    2: "text-lime-400",
    3: "text-blue-400",
    4: "text-purple-400",
    5: "text-orange-400",
};

export const COST_BG: Record<number, string> = {
    1: "bg-gray-600",
    2: "bg-lime-600",
    3: "bg-blue-600",
    4: "bg-purple-600",
    5: "bg-orange-600",
};

export const STORAGE_KEY = "tft-reroll-bar-v1";
export const BENCH_SIZE = 10;