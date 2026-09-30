// Game data shared by the client and the Colyseus server.
// Speed Fish Escape: ride your fish, train on treadmills, escape the ocean.

export const CFG = {
    maxLevel: 25,
    minWalk: 16,
    gainInterval: 0.5,
    staminaMax: 12,
    staminaDrain: 3,
    staminaRegen: 2,
    staminaDelay: 1,
    sprintMult: 1.35,
    courseWidth: 44,
    wallHeight: 46,
    voidY: -40,
    endZone: 50,
    pickupRespawn: 10,
    ballLifetime: 16,
    ballKnockback: 70,
    sharkLifetime: 6,
    fall: { raised: 2.5, warn: 0.8, fall: 0.25, down: 1.5, rise: 0.6 },
    boostMult: 2,
    boostMinutes: 15,
    reviveTimeout: 10,
    shieldTime: 3,
    starterPackDuration: 15 * 60,
    offerRotate: 45,
    rebirthStep: 0.5,
    maxPlayers: 24,
};

export const xpFor = (L) => Math.floor(20 * Math.pow(1.42, L - 1));
export const maxSpeedFor = (L, R) => Math.max(CFG.minWalk, 12 + 2 * L + 20 * (R || 0));

export const LOBBY = { halfX: 85, halfZ: 70, lower: 30, wallHeight: 46, spawn: { x: 0, y: 0.5, z: -14 } };

// bi = seconds between hazards, bs = hazard speed. Balls are rolling sea mines,
// sharks cross the lane sideways, the Chase stage sends a Megalodon after you.
export const STAGES = [
    { name: 'Stage 1', sub: 'ESCAPE THE OCEAN', subColor: '#28e0ff', type: 'LavaPath', len: 420, pw: 20, pickup: 5, wins: 1, rec: 1, bi: 4, bs: 34 },
    { name: 'Stage 2', sub: 'Crushing Rocks', subColor: '#ff5a1e', type: 'FallingWalls', len: 420, pickup: 5, wins: 3, rec: 5, bi: 5, bs: 38 },
    { name: 'Stage 3', sub: 'Golden Maze', subColor: '#ffd028', type: 'Maze', len: 440, pickup: 9, wins: 8, rec: 9, bi: 6, bs: 40 },
    { name: 'Stage 4', sub: 'Coral Obby', subColor: '#ff6ec7', type: 'Obby', len: 440, pickup: 9, wins: 20, rec: 13, bi: 6, bs: 40 },
    { name: 'Stage 5', sub: 'SHARK ATTACK', subColor: '#6fe0ff', type: 'Sharks', len: 460, pickup: 12, wins: 50, rec: 17, bi: 1.3, bs: 34 },
    { name: 'Stage 6', sub: 'MEGALODON!', subColor: '#ff3c50', type: 'Chase', len: 480, chaseSpeed: 50, chaseWait: 4, pickup: 15, wins: 100, rec: 21, bi: 4, bs: 42 },
];
{
    let z = 70;
    for (const s of STAGES) {
        s.zS = z;
        s.zE = z + s.len;
        s.cE = s.zE - CFG.endZone;
        // Stages whose floor is a continuous lane get rolling sea mines
        s.ballLane = s.type === 'LavaPath' ? s.pw / 2 : s.type === 'FallingWalls' ? CFG.courseWidth / 2 - 1 : 0;
        z = s.zE;
    }
}
export function stageAt(z) {
    for (let i = 0; i < STAGES.length; i++) if (z >= STAGES[i].zS && z < STAGES[i].zE) return i;
    return -1;
}

// Lobby order matches the reference: X25, X9, X3, four x1, X3
export const TREADMILLS = [
    { mult: 25, pass: 'RunArea25x', tag: '*SUPER OP*' },
    { mult: 9, pass: 'RunArea9x' },
    { mult: 3, req: 5 },
    { mult: 1 }, { mult: 1 }, { mult: 1 }, { mult: 1 },
    { mult: 3, req: 5 },
];
// Belt geometry (also used by the server to know who is on a treadmill)
export const TREAD_GEO = { cx: LOBBY.halfX - 12, top: 1.5, len: 16, width: 8, z0: -42, step: 12 };
export function treadmillAt(x, y, z) {
    const g = TREAD_GEO;
    if (Math.abs(x - g.cx) > g.len / 2 + 1 || y > g.top + 3 || y < g.top - 0.5) return null;
    for (let i = 0; i < TREADMILLS.length; i++) {
        if (Math.abs(z - (g.z0 + i * g.step)) <= g.width / 2 + 0.5) return TREADMILLS[i];
    }
    return null;
}

export const PORTALS = [
    { stage: 3, req: 10 }, { stage: 6, req: 100 }, { stage: 9, req: 1000 }, { stage: 12, req: 10000 }, { stage: 15, req: 200000 },
];

export const PRODUCTS = {
    Speed10K: { name: '+10K Speed', price: 29, speed: 10000 },
    Speed100K: { name: '+100K Speed', price: 79, speed: 100000 },
    Speed1M: { name: '+1M Speed', price: 149, speed: 1000000 },
    StarterPack: { name: 'OP Starter Pack', price: 19, speed: 50000, wins: 10 },
    Revive: { name: 'Revive', price: 9 },
    SpeedBoost: { name: 'x2 Speed Boost (15 min)', price: 49 },
};
export const PASSES = {
    DoubleSpeed: { name: '2x Speed', price: 3, ic: '⚡', desc: 'Double all Speed you earn' },
    DoubleWins: { name: 'x2 Wins', price: 139, ic: '🏆', desc: 'Double Wins from every stage' },
    RunArea9x: { name: '9x Run Area', price: 279, ic: '🏃', desc: 'Unlocks the x9 treadmill' },
    RunArea25x: { name: '25x Run Area', price: 399, ic: '🚀', desc: 'Unlocks the x25 treadmill' },
    CheapFish: { name: 'Cheap Fish: Piranha', price: 9, ic: '🐟', desc: '+30 Speed per step' },
    SeaSerpent: { name: 'OP Sea Serpent', price: 199, ic: '🐉', desc: '+10K Speed per step' },
    Kraken: { name: 'Kraken', price: 299, ic: '🐙', desc: '+25K Speed per step' },
    RainbowAura: { name: 'Rainbow Aura', price: 99, ic: '🌈', desc: 'x5 Speed aura' },
};
// Bloxity Bux SKUs: create these in the game's IAP catalog on bloxity.io (prices live there)
export const SKUS = {
    product: {
        Speed10K: 'speed_10k', Speed100K: 'speed_100k', Speed1M: 'speed_1m',
        StarterPack: 'starter_pack', Revive: 'revive', SpeedBoost: 'speed_boost',
    },
    pass: {
        DoubleSpeed: 'pass_double_speed', DoubleWins: 'pass_double_wins',
        RunArea9x: 'pass_run_area_9x', RunArea25x: 'pass_run_area_25x',
        CheapFish: 'pass_cheap_fish', SeaSerpent: 'pass_sea_serpent', Kraken: 'pass_kraken', RainbowAura: 'pass_rainbow_aura',
    },
};
// Bux price label for 3D text (DOM uses the coin icon instead)
export const buxText = (n) => fmt(n) + ' Bux';
export function skuLookup(sku) {
    for (const kind of ['product', 'pass']) for (const [key, s] of Object.entries(SKUS[kind])) if (s === sku) return { kind, key };
    return null;
}

export const OFFERS = [
    { title: 'OP STARTER PACK', ic: '🎁', kind: 'product', key: 'StarterPack' },
    { title: 'Cheap Fish x30', ic: '🐟', kind: 'pass', key: 'CheapFish' },
    { title: '1M Speed', ic: '👟', kind: 'product', key: 'Speed1M' },
    { title: 'Kraken', ic: '🐙', kind: 'pass', key: 'Kraken' },
    { title: '9x Run Area', ic: '🏃', kind: 'pass', key: 'RunArea9x' },
];

// Fish you ride. bonus = extra Speed per step, req = Wins to unlock.
// shape picks the model in client/src/fish.js; row 1 is the front shop row, row 2 the raised back row.
const F_ = (id, name, bonus, req, row, shape, body, belly, fin, extra) =>
    Object.assign({ id, name, bonus, req, row, shape, body, belly, fin }, extra || {});
export const FISH = [
    F_('Clownfish', 'Clownfish', 1, 0, 1, 'clown', 0xff7a1a, 0xffffff, 0xff8a2a, { stripe: 0xffffff, rarity: 'common' }),
    F_('Puffer', 'Pufferfish', 3, 3, 1, 'puffer', 0xffd028, 0xfff3b0, 0xe0a010, { rarity: 'common' }),
    F_('Snapper', 'Red Snapper', 6, 15, 1, 'snapper', 0xe8303a, 0xffb0a0, 0xb01822, { rarity: 'common' }),
    F_('Lionfish', 'Lionfish', 25, 75, 1, 'lion', 0xff6a28, 0xfff0e0, 0xffffff, { stripe: 0xffffff, rarity: 'rare' }),
    F_('Swordfish', 'Swordfish', 50, 300, 2, 'sword', 0x2f6fd8, 0xdfe8ff, 0x1c3f8a, { rarity: 'rare' }),
    F_('Stingray', 'Stingray', 100, 1000, 2, 'ray', 0x6a5a8a, 0xe8e0f0, 0x4a3a6a, { rarity: 'epic' }),
    F_('Hammerhead', 'Hammerhead', 250, 10000, 2, 'hammer', 0x7a8ca8, 0xeef2f8, 0x5a6a86, { rarity: 'epic' }),
    F_('Angler', 'Anglerfish', 500, 50000, 2, 'angler', 0x2a1f3c, 0x3c2c52, 0x1a1428, { glow: 0x6ffcff, rarity: 'legendary' }),
    F_('Orca', 'Orca', 1000, 100000, 2, 'orca', 0x16161c, 0xf5f5f5, 0x16161c, { rarity: 'legendary' }),
    F_('Megalodon', 'Megalodon', 2500, 1000000, 2, 'shark', 0x2a3a66, 0xf0e8ee, 0x1c2848, { rarity: 'mythic', size: 1.25 }),
    F_('Piranha', 'Piranha', 30, 0, 0, 'piranha', 0xd8182c, 0xff6070, 0x8a0c18, { pass: 'CheapFish', special: true, tagline: '*CHEAP FISH!*', rarity: 'rare' }),
    F_('SeaSerpent', 'Sea Serpent', 10000, 0, 0, 'serpent', 0x1ec8b4, 0xc8fff0, 0x0a7a8a, { pass: 'SeaSerpent', special: true, tagline: '*X10 VALUE*', aura: 0x28e0ff, rarity: 'mythic' }),
    F_('Kraken', 'Kraken', 25000, 0, 0, 'kraken', 0xc42850, 0xff90b0, 0x7a1030, { pass: 'Kraken', special: true, tagline: '*INSANE VALUE*', aura: 0xff3c78, rarity: 'mythic' }),
];
export const RARITY = {
    common: { name: 'COMMON', color: 0x6fe0ff },
    rare: { name: 'RARE', color: 0x46ec50 },
    epic: { name: 'EPIC', color: 0xc428ff },
    legendary: { name: 'LEGENDARY', color: 0xffd028 },
    mythic: { name: 'MYTHIC', color: 0xff3c50 },
};
export const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));
export const STARTER_FISH = 'Clownfish';

export const AURAS = [
    { id: 'Bubbles', name: 'Bubbles', req: 10, mult: 1.1, color: 0xffffff, ic: '🫧' },
    { id: 'Tidal', name: 'Tidal Wave', req: 50, mult: 1.25, color: 0x288cff, ic: '🌊' },
    { id: 'Inferno', name: 'Lava Heat', req: 250, mult: 1.5, color: 0xff6e14, ic: '🔥' },
    { id: 'Lightning', name: 'Electric Eel', req: 1000, mult: 2, color: 0x5ae6ff, ic: '⚡' },
    { id: 'Abyss', name: 'Abyss', req: 5000, mult: 3, color: 0xaa46ff, ic: '🌌' },
    { id: 'Rainbow', name: 'Rainbow', pass: 'RainbowAura', mult: 5, color: 0xff50c8, ic: '🌈' },
];
export const auraById = Object.fromEntries(AURAS.map((a) => [a.id, a]));

// Session playtime rewards (minutes since joining)
export const FREE = [
    { min: 2, speed: 500 }, { min: 5, wins: 2 }, { min: 10, speed: 5000 },
    { min: 15, wins: 5 }, { min: 25, speed: 25000 }, { min: 40, wins: 15 },
];

// Daily login streak: one claim per UTC day, missing a day resets the streak.
// Day 7 repeats once the streak goes past a week.
export const DAILY = [
    { speed: 200 }, { speed: 5000 }, { wins: 3 }, { speed: 25000 }, { wins: 10 }, { speed: 100000 }, { wins: 30, speed: 250000 },
];
export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
// Daily state at time now: can = claimable, streak = days claimed in a row, day = DAILY index of the next (or last) claim
export function dailyStatus(d, now) {
    d = d || {};
    const today = dayKey(now), yesterday = dayKey(now - 86400000);
    const can = d.last !== today;
    const streak = d.last === today || d.last === yesterday ? d.streak || 0 : 0;
    return { can, streak, day: Math.min(DAILY.length - 1, can ? streak : Math.max(0, streak - 1)) };
}
export const rewardText = (r) => [r.speed ? '+' + fmt(r.speed) + ' Speed' : '', r.wins ? '+' + r.wins + ' Wins' : ''].filter(Boolean).join(' & ');

// Rider outfits cycle by join order so players look different from each other
export const KITS = [
    { shirt: 0x2f7bff, shorts: 0x1e2a44, socks: 0x2f7bff },
    { shirt: 0xe82434, shorts: 0x14141e, socks: 0xe82434 },
    { shirt: 0x28c43c, shorts: 0x1e2a44, socks: 0x28c43c },
    { shirt: 0xffb51c, shorts: 0x1e3caa, socks: 0xffb51c },
    { shirt: 0x8a1cff, shorts: 0x1e2a44, socks: 0x8a1cff },
    { shirt: 0x14141e, shorts: 0x14141e, socks: 0xffd028 },
    { shirt: 0xff3fa0, shorts: 0x1e2a44, socks: 0xff3fa0 },
    { shirt: 0x1ec8b4, shorts: 0x14141e, socks: 0x1ec8b4 },
];
export const SKINS = [0xe1af87, 0xc88c5f, 0x8c5a3c, 0x5f3c28, 0xf0c8a0];

// Combined multiplier for earned Speed: rebirths, aura, 2x pass, timed boost
export function speedMult(p, now) {
    let m = 1 + (p.rebirths || 0) * CFG.rebirthStep;
    const a = auraById[p.aura];
    if (a) m *= a.mult;
    if (p.passes && p.passes.DoubleSpeed) m *= 2;
    if ((now || Date.now()) < (p.boostUntil || 0)) m *= CFG.boostMult;
    return m;
}

const SUF = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
// 2700 -> "2.7K", 1000000 -> "1M", 950 -> "950"
export function fmt(v) {
    v = Math.floor(v || 0);
    if (v < 1000) return String(v);
    let i = -1, s = v;
    while (s >= 1000 && i < SUF.length - 1) { s /= 1000; i++; }
    const t = s >= 100 ? String(Math.floor(s)) : (Math.floor(s * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return t + SUF[i];
}
// Leaderboard style: 6700000 -> "6.7e+6"
export function sci(v) {
    v = Math.floor(v || 0);
    if (v < 100000) return fmt(v);
    const e = Math.floor(Math.log10(v));
    return (Math.floor(v / Math.pow(10, e) * 10) / 10).toFixed(1) + 'e+' + e;
}
export function clock(s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function rngFrom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
