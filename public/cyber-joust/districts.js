export const CYBER_JOUST_DISTRICTS = [
    {
        slug: 'neon-docks',
        name: 'Neon Docks',
        tagline: 'Pier ramps, tide hazards, wide launch lanes',
        palette: {
            sky: 0x07162e,
            primary: 0x00f0ff,
            secondary: 0xff007f,
            accent: 0xffea00,
            platform: 0x0c1024,
            hazard: 0x0088ff
        },
        gravityY: 760,
        botCount: 2,
        botChaseProbability: 58,
        scoreBonus: 250,
        thrustMultiplier: 1,
        hazard: { label: 'DATA TIDE', widthRatio: 0.46, alpha: 0.35 },
        platforms: [
            { x: 0.18, y: 0.83, w: 0.34, h: 24, stroke: 'secondary' },
            { x: 0.82, y: 0.83, w: 0.34, h: 24, stroke: 'secondary' },
            { x: 0.25, y: 0.58, w: 0.3, h: 24, stroke: 'primary' },
            { x: 0.75, y: 0.58, w: 0.3, h: 24, stroke: 'primary' },
            { x: 0.5, y: 0.34, w: 0.26, h: 24, stroke: 'accent' }
        ],
        ramps: [
            { x: 0.34, y: 0.83, w: 120, h: 80, dir: 'right' },
            { x: 0.66, y: 0.83, w: 120, h: 80, dir: 'left' },
            { x: 0.4, y: 0.58, w: 100, h: 60, dir: 'right' },
            { x: 0.6, y: 0.58, w: 100, h: 60, dir: 'left' }
        ]
    },
    {
        slug: 'gridline-market',
        name: 'Gridline Market',
        tagline: 'Stacked stalls and fast ambush lanes',
        palette: {
            sky: 0x1b0830,
            primary: 0xff007f,
            secondary: 0x39ff14,
            accent: 0x00f0ff,
            platform: 0x13091f,
            hazard: 0xff0055
        },
        gravityY: 720,
        botCount: 3,
        botChaseProbability: 72,
        scoreBonus: 300,
        thrustMultiplier: 1.06,
        hazard: { label: 'GLITCH CROWD', widthRatio: 0.38, alpha: 0.42 },
        platforms: [
            { x: 0.16, y: 0.84, w: 0.28, h: 24, stroke: 'primary' },
            { x: 0.84, y: 0.84, w: 0.28, h: 24, stroke: 'primary' },
            { x: 0.5, y: 0.68, w: 0.28, h: 24, stroke: 'secondary' },
            { x: 0.2, y: 0.48, w: 0.24, h: 24, stroke: 'accent' },
            { x: 0.8, y: 0.48, w: 0.24, h: 24, stroke: 'accent' },
            { x: 0.5, y: 0.28, w: 0.22, h: 24, stroke: 'secondary' }
        ],
        ramps: [
            { x: 0.3, y: 0.84, w: 90, h: 70, dir: 'right' },
            { x: 0.7, y: 0.84, w: 90, h: 70, dir: 'left' },
            { x: 0.36, y: 0.68, w: 80, h: 55, dir: 'left' },
            { x: 0.64, y: 0.68, w: 80, h: 55, dir: 'right' }
        ]
    },
    {
        slug: 'toxic-overpass',
        name: 'Toxic Overpass',
        tagline: 'Narrow rails, heavy gravity, corrosive spill',
        palette: {
            sky: 0x061f12,
            primary: 0x39ff14,
            secondary: 0xffea00,
            accent: 0xff007f,
            platform: 0x071910,
            hazard: 0x39ff14
        },
        gravityY: 820,
        botCount: 2,
        botChaseProbability: 64,
        scoreBonus: 350,
        thrustMultiplier: 0.96,
        hazard: { label: 'SLUDGE SPILL', widthRatio: 0.55, alpha: 0.5 },
        platforms: [
            { x: 0.2, y: 0.82, w: 0.26, h: 22, stroke: 'primary' },
            { x: 0.8, y: 0.82, w: 0.26, h: 22, stroke: 'primary' },
            { x: 0.5, y: 0.62, w: 0.2, h: 22, stroke: 'secondary' },
            { x: 0.28, y: 0.42, w: 0.24, h: 22, stroke: 'accent' },
            { x: 0.72, y: 0.42, w: 0.24, h: 22, stroke: 'accent' }
        ],
        ramps: [
            { x: 0.33, y: 0.82, w: 110, h: 88, dir: 'right' },
            { x: 0.67, y: 0.82, w: 110, h: 88, dir: 'left' },
            { x: 0.4, y: 0.62, w: 84, h: 64, dir: 'right' },
            { x: 0.6, y: 0.62, w: 84, h: 64, dir: 'left' }
        ]
    }
];

export const DEFAULT_CYBER_JOUST_DISTRICT = CYBER_JOUST_DISTRICTS[0];

export function getCyberJoustDistrict(slug) {
    return CYBER_JOUST_DISTRICTS.find((district) => district.slug === slug) || DEFAULT_CYBER_JOUST_DISTRICT;
}
