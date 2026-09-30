import {
    T, V3, scene, mat, box, aabb, UNIT, solids, kills, triggers, tickers,
    texFrom, billboard, textPlane, camera,
} from './engine.js';
import { S, actions, net } from './state.js';
import { lavaMaterial, brickMaterial, bannerMaterial, waterMaterial } from './textures.js';
import { emitTread, bubble } from './fx.js';
import { buildFish, swimFish } from './fish.js';
import {
    CFG, LOBBY, STAGES, TREADMILLS, TREAD_GEO, PRODUCTS, PASSES, FISH, SHARK_LOOK, GROUP_CHEST, TURTLE_MINUTES, FREE_BOOST_MINUTES,
    fishById, fmt, sci, clamp, clock, rngFrom, buxText,
} from '../../shared/config.js';

const HX = LOBBY.halfX, HZ = LOBBY.halfZ, WALLH = LOBBY.wallHeight;
// Lobby colours from the reference: blue studded pool, brown stone paths, sand, gold shop,
// pale blue-grey Atlantis terraces with yellow trim, gold towers with pink domes
const LC = {
    pool: 0x3a86e8, stone: 0x9a7e74, sand: 0xf5d65a, trim: 0xffd23a, gold: 0xf2c230, goldDark: 0xd8a020,
    terrace: 0xaab4cc, terraceDark: 0x8e98b4, pad: 0xffe23a, dome: 0xffa8c8, kelp: 0x2ee07a, kelpDark: 0x1aa85a,
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
const signs = {};

// Pool, and the brown stone ring around it (the lobby floor)
const POOL = { x0: -56, x1: 50, z0: -54, z1: 50 };

// =====================================================================================
// Decoration
// =====================================================================================
// Swaying kelp stalk: stacked leaves on a pivot at the root
function kelp(rng, x, z, h) {
    const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
    const n = Math.max(2, Math.round(h / 2.2));
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
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
        const c = CORAL[Math.floor(rng() * CORAL.length)];
        const h = (1.2 + rng() * 2.5) * scale, w = (0.6 + rng() * 0.5) * scale;
        const px = x + (rng() * 2 - 1) * 1.5 * scale, pz = z + (rng() * 2 - 1) * 1.5 * scale;
        box(w, h, w, px, h / 2, pz, c, { decor: true });
        if (rng() < 0.7) box(w * 0.8, w * 0.8, w * 2.2, px, h * 0.7, pz, c, { decor: true });
        if (rng() < 0.5) box(w * 2.2, w * 0.8, w * 0.8, px, h * 0.5, pz, c, { decor: true });
    }
}
// Pale cyan crystal shards sticking out of the pool
const SHARD = new T.ConeGeometry(0.5, 1, 5);
function crystals(rng, x, z) {
    for (let i = 0; i < 4; i++) {
        const m = new T.Mesh(SHARD, mat(i % 2 ? 0x9ff0ff : 0x6fd8f0));
        const h = 1.2 + rng() * 1.6;
        m.scale.set(0.8, h, 0.8);
        m.position.set(x + (rng() * 2 - 1) * 1.2, h / 2, z + (rng() * 2 - 1) * 1.2);
        m.rotation.set((rng() * 2 - 1) * 0.4, 0, (rng() * 2 - 1) * 0.4);
        scene.add(m);
    }
}
// Gold colonnade tower with kelp inside and a pink soft-serve dome, standing on the terraces
function tower(x, y, z, r) {
    const add = (geo, c, px, py, pz, o) => { const m = new T.Mesh(geo, mat(c, o)); m.position.set(px, py, pz); scene.add(m); return m; };
    add(new T.CylinderGeometry(r * 1.15, r * 1.25, y + 6, 16), LC.goldDark, x, (y + 6) / 2, z);
    add(new T.CylinderGeometry(r * 1.1, r * 1.1, 1.2, 16), LC.gold, x, y + 6.6, z);
    const H = r * 2.6;
    for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const c = add(UNIT, LC.gold, x + Math.sin(a) * r, y + 7.2 + H / 2, z + Math.cos(a) * r);
        c.scale.set(r * 0.28, H, r * 0.28); c.rotation.y = a;
    }
    for (let i = 0; i < 3; i++) {
        const k = add(UNIT, i % 2 ? LC.kelp : 0x3cf0c8, x + (i - 1) * r * 0.35, y + 7.2 + H * 0.35, z, i % 2 ? undefined : { neon: true });
        k.scale.set(r * 0.25, H * 0.7, r * 0.25);
    }
    add(new T.CylinderGeometry(r * 1.2, r * 1.1, 1.6, 16), LC.gold, x, y + 7.2 + H + 0.8, z);
    const base = y + 8.8 + H;
    add(new T.CylinderGeometry(r * 1.25, r * 1.3, r * 0.7, 16), LC.dome, x, base + r * 0.35, z);
    add(new T.CylinderGeometry(r * 0.95, r * 1.2, r * 0.7, 16), 0xffb8d2, x, base + r * 1.0, z);
    add(new T.CylinderGeometry(r * 0.6, r * 0.9, r * 0.6, 16), LC.dome, x, base + r * 1.6, z);
    add(new T.SphereGeometry(r * 0.55, 12, 8), 0xffb8d2, x, base + r * 2.0, z);
}
// Stepped Atlantis terraces around the lobby: jagged blocks, each tier trimmed in yellow.
// The first tier is the lobby's wall; higher tiers are scenery.
function terraces(rng) {
    const seg = 12;
    const side = (along, fixed, dir, axis, skip) => {
        for (let a = -along; a < along; a += seg) {
            const c = a + seg / 2;
            if (skip && skip(c)) continue;
            let h = 0;
            for (let k = 0; k < 4; k++) {
                h += k === 0 ? 12 + rng() * 6 : 6 + rng() * 9;
                const depth = 9 + rng() * 3, off = fixed + dir * (k * 10 + depth / 2);
                const [x, z, sx, sz] = axis === 'x' ? [c, off, seg + 0.2, depth] : [off, c, depth, seg + 0.2];
                box(sx, h, sz, x, h / 2, z, k % 2 ? LC.terraceDark : LC.terrace, { studs: true, decor: k > 0 });
                const tx = axis === 'x' ? x : fixed + dir * k * 10 + dir * 0.2, tz = axis === 'x' ? fixed + dir * k * 10 + dir * 0.2 : z;
                box(axis === 'x' ? seg + 0.3 : 0.7, 0.8, axis === 'x' ? 0.7 : seg + 0.3, tx, h - 0.2, tz, LC.trim, { decor: true });
            }
        }
    };
    const gate = (c) => Math.abs(c) < 44;
    side(HX + 40, HZ, 1, 'x', gate);
    side(HX + 40, -HZ, -1, 'x');
    side(HZ, HX, 1, 'z');
    side(HZ, -HX, -1, 'z');
}
// Big soap-bubble spheres drifting up through the sky, above head height
function skyBubbles(rng) {
    const shell = new T.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.16, depthWrite: false });
    const shine = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
    const geo = new T.SphereGeometry(1, 20, 14);
    const list = [];
    for (let i = 0; i < 18; i++) {
        const g = new T.Group();
        const r = 1.5 + rng() * 3;
        const s = new T.Mesh(geo, shell); s.scale.setScalar(r); g.add(s);
        const h = new T.Mesh(geo, shine); h.scale.setScalar(r * 0.18); h.position.set(-r * 0.45, r * 0.45, r * 0.6); g.add(h);
        g.position.set((rng() * 2 - 1) * 110, 30 + rng() * 60, (rng() * 2 - 1) * 100);
        scene.add(g);
        list.push({ g, v: 1.5 + rng() * 2, ph: rng() * 6 });
    }
    tickers.push((dt, t) => {
        for (const b of list) {
            b.g.position.y += b.v * dt;
            b.g.position.x += Math.sin(t * 0.4 + b.ph) * dt * 0.8;
            if (b.g.position.y > 95) b.g.position.y = 30;
        }
    });
}
// Flat board whose canvas can be redrawn (hut sign, leaderboards)
function canvasPlane(w, h, pxW, pxH, pos, face) {
    const cv = document.createElement('canvas'); cv.width = pxW; cv.height = pxH;
    const tex = texFrom(cv);
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    m.position.copy(pos); m.rotation.y = Math.atan2(face.x, face.z);
    scene.add(m);
    return { cv, tex, m };
}

// Group Chest: a gold-banded chest gripped by blue tentacles on an icy base
function groupChest(pos) {
    const g = new T.Group(); g.position.copy(pos); g.rotation.y = Math.PI / 2 + 0.3; scene.add(g);
    const part = (sx, sy, sz, x, y, z, c, o) => { const m = new T.Mesh(UNIT, mat(c, o)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    for (let i = 0; i < 5; i++) part(3 + (i % 2) * 2, 0.5, 2.5 + (i % 3), (i - 2) * 1.8, 0.25, (i % 2 ? 1 : -1) * 1.2, 0xbff0ff);
    part(8, 5, 6, 0, 3, 0, 0x9a6a2a);
    for (const x of [-3.4, 0, 3.4]) part(0.6, 5.1, 6.1, x, 3, 0, 0xe8b830);
    const lid = part(8.2, 2.4, 6.2, 0, 6.3, -0.4, 0xa87430); lid.rotation.x = -0.25;
    part(1.4, 1.4, 0.4, 0, 4.4, 3.1, 0xffd23a);
    part(8.4, 0.5, 6.4, 0, 7.6, 0.2, 0xbff6ff);
    // Tentacles curling round the sides
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
        let y = 0.6;
        for (let i = 0; i < 5; i++) {
            const a = i * 0.55;
            part(1.2, 1.2, 1.2, sx * (4.4 + Math.sin(a) * 0.4), y, (k ? 1.6 : -1.6) + Math.cos(a) * 0.6, i % 2 ? 0x2a6ae8 : 0x3c86ff);
            y += 1.1;
        }
    }
    solids.push(aabb(pos.x, 4, pos.z, 9, 8, 9));
    const tr = aabb(pos.x, 3, pos.z, 13, 6, 13);
    tr.enter = () => actions.chest();
    triggers.push(tr);
}
// The +150/Speed turtle on its magenta hex pad (free after playing a while)
function turtlePad(pos) {
    const pad = new T.Mesh(new T.CylinderGeometry(6, 6, 0.4, 6), mat(0xff3cc8, { neon: true }));
    pad.position.set(pos.x, 0.2, pos.z); scene.add(pad);
    const t = buildFish(fishById.Turtle);
    t.position.set(pos.x, 0.4, pos.z); t.rotation.y = 2.3; scene.add(t);
    tickers.push((dt) => swimFish(t, dt, false));
    signs.turtle = billboard(turtleLines(), 11, 512, new V3(pos.x, 10.5, pos.z));
    const tr = aabb(pos.x, 3, pos.z, 10, 6, 10);
    tr.enter = () => actions.turtle();
    triggers.push(tr);
}
function turtleLines() {
    const left = TURTLE_MINUTES * 60 - (net.now() - S.joinedAt) / 1000;
    const status = S.owned.Turtle ? { t: 'OWNED', c: '#6fe0ff' } : left > 0 ? { t: 'Claim In: ' + clock(left), c: '#7dff6b' } : { t: 'CLAIM!', c: '#7dff6b' };
    return [{ t: '+' + fishById.Turtle.bonus + '/Speed', c: '#6fe0ff', s: '#16121f', px: 80 }, { ...status, s: '#16121f', px: 56 }];
}
// "Keep playing for ... Free SPEED BOOST" hut
function boostHut(pos) {
    const wood = 0x9a6a4a, ice = 0x9fe8ff;
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) box(1.2, 9, 1.2, pos.x + sx * 3, 4.5, pos.z + sz * 5, wood, { decor: true });
    box(7, 8, 0.6, pos.x, 4.5, pos.z + 5.2, 0xc8a88a, { studs: true });
    box(0.6, 8, 10, pos.x - 3.4, 4.5, pos.z, 0xc8a88a, { studs: true });
    const roof = box(9, 0.8, 13, pos.x, 9.4, pos.z, ice, { decor: true });
    roof.rotation.z = -0.12; roof.updateMatrix();
    signs.hut = canvasPlane(5.6, 4, 256, 184, new V3(pos.x - 3.05, 5, pos.z), new V3(1, 0, 0));
    drawHut();
    const tr = aabb(pos.x, 3, pos.z, 7, 6, 9);
    tr.enter = () => actions.freeBoost();
    triggers.push(tr);
}
function hutText() {
    const left = FREE_BOOST_MINUTES * 60 - (net.now() - S.joinedAt) / 1000;
    if (S.freeBoost) return 'Enjoy your boost!';
    return left > 0 ? Math.floor(left / 60) + ' min ' + Math.floor(left % 60) + ' sec' : 'Step in to claim!';
}
function drawHut() {
    const h = signs.hut, x = h.cv.getContext('2d');
    x.fillStyle = '#e8dcc8'; x.fillRect(0, 0, 256, 184);
    x.strokeStyle = '#6a4a30'; x.lineWidth = 8; x.strokeRect(4, 4, 248, 176);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#2a2a3a'; x.font = '700 26px Fredoka, sans-serif'; x.fillText('Keep playing for:', 128, 44);
    x.font = '700 30px Fredoka, sans-serif'; x.fillText(hutText(), 128, 92);
    x.fillStyle = '#28a83c'; x.font = '700 26px Fredoka, sans-serif'; x.fillText('Free SPEED BOOST', 128, 142);
    h.tex.needsUpdate = true;
    h.last = hutText();
}
// Timers on the turtle and hut signs; cheap to call often, redraws only when the text changes
export function updateLobbySigns() {
    if (signs.hut && hutText() !== signs.hut.last) drawHut();
    if (signs.turtle) {
        const lines = turtleLines(), key = lines.map((l) => l.t).join('|');
        if (key !== signs.turtle.key) { signs.turtle.key = key; signs.turtle.userData.set(lines); }
    }
}

// Carved stone tablet leaderboard with a tilted plaque on top
function leaderboard(pos, title, face) {
    const g = new T.Group(); g.position.copy(pos); g.rotation.y = Math.atan2(face.x, face.z); scene.add(g);
    const part = (sx, sy, sz, x, y, z, c) => { const m = new T.Mesh(UNIT, mat(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    part(18, 3, 5, 0, 1.5, 0, 0x6a6e7c);
    part(16, 26, 2.4, 0, 16, 0, 0x9aa0ae);
    const plaque = part(17, 4, 2.4, 0, 31, 0.8, 0xb0b6c4); plaque.rotation.x = -0.35;
    solids.push(aabb(pos.x, 14, pos.z, 12, 28, 12));
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 720;
    const tex = texFrom(cv);
    const scr = new T.Mesh(new T.PlaneGeometry(14.6, 20.5), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
    scr.position.set(0, 15.5, 1.25); g.add(scr);
    const head = textPlane([{ t: title, c: '#2a2a3a', px: 90 }], 14, 1024, new V3(), new V3(0, 0, 1));
    scene.remove(head); head.position.set(0, 31.2, 2.1); head.rotation.x = -0.35; g.add(head);
    return { cv, tex };
}
function drawBoard(b, rows, kind) {
    const x = b.cv.getContext('2d');
    x.fillStyle = '#9aa0ae'; x.fillRect(0, 0, 512, 720);
    x.font = '700 34px Fredoka, sans-serif'; x.textBaseline = 'middle';
    if (!rows.length) { x.textAlign = 'center'; x.fillStyle = '#2a2a3a'; x.fillText('Be the first!', 256, 360); }
    rows.forEach((r, i) => {
        const y = 40 + i * 68;
        x.textAlign = 'left'; x.fillStyle = r.you ? '#1a7a2a' : '#2a2a3a';
        x.fillText('#' + (r.rank || i + 1), 14, y);
        x.fillText(r.n.slice(0, 13), 84, y);
        x.textAlign = 'right'; x.fillStyle = '#18a82c';
        x.fillText(kind === 'speed' ? sci(r.v) : fmt(r.v), 500, y);
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
// Stage 1 / course end chest
function treasureChest(pos, face) {
    const g = new T.Group(); g.position.copy(pos); g.rotation.y = Math.atan2(face.x, face.z); scene.add(g);
    const part = (sx, sy, sz, x, y, z, c, o) => { const m = new T.Mesh(UNIT, mat(c, o)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = !(o && o.neon); g.add(m); return m; };
    part(6, 3.4, 4, 0, 1.7, 0, 0x8a4a1c);
    part(6.2, 0.5, 4.2, 0, 1.2, 0, 0xffc83a);
    const lid = part(6.1, 1.6, 4.1, 0, 4.1, -0.6, 0x9a5424); lid.rotation.x = -0.5;
    part(1, 1, 0.3, 0, 2.6, 2.1, 0xffc83a);
    for (let i = 0; i < 9; i++) part(0.9, 0.9, 0.9, (i % 3 - 1) * 1.5, 3.5 + (i % 2) * 0.3, (Math.floor(i / 3) - 1) * 0.9, i % 4 ? 0xffd84a : 0x7fe8ff, { neon: i % 4 === 0 });
    solids.push(aabb(pos.x, 2, pos.z, 6.4, 4, 6.4));
}

// =====================================================================================
// Fish shop pedestals: a yellow pad you step on, the fish hovering above it
// =====================================================================================
function pedestalLines(d) {
    const lines = [{ t: '+' + fmt(d.bonus) + '/Speed', c: '#ffffff', s: '#16121f', px: 72 }];
    if (S.equipped === d.id) lines.push({ t: 'RIDING', c: '#6fe0ff', s: '#16121f', px: 50 });
    else if (S.owned[d.id]) lines.push({ t: 'OWNED', c: '#7dff6b', s: '#16121f', px: 50 });
    else if (d.pass) lines.push({ t: d.tagline + ' ONLY ' + buxText(PASSES[d.pass].price), c: '#7dff6b', s: '#16121f', px: 46 });
    else lines.push({ t: fmt(d.req) + ' Wins Required', c: '#6fe0ff', s: '#16121f', px: 46 });
    return lines;
}
function buildPedestal(d, pos) {
    const glow = d.glow || 0xffe23a;
    box(6, 0.3, 6, pos.x, pos.y + 0.15, pos.z, LC.pad, { neon: true, decor: true });
    const fish = buildFish(d);
    const baseY = pos.y + 1.2 + (d.size ? (d.size - 1) * 1.5 : 0);
    fish.position.set(pos.x, baseY, pos.z);
    fish.rotation.y = -Math.PI / 2 - 0.5;
    scene.add(fish);
    const at = new V3(pos.x, pos.y + 1, pos.z);
    const phase = Math.random() * 6;
    let acc = Math.random();
    tickers.push((dt, t) => {
        if (camera.position.distanceToSquared(at) > 130 * 130) return;
        swimFish(fish, dt, false);
        fish.position.y = baseY + Math.sin(t * 1.6 + phase) * 0.3;
        if (d.glow) { acc += dt * 3; while (acc > 1) { acc -= 1; bubble(at, glow); } }
    });
    const top = (d.size || 1) * 6.5;
    const sp = billboard(pedestalLines(d), 11, 512, new V3(pos.x, pos.y + top + 5, pos.z));
    shopItems.push({ d, sp, sig: '' });
    const tr = aabb(pos.x, pos.y + 2, pos.z, 6, 4, 6);
    tr.enter = () => actions.shop(d);
    triggers.push(tr);
}

export function treadLocked(def) {
    if (def.pass) return !S.passes[def.pass];
    if (def.req) return S.wins < def.req;
    return false;
}
const TREAD_LOOK = {
    25: { frame: 0x16161e, belt: 0x2a2a34, label: '#d0c8f0' },
    9: { frame: 0xd8f6ff, belt: 0x9fdcf0, label: '#6fe0ff' },
    3: { frame: 0xff8a1e, belt: 0xd85a10, label: '#ffbe28' },
    1: { frame: 0x28c8f0, belt: 0x2d2d34, label: '#ffffff' },
};
function treadLines(def) {
    const lines = def.mult > 1 ? [{ t: 'X' + def.mult + ' Speed', c: TREAD_LOOK[def.mult].label, s: '#16121f', px: 72 }] : [];
    if (treadLocked(def)) lines.push({ t: def.pass ? '🔒 ' + buxText(PASSES[def.pass].price) : '🔒 ' + def.req + ' Wins', c: '#ffd028', s: '#16121f', px: 48 });
    return lines.length ? lines : [{ t: ' ', px: 10 }];
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
// Treadmill facing away from the pool: belt runs toward the pool, console at the back (-x)
function buildTreadmill(def, cx, top, cz) {
    const L = TREAD_GEO.len, W = TREAD_GEO.width, look = TREAD_LOOK[def.mult];
    const belt = new T.Mesh(UNIT, new T.MeshLambertMaterial({ map: beltTex, color: look.belt }));
    belt.scale.set(L, 0.6, W); belt.position.set(cx, top + 0.3, cz); belt.receiveShadow = true; scene.add(belt);
    const c = aabb(cx, top + 0.3, cz, L, 0.6, W); c.belt = new V3(12, 0, 0); c.tread = def; solids.push(c);
    const neon = def.mult === 9 || def.mult === 3;
    for (const s of [-1, 1]) {
        box(L, 1, 0.7, cx, top + 0.5, cz + s * (W / 2 + 0.35), look.frame, { neon });
        box(0.7, 5, 0.7, cx - L / 2 + 0.5, top + 2.5, cz + s * (W / 2), look.frame, { decor: true });
    }
    box(0.7, 0.7, W + 0.7, cx - L / 2 + 0.5, top + 4.3, cz, look.frame, { decor: true });
    box(1, 2.6, W - 0.6, cx - L / 2, top + 5.8, cz, look.frame, { decor: true });
    box(0.3, 1.8, W - 1.6, cx - L / 2 + 0.55, top + 5.8, cz, def.mult === 25 ? 0x9fe8ff : 0x1e5ad8, { neon: true, decor: true });
    if (def.mult === 9) for (let i = 0; i < 5; i++) box(1.5 + i % 2, 1.2 + (i % 3) * 0.6, 1.5, cx - L / 2 + 2 + i * 2.8, top + 1, cz + (i % 2 ? 1 : -1) * (W / 2 + 1.2), 0xbff6ff, { decor: true });
    const sp = billboard(treadLines(def), 12, 512, new V3(cx, top + 11, cz));
    treadItems.push({ def, sp, sig: '' });
    if (def.mult > 1) {
        const at = new V3(cx, top + 0.7, cz);
        let acc = Math.random();
        tickers.push((dt) => { acc += dt * 14; while (acc > 1) { acc -= 1; emitTread(at, def.mult, L, W); } });
    }
}
// Floating banner: white text on a bar that fades out at both ends
function gradientBanner(text, colors, w, pos, face) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 200;
    const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1024, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.2, colors[0]); g.addColorStop(0.8, colors[1]); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 40, 1024, 120);
    x.font = '700 104px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 14; x.strokeStyle = '#16121f'; x.strokeText(text, 512, 104);
    x.fillStyle = '#ffffff'; x.fillText(text, 512, 104);
    const m = new T.Mesh(new T.PlaneGeometry(w, w * 200 / 1024), new T.MeshBasicMaterial({ map: texFrom(cv), transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
    m.position.copy(pos); m.rotation.y = Math.atan2(face.x, face.z);
    scene.add(m);
    return m;
}
// Round pad that opens a purchase when stepped on (+10K SPEED, +500 WINS ...)
function buyPad(x, z, color, lines, kind, key) {
    const pad = new T.Mesh(new T.CylinderGeometry(2.6, 2.6, 0.3, 28), mat(color, { neon: true }));
    pad.position.set(x, 0.15, z); scene.add(pad);
    billboard(lines, 7, 512, new V3(x, 4, z));
    const tr = aabb(x, 2, z, 5, 4, 5);
    tr.enter = () => actions.buy(kind, key);
    triggers.push(tr);
}

// =====================================================================================
// Lobby: Atlantis plaza from the reference video
//   facing Stage 1 (north, +z): FISH shop on the left (+x), AUTO-TRAIN treadmills, hut,
//   Group Chest, turtle and boards on the right (-x); pool + spawn in the middle
// =====================================================================================
function buildLobby() {
    const rng = rngFrom(7);
    const P = POOL;
    // Floor: brown stone everywhere, the blue pool in the middle with a yellow rim, sand by the gate
    box(HX * 2, 2, HZ * 2, 0, -1, 0, LC.stone, { studs: true });
    box(P.x1 - P.x0, 0.1, P.z1 - P.z0, (P.x0 + P.x1) / 2, 0.05, (P.z0 + P.z1) / 2, LC.pool, { studs: true, decor: true });
    box(P.x1 - P.x0 + 2, 0.08, 1, (P.x0 + P.x1) / 2, 0.06, P.z0 - 0.5, LC.trim, { decor: true });
    box(P.x1 - P.x0 + 2, 0.08, 1, (P.x0 + P.x1) / 2, 0.06, P.z1 + 0.5, LC.trim, { decor: true });
    box(1, 0.08, P.z1 - P.z0, P.x0 - 0.5, 0.06, (P.z0 + P.z1) / 2, LC.trim, { decor: true });
    box(1, 0.08, P.z1 - P.z0, P.x1 + 0.5, 0.06, (P.z0 + P.z1) / 2, LC.trim, { decor: true });
    box(P.x1 - P.x0, 0.1, HZ - P.z1 - 1, (P.x0 + P.x1) / 2, 0.07, (P.z1 + 1 + HZ) / 2, LC.sand, { studs: true, decor: true });
    for (let i = 0; i < 26; i++) {
        const x = P.x0 + 4 + rng() * (P.x1 - P.x0 - 8), z = P.z0 + 4 + rng() * (P.z1 - P.z0 - 8);
        if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 10) continue;
        if (i % 3 === 0) crystals(rng, x, z); else coral(rng, x, z, 0.55);
    }
    for (let i = 0; i < 8; i++) kelp(rng, P.x0 + 6 + rng() * (P.x1 - P.x0 - 12), P.z0 + 6 + rng() * (P.z1 - P.z0 - 12), 3 + rng() * 3);

    terraces(rng);
    for (const [x, y, z, r] of [[-70, 30, -95], [5, 34, -100], [70, 30, -96], [-110, 28, 30], [112, 30, 34], [-62, 40, 102], [66, 38, 104], [-112, 26, -40]].map((a) => [...a, 6])) tower(x, y, z, r);
    skyBubbles(rng);

    // Spawn: sand pad with a brown frame and a black sun emblem
    box(13, 0.3, 13, SPAWN.x, 0.15, SPAWN.z, 0x7a5a48, { decor: true });
    box(11.4, 0.4, 11.4, SPAWN.x, 0.2, SPAWN.z, LC.sand, { studs: true, decor: true });
    const sun = new T.Mesh(new T.CircleGeometry(1.6, 24), mat(0x141418)); sun.rotation.x = -Math.PI / 2; sun.position.set(SPAWN.x, 0.42, SPAWN.z); scene.add(sun);
    for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        const ray = new T.Mesh(new T.ConeGeometry(0.6, 3.4, 3), mat(0x141418));
        ray.scale.z = 0.05; ray.rotation.set(-Math.PI / 2, 0, -a + 0.35); ray.position.set(SPAWN.x + Math.sin(a) * 2.8, 0.43, SPAWN.z + Math.cos(a) * 2.8);
        scene.add(ray);
    }

    // Stage 1 building: a big stone block with the tunnel into the ocean
    const half = CFG.courseWidth / 2, gz = HZ + 11, BH = 52;
    for (const s of [-1, 1]) box(22, BH, 22, s * (half + 11), BH / 2, gz, LC.terrace, { studs: true });
    box(CFG.courseWidth + 1, BH - 30, 22, 0, 30 + (BH - 30) / 2, gz, LC.terrace, { studs: true, decor: true });
    box(CFG.courseWidth + 46, 1, 1, 0, 30, HZ - 0.4, LC.trim, { decor: true });
    for (const s of [-1, 1]) box(1.2, 30, 1.2, s * (half + 0.2), 15, HZ - 0.4, LC.terraceDark, { decor: true });
    box(CFG.courseWidth + 48, 3, 26, 0, BH + 1.5, gz, LC.terraceDark, { studs: true, decor: true });
    box(CFG.courseWidth + 48, 0.8, 0.8, 0, BH + 3, HZ - 1.4, LC.trim, { decor: true });

    // Speed pads between the gate and the treadmills
    buyPad(-32, 60, 0xff4a8a, [{ t: '+10K SPEED', c: '#ffffff', s: '#16121f', px: 60 }], 'product', 'Speed10K');
    buyPad(-40, 60, 0xff4a8a, [{ t: '+100K SPEED', c: '#ffffff', s: '#16121f', px: 60 }], 'product', 'Speed100K');
    buyPad(-48, 60, 0xe8182c, [{ t: '+1M SPEED', c: '#ff5a5a', s: '#16121f', px: 60 }], 'product', 'Speed1M');

    // FISH shop (left, +x): low front row, gold wall, and the back row up the stairs on top
    const FX = 57, GX0 = 62, GX1 = 72, TOPY = 8;
    box(10, 1, 108, FX, 0.5, -6, LC.stone, { studs: true });
    box(GX1 - GX0, TOPY, 104, (GX0 + GX1) / 2, TOPY / 2, -2, LC.gold, { studs: true });
    box(HX - GX1, TOPY, 120, (HX + GX1) / 2, TOPY / 2, -6, LC.stone, { studs: true });
    box(0.6, 0.6, 104.4, GX0 - 0.1, TOPY + 0.3, -2, LC.goldDark, { decor: true });
    // Stairs up from the south end of the front row
    for (let i = 0; i < 7; i++) {
        const h = (i + 1) * (TOPY / 7);
        box(3.2, h, 10, 50 + i * 3 + 1.6 + 3, h / 2, -61, LC.stone, { studs: true });
    }
    const front = FISH.filter((d) => d.row === 1), back = FISH.filter((d) => d.row === 2);
    front.forEach((d, i) => buildPedestal(d, new V3(FX, 1, -44 + i * 16)));
    back.forEach((d, i) => buildPedestal(d, new V3((GX0 + GX1) / 2, TOPY, -46 + i * 15)));
    gradientBanner('FISH', ['#1e8cff', '#0a4ac8'], 34, new V3(60, 30, -2), new V3(-1, 0, 0));

    // Treadmills (right, -x) on a brown stone ledge, south to north: X25, four x1, X3, X9
    const bc = document.createElement('canvas'); bc.width = 64; bc.height = 64;
    const bx = bc.getContext('2d');
    bx.fillStyle = '#ffffff'; bx.fillRect(0, 0, 64, 64);
    bx.fillStyle = '#b8b8c4'; for (let i = 0; i < 4; i++) bx.fillRect(i * 16, 0, 6, 64);
    beltTex = texFrom(bc); beltTex.wrapS = beltTex.wrapT = T.RepeatWrapping; beltTex.repeat.set(4, 1);
    const top = TREAD_GEO.top, tz0 = TREAD_GEO.z0 - 7, tz1 = TREAD_GEO.z0 + (TREADMILLS.length - 1) * TREAD_GEO.step + 7;
    box(HX + P.x0 - 1, top, tz1 - tz0, (-HX + P.x0 - 1) / 2, top / 2, (tz0 + tz1) / 2, LC.stone, { studs: true });
    box(0.8, 0.3, tz1 - tz0, P.x0 - 1.6, top + 0.1, (tz0 + tz1) / 2, LC.trim, { decor: true });
    TREADMILLS.forEach((def, i) => buildTreadmill(def, TREAD_GEO.cx, top, TREAD_GEO.z0 + i * TREAD_GEO.step));
    gradientBanner('AUTO-TRAIN', ['#f4ff5a', '#6fff3a'], 32, new V3(TREAD_GEO.cx + 8, 22, (tz0 + tz1) / 2), new V3(1, 0, 0));

    // Back right corner: the hut, the Group Chest, the turtle, Wins pads and the leaderboards
    boostHut(new V3(-70, 0, -20));
    groupChest(new V3(-68, 0, -36));
    billboard([{ t: 'Group Chest', c: '#ffd028', s: '#16121f', px: 80 }, { t: 'Like the game + claim daily!', c: '#ffe07a', s: '#16121f', px: 44 }], 14, 512, new V3(-68, 13, -36));
    turtlePad(new V3(-48, 0, -44));
    buyPad(-30, -60, 0xffd028, [{ t: '+500 WINS', c: '#ffd028', s: '#16121f', px: 60 }], 'product', 'Wins500');
    buyPad(-38, -64, 0xffd028, [{ t: '+5K WINS', c: '#ffd028', s: '#16121f', px: 60 }], 'product', 'Wins5K');
    boards.speed = leaderboard(new V3(-56, 0, -63), 'Most Speed', new V3(0.5, 0, 1).normalize());
    boards.wins = leaderboard(new V3(-76, 0, -54), 'Most Wins', new V3(1, 0, 0.6).normalize());
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
function stageSigns(s, idx) {
    // Stage 1's title floats in front of the tunnel, like the reference; the others sit on the lintel
    const y = idx ? 33.5 : 20, z = idx ? s.zS + 0.2 : s.zS - 5;
    textPlane([{ t: s.name, c: '#ffffff', s: '#16121f', px: 150 }, { t: s.sub, c: s.subColor, s: '#16121f', px: 120 }], 30, 1024, new V3(0, y, z), new V3(0, y, z - 10));
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
    const jaws = { ...SHARK_LOOK, size: 7 };
    const big = buildFish(jaws); m.add(big);
    for (const sx of [-1, 1]) { const f = buildFish({ ...SHARK_LOOK, size: 4 }); f.position.set(sx * 14, 2, -8); m.add(f); }
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
        stageSigns(s, idx);
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
