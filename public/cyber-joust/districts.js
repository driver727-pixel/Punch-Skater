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
        botSkill: 0.58,
        scoreBonus: 250,
        thrustMultiplier: 1,
        backdrop: { style: 'docks', label: 'PIER 07', trafficColor: 0x00f0ff },
        hazard: { label: 'DATA TIDE', widthRatio: 0.46, alpha: 0.35 },
        platforms: [
            { x: 0.18, y: 0.83, w: 0.34, h: 24, stroke: 'secondary' },
            { x: 0.82, y: 0.83, w: 0.34, h: 24, stroke: 'secondary' },
            { x: 0.25, y: 0.58, w: 0.3, h: 24, stroke: 'primary' },
            { x: 0.75, y: 0.58, w: 0.3, h: 24, stroke: 'primary' },
            { x: 0.5, y: 0.34, w: 0.26, h: 24, stroke: 'accent' },
            { x: 0.5, y: 0.18, w: 0.16, h: 18, stroke: 'primary' }
        ],
        ramps: [
            { x: 0.34, y: 0.83, w: 120, h: 80, dir: 'right' },
            { x: 0.66, y: 0.83, w: 120, h: 80, dir: 'left' },
            { x: 0.4, y: 0.58, w: 100, h: 60, dir: 'right' },
            { x: 0.6, y: 0.58, w: 100, h: 60, dir: 'left' }
        ],
        boostRings: [
            { x: 0.5, y: 0.49, r: 34, vx: 0, vy: -430 },
            { x: 0.18, y: 0.36, r: 26, vx: 230, vy: -250 },
            { x: 0.82, y: 0.36, r: 26, vx: -230, vy: -250 }
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
        botSkill: 0.72,
        scoreBonus: 300,
        thrustMultiplier: 1.06,
        backdrop: { style: 'market', label: 'STALLNET', trafficColor: 0xff007f },
        hazard: { label: 'GLITCH CROWD', widthRatio: 0.38, alpha: 0.42 },
        platforms: [
            { x: 0.16, y: 0.84, w: 0.28, h: 24, stroke: 'primary' },
            { x: 0.84, y: 0.84, w: 0.28, h: 24, stroke: 'primary' },
            { x: 0.5, y: 0.68, w: 0.28, h: 24, stroke: 'secondary' },
            { x: 0.2, y: 0.48, w: 0.24, h: 24, stroke: 'accent' },
            { x: 0.8, y: 0.48, w: 0.24, h: 24, stroke: 'accent' },
            { x: 0.5, y: 0.28, w: 0.22, h: 24, stroke: 'secondary' },
            { x: 0.08, y: 0.64, w: 0.12, h: 18, stroke: 'accent' },
            { x: 0.92, y: 0.64, w: 0.12, h: 18, stroke: 'accent' }
        ],
        ramps: [
            { x: 0.3, y: 0.84, w: 90, h: 70, dir: 'right' },
            { x: 0.7, y: 0.84, w: 90, h: 70, dir: 'left' },
            { x: 0.36, y: 0.68, w: 80, h: 55, dir: 'left' },
            { x: 0.64, y: 0.68, w: 80, h: 55, dir: 'right' }
        ],
        boostRings: [
            { x: 0.5, y: 0.53, r: 28, vx: 0, vy: -380 },
            { x: 0.32, y: 0.3, r: 24, vx: 280, vy: -210 },
            { x: 0.68, y: 0.3, r: 24, vx: -280, vy: -210 }
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
        botSkill: 0.66,
        scoreBonus: 350,
        thrustMultiplier: 0.96,
        backdrop: { style: 'overpass', label: 'ACID LOOP', trafficColor: 0x39ff14 },
        hazard: { label: 'SLUDGE SPILL', widthRatio: 0.55, alpha: 0.5 },
        platforms: [
            { x: 0.2, y: 0.82, w: 0.26, h: 22, stroke: 'primary' },
            { x: 0.8, y: 0.82, w: 0.26, h: 22, stroke: 'primary' },
            { x: 0.5, y: 0.62, w: 0.2, h: 22, stroke: 'secondary' },
            { x: 0.28, y: 0.42, w: 0.24, h: 22, stroke: 'accent' },
            { x: 0.72, y: 0.42, w: 0.24, h: 22, stroke: 'accent' },
            { x: 0.5, y: 0.24, w: 0.14, h: 18, stroke: 'secondary' }
        ],
        ramps: [
            { x: 0.33, y: 0.82, w: 110, h: 88, dir: 'right' },
            { x: 0.67, y: 0.82, w: 110, h: 88, dir: 'left' },
            { x: 0.4, y: 0.62, w: 84, h: 64, dir: 'right' },
            { x: 0.6, y: 0.62, w: 84, h: 64, dir: 'left' }
        ],
        boostRings: [
            { x: 0.5, y: 0.48, r: 26, vx: 0, vy: -450 },
            { x: 0.12, y: 0.56, r: 23, vx: 300, vy: -170 },
            { x: 0.88, y: 0.56, r: 23, vx: -300, vy: -170 }
        ]
    },
    {
        slug: 'orbital-foundry',
        name: 'Orbital Foundry',
        tagline: 'Low gravity rings, furnace lanes, aerial duels',
        palette: {
            sky: 0x08051f,
            primary: 0xffea00,
            secondary: 0x00f0ff,
            accent: 0xff007f,
            platform: 0x11101f,
            hazard: 0xff6a00
        },
        gravityY: 650,
        botCount: 3,
        botChaseProbability: 78,
        botSkill: 0.82,
        scoreBonus: 400,
        thrustMultiplier: 1.12,
        backdrop: { style: 'foundry', label: 'ORBITAL FORGE', trafficColor: 0xffea00 },
        hazard: { label: 'PLASMA VENT', widthRatio: 0.5, alpha: 0.48 },
        platforms: [
            { x: 0.16, y: 0.8, w: 0.24, h: 22, stroke: 'secondary' },
            { x: 0.84, y: 0.8, w: 0.24, h: 22, stroke: 'secondary' },
            { x: 0.5, y: 0.69, w: 0.18, h: 20, stroke: 'accent' },
            { x: 0.24, y: 0.5, w: 0.2, h: 20, stroke: 'primary' },
            { x: 0.76, y: 0.5, w: 0.2, h: 20, stroke: 'primary' },
            { x: 0.5, y: 0.31, w: 0.28, h: 20, stroke: 'secondary' },
            { x: 0.5, y: 0.16, w: 0.14, h: 18, stroke: 'accent' }
        ],
        ramps: [
            { x: 0.28, y: 0.8, w: 100, h: 76, dir: 'right' },
            { x: 0.72, y: 0.8, w: 100, h: 76, dir: 'left' },
            { x: 0.38, y: 0.5, w: 86, h: 58, dir: 'right' },
            { x: 0.62, y: 0.5, w: 86, h: 58, dir: 'left' }
        ],
        boostRings: [
            { x: 0.5, y: 0.53, r: 36, vx: 0, vy: -470 },
            { x: 0.24, y: 0.28, r: 25, vx: 260, vy: -240 },
            { x: 0.76, y: 0.28, r: 25, vx: -260, vy: -240 },
            { x: 0.5, y: 0.2, r: 22, vx: 0, vy: -360 }
        ]
    }
];

export const DEFAULT_CYBER_JOUST_DISTRICT = CYBER_JOUST_DISTRICTS[0];

export function getCyberJoustDistrict(slug) {
    return CYBER_JOUST_DISTRICTS.find((district) => district.slug === slug) || DEFAULT_CYBER_JOUST_DISTRICT;
}
