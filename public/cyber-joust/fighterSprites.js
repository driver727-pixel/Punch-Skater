export const CYBER_JOUST_SPRITE_MANIFEST_KEY = 'cyber-joust-sprite-manifest';
export const CYBER_JOUST_SPRITE_API_PATH = '/api/cyber-joust/sprites';
export const CYBER_JOUST_REMOTE_API_ORIGIN = 'https://card-forge-proxy.onrender.com';

export const CYBER_JOUST_COLORS = [
    { name: 'Neon Cyan', value: 0x00f0ff },
    { name: 'Cyber Pink', value: 0xff007f },
    { name: 'Laser Yellow', value: 0xffea00 },
    { name: 'Toxic Green', value: 0x39ff14 }
];

export const CYBER_JOUST_DECKS = ['Speedline', 'Gridwave', 'ToxiCorp', 'Hologram'];

export const CYBER_JOUST_WEAPONS = [
    { name: 'Hockey Stick', speed: '⚡⚡⚡', weight: '⚡', reach: '⚡⚡' },
    { name: 'Street Sign', speed: '⚡', weight: '⚡⚡⚡', reach: '⚡⚡' },
    { name: 'Crutch Lance', speed: '⚡⚡', weight: '⚡⚡', reach: '⚡⚡⚡' }
];

const COLOR_NAME_ALIASES = {
    cyan: 'Neon Cyan',
    'neon cyan': 'Neon Cyan',
    'cyber pink': 'Cyber Pink',
    'laser yellow': 'Laser Yellow',
    'toxic green': 'Toxic Green'
};

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function normalizeCyberJoustColorName(colorName) {
    const normalized = String(colorName || '').trim().toLowerCase();
    return COLOR_NAME_ALIASES[normalized] || CYBER_JOUST_COLORS[0].name;
}

export function getCyberJoustColor(colorName, colorValue) {
    const normalizedName = normalizeCyberJoustColorName(colorName);
    return (
        CYBER_JOUST_COLORS.find((entry) => entry.name === normalizedName) ||
        CYBER_JOUST_COLORS.find((entry) => entry.value === colorValue) ||
        CYBER_JOUST_COLORS[0]
    );
}

export function buildCyberJoustBodySlug(colorName, deck) {
    return `${slugify(normalizeCyberJoustColorName(colorName))}--${slugify(deck)}`;
}

export function buildCyberJoustWeaponSlug(colorName, weapon) {
    return `${slugify(normalizeCyberJoustColorName(colorName))}--${slugify(weapon)}`;
}

export function buildCyberJoustBodyTextureKey(slug) {
    return `cyber-joust-body:${slug}`;
}

export function buildCyberJoustWeaponTextureKey(slug) {
    return `cyber-joust-weapon:${slug}`;
}

function buildEmptyManifest() {
    return { version: 1, generatedAt: '', bodies: [], weapons: [], fighters: [] };
}

function resolveManifestCandidates() {
    const params = new URLSearchParams(window.location.search);
    const explicitBase = params.get('apiBase') || params.get('api');
    const sameOrigin = new URL(CYBER_JOUST_SPRITE_API_PATH, window.location.origin).toString();
    const remote = new URL(CYBER_JOUST_SPRITE_API_PATH, CYBER_JOUST_REMOTE_API_ORIGIN).toString();
    const staticManifest = new URL('./assets/fighters/manifest.json', window.location.href).toString();

    const candidates = [];
    if (explicitBase) {
        candidates.push(new URL(CYBER_JOUST_SPRITE_API_PATH, explicitBase).toString());
    }
    candidates.push(sameOrigin);
    if (remote !== sameOrigin) candidates.push(remote);
    candidates.push(staticManifest);
    return Array.from(new Set(candidates));
}

function normalizeManifest(rawManifest) {
    return {
        version: Number(rawManifest?.version || 1),
        generatedAt: typeof rawManifest?.generatedAt === 'string' ? rawManifest.generatedAt : '',
        bodies: Array.isArray(rawManifest?.bodies) ? rawManifest.bodies : [],
        weapons: Array.isArray(rawManifest?.weapons) ? rawManifest.weapons : [],
        fighters: Array.isArray(rawManifest?.fighters) ? rawManifest.fighters : []
    };
}

export async function loadCyberJoustSpriteManifest() {
    const candidates = resolveManifestCandidates();

    for (const url of candidates) {
        try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) {
                continue;
            }
            return normalizeManifest(await response.json());
        } catch (error) {
            console.warn('Cyber Joust sprite manifest load failed for', url, error);
        }
    }

    return buildEmptyManifest();
}

export function resolveCyberJoustSpriteUrl(entry) {
    if (!entry) return null;
    if (typeof entry.imageUrl === 'string' && entry.imageUrl) return entry.imageUrl;
    if (typeof entry.imagePath === 'string' && entry.imagePath) {
        return new URL(entry.imagePath, window.location.href).toString();
    }
    return null;
}

export function findCyberJoustBodySprite(manifest, cosmetics = {}) {
    const color = getCyberJoustColor(cosmetics.colorName, cosmetics.color);
    const slug = buildCyberJoustBodySlug(color.name, cosmetics.deck || 'Speedline');
    return manifest?.bodies?.find((entry) => entry.slug === slug) || null;
}

export function findCyberJoustWeaponSprite(manifest, cosmetics = {}) {
    const color = getCyberJoustColor(cosmetics.colorName, cosmetics.color);
    const slug = buildCyberJoustWeaponSlug(color.name, cosmetics.weapon || 'Crutch Lance');
    return manifest?.weapons?.find((entry) => entry.slug === slug) || null;
}
