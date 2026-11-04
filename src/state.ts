export const names = [
  "KICK",
  "SNARE",
  "CLAP",
  "LOW TOM",
  "HIGH TOM",
  "HI-HAT (C/H)",
  "PERCUSSION",
  "CLAVES",
  "CYMBAL",
];
export type Lane = { steps: number[]; length: number };
export type Voice = {
  level: number;
  tune: number;
  decay: number;
  tone: number;
  mode: "analog" | "sample";
  start: number;
  end: number;
  pitch: number;
  reverse: boolean;
  sample?: AudioBuffer;
};
export const emptyPattern = (): Lane[] =>
  names.map(() => ({ steps: Array(16).fill(0), length: 16 }));
export const demo = (): Lane[] => {
  const p = emptyPattern();
  [
    [0, 4, 8, 12],
    [4, 12],
    [4, 12],
    [0, 8],
    [4, 12],
    [0, 2, 4, 6, 8, 10, 12, 14],
    [2, 10],
    [1, 5, 9, 13],
    [4, 12],
  ].forEach((s, i) =>
    s.forEach((n) => (p[i].steps[n] = i === 5 && n % 4 === 2 ? 2 : 1)),
  );
  [16, 12, 16, 7, 11, 16, 9, 5, 13].forEach((l, i) => (p[i].length = l));
  return p;
};
export const clone = <T>(x: T): T => structuredClone(x);
export const position = (tick: number, length: number) => tick % length;
export const interval = (tick: number, bpm: number, swing: number) =>
  (60 / bpm / 4) * (tick % 2 ? 1 - swing : 1 + swing);
export const voices: Voice[] = names.map(() => ({
  level: 0.7,
  tune: 0.5,
  decay: 0.4,
  tone: 0.5,
  mode: "analog",
  start: 0,
  end: 1,
  pitch: 0.5,
  reverse: false,
}));

/** Mute takes priority; any active solo excludes tracks outside the solo group. */
export const isAudible = (lane:number, muted:boolean[], solo:boolean[]) => !muted[lane] && (!solo.some(Boolean) || !!solo[lane]);
