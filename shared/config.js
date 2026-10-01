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
    endZone: 36,
    pickupRespawn: 10,
    sharkLifetime: 6,
    // Stage 2 stone walls: seconds up, shaking, dropping, down, rising (reference: ~4 s down)
    fall: { raised: 3, warn: 0.6, fall: 0.5, down: 3.5, rise: 1.6 },
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

export const LOBBY = { halfX: 85, halfZ: 70, lower: 30, wallHeight: 46, spawn: { x: -2, y: 0.5, z: 0 } };

// Stages 1-4 follow reference/game satges.mp4; 5 and 6 are our own, in the same style.
// w = stage width, door = opening in the "Stage N" wall at its start.
// Sharks: bi = seconds between sharks, bs = their swim speed.
export const STAGES = [
    { name: 'Stage 1', sub: 'ESCAPE THE OCEAN', subColor: '#28e0ff', type: 'Ocean', len: 230, w: 40, door: 40, pickup: 1, wins: 1 },
    { name: 'Stage 2', sub: '', type: 'FallingWalls', len: 300, w: 30, door: 30, pickup: 1, wins: 3 },
    { name: 'Stage 3', sub: '', type: 'Maze', len: 300, w: 64, door: 16, pickup: 1, wins: 8 },
    { name: 'Stage 4', sub: '', type: 'Sharks', len: 320, w: 44, door: 26, pickup: 1, wins: 20, bi: 1.2, bs: 30 },
    { name: 'Stage 5', sub: 'Coral Obby', subColor: '#ff6ec7', type: 'Obby', len: 360, w: 44, door: 24, pickup: 1, wins: 50 },
    { name: 'Stage 6', sub: 'MEGALODON!', subColor: '#ff3c50', type: 'Chase', len: 420, w: 44, door: 30, chaseSpeed: 50, chaseWait: 4, pickup: 1, wins: 100 },
];
{
    let z = 70;
    for (const s of STAGES) {
        s.zS = z;
        s.zE = z + s.len;
        s.cE = s.zE - CFG.endZone;
        z = s.zE;
    }
}
export function stageAt(z) {
    for (let i = 0; i < STAGES.length; i++) if (z >= STAGES[i].zS && z < STAGES[i].zE) return i;
    return -1;
}

// Right-hand side of the lobby (-x, facing Stage 1), listed south to north like the reference: X25, four x1, X3, X9
export const TREADMILLS = [
    { mult: 25, pass: 'RunArea25x', tag: '*SUPER OP*' },
    { mult: 1 }, { mult: 1 }, { mult: 1 }, { mult: 1 },
    { mult: 3 },
    { mult: 9, pass: 'RunArea9x' },
];
// Belt geometry (also used by the server to know who is on a treadmill)
export const TREAD_GEO = { cx: -(LOBBY.halfX - 14), top: 1.5, len: 14, width: 7, z0: -4, step: 10 };
export function treadmillAt(x, y, z) {
    const g = TREAD_GEO;
    if (Math.abs(x - g.cx) > g.len / 2 + 1 || y > g.top + 3 || y < g.top - 0.5) return null;
    for (let i = 0; i < TREADMILLS.length; i++) {
        if (Math.abs(z - (g.z0 + i * g.step)) <= g.width / 2 + 0.5) return TREADMILLS[i];
    }
    return null;
}

// Lobby freebies: the Group Chest (once a day), the turtle (after playing a while)
// and the "Keep playing" hut's free Speed Boost
export const GROUP_CHEST = { hours: 24, speed: 2500, wins: 2 };
export const TURTLE_MINUTES = 20;
export const FREE_BOOST_MINUTES = 15;

export const PRODUCTS = {
    Speed10K: { name: '+10K Speed', price: 29, speed: 10000 },
    Speed100K: { name: '+100K Speed', price: 79, speed: 100000 },
    Speed1M: { name: '+1M Speed', price: 149, speed: 1000000 },
    StarterPack: { name: 'OP Starter Pack', price: 19, speed: 50000, wins: 10 },
    Revive: { name: 'Revive', price: 9 },
    SpeedBoost: { name: 'x2 Speed Boost (15 min)', price: 49 },
    Wins500: { name: '+500 Wins', price: 99, wins: 500 },
    Wins5K: { name: '+5K Wins', price: 399, wins: 5000 },
};
export const PASSES = {
    DoubleSpeed: { name: '2x Speed', price: 3, ic: '⚡', desc: 'Double all Speed you earn' },
    DoubleWins: { name: 'x2 Wins', price: 139, ic: '🏆', desc: 'Double Wins from every stage' },
    RunArea9x: { name: '9x Run Area', price: 279, ic: '🏃', desc: 'Unlocks the x9 treadmill' },
    RunArea25x: { name: '25x Run Area', price: 399, ic: '🚀', desc: 'Unlocks the x25 treadmill' },
    CheapFish: { name: 'Cheap Fish: Piranha', price: 9, ic: '🐟', desc: '+30 Speed per step' },
    SeaSerpent: { name: 'OP Serpent', price: 199, ic: '🐉', desc: '+200 Speed per step' },
    RainbowAura: { name: 'Rainbow Aura', price: 99, ic: '🌈', desc: 'x5 Speed aura' },
};
// Bloxity Bux SKUs: create these in the game's IAP catalog on bloxity.io (prices live there)
export const SKUS = {
    product: {
        Speed10K: 'speed_10k', Speed100K: 'speed_100k', Speed1M: 'speed_1m',
        StarterPack: 'starter_pack', Revive: 'revive', SpeedBoost: 'speed_boost',
        Wins500: 'wins_500', Wins5K: 'wins_5k',
    },
    pass: {
        DoubleSpeed: 'pass_double_speed', DoubleWins: 'pass_double_wins',
        RunArea9x: 'pass_run_area_9x', RunArea25x: 'pass_run_area_25x',
        CheapFish: 'pass_cheap_fish', SeaSerpent: 'pass_sea_serpent', RainbowAura: 'pass_rainbow_aura',
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
    { title: 'OP Serpent', ic: '🐉', kind: 'pass', key: 'SeaSerpent' },
    { title: '9x Run Area', ic: '🏃', kind: 'pass', key: 'RunArea9x' },
];

// Fish you ride, in the reference's shop order. bonus = extra Speed per step, req = Wins to unlock.
// shape picks the model in client/src/fish.js. Row 1 is the low front row (south to north),
// row 2 the raised back row; the turtle is claimed after playing TURTLE_MINUTES.
const F_ = (id, name, bonus, req, row, shape, body, belly, fin, extra) =>
    Object.assign({ id, name, bonus, req, row, shape, body, belly, fin }, extra || {});
export const FISH = [
    F_('Clownfish', 'Clownfish', 1, 0, 1, 'clown', 0xff7a1a, 0xffffff, 0xff8a2a, { stripe: 0xffffff }),
    F_('Puffer', 'Pufferfish', 3, 3, 1, 'puffer', 0xffd028, 0xfff3b0, 0xe0a010),
    F_('Snapper', 'Red Snapper', 6, 15, 1, 'snapper', 0xe8303a, 0xffb0a0, 0xb01822),
    F_('Lionfish', 'Lionfish', 25, 75, 1, 'lion', 0xff6a28, 0xfff0e0, 0xffffff, { stripe: 0xffffff }),
    F_('Piranha', 'Piranha', 30, 0, 1, 'piranha', 0xd8182c, 0xff6070, 0x8a0c18, { pass: 'CheapFish', tagline: 'Cheap Fish!' }),
    F_('SeaSerpent', 'OP Serpent', 200, 0, 1, 'serpent', 0x1ec8e0, 0xc8fff8, 0x0a8aa8, { pass: 'SeaSerpent', tagline: 'OP SERPENT!', glow: 0x6ff6ff }),
    F_('Swordfish', 'Blue Marlin', 50, 400, 2, 'sword', 0x1e4fd8, 0xf0f4ff, 0x14308a),
    F_('Orca', 'Orca', 100, 2000, 2, 'orca', 0x16161c, 0xf5f5f5, 0x16161c, { size: 1.15 }),
    F_('WhaleShark', 'Whale Shark', 250, 10000, 2, 'whale', 0x1a2a6a, 0xe8eef8, 0x121e50, { stripe: 0xffffff, size: 1.2 }),
    F_('GreatWhite', 'Great White', 500, 40000, 2, 'shark', 0x9aa2b0, 0xf4f4f4, 0x7a8290, { size: 1.25 }),
    F_('Leviathan', 'Leviathan', 1000, 200000, 2, 'leviathan', 0x2ab8c8, 0xfff4d8, 0x14303a, { glow: 0xff5ab4, size: 1.35 }),
    F_('AbyssKing', 'Abyss King', 2500, 1000000, 2, 'abyss', 0x2a1838, 0x3c2450, 0x140c1e, { glow: 0xff2aa0, size: 1.45 }),
    F_('BloodJaws', 'Blood Jaws', 5000, 4000000, 2, 'jaws', 0xe01e2a, 0xffffff, 0xa0101c, { size: 1.55 }),
    F_('Turtle', 'Sea Turtle', 150, 0, 0, 'turtle', 0x46e03c, 0xf0e890, 0x2aa028, { timed: true }),
];
export const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));
export const STARTER_FISH = 'Clownfish';
// Look of the hazard sharks and the Stage 6 Megalodon (not in the shop)
export const SHARK_LOOK = { id: 'Megalodon', shape: 'shark', body: 0x2a3a66, belly: 0xf0e8ee, fin: 0x1c2848 };

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
