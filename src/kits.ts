/** Original synthesis recipes; names describe inspiration, not hardware emulation. */
export type KitId = "classic" | "sr88" | "808" | "909" | "kr55";
export type KitRecipe = {
  label: string;
  description: string;
  durations: number[];
  openHat: number;
  kick: [number, number, number]; // start Hz, destination Hz, pitch fall seconds
  snare: [number, number];
  toms: [number, number];
  metal: number[];
  hatCutoff: number;
  noiseCutoff: number;
  clapGap: number;
  wood: number;
  drive: number;
};
export const kits: Record<Exclude<KitId, "classic">, KitRecipe> = {
  sr88: {
    label: "MEMORY 88",
    description:
      "SR-88-inspired: compact kick, papery snare, fizzy hats and woody percussion",
    durations: [0.23, 0.14, 0.13, 0.19, 0.15, 0.055, 0.12, 0.045, 2.0],
    openHat: 0.24,
    kick: [125, 53, 0.035],
    snare: [185, 320],
    toms: [175, 285],
    metal: [730, 1090, 1570, 2130, 2920, 4010],
    hatCutoff: 6200,
    noiseCutoff: 1400,
    clapGap: 0.009,
    wood: 1750,
    drive: 1.3,
  },
  "808": {
    label: "DEEP 08",
    description:
      "808-inspired: rounded sub kick, airy snare, ringing toms and cowbell-like percussion",
    durations: [0.8, 0.21, 0.24, 0.42, 0.31, 0.065, 0.21, 0.055, 2.8],
    openHat: 0.48,
    kick: [145, 43, 0.07],
    snare: [175, 330],
    toms: [125, 210],
    metal: [205, 304, 369, 522, 800, 1047],
    hatCutoff: 7000,
    noiseCutoff: 1800,
    clapGap: 0.012,
    wood: 2350,
    drive: 1,
  },
  "909": {
    label: "DRIVE 09",
    description:
      "909-inspired: punchy kick, bright snare, aggressive clap and sizzling metallic hats",
    durations: [0.39, 0.19, 0.19, 0.28, 0.22, 0.075, 0.16, 0.065, 3.2],
    openHat: 0.55,
    kick: [190, 51, 0.038],
    snare: [195, 360],
    toms: [155, 255],
    metal: [421, 587, 845, 1193, 1747, 2561],
    hatCutoff: 8100,
    noiseCutoff: 2600,
    clapGap: 0.011,
    wood: 2650,
    drive: 2.3,
  },
  kr55: {
    label: "RHYTHM 55",
    description:
      "KR-55-inspired: warm rhythm-box kick, soft noise snare, rounded toms and dry woodblock",
    durations: [0.28, 0.16, 0.12, 0.25, 0.19, 0.045, 0.14, 0.075, 2.3],
    openHat: 0.22,
    kick: [105, 58, 0.028],
    snare: [150, 275],
    toms: [165, 275],
    metal: [610, 890, 1310, 1830, 2570, 3470],
    hatCutoff: 5100,
    noiseCutoff: 1050,
    clapGap: 0.008,
    wood: 1320,
    drive: 1.15,
  },
};
