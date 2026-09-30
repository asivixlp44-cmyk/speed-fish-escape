import {
    T, V3, scene, mat, box, aabb, UNIT, solids, kills, triggers, prompts, tickers,
    texFrom, billboard, textPlane, signBoard, hexCss, camera,
} from './engine.js';
import { S, actions } from './state.js';
import { lavaMaterial, brickMaterial, bannerMaterial, waterMaterial } from './textures.js';
import { emitTread, bubble } from './fx.js';
import { buildFish, swimFish } from './fish.js';
import {
    CFG, LOBBY, STAGES, TREADMILLS, TREAD_GEO, PORTALS, PRODUCTS, PASSES, FISH, RARITY, fishById, fmt, sci, clamp, rngFrom, buxText,
} from '../../shared/config.js';

const HX = LOBBY.halfX, HZ = LOBBY.halfZ, LOWER = LOBBY.lower, WALLH = LOBBY.wallHeight;
// Lobby: blue sea-floor studs, sand paths, sandstone and blue stone walls, Atlantis gold
const LC = {
    floor: 0x3a86e8, sand: 0xf2d27a, platform: 0xd9b25a, lower: 0xe8c46a, pillar: 0xf0b43c, stone: 0x6a7ea8,
    frame: 0xc99a3a, frameInner: 0x2a5aa8, kelp: 0x2ee07a, kelpDark: 0x1aa85a, lavender: 0x7fe8ff,
    treadSign: 0x2a7ad8, shopSign: 0xe8508a, pedestal: 0xffcd28, portal: 0xffdc28, gold: 0xffc83a, dome: 0xff8fc8,
};
// Course: water lanes, blue stone walls, sandstone pillars
const CC = {
    red: 0xe82434, wall: 0x5c6c94, sidewalk: 0xe0c070, ceiling: 0x1c2c52, pillar: 0xf0b43c, spike: 0x7fe8ff,
    falling: 0x8a96b0, yellow: 0xffd028, purple: 0xc428ff, chase: 0x3c4a78, ledge: 0x6a78a0, plaque: 0x2a5aa8, gold: 0xffc83a,
};
const CORAL = [0xff4a6a, 0xff9a3c, 0xffd028, 0xff6ec7, 0xb45aff, 0x3ce8c8];

export const SPAWN = new V3(LOBBY.spawn.x, LOBBY.spawn.y, LOBBY.spawn.z);
export const slabs = [];
export const pickups = [];
export let beltTex;
const shopItems = [];
const treadItems = [];
const boards = {};

// =====================================================================================
// Decoration
// =====================================================================================
// Swaying kelp stalk: stacked leaves on a pivot at the root
function kelp(rng, x, z, h) {
    const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
    const n = Math.max(3, Math.round(h / 2.2));
    const segs = [];
    let prev = g;
    for (let i = 0; i < n; i++) {
        const s = new T.Group(); s.position.y = i ? 2.2 : 0; prev.add(s);
        const leaf = new T.Mesh(UNIT, mat(i % 2 ? LC.kelp : LC.kelpDark));
        leaf.scale.set(1.3 - i * 0.05, 2.3, 0.35); leaf.position.y = 1.1; s.add(leaf);
        if (i % 2) { const side = new T.Mesh(UNIT, mat(LC.kelp)); side.scale.set(1.4, 0.8, 0.3); side.position.set(0.8, 1.2, 0); side.rotation.z = -0.6; s.add(side); }
        segs.push(s); prev = s;
    }
    const ph = rng() * 6;
    tickers.push((dt, t) => {
        if (camera.position.distanceToSquared(g.position) > 160 * 160) return;
        for (let i = 0; i < segs.length; i++) segs[i].rotation.z = Math.sin(t * 1.1 + ph + i * 0.5) * 0.09;
    });
    return g;
}
// Cluster of blocky coral in reef colours
function coral(rng, x, z, scale) {
    scale = scale || 1;
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
        const c = CORAL[Math.floor(rng() * CORAL.length)];
        const h = (1.5 + rng() * 3) * scale, w = (0.7 + rng() * 0.6) * scale;
        const px = x + (rng() * 2 - 1) * 2 * scale, pz = z + (rng() * 2 - 1) * 2 * scale;
        box(w, h, w, px, h / 2, pz, c, { decor: true });
        if (rng() < 0.7) box(w * 0.8, w * 0.8, w * 2.2, px, h * 0.7, pz, c, { decor: true });
        if (rng() < 0.5) box(w * 2.2, w * 0.8, w * 0.8, px, h * 0.5, pz, c, { decor: true });
    }
}
// Vent on the floor that keeps puffing bubbles
function bubbleVent(x, y, z, color) {
    const at = new V3(x, y, z);
    let acc = Math.random();
    tickers.push((dt) => {
        if (camera.position.distanceToSquared(at) > 120 * 120) return;
        acc += dt * 4;
        while (acc > 1) { acc -= 1; bubble(at, color || 0xbfeaff); }
    });
}
// Atlantis tower: gold shaft with windows, pink dome and a spire
function tower(x, z, h, r) {
    const shaft = new T.Mesh(new T.CylinderGeometry(r, r * 1.1, h, 12), mat(LC.gold));
    shaft.position.set(x, h / 2, z); scene.add(shaft);
    for (let k = 0; k < 3; k++) {
        const band = new T.Mesh(new T.CylinderGeometry(r * 1.08, r * 1.08, 1.2, 12), mat(0xe0a020));
        band.position.set(x, h * (0.35 + k * 0.22), z); scene.add(band);
    }
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const w = new T.Mesh(UNIT, mat(0x7fe8ff, { neon: true }));
        w.scale.set(1.4, 3.2, 0.3); w.position.set(x + Math.sin(a) * r, h * 0.72, z + Math.cos(a) * r); w.rotation.y = a; scene.add(w);
    }
    const dome = new T.Mesh(new T.SphereGeometry(r * 1.25, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(LC.dome));
    dome.position.set(x, h, z); scene.add(dome);
    const spire = new T.Mesh(new T.ConeGeometry(r * 0.35, r * 2.2, 8), mat(LC.gold));
    spire.position.set(x, h + r * 1.2 + r * 1.1, z); scene.add(spire);
}
// Light shafts from the surface: soft additive columns that slowly breathe
const rayTex = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 4, 128);
    return texFrom(c);
})();
function lightRay(x, z, w, tilt) {
    const m = new T.MeshBasicMaterial({ map: rayTex, color: 0x9fdcff, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false, toneMapped: false });
    const p = new T.Mesh(new T.PlaneGeometry(w, 90), m);
    p.position.set(x, 45, z); p.rotation.set(0, Math.random() * Math.PI, tilt);
    scene.add(p);
    const ph = Math.random() * 6;
    tickers.push((dt, t) => { m.opacity = 0.1 + Math.sin(t * 0.5 + ph) * 0.05; });
}
function treasureChest(pos, face) {
    const g = new T.Group(); g.position.copy(pos); g.rotation.y = Math.atan2(face.x, face.z); scene.add(g);
    const part = (sx, sy, sz, x, y, z, c, o) => { const m = new T.Mesh(UNIT, mat(c, o)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = !(o && o.neon); g.add(m); return m; };
    part(6, 3.4, 4, 0, 1.7, 0, 0x8a4a1c);
    part(6.2, 0.5, 4.2, 0, 1.2, 0, 0xffc83a);
    const lid = part(6.1, 1.6, 4.1, 0, 4.1, -0.6, 0x9a5424); lid.rotation.x = -0.5;
    part(1, 1, 0.3, 0, 2.6, 2.1, 0xffc83a);
    for (let i = 0; i < 9; i++) part(0.9, 0.9, 0.9, (i % 3 - 1) * 1.5, 3.5 + (i % 2) * 0.3, (Math.floor(i / 3) - 1) * 0.9, i % 4 ? 0xffd84a : 0x7fe8ff, { neon: i % 4 === 0 });
    solids.push(aabb(pos.x, 2, pos.z, 6.4, 4, 6.4));
    bubbleVent(pos.x, 4, pos.z, 0xffe07a);
}
function leaderboard(pos, title, color) {
    const g = new T.Group(); g.position.copy(pos); scene.add(g);
    for (const sx of [-9, 9]) {
        const leg = new T.Mesh(UNIT, mat(LC.pillar)); leg.scale.set(2, 26, 2); leg.position.set(sx, 13, 0); g.add(leg);
        solids.push(aabb(pos.x + sx, 13, pos.z, 2, 26, 2));
    }
    const back = new T.Mesh(UNIT, mat(0x2a5aa8)); back.scale.set(20, 22, 1.4); back.position.set(0, 16, 0.4); g.add(back);
    const head = new T.Mesh(UNIT, mat(color)); head.scale.set(22, 4, 2); head.position.set(0, 28.5, 0); head.rotation.x = -0.18; g.add(head);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 560;
    const tex = texFrom(cv);
    const scr = new T.Mesh(new T.PlaneGeometry(18, 19.7), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
    scr.position.set(0, 16, -0.35); scr.rotation.y = Math.PI; g.add(scr);
    textPlane([{ t: 'Most ' + title.split(' ')[1], c: '#fff', s: '#16121f', px: 60 }], 16, 512, new V3(pos.x, 28.6, pos.z - 1.2), new V3(pos.x, 28.6, pos.z - 10));
    billboard([{ t: title, c: hexCss(color), s: '#ffffff', px: 80 }], 18, 512, new V3(pos.x, 35, pos.z));
    return { cv, tex };
}
function drawBoard(b, rows, kind) {
    const x = b.cv.getContext('2d');
    x.fillStyle = '#0f2146'; x.fillRect(0, 0, 512, 560);
    x.font = '700 30px Fredoka, sans-serif'; x.textBaseline = 'middle';
    if (!rows.length) {
        x.textAlign = 'center'; x.fillStyle = '#bfe4ff'; x.fillText('Be the first!', 256, 280);
    }
    rows.forEach((r, i) => {
        const y = 32 + i * 54;
        x.fillStyle = r.you ? 'rgba(70,236,80,0.28)' : (i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)');
        x.fillRect(8, y - 24, 496, 48);
        const rank = r.rank || i + 1;
        x.fillStyle = rank === 1 ? '#ffd028' : rank === 2 ? '#dfe4f0' : rank === 3 ? '#e0925a' : '#ffffff';
        x.textAlign = 'left'; x.fillText('#' + rank, 18, y);
        x.fillStyle = r.you ? '#7dff6b' : '#ffffff'; x.fillText(r.n.slice(0, 16), 86, y);
        x.textAlign = 'right'; x.fillStyle = kind === 'speed' ? '#6fe0ff' : '#ffb51c';
        x.fillText(kind === 'speed' ? sci(r.v) : fmt(r.v), 496, y);
    });
    b.tex.needsUpdate = true;
}
// msg = { speed: [{n, v}], wins: [...] } from the server, top 10 each
export function renderBoards(msg) {
    if (!boards.speed || !msg) return;
    for (const kind of ['speed', 'wins']) {
        const rows = (msg[kind] || []).map((r, i) => ({ n: r.n, v: r.v, rank: i + 1, you: r.n === S.name }));
        drawBoard(boards[kind], rows, kind);
    }
}

// =====================================================================================
// Fish shop pedestals
// =====================================================================================
function pedestalLines(d) {
    const rar = RARITY[d.rarity] || RARITY.common;
    const lines = [{ t: rar.name, c: hexCss(rar.color), s: '#16121f', px: 40 }, { t: d.name, c: '#ffffff', s: '#16121f', px: 64 }];
    if (d.tagline) lines.push({ t: d.tagline, c: '#ff4a4a', s: '#16121f', px: 44 });
    lines.push({ t: '+' + fmt(d.bonus) + '/Speed', c: '#7dff6b', s: '#16121f', px: 50 });
    if (S.equipped === d.id) lines.push({ t: 'EQUIPPED', c: '#6fe0ff', s: '#16121f', px: 48 });
    else if (S.owned[d.id]) lines.push({ t: 'OWNED', c: '#ffffff', s: '#16121f', px: 48 });
    else if (d.pass) lines.push({ t: 'ONLY ' + buxText(PASSES[d.pass].price), c: '#ffd23a', s: '#16121f', px: 50 });
    else lines.push({ t: fmt(d.req) + ' Wins Required', c: '#ffd028', s: '#16121f', px: 44 });
    return lines;
}
// Vertical fade used by the pedestal light columns
const columnTex = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 4, 128);
    return texFrom(c);
})();
function buildPedestal(d, pos, face) {
    const rar = RARITY[d.rarity] || RARITY.common;
    const glow = d.aura || rar.color;
    box(7.8, 0.5, 8.8, pos.x, pos.y + 0.25, pos.z, 0xe0a020, { decor: true });
    box(7, 1, 8, pos.x, pos.y + 0.6, pos.z, LC.pedestal);
    const ring = new T.Mesh(new T.CylinderGeometry(3.3, 3.3, 0.1, 40), mat(glow, { neon: true }));
    ring.position.set(pos.x, pos.y + 1.12, pos.z); scene.add(ring);
    const colMat = new T.MeshBasicMaterial({ map: columnTex, color: glow, transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, toneMapped: false });
    const col = new T.Mesh(new T.CylinderGeometry(3.1, 3.1, 9, 32, 1, true), colMat);
    col.position.set(pos.x, pos.y + 5.6, pos.z); scene.add(col);
    const fish = buildFish(d);
    const baseY = pos.y + 1.6;
    fish.position.set(pos.x, baseY, pos.z);
    const yaw = Math.atan2(face.x, face.z);
    fish.rotation.y = yaw + 0.6;
    scene.add(fish);
    const bubbleAt = new V3(pos.x, pos.y + 1.2, pos.z);
    let acc = Math.random();
    const phase = Math.random() * 6;
    tickers.push((dt, t) => {
        colMat.opacity = 0.5 + Math.sin(t * 2 + phase) * 0.1;
        if (camera.position.distanceToSquared(bubbleAt) > 110 * 110) return;
        // Hover and turn slowly so the whole fish is visible
        swimFish(fish, dt, false);
        fish.position.y = baseY + 0.6 + Math.sin(t * 1.6 + phase) * 0.35;
        fish.rotation.y = yaw + Math.sin(t * 0.6 + phase) * 0.9;
        acc += dt * 3;
        while (acc > 1) { acc -= 1; bubble(bubbleAt, glow); }
    });
    // Back-row labels sit higher so they clear the front row's
    const sp = billboard(pedestalLines(d), 9, 512, new V3(pos.x, pos.y + 13 + (d.row === 2 ? 5 : 0) + (d.size || 1) * 1.5, pos.z));
    shopItems.push({ d, sp, sig: '' });
    prompts.push({
        pos: new V3(pos.x, pos.y + 3, pos.z), r: 9,
        label: () => S.equipped === d.id ? 'Riding' : S.owned[d.id] ? 'Ride ' + d.name : d.pass ? 'Buy ' + d.name : S.wins >= d.req ? 'Unlock ' + d.name : 'Need ' + fmt(d.req) + ' Wins',
        act: () => actions.shop(d),
    });
}

export function treadLocked(def) {
    if (def.pass) return !S.passes[def.pass];
    if (def.req) return S.wins < def.req;
    return false;
}
function treadLines(def) {
    const col = def.mult === 25 ? '#c28cff' : def.mult === 9 ? '#6fe0ff' : def.mult === 3 ? '#ffbe28' : '#ffffff';
    const lines = [{ t: 'x' + def.mult + ' Speed', c: col, s: '#16121f', px: 70 }];
    if (def.tag) lines.push({ t: def.tag, c: '#ff4a4a', s: '#16121f', px: 44 });
    if (treadLocked(def)) lines.push({ t: def.pass ? '🔒 ' + buxText(PASSES[def.pass].price) : '🔒 ' + def.req + ' Wins', c: '#ffd028', s: '#16121f', px: 48 });
    return lines;
}
export function refreshShop() {
    for (const it of shopItems) {
        const sig = S.equipped + (S.owned[it.d.id] ? 1 : 0) + (it.d.pass ? PASSES[it.d.pass].price : '');
        if (sig !== it.sig) { it.sig = sig; it.sp.userData.set(pedestalLines(it.d)); }
    }
    for (const t of treadItems) {
        const sig = (treadLocked(t.def) ? 'l' : 'u') + (t.def.pass ? PASSES[t.def.pass].price : '');
        if (sig !== t.sig) { t.sig = sig; t.sp.userData.set(treadLines(t.def)); }
    }
}
function buildTreadmill(def, cx, top, cz) {
    const L = TREAD_GEO.len, W = TREAD_GEO.width;
    const accent = def.mult === 25 ? 0x965aff : def.mult === 9 ? 0x3cc8ff : def.mult === 3 ? 0xff961e : 0xa5a5af;
    const neon = def.mult > 1;
    const belt = new T.Mesh(UNIT, new T.MeshLambertMaterial({ map: beltTex, color: 0xffffff }));
    belt.scale.set(L, 0.6, W); belt.position.set(cx, top + 0.3, cz); belt.receiveShadow = true; scene.add(belt);
    const c = aabb(cx, top + 0.3, cz, L, 0.6, W); c.belt = new V3(-12, 0, 0); c.tread = def; solids.push(c);
    for (const s of [-1, 1]) {
        box(L, 0.9, 0.6, cx, top + 0.45, cz + s * (W / 2 + 0.3), accent, { neon });
        box(0.6, 5, 0.6, cx + L / 2 - 0.5, top + 2.5, cz + s * (W / 2), 0x464650, { decor: true });
    }
    box(0.6, 0.6, W + 0.6, cx + L / 2 - 0.5, top + 4.2, cz, 0x464650, { decor: true });
    box(1, 2.4, W - 0.4, cx + L / 2, top + 5.8, cz, 0x23232a, { decor: true });
    textPlane([{ t: 'x' + def.mult, c: neon ? hexCss(accent) : '#ffffff', px: 90 }], 4, 256, new V3(cx + L / 2 - 0.55, top + 5.8, cz), new V3(cx - 10, top + 5.8, cz));
    const sp = billboard(treadLines(def), 10, 512, new V3(cx - 2, top + 11, cz));
    treadItems.push({ def, sp, sig: '' });
    if (def.mult > 1) {
        const at = new V3(cx, top + 0.7, cz);
        let acc = Math.random();
        tickers.push((dt) => { acc += dt * 14; while (acc > 1) { acc -= 1; emitTread(at, def.mult, L, W); } });
    }
}

// =====================================================================================
// Lobby: Atlantis plaza
// =====================================================================================
function buildLobby() {
    const rng = rngFrom(7);
    const half = CFG.courseWidth / 2;
    box(HX * 2, 2, HZ * 2, 0, -1, 0, LC.floor, { studs: true });
    box(CFG.courseWidth, 0.1, 38, 0, 0.05, HZ - 19, LC.sand, { studs: true, decor: true });
    box(28, 0.1, 76, -44, 0.05, 0, LC.sand, { studs: true, decor: true });
    box(28, 0.1, 96, 48, 0.05, 0, LC.sand, { studs: true, decor: true });

    // Sandstone lower walls with blue stone above and crenellations on top
    const wall = (sx, sz, x, z) => {
        box(sx, LOWER, sz, x, LOWER / 2, z, LC.lower);
        box(sx + 0.6, WALLH - LOWER, sz + 0.6, x, LOWER + (WALLH - LOWER) / 2, z, LC.stone);
        const along = sx > sz, n = Math.floor((along ? sx : sz) / 8);
        for (let i = 0; i < n; i++) {
            const o = -(along ? sx : sz) / 2 + 4 + i * 8;
            box(along ? 4 : sx + 1, 3, along ? sz + 1 : 4, x + (along ? o : 0), WALLH + 1.5, z + (along ? 0 : o), LC.stone, { decor: true });
        }
    };
    const seg = HX - half;
    wall(seg, 2, -(half + seg / 2), HZ + 1);
    wall(seg, 2, half + seg / 2, HZ + 1);
    wall(HX * 2 + 4, 2, 0, -HZ - 1);
    wall(2, HZ * 2, -HX - 1, 0);
    wall(2, HZ * 2, HX + 1, 0);
    for (let x = -72; x <= 72; x += 24) {
        if (Math.abs(x) > half + 4) {
            box(4, LOWER, 2.4, x, LOWER / 2, HZ - 1.2, LC.pillar);
            if (Math.abs(x + 12) > half + 6 && x + 12 < HX - 6) {
                box(11, 20, 0.4, x + 12, 10, HZ - 0.2, LC.frame, { decor: true });
                box(8, 17.5, 0.5, x + 12, 8.75, HZ - 0.3, LC.frameInner, { decor: true });
            }
        }
    }
    for (let z = -60; z <= 60; z += 20) {
        box(2.4, LOWER, 4, -HX + 1.2, LOWER / 2, z, LC.pillar);
        box(2.4, LOWER, 4, HX - 1.2, LOWER / 2, z, LC.pillar);
        if (z < 60) {
            box(0.4, 20, 11, -HX + 0.2, 10, z + 10, LC.frame, { decor: true });
            box(0.5, 17.5, 8, -HX + 0.3, 8.75, z + 10, LC.frameInner, { decor: true });
        }
    }
    // Atlantis skyline beyond the walls, light from the surface, kelp and coral inside
    for (const [x, z, h, r] of [[-120, 40, 90, 7], [-110, -60, 75, 6], [120, -20, 95, 8], [105, 70, 70, 5], [-40, -115, 85, 7], [45, -120, 100, 8], [-70, 120, 72, 6], [75, 125, 80, 6]]) tower(x, z, h, r);
    for (let i = 0; i < 9; i++) lightRay(-70 + i * 18, -50 + (i % 3) * 45, 10 + (i % 3) * 4, (i % 2 ? 1 : -1) * 0.12);
    for (let x = -76; x <= 76; x += 13) { kelp(rng, x, HZ - 3.5, 10 + rng() * 10); kelp(rng, x + 5, -HZ + 3.5, 8 + rng() * 12); }
    for (let z = -60; z <= 60; z += 15) { kelp(rng, -HX + 3.5, z, 10 + rng() * 12); }
    for (const [x, z] of [[-26, 44], [26, 44], [-28, -40], [-32, 20], [30, -52], [-60, 58], [56, 60], [-8, -52]]) coral(rng, x, z, 1 + rng() * 0.4);
    for (const [x, z] of [[-18, 30], [18, 30], [-30, -12], [12, -44], [34, 6]]) bubbleVent(x, 0.2, z);

    // Stage 1 gate arch
    const arch = LC.lower, gz = HZ + 1;
    for (const s of [-1, 1]) {
        box(6, WALLH, 7, s * (half + 3), WALLH / 2, gz, arch);
        box(6, 5, 7, s * (half - 3), 33.5, gz, arch, { decor: true });
        box(5, 4, 7, s * (half - 8.5), 35, gz, arch, { decor: true });
    }
    box(CFG.courseWidth + 12, WALLH - 37, 7, 0, (WALLH + 37) / 2, gz, arch, { decor: true });
    textPlane([{ t: 'ESCAPE THE OCEAN', c: '#28e0ff', s: '#16121f', px: 110 }], 36, 1024, new V3(0, 41, gz - 3.6), new V3(0, 41, gz - 20));

    // Spawn pad: white square with a black star
    box(14, 0.3, 14, SPAWN.x, 0.15, SPAWN.z, 0xf6f6fa, { decor: true });
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, len = i % 2 ? 4.5 : 6.5;
        const m = box(i % 2 ? 0.5 : 0.7, 0.06, len, 0, 0.32, 0, 0x141418, { decor: true });
        m.position.set(SPAWN.x + Math.sin(a) * len / 2, 0.32, SPAWN.z + Math.cos(a) * len / 2); m.rotation.y = a; m.updateMatrix();
    }
    const ring = new T.Mesh(new T.RingGeometry(1.5, 2, 32), mat(0x141418));
    ring.rotation.x = -Math.PI / 2; ring.position.set(SPAWN.x, 0.34, SPAWN.z); scene.add(ring);

    // Fish shop (west): cheap fish in front, big ones on the raised back row
    box(14, 5, 72, -HX + 7, 2.5, 0, LC.platform, { studs: true });
    box(12, 1.5, 72, -HX + 20, 0.75, 0, LC.platform, { studs: true });
    const rows = { 1: [], 2: [] };
    for (const d of FISH) if (!d.special) rows[d.row].push(d);
    const rowX = { 1: -HX + 20, 2: -HX + 7 }, rowY = { 1: 1.5, 2: 5 };
    for (const r of [1, 2]) rows[r].forEach((d, i) => {
        const z = (i - (rows[r].length - 1) / 2) * 13.5;
        buildPedestal(d, new V3(rowX[r], rowY[r], z), new V3(1, 0, 0));
    });
    signBoard(new V3(-HX + 0.3, 37, 0), new V3(1, 0, 0), 30, 11, [{ t: 'FISH', c: '#ffffff', s: '#16121f', px: 150 }], LC.shopSign);
    const specials = { Piranha: new V3(-24, 0, 12), SeaSerpent: new V3(-14, 0, -HZ + 22), Kraken: new V3(44, 0, -34) };
    for (const d of FISH) if (d.special) {
        const p = specials[d.id];
        buildPedestal(d, p, new V3(-p.x, 0, -p.z).normalize());
    }

    // Treadmills (east)
    const bc = document.createElement('canvas'); bc.width = 64; bc.height = 64;
    const bx = bc.getContext('2d');
    bx.fillStyle = '#2d2d34'; bx.fillRect(0, 0, 64, 64);
    bx.fillStyle = '#3d3d46'; for (let i = 0; i < 4; i++) bx.fillRect(i * 16, 0, 6, 64);
    beltTex = texFrom(bc); beltTex.wrapS = beltTex.wrapT = T.RepeatWrapping; beltTex.repeat.set(4, 1);
    const top = TREAD_GEO.top;
    box(22, top, 96, HX - 11, top / 2, 0, LC.platform, { studs: true });
    box(3, 0.3, 96, HX - 23.5, 0.15, 0, LC.lavender, { neon: true, decor: true });
    TREADMILLS.forEach((def, i) => buildTreadmill(def, TREAD_GEO.cx, top, TREAD_GEO.z0 + i * TREAD_GEO.step));
    signBoard(new V3(HX - 0.3, 37, 0), new V3(-1, 0, 0), 44, 10, [{ t: 'AUTO-TRAIN', c: '#ffffff', s: '#16121f', px: 130 }], LC.treadSign);
    textPlane([{ t: 'TREADMILLS', c: '#ffffff', s: '#16121f', px: 110 }, { t: 'Earn Speed every second you run!', c: '#ffd228', s: '#16121f', px: 56 }], 30, 1024, new V3(HX - 4, 28, 0), new V3(0, 28, 0));

    // Stage portals (south wall)
    const lt = 1.5;
    box(100, lt, 12, 0, lt / 2, -HZ + 6, LC.platform, { studs: true });
    PORTALS.forEach((p, i) => {
        const x = (i - 2) * 20, wz = -HZ + 0.6;
        box(10, 13, 1, x, lt + 6.5, wz, LC.portal, { neon: true, decor: true });
        const archM = new T.Mesh(new T.CylinderGeometry(5, 5, 1, 24, 1, false, 0, Math.PI), mat(LC.portal, { neon: true }));
        archM.rotation.set(Math.PI / 2, 0, Math.PI / 2, 'ZYX'); archM.position.set(x, lt + 13, wz); scene.add(archM);
        box(12, 1, 1.4, x, lt + 0.5, wz + 0.5, 0xc8a01e, { decor: true });
        billboard([{ t: 'Stage ' + p.stage, c: '#ffffff', s: '#16121f', px: 72 }, { t: '🏆 ' + fmt(p.req) + ' Wins', c: '#ffd028', s: '#16121f', px: 54 }], 9, 512, new V3(x, lt + 20, wz + 2));
        const tr = aabb(x, lt + 8, wz + 2.5, 10, 16, 4);
        tr.enter = () => actions.portal(p);
        triggers.push(tr);
    });

    // Golden Megalodon statue on the speed boost pad
    const bp = new V3(22, 0, -HZ + 20);
    const pad = new T.Mesh(new T.CylinderGeometry(6, 6, 0.4, 32), mat(0xffd028, { neon: true }));
    pad.position.set(bp.x, 0.2, bp.z); scene.add(pad);
    const statue = buildFish(fishById.Megalodon, { gold: true });
    statue.position.set(bp.x, 1.2, bp.z); statue.rotation.set(-0.35, Math.atan2(-bp.x, -bp.z), 0); scene.add(statue);
    tickers.push((dt, t) => { swimFish(statue, dt, false); statue.position.y = 1.4 + Math.sin(t * 1.2) * 0.4; });
    billboard([{ t: 'SPEED BOOST', c: '#ffd028', s: '#16121f', px: 76 }, { t: 'x2 Speed for 15 min', c: '#ffffff', s: '#16121f', px: 48 }, { t: buxText(PRODUCTS.SpeedBoost.price), c: '#ffd23a', s: '#16121f', px: 52 }], 14, 512, new V3(bp.x, 14, bp.z));
    const btr = aabb(bp.x, 3.5, bp.z, 12, 7, 12);
    btr.enter = () => actions.buy('product', 'SpeedBoost');
    triggers.push(btr);

    // Leaderboards either side of the Stage 1 gate
    boards.speed = leaderboard(new V3(-36, 0, HZ - 18), 'Top Speed', 0x286ee6);
    boards.wins = leaderboard(new V3(36, 0, HZ - 18), 'Top Wins', 0xff8c1e);

    treasureChest(new V3(-62, 0, HZ - 10), new V3(0.6, 0, -1).normalize());
    treasureChest(new V3(-62, 0, -HZ + 10), new V3(0.6, 0, 1).normalize());
}

// =====================================================================================
// Course
// =====================================================================================
const SPIKE_GEO = new T.ConeGeometry(1.5, 4, 6);
// Ice-crystal spike cluster (the cyan shards in the reference)
function spike(x, y, z) {
    const m = new T.Mesh(SPIKE_GEO, mat(CC.spike));
    m.position.set(x, y + 2, z); m.castShadow = true; scene.add(m);
    const m2 = new T.Mesh(SPIKE_GEO, mat(0xbff6ff));
    m2.scale.set(0.5, 0.6, 0.5); m2.position.set(x + 0.9, y + 1.2, z + 0.5); m2.rotation.z = -0.35; scene.add(m2);
    const k = aabb(x, y + 1.5, z, 2, 3, 2); k.active = true; kills.push(k);
}
function texturedBox(sx, sy, sz, x, y, z, material) {
    const m = new T.Mesh(UNIT, material);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    m.receiveShadow = true;
    m.matrixAutoUpdate = false; m.updateMatrix();
    scene.add(m);
    return m;
}
// Walkable water-textured floor slab with its top at y = top
function waterFloor(sx, sz, x, z, top) {
    top = top || 0;
    texturedBox(sx, 2, sz, x, top - 1, z, waterMaterial(sx / 14, sz / 14));
    solids.push(aabb(x, top - 1, z, sx, 2, sz));
}
function lavaPillar(x, z, h) {
    const sy = h + 10;
    texturedBox(3.5, sy, 3.5, x, -10 + sy / 2 - 6, z, lavaMaterial(1, sy / 6));
    const k = aabb(x, -10 + sy / 2 - 6, z, 3.5, sy, 3.5); k.active = true; kills.push(k);
}
function lavaPit(z0, z1) {
    const len = z1 - z0;
    texturedBox(CFG.courseWidth, 1, len, 0, -6.5, z0 + len / 2, lavaMaterial(CFG.courseWidth / 14, len / 14));
    const k = aabb(0, -22, z0 + len / 2, CFG.courseWidth, 34, len); k.active = true; kills.push(k);
}
// Pink sneaker worth +Speed
function addPickup(stageIdx, x, y, z, amount) {
    const g = new T.Group();
    const body = new T.Mesh(UNIT, mat(0xff3f7a)); body.scale.set(1.6, 1, 2.8); body.position.y = 0.3; g.add(body);
    const sole = new T.Mesh(UNIT, mat(0xffffff)); sole.scale.set(1.75, 0.35, 3); sole.position.y = -0.3; g.add(sole);
    const ankle = new T.Mesh(UNIT, mat(0xff3f7a)); ankle.scale.set(1.5, 1, 1.2); ankle.position.set(0, 1, -0.8); g.add(ankle);
    const swoosh = new T.Mesh(UNIT, mat(0xffffff, { neon: true })); swoosh.scale.set(1.62, 0.2, 1.6); swoosh.position.set(0, 0.35, 0.1); g.add(swoosh);
    const glow = new T.Mesh(new T.CylinderGeometry(1.8, 1.8, 0.1, 20), mat(0x6fe0ff, { neon: true, opacity: 0.45 })); glow.position.y = -1.3; g.add(glow);
    g.position.set(x, y + 1.8, z);
    scene.add(g);
    const id = stageIdx + ':' + pickups.filter((p) => p.stage === stageIdx).length;
    pickups.push({ id, stage: stageIdx, g, base: y + 1.8, amount, respawnAt: 0, phase: Math.random() * 6 });
}
function chevrons(z0, count) {
    for (let i = 0; i < count; i++) {
        textPlane([{ t: '^', c: '#ffffff', px: 180 }], 6, 256, new V3(0, 0.06, z0 + i * 8), new V3(0, 10, z0 + i * 8)).rotation.set(-Math.PI / 2, 0, Math.PI);
    }
}
function stageSigns(s) {
    textPlane([{ t: s.name, c: '#ffffff', s: '#16121f', px: 150 }, { t: s.sub, c: s.subColor, s: '#16121f', px: 120 }], 30, 1024, new V3(0, 33.5, s.zS + 0.2), new V3(0, 33.5, s.zS - 10));
    const pz = s.zS + 22;
    box(0.4, 5, 12, -CFG.courseWidth / 2 + 0.2, 8, pz, CC.plaque, { decor: true });
    textPlane([{ t: 'Recommended :', c: '#ffffff', s: '#16121f', px: 60 }, { t: 'Lvl : ' + s.rec, c: '#ffd028', s: '#16121f', px: 70 }], 10, 512, new V3(-CFG.courseWidth / 2 + 0.5, 8, pz), new V3(10, 8, pz));
}
function returnPad(stageIdx, x, z, wins, finish) {
    const pad = new T.Mesh(new T.CylinderGeometry(5, 5, 0.4, 32), mat(finish ? CC.purple : CC.yellow, { neon: true }));
    pad.position.set(x, 0.2, z); scene.add(pad);
    billboard([{ t: '+' + wins + ' Wins', c: '#ffd028', s: '#16121f', px: 80 }, { t: finish ? 'FINISH!' : 'Return to lobby', c: '#ffffff', s: '#16121f', px: 46 }], 10, 512, new V3(x, 8, z));
    const tr = aabb(x, 3, z, 10, 6, 10);
    tr.enter = () => actions.pad(stageIdx);
    triggers.push(tr);
}
function doubleWinsPad(x, z) {
    const pad = new T.Mesh(new T.CylinderGeometry(4, 4, 0.4, 32), mat(CC.purple, { neon: true }));
    pad.position.set(x, 0.2, z); scene.add(pad);
    billboard([{ t: 'x2 Wins', c: '#e27bff', s: '#16121f', px: 80 }, { t: buxText(PASSES.DoubleWins.price), c: '#ffd23a', s: '#16121f', px: 50 }], 8, 512, new V3(x, 7, z));
    const tr = aabb(x, 3, z, 8, 6, 8);
    tr.enter = () => actions.buy('pass', 'DoubleWins');
    triggers.push(tr);
}

function buildLavaPath(i, s, rng, z0, z1) {
    const pw = s.pw, len = z1 - z0, mid = z0 + len / 2;
    lavaPit(z0, z1);
    waterFloor(pw, len, 0, mid);
    for (const sx of [-1, 1]) {
        box(0.8, 0.1, len, sx * (pw / 2 - 0.4), 0.05, mid, CC.red, { decor: true });
        box(4, 2, len, sx * (CFG.courseWidth / 2 - 2), -1, mid, CC.sidewalk, { studs: true });
    }
    for (let z = z0 + 24; z < z1 - 10; z += 22) {
        const n = 1 + Math.floor(rng() * 2);
        for (let k = 0; k < n; k++) spike((rng() * 2 - 1) * (pw / 2 - 2.5), 0, z + rng() * 8);
    }
    for (let z = z0 + 30; z < z1; z += 40) for (const sx of [-1, 1]) lavaPillar(sx * (pw / 2 + 3.5), z + rng() * 10, 4 + rng() * 10);
    for (let k = 0; k < 8; k++) addPickup(i, (rng() * 2 - 1) * (pw / 2 - 2), 0, z0 + 20 + (len - 30) * k / 7, s.pickup);
}
function buildFallingWalls(i, s, rng, z0, z1) {
    const len = z1 - z0, W = CFG.courseWidth;
    waterFloor(W, len, 0, z0 + len / 2);
    let k = 0;
    for (let z = z0 + 26; z < z1 - 14; z += 34, k++) {
        box(W, 0.1, 8, 0, 0.05, z, CC.red, { decor: true });
        const m = new T.Mesh(UNIT, brickMaterial(CC.falling, W / 8, 30 / 6).clone()); m.scale.set(W, 30, 8); m.castShadow = true; scene.add(m);
        const c = aabb(0, 31, z, W, 30, 8); solids.push(c);
        slabs.push({ m, c, z, phase: k * 1.1 });
    }
    for (let n = 0; n < 8; n++) addPickup(i, (rng() * 2 - 1) * 16, 0, z0 + 24 + (len - 24) * n / 7, s.pickup);
}
// Rows of tall gold walls, each with one gap; the gap moves side to side from row to row
function buildMaze(i, s, rng, z0, z1) {
    const len = z1 - z0, W = CFG.courseWidth, H = 22, GAP = 8;
    waterFloor(W, len, 0, z0 + len / 2);
    let k = 0, lastX = 0;
    const gaps = [];
    for (let z = z0 + 22; z < z1 - 12; z += 20, k++) {
        let gx = clamp((rng() * 2 - 1) * (W / 2 - GAP / 2 - 1), -(W / 2 - GAP / 2 - 1), W / 2 - GAP / 2 - 1);
        if (Math.abs(gx - lastX) < 10) gx = clamp(lastX + (lastX > 0 ? -1 : 1) * (12 + rng() * 8), -(W / 2 - GAP / 2 - 1), W / 2 - GAP / 2 - 1);
        lastX = gx;
        const l0 = -W / 2, l1 = gx - GAP / 2, r0 = gx + GAP / 2, r1 = W / 2;
        if (l1 - l0 > 0.5) box(l1 - l0, H, 3, (l0 + l1) / 2, H / 2, z, CC.gold, { studs: true, cast: true });
        if (r1 - r0 > 0.5) box(r1 - r0, H, 3, (r0 + r1) / 2, H / 2, z, CC.gold, { studs: true, cast: true });
        box(GAP + 1, 1.2, 3.4, gx, H - 0.6, z, 0xe0a020, { decor: true });
        gaps.push({ x: gx, z });
    }
    for (let n = 0; n < gaps.length - 1; n += 2) addPickup(i, (gaps[n].x + gaps[n + 1].x) / 2, 0, (gaps[n].z + gaps[n + 1].z) / 2, s.pickup);
}
function buildObby(i, s, rng, z0, z1) {
    lavaPit(z0, z1);
    let z = z0, x = 0, y = 0, k = 0;
    const tops = [];
    for (;;) {
        const gap = 3.5 + rng() * 3;
        const beam = rng() < 0.25;
        const sx = beam ? 3.5 : 7 + rng() * 6, sz = beam ? 14 : 7 + rng() * 5;
        const nz = z + gap;
        if (nz + sz > z1 - 12) break;
        x = clamp(x + (rng() * 2 - 1) * 5, -14, 14);
        y = clamp(y + [0, 0, 2, -2, 3, -3][Math.floor(rng() * 6)], 0, 9);
        box(sx, 2, sz, x, y - 1, nz + sz / 2, CORAL[k % 4], { studs: true });
        tops.push({ x, y, z: nz + sz / 2 });
        z = nz + sz; k++;
    }
    const bz = z + 4;
    waterFloor(CFG.courseWidth, z1 - bz, 0, bz + (z1 - bz) / 2);
    for (let pz = z0 + 20; pz < z1; pz += 36) for (const sx of [-1, 1]) lavaPillar(sx * 19, pz + rng() * 8, 6 + rng() * 14);
    const step = Math.max(1, Math.floor(tops.length / 9));
    for (let n = 1; n < tops.length; n += step) addPickup(i, tops[n].x, tops[n].y, tops[n].z, s.pickup);
}
// Open water lane; sharks cross it on the server's timeline (main.js)
function buildSharks(i, s, rng, z0, z1) {
    const len = z1 - z0, W = CFG.courseWidth;
    waterFloor(W, len, 0, z0 + len / 2);
    for (let z = z0 + 10; z < z1; z += 16) for (const sx of [-1, 1]) kelp(rng, sx * (W / 2 - 1.5), z + rng() * 6, 12 + rng() * 14);
    for (let n = 0; n < 10; n++) addPickup(i, (rng() * 2 - 1) * 16, 0, z0 + 20 + (len - 30) * n / 9, s.pickup);
}
function buildChase(i, s, rng, z0, z1) {
    const len = z1 - z0, W = CFG.courseWidth;
    box(W, 2, len, 0, -1, z0 + len / 2, CC.chase, { studs: true });
    for (let z = z0 + 30; z < z1 - 10; z += 28) {
        if (rng() < 0.5) box(12 + rng() * 8, 2.6, 2, (rng() * 2 - 1) * 10, 1.3, z, CC.red);
        else for (let n = 0; n < 2; n++) box(5, WALLH, 5, (rng() * 2 - 1) * 15, WALLH / 2, z + n * 10, CC.ledge);
    }
    for (let n = 0; n < 9; n++) addPickup(i, (rng() * 2 - 1) * 16, 0, z0 + 20 + (len - 30) * n / 8, s.pickup);
    // The Megalodon that chases this player (local only; each player gets their own)
    const m = new T.Group();
    const jaws = { ...fishById.Megalodon, size: 7 };
    const big = buildFish(jaws); m.add(big);
    for (const sx of [-1, 1]) { const f = buildFish({ ...fishById.Megalodon, size: 4 }); f.position.set(sx * 14, 2, -8); m.add(f); }
    m.visible = false; scene.add(m);
    // Length from the group origin to the Megalodon's nose
    m.userData.nose = (5.4 / 2 + 1.8 + 1) * big.userData.inner.scale.z;
    const k = aabb(0, WALLH / 2, s.zS - 6, W, WALLH, 4); k.active = false; kills.push(k);
    s.chaseMesh = m; s.chaseKill = k;
    tickers.push((dt) => { if (m.visible) { swimFish(big, dt, true); m.children.forEach((f) => f !== big && swimFish(f, dt, true)); } });
}

function buildCourse() {
    const W = CFG.courseWidth;
    STAGES.forEach((s, idx) => {
        const rng = rngFrom(100 + idx * 17);
        const mid = s.zS + s.len / 2;
        for (const sx of [-1, 1]) {
            texturedBox(2, 86, s.len, sx * (W / 2 + 1), 3, mid, brickMaterial(CC.wall, s.len / 12, 86 / 6));
            solids.push(aabb(sx * (W / 2 + 1), 3, mid, 2, 86, s.len));
            for (let z = s.zS + 20; z < s.zE - 5; z += 40) {
                box(2.4, WALLH, 2.4, sx * (W / 2 + 0.3), WALLH / 2, z, CC.pillar, { decor: true });
                box(3, 1.2, 3, sx * (W / 2 + 0.3), WALLH - 0.6, z, 0xc2860a, { decor: true });
                box(0.4, 2, 5, sx * (W / 2 - 0.1), 20, z + 20, 0xbff6ff, { neon: true, decor: true });
                const banner = new T.Mesh(new T.PlaneGeometry(5, 12.5), bannerMaterial((z / 40) % 2 ? ['#1ec8b4', '#0a6a7a'] : ['#1e46c8', '#0f2470'], (z / 40) % 2 ? 'SWIM' : 'RUN!'));
                banner.position.set(sx * (W / 2 - 0.05), 30, z + 10);
                banner.rotation.y = -sx * Math.PI / 2;
                scene.add(banner);
            }
        }
        box(W + 4, 2, s.len, 0, WALLH + 1, mid, CC.ceiling, { decor: true });
        waterFloor(W, 16, 0, s.zS + 8);
        chevrons(s.zS + 4, 2);
        const z0 = s.zS + 16, z1 = s.cE;
        if (s.type === 'LavaPath') buildLavaPath(idx, s, rng, z0, z1);
        else if (s.type === 'FallingWalls') buildFallingWalls(idx, s, rng, z0, z1);
        else if (s.type === 'Maze') buildMaze(idx, s, rng, z0, z1);
        else if (s.type === 'Obby') buildObby(idx, s, rng, z0, z1);
        else if (s.type === 'Sharks') buildSharks(idx, s, rng, z0, z1);
        else buildChase(idx, s, rng, z0, z1);
        box(W, 2, CFG.endZone, 0, -1, s.cE + CFG.endZone / 2, CC.sidewalk, { studs: true });
        const finish = idx === STAGES.length - 1;
        returnPad(idx, -10, s.cE + 22, s.wins, finish);
        doubleWinsPad(10, s.cE + 22);
        treasureChest(new V3(W / 2 - 5, 0, s.cE + 40), new V3(-1, 0, 0));
        coral(rng, -W / 2 + 4, s.cE + 40, 1.2);
        stageSigns(s);
        stageGate(s, idx);
        const tr = aabb(0, 20, s.zS + 3, W, 60, 2);
        tr.enter = () => actions.enterStage(idx);
        triggers.push(tr);
        if (finish) {
            texturedBox(W + 4, 90, 2, 0, 2, s.zE + 1, brickMaterial(CC.wall, 4, 15));
            solids.push(aabb(0, 2, s.zE + 1, W + 4, 90, 2));
            textPlane([{ t: 'YOU ESCAPED!', c: '#ffd028', s: '#16121f', px: 150 }, { t: 'More stages coming soon', c: '#ffffff', s: '#16121f', px: 70 }], 34, 1024, new V3(0, 24, s.zE - 0.2), new V3(0, 24, s.zE - 20));
        }
    });
}

// =====================================================================================
// Stage gates: sandstone frame with an animated hex force field you swim through
// =====================================================================================
const GATE_H = 26;
const gates = [];
function stageGate(s, idx) {
    const W = CFG.courseWidth, z = s.zS + 1, fw = W - 4;
    for (const sx of [-1, 1]) {
        box(2, GATE_H + 2, 2.4, sx * (W / 2 - 1), (GATE_H + 2) / 2, z, CC.pillar, { decor: true });
        box(0.5, GATE_H, 0.6, sx * (fw / 2 + 0.2), GATE_H / 2, z - 1.3, 0xbff6ff, { neon: true, decor: true });
    }
    box(W, 2, 2.4, 0, GATE_H + 1, z, CC.pillar, { decor: true });
    box(fw, 0.5, 0.6, 0, GATE_H - 0.2, z - 1.3, 0xbff6ff, { neon: true, decor: true });
    const m = new T.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 }, uRip: { value: 9 }, uRipC: { value: new T.Vector2(0.5, 0.2) },
            uColor: { value: new T.Color(s.subColor) }, uAspect: { value: fw / GATE_H }, uFade: { value: 1 },
        },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
            uniform float uTime, uRip, uAspect, uFade; uniform vec2 uRipC; uniform vec3 uColor; varying vec2 vUv;
            float hexDist(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }
            void main() {
                vec2 uv = vec2(vUv.x * uAspect, vUv.y) * 8.0;
                vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
                vec2 a = mod(uv, r) - h, b = mod(uv - h, r) - h;
                vec2 gv = dot(a, a) < dot(b, b) ? a : b;
                vec2 id = uv - gv;
                float edge = smoothstep(0.40, 0.49, hexDist(gv));
                float shimmer = pow(0.5 + 0.5 * sin(uTime * 2.2 + id.x * 0.9 + id.y * 1.7), 8.0);
                float scan = exp(-pow((fract(uTime * 0.28) * 1.4 - 0.2 - vUv.y) * 9.0, 2.0));
                vec2 d = vec2((vUv.x - uRipC.x) * uAspect, vUv.y - uRipC.y);
                float ring = exp(-pow(length(d) - uRip * 1.8, 2.0) * 40.0) * clamp(1.0 - uRip / 1.1, 0.0, 1.0);
                float flash = clamp(1.0 - uRip * 2.5, 0.0, 1.0) * 0.45;
                float fade = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x) * (0.55 + 0.45 * (1.0 - vUv.y));
                float alpha = (0.05 + edge * 0.32 + shimmer * 0.2 + scan * 0.22 + ring * 0.9 + flash) * fade * uFade;
                vec3 col = uColor * (0.55 + edge * 0.7 + shimmer * 0.5 + ring * 1.2) + vec3(ring * 0.5 + flash);
                gl_FragColor = vec4(col * alpha, alpha);
                #include <colorspace_fragment>
            }`,
        transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, toneMapped: false,
    });
    const field = new T.Mesh(new T.PlaneGeometry(fw, GATE_H), m);
    field.position.set(0, GATE_H / 2, z);
    scene.add(field);
    gates[idx] = { m, fw, z };
}
// Ripple from where the player broke through the field
export function gatePulse(idx, x, y) {
    const g = gates[idx];
    if (!g) return;
    g.m.uniforms.uRip.value = 0;
    g.m.uniforms.uRipC.value.set(clamp(x / g.fw + 0.5, 0, 1), clamp((y + 2.5) / GATE_H, 0, 1));
}
export function updateGates(t, dt) {
    for (const g of gates) {
        if (!g) continue;
        g.m.uniforms.uTime.value = t;
        g.m.uniforms.uRip.value += dt;
        // Seen from close behind (just after running through) the field would cover the whole screen
        const d = Math.abs(camera.position.z - g.z);
        const behind = camera.position.z > g.z;
        g.m.uniforms.uFade.value = behind ? Math.min(1, Math.max(0.08, (d - 4) / 34)) : Math.min(1, Math.max(0.15, (d - 3) / 26));
    }
}

// Falling rocks run on the server clock so every player sees the same timing.
// Returns true when a slab crushes the player box at (x, y, z).
export function updateSlabs(t, hitsPlayer) {
    const F = CFG.fall, cyc = F.raised + F.warn + F.fall + F.down + F.rise;
    let crushed = false;
    for (const s of slabs) {
        const k = ((t + s.phase) % cyc + cyc) % cyc;
        let bottom = 16, warn = false, crushing = false;
        if (k < F.raised) bottom = 16;
        else if (k < F.raised + F.warn) { warn = true; bottom = 16 + Math.sin(k * 60) * 0.25; }
        else if (k < F.raised + F.warn + F.fall) { crushing = true; bottom = 16 * (1 - (k - F.raised - F.warn) / F.fall); }
        else if (k < F.raised + F.warn + F.fall + F.down) { bottom = 0; crushing = true; }
        else bottom = 16 * ((k - F.raised - F.warn - F.fall - F.down) / F.rise);
        s.m.position.set(0, bottom + 15, s.z);
        s.m.material.color.setHex(warn ? CC.red : CC.falling);
        s.c.min.y = bottom; s.c.max.y = bottom + 30;
        if (crushing && hitsPlayer && hitsPlayer(s)) crushed = true;
    }
    return crushed;
}

export function buildWorld() {
    buildLobby();
    buildCourse();
    refreshShop();
}
