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
};