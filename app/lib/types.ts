export type BaseUnit = {
    key: string;
    name: string;
    traits: string[];
    color: string;
    img?: string;
};

export type Unit = BaseUnit & {
    cost: number;
    star: number; // 1성, 2성, 3성
    removedUnits?: string[]; // 이 유닛을 구매할 때 풀에서 제거된 유닛들의 ID 목록
};