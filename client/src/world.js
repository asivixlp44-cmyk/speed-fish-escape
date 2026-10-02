import {
    T, V3, scene, mat, box, aabb, UNIT, solids, kills, triggers, tickers,
    texFrom, billboard, textPlane, camera,
} from './engine.js';
import { S, actions, net } from './state.js';
import { lavaMaterial, brickMaterial, waterMaterial, studWallMaterial, crackedStoneMaterial } from './textures.js';
import { emitTread, bubble } from './fx.js';
import { buildFish, swimFish } from './fish.js';
import {
    CFG, LOBBY, STAGES, TREADMILLS, TREAD_GEO, PASSES, FISH, SHARK_LOOK, TURTLE_MINUTES, FREE_BOOST_MINUTES,
    fishById, fmt, sci, clamp, clock, rngFrom, buxText,
} from '../../shared/config.js';

const HX = LOBBY.halfX, HZ = LOBBY.halfZ;
// Lobby colours from the reference: blue studded pool, brown stone paths, sand, gold shop,
// pale blue-grey Atlantis terraces with yellow trim, gold towers with pink domes
const LC = {
    pool: 0x3a86e8, stone: 0x9a7e74, sand: 0xf5d65a, trim: 0xffd23a, gold: 0xf2c230, goldDark: 0xd8a020,
    terrace: 0xaab4cc, terraceDark: 0x8e98b4, pad: 0xffe23a, dome: 0xffa8c8, kelp: 0x2ee07a, kelpDark: 0x1aa85a,
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
// Course, modelled on reference/game satges.mp4. Stages sit end to end along +z; each
// starts behind a "Stage N" wall and ends on a grey landing with the Wins pads.
// =====================================================================================
const STAGE_H = 44;
function texturedBox(sx, sy, sz, x, y, z, material) {
    const m = new T.Mesh(UNIT, material);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    m.receiveShadow = true;
    m.matrixAutoUpdate = false; m.updateMatrix();
    scene.add(m);
    return m;
}
// Solid box with a studded texture on every face
function studBox(sx, sy, sz, x, y, z, color, o) {
    const m = texturedBox(sx, sy, sz, x, y, z, studWallMaterial(color, Math.max(sx, sz) / 4, sy / 4));
    if (!(o && o.decor)) solids.push(aabb(x, y, z, sx, sy, sz));
    return m;
}
// Walkable water slab with its top at y = top, reaching `depth` studs down
function waterFloor(sx, sz, x, z, top, depth) {
    top = top || 0; depth = depth || 2;
    texturedBox(sx, depth, sz, x, top - depth / 2, z, waterMaterial(sx / 14, sz / 14));
    solids.push(aabb(x, top - depth / 2, z, sx, depth, sz));
}
function lavaPit(w, z0, z1) {
    const len = z1 - z0;
    texturedBox(w, 1, len, 0, -6.5, z0 + len / 2, lavaMaterial(w / 14, len / 14));
    const k = aabb(0, -22, z0 + len / 2, w, 34, len); k.active = true; kills.push(k);
}
// Glowing lava column from the pit up to the ceiling (the orange pillars in Stage 1)
function lavaPillar(x, z, top) {
    const sy = top + 8;
    texturedBox(3, sy, 3, x, -8 + sy / 2, z, lavaMaterial(1, sy / 6));
    const k = aabb(x, -8 + sy / 2, z, 3, sy, 3); k.active = true; kills.push(k);
}
const CONE = new T.ConeGeometry(1, 1, 6);
function cone(x, y, z, r, h, color) {
    const m = new T.Mesh(CONE, mat(color));
    m.scale.set(r, h, r); m.position.set(x, y + h / 2, z); m.castShadow = true;
    scene.add(m);
    return m;
}
// Ice-crystal spike standing on a walkway (top at y + 3): jump it or go round, touching it is a KO
function iceSpike(x, y, z) {
    cone(x, y, z, 1, 3.2, 0x6fe8ff);
    cone(x + 0.9, y, z + 0.5, 0.5, 1.8, 0xbff6ff);
    const k = aabb(x, y + 1.3, z, 1.6, 2.6, 1.6); k.active = true; kills.push(k);
}
// Pink sneaker worth +Speed, with its "+1 Speed" label floating underneath
function addPickup(stageIdx, x, y, z, amount) {
    const g = new T.Group();
    const body = new T.Mesh(UNIT, mat(0xe8386a)); body.scale.set(1.6, 1, 2.8); body.position.y = 0.3; g.add(body);
    const sole = new T.Mesh(UNIT, mat(0xffffff)); sole.scale.set(1.75, 0.35, 3); sole.position.y = -0.3; g.add(sole);
    const ankle = new T.Mesh(UNIT, mat(0xe8386a)); ankle.scale.set(1.5, 1, 1.2); ankle.position.set(0, 1, -0.8); g.add(ankle);
    const toe = new T.Mesh(UNIT, mat(0xffffff)); toe.scale.set(1.62, 0.5, 0.6); toe.position.set(0, 0, 1.2); g.add(toe);
    g.position.set(x, y + 2.4, z);
    scene.add(g);
    billboard([{ t: '+' + amount + ' Speed', c: '#2a8cff', s: '#ffffff', px: 64 }], 4.2, 512, new V3(x, y + 0.9, z));
    const id = stageIdx + ':' + pickups.filter((p) => p.stage === stageIdx).length;
    pickups.push({ id, stage: stageIdx, g, base: y + 2.4, amount, respawnAt: 0, phase: Math.random() * 6 });
}
// Side walls and ceiling for an enclosed stage
function enclosure(s, wallMat, ceilColor, h) {
    const mid = s.zS + s.len / 2;
    for (const sx of [-1, 1]) {
        texturedBox(2, h + 10, s.len, sx * (s.w / 2 + 1), (h + 10) / 2 - 8, mid, wallMat);
        solids.push(aabb(sx * (s.w / 2 + 1), (h + 10) / 2 - 8, mid, 2, h + 10, s.len));
    }
    studBox(s.w + 4, 2, s.len, 0, h + 1, mid, ceilColor, { decor: true });
}
// White light panels set into a dark ceiling (Stages 3 and 4)
function ceilingLights(s, h) {
    for (let z = s.zS + 8; z < s.zE - 4; z += 14) {
        for (let x = -s.w / 2 + 8; x <= s.w / 2 - 6; x += 14) box(3.4, 0.3, 1.6, x + ((z / 14) % 2 ? 4 : 0), h - 0.1, z, 0xffffff, { neon: true, decor: true });
    }
}
// The "Stage N" wall across the start of a stage, with the doorway through it
function stageWall(prev, s, mat) {
    const half = Math.max(prev.w, s.w) / 2 + 2, D = s.door / 2, DH = 20, z = s.zS + 1;
    texturedBox(half - D, STAGE_H + 8, 2, -(half + D) / 2, STAGE_H / 2 - 4, z, mat);
    texturedBox(half - D, STAGE_H + 8, 2, (half + D) / 2, STAGE_H / 2 - 4, z, mat);
    texturedBox(D * 2, STAGE_H - DH + 4, 2, 0, (STAGE_H + DH + 4) / 2, z, mat);
    solids.push(aabb(-(half + D) / 2, STAGE_H / 2 - 4, z, half - D, STAGE_H + 8, 2), aabb((half + D) / 2, STAGE_H / 2 - 4, z, half - D, STAGE_H + 8, 2));
    solids.push(aabb(0, (STAGE_H + DH + 4) / 2, z, D * 2, STAGE_H - DH + 4, 2));
    const lines = [{ t: s.name, c: '#ffffff', s: '#1a1f5c', px: 170 }];
    if (s.sub) lines.push({ t: s.sub, c: s.subColor, s: '#1a1f5c', px: 90 });
    textPlane(lines, 28, 1024, new V3(0, DH + 10, s.zS - 0.1), new V3(0, DH + 10, s.zS - 10));
}
// Grey landing at the end of a stage: "+N Wins / Return!" pad left, "x2 Wins!" pad right
function landing(i, s, finish) {
    const w = Math.max(s.w, 30);
    studBox(w, 2, CFG.endZone, 0, -1, s.cE + CFG.endZone / 2, 0x6c6a8a);
    const pz = s.cE + CFG.endZone / 2;
    const pad = (x, color, lines, enter) => {
        const m = new T.Mesh(UNIT, mat(color, { neon: true }));
        m.scale.set(9, 0.3, 5); m.position.set(x, 0.15, pz); m.rotation.y = x > 0 ? 0.35 : -0.35; scene.add(m);
        billboard(lines, 8, 512, new V3(x, 4.5, pz));
        const tr = aabb(x, 2.5, pz, 9, 5, 6);
        tr.enter = enter;
        triggers.push(tr);
    };
    // Facing down the course, +x is on the left: Return on the left, x2 on the right
    pad(w / 2 - 7, 0xffd23a, [{ t: '+' + s.wins + ' Wins', c: '#ffd028', s: '#16121f', px: 80 }, { t: finish ? 'FINISH!' : 'Return!', c: '#ffffff', s: '#16121f', px: 50 }], () => actions.pad(i));
    pad(-w / 2 + 7, 0xff2ad8, [{ t: 'x2 Wins!', c: '#ff7ae0', s: '#16121f', px: 80 }, { t: 'Only ' + buxText(PASSES.DoubleWins.price), c: '#ffffff', s: '#16121f', px: 46 }], () => actions.buy('pass', 'DoubleWins'));
}
// Tall bright sea-grass clump whose blades sway (Stage 4)
function seaGrass(rng, x, z, h) {
    const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
    const blades = [];
    for (let i = 0; i < 9; i++) {
        const b = new T.Mesh(UNIT, mat(i % 3 ? 0x4cf05a : 0x2ed84a));
        const bh = h * (0.6 + rng() * 0.4);
        b.scale.set(0.5, bh, 0.16); b.position.y = bh / 2;
        const p = new T.Group(); p.rotation.set((rng() - 0.5) * 0.7, rng() * Math.PI, (rng() - 0.5) * 0.7); p.add(b); g.add(p);
        blades.push(p);
    }
    const ph = rng() * 6;
    tickers.push((dt, t) => {
        if (camera.position.distanceToSquared(g.position) > 140 * 140) return;
        blades.forEach((p, i) => { p.rotation.z = Math.sin(t * 1.3 + ph + i) * 0.12 + (i % 2 ? 0.2 : -0.2); });
    });
}
// Cluster of brown rock cubes hanging from a ceiling (Stage 1)
function hangingRocks(rng, x, z, top) {
    let y = top;
    for (let i = 0; i < 4; i++) {
        const s = 2.2 + rng() * 1.8;
        y -= s * 0.7;
        studBox(s, s, s, x + (rng() - 0.5) * 2.5, y, z + (rng() - 0.5) * 2.5, i % 2 ? 0xa07850 : 0x8e6a48, { decor: true });
    }
}
// Stepped terraces with yellow trim beside the open Stage 2 bridge
function terraceBank(rng, side, z0, z1) {
    for (let z = z0; z < z1; z += 16) {
        let h = 0;
        for (let k = 0; k < 3; k++) {
            h += 8 + rng() * 12;
            const x = side * (32 + k * 14 + rng() * 4);
            studBox(14, h, 16.2, x, h / 2 - 6, z + 8, k % 2 ? LC.terraceDark : LC.terrace, { decor: true });
            box(14.4, 0.8, 0.7, x, h - 6.2, z + 0.4, LC.trim, { decor: true });
        }
    }
}

// Stage 1: water slabs stepping up and down over a lava pit, lava columns, spikes and hanging rocks
function buildOcean(i, s, rng) {
    const W = s.w, H = STAGE_H, z1 = s.cE;
    enclosure(s, studWallMaterial(0x8ea2c8, s.len / 4, (H + 10) / 4), 0x4a5068, H);
    studBox(W, 2, 16, 0, -1, s.zS + 8, LC.sand);
    lavaPit(W, s.zS + 16, z1);
    let z = s.zS + 16, x = 0, k = 0;
    const tops = [];
    while (z < z1 - 1) {
        const len = Math.min(13 + rng() * 9, z1 - z);
        const pw = 9 + rng() * 5;
        x = clamp(x + (rng() * 2 - 1) * 4, -(W / 2 - pw / 2 - 3), W / 2 - pw / 2 - 3);
        const y = [0, 1.5, 3, 1.5][k % 4];
        waterFloor(pw, len, x, z + len / 2, y, y + 7);
        tops.push({ x, y, z: z + len / 2, pw });
        // Spikes poking up out of the lava beside the slab
        for (const sd of [-1, 1]) if (rng() < 0.7) {
            const cx = x + sd * (pw / 2 + 1.5 + rng() * 3);
            cone(cx, -6, z + rng() * len, 1.1, 7 + rng() * 3, rng() < 0.5 ? 0x6fe8ff : 0x6a6e80);
        }
        if (k > 0 && k % 2 === 0 && len > 12) iceSpike(x + (rng() * 2 - 1) * (pw / 2 - 2), y, z + len / 2);
        // Every other slab ends in a jump over the lava
        z += len + (k % 2 && z + len < z1 - 20 ? 2.5 + rng() * 2 : 0); k++;
    }
    for (let pz = s.zS + 30; pz < z1; pz += 42) for (const sd of [-1, 1]) lavaPillar(sd * (W / 2 - 3 - rng() * 4), pz + rng() * 12, H);
    for (let pz = s.zS + 24; pz < z1; pz += 26) {
        hangingRocks(rng, (rng() * 2 - 1) * (W / 2 - 6), pz, H);
        const sd = rng() < 0.5 ? -1 : 1;
        box(0.8, 0.6, 9, sd * (W / 2 - 0.4), 5 + rng() * 3, pz + 6, 0xffc83a, { decor: true });
        box(0.8, 3, 0.6, sd * (W / 2 - 0.4), 4, pz + 1.8, 0xffc83a, { decor: true });
    }
    for (let n = 1; n < tops.length; n += 2) addPickup(i, tops[n].x + (rng() - 0.5) * 4, tops[n].y, tops[n].z, s.pickup);
}
// Stage 2: an open bridge over a lava sea. Water strips alternate with red strips, and a grey
// cracked stone wall hanging over each red strip slams down onto it (server-clock timing).
const SLAB_H = 36, SLAB_RAISE = 24, RED_LEN = 10, WATER_LEN = 16;
function buildFallingWalls(i, s, rng) {
    const W = s.w, mid = s.zS + s.len / 2;
    texturedBox(260, 1, s.len + 40, 0, -5.5, mid, lavaMaterial(260 / 14, (s.len + 40) / 14));
    const kill = aabb(0, -20, mid, 260, 28, s.len + 40); kill.active = true; kills.push(kill);
    terraceBank(rng, -1, s.zS, s.zE);
    terraceBank(rng, 1, s.zS, s.zE);
    waterFloor(W, 20, 0, s.zS + 10);
    let z = s.zS + 20, k = 0;
    while (z + RED_LEN + WATER_LEN <= s.cE) {
        studBox(W, 2, RED_LEN, 0, -1, z + RED_LEN / 2, 0xe8182c);
        // A wall lands here, so it is never a revive spot
        solids[solids.length - 1].unsafe = true;
        const m = new T.Mesh(UNIT, crackedStoneMaterial(W / 4, SLAB_H / 4));
        m.scale.set(W, SLAB_H, RED_LEN); m.castShadow = true; scene.add(m);
        const c = aabb(0, SLAB_RAISE + SLAB_H / 2, z + RED_LEN / 2, W, SLAB_H, RED_LEN); c.unsafe = true; solids.push(c);
        slabs.push({ m, c, z: z + RED_LEN / 2, phase: k * 1.7 });
        waterFloor(W, WATER_LEN, 0, z + RED_LEN + WATER_LEN / 2);
        if (k % 2 === 0) addPickup(i, (rng() * 2 - 1) * (W / 2 - 4), 0, z + RED_LEN + WATER_LEN / 2, s.pickup);
        z += RED_LEN + WATER_LEN; k++;
    }
    if (z < s.cE) waterFloor(W, s.cE - z, 0, (z + s.cE) / 2);
}
// Stage 3: a real maze of tall gold walls on a water floor, under a dark ceiling with lights.
// Carved with a seeded depth-first search, then a few extra walls knocked out for loops.
function buildMaze(i, s, rng) {
    const W = s.w, H = 26, C = 16, COLS = Math.round(W / C);
    const gold = studWallMaterial(0xd8a820, s.len / 4, (H + 10) / 4);
    enclosure(s, gold, 0x3a2a22, H);
    ceilingLights(s, H);
    waterFloor(W, s.cE - s.zS, 0, (s.zS + s.cE) / 2);
    const mz = s.zS + 8, ROWS = Math.floor((s.cE - 6 - mz) / C), mid = Math.floor(COLS / 2);
    // walls: east[r][c] between c and c+1, north[r][c] between r and r+1
    const east = [], north = [], seen = [];
    for (let r = 0; r < ROWS; r++) { east.push(Array(COLS).fill(true)); north.push(Array(COLS).fill(true)); seen.push(Array(COLS).fill(false)); }
    const stack = [[0, mid]]; seen[0][mid] = true;
    while (stack.length) {
        const [r, c] = stack[stack.length - 1];
        const nb = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]].filter(([a, b]) => a >= 0 && a < ROWS && b >= 0 && b < COLS && !seen[a][b]);
        if (!nb.length) { stack.pop(); continue; }
        const [a, b] = nb[Math.floor(rng() * nb.length)];
        if (a > r) north[r][c] = false; else if (a < r) north[a][c] = false;
        else if (b > c) east[r][c] = false; else east[r][b] = false;
        seen[a][b] = true; stack.push([a, b]);
    }
    for (let n = 0; n < ROWS * COLS * 0.04; n++) {
        const r = Math.floor(rng() * (ROWS - 1)), c = Math.floor(rng() * (COLS - 1));
        if (rng() < 0.5) north[r][c] = false; else east[r][c] = false;
    }
    const wall = (sx, sz, x, z) => {
        texturedBox(sx, H, sz, x, H / 2, z, studWallMaterial(0xd8a820, Math.max(sx, sz) / 4, H / 4));
        solids.push(aabb(x, H / 2, z, sx, H, sz));
    };
    const x0 = -W / 2;
    for (let c = 0; c < COLS; c++) if (c !== mid) wall(C + 1.5, 1.5, x0 + c * C + C / 2, mz);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const cz = mz + r * C;
        if (north[r][c] && !(r === ROWS - 1 && c === mid)) wall(C + 1.5, 1.5, x0 + c * C + C / 2, cz + C);
        if (east[r][c] && c < COLS - 1) wall(1.5, C + 1.5, x0 + (c + 1) * C, cz + C / 2);
    }
    // Ice spike traps in some corridors
    for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (rng() < 0.16) iceSpike(x0 + c * C + C / 2 + (rng() - 0.5) * 4, 0, mz + r * C + C / 2 + (rng() - 0.5) * 4);
    for (let n = 0; n < 12; n++) {
        const r = Math.floor(rng() * ROWS), c = Math.floor(rng() * COLS);
        addPickup(i, x0 + c * C + C / 2, 0, mz + r * C + C / 2, s.pickup);
    }
}
// Stage 4 sharks: a lane every laneGap studs. Each shark swims back and forth across the
// hall on the server clock, so it is always there and every player sees the same thing.
export const sharkSwimmers = [];
const HAZARD_SHARK = { ...SHARK_LOOK, size: 1.7 };
function sharkLanes(s, rng) {
    const span = s.w / 2 + 6;
    let lane = 0;
    for (let z = s.zS + 30; z < s.cE - 8; z += s.laneGap, lane++) {
        const speed = s.bs * (0.8 + rng() * 0.45);
        const phase = rng();
        // Every third lane has a second shark coming the other way
        const count = lane % 3 === 2 ? 2 : 1;
        for (let n = 0; n < count; n++) {
            const f = buildFish(HAZARD_SHARK);
            scene.add(f);
            sharkSwimmers.push({ f, z: z + (n ? 4 : 0), span, period: 4 * span / speed, phase: (phase + n * 0.5) % 1, x: 0, dir: 1 });
        }
    }
}
// Positions every shark for server time t (seconds); main.js checks for hits
export function updateSharkSwimmers(t, dt) {
    for (const k of sharkSwimmers) {
        const u = ((t / k.period + k.phase) % 1 + 1) % 1;
        const out = u < 0.5;
        k.x = -k.span + 2 * k.span * (out ? u * 2 : 2 - u * 2);
        k.dir = out ? 1 : -1;
        k.f.position.set(k.x, 0.4, k.z);
        k.f.rotation.y = k.dir * Math.PI / 2;
        if (Math.abs(k.z - camera.position.z) < 160) swimFish(k.f, dt, true);
    }
}
// Stage 4: brown brick hall with yellow panels, a pale floor, sea grass and crystals
function buildSharks(i, s, rng) {
    sharkLanes(s, rng);
    const W = s.w, H = 30;
    enclosure(s, brickMaterial(0x8a5a4a, s.len / 12, (H + 10) / 6), 0x3a2a22, H);
    ceilingLights(s, H);
    studBox(W, 2, 18, 0, -1, s.zS + 9, 0x6c6a8a);
    studBox(W, 2, s.cE - s.zS - 18, 0, -1, (s.zS + 18 + s.cE) / 2, 0xdff4ff);
    for (let z = s.zS + 10; z < s.zE - 6; z += 18) for (const sd of [-1, 1]) {
        box(0.6, 18, 11, sd * (W / 2 - 0.3), 11, z + 9, 0xe8c040, { decor: true });
        box(3, H, 3, sd * (W / 2 - 1), H / 2, z, 0x7a4a3a, { decor: true });
    }
    for (let z = s.zS + 22; z < s.cE - 4; z += 13) for (const sd of [-1, 1]) {
        seaGrass(rng, sd * (W / 2 - 3 - rng() * 2), z + rng() * 4, 9 + rng() * 6);
        if (rng() < 0.6) cone(sd * (W / 2 - 6 - rng() * 3), 0, z + 6, 0.9, 4 + rng() * 3, 0x6fe8ff);
    }
    for (let n = 0; n < 10; n++) addPickup(i, (rng() * 2 - 1) * (W / 2 - 8), 0, s.zS + 26 + (s.cE - s.zS - 32) * n / 9, s.pickup);
}
// Stage 5: coral platforms over lava
function buildObby(i, s, rng) {
    const W = s.w, H = STAGE_H, z1 = s.cE;
    enclosure(s, studWallMaterial(0x8ea2c8, s.len / 4, (H + 10) / 4), 0x4a5068, H);
    waterFloor(W, 16, 0, s.zS + 8);
    lavaPit(W, s.zS + 16, z1);
    let z = s.zS + 16, x = 0, y = 0, k = 0;
    const tops = [];
    for (;;) {
        const gap = 4 + rng() * 2;
        const beam = rng() < 0.35;
        const sx = beam ? 3 : 6 + rng() * 4, sz = beam ? 12 : 6 + rng() * 4;
        const nz = z + gap;
        if (nz + sz > z1 - 12) break;
        // Keep every jump makeable at the starting walk speed (about 7 studs of air at +2 height)
        x = clamp(x + (rng() * 2 - 1) * 3.5, -(W / 2 - 8), W / 2 - 8);
        const rise = [0, 0, 2, -2, 3, -3][Math.floor(rng() * 6)];
        y = clamp(y + (gap > 5 ? Math.min(rise, 2) : rise), 0, 9);
        box(sx, 2, sz, x, y - 1, nz + sz / 2, CORAL[k % 4], { studs: true });
        tops.push({ x, y, z: nz + sz / 2 });
        z = nz + sz; k++;
    }
    const bz = z + 4;
    waterFloor(W, z1 - bz, 0, bz + (z1 - bz) / 2);
    for (let pz = s.zS + 30; pz < z1; pz += 42) for (const sd of [-1, 1]) lavaPillar(sd * (W / 2 - 3), pz + rng() * 8, H);
    const step = Math.max(1, Math.floor(tops.length / 9));
    for (let n = 1; n < tops.length; n += step) addPickup(i, tops[n].x, tops[n].y, tops[n].z, s.pickup);
}
// Stage 6: a long hall; a Megalodon chases you down it
function buildChase(i, s, rng) {
    const W = s.w, H = STAGE_H, len = s.cE - s.zS;
    enclosure(s, brickMaterial(0x5c6c94, s.len / 12, (H + 10) / 6), 0x2a3450, H);
    ceilingLights(s, H);
    waterFloor(W, len, 0, s.zS + len / 2);
    for (let z = s.zS + 30; z < s.cE - 10; z += 28) {
        if (rng() < 0.5) box(12 + rng() * 8, 2.6, 2, (rng() * 2 - 1) * 10, 1.3, z, 0xe8182c);
        else for (let n = 0; n < 2; n++) studBox(5, H, 5, (rng() * 2 - 1) * 15, H / 2, z + n * 10, 0x6a78a0);
    }
    for (let n = 0; n < 9; n++) addPickup(i, (rng() * 2 - 1) * 16, 0, s.zS + 20 + (len - 30) * n / 8, s.pickup);
    // The Megalodon that chases this player (local only; each player gets their own)
    const m = new T.Group();
    const big = buildFish({ ...SHARK_LOOK, size: 7 }); m.add(big);
    for (const sx of [-1, 1]) { const f = buildFish({ ...SHARK_LOOK, size: 4 }); f.position.set(sx * 14, 2, -8); m.add(f); }
    m.visible = false; scene.add(m);
    // Length from the group origin to the Megalodon's nose
    m.userData.nose = (5.4 / 2 + 1.8 + 1) * big.userData.inner.scale.z;
    const k = aabb(0, H / 2, s.zS - 6, W, H, 4); k.active = false; kills.push(k);
    s.chaseMesh = m; s.chaseKill = k;
    tickers.push((dt) => { if (m.visible) m.children.forEach((f) => swimFish(f, dt, true)); });
}

const BUILDERS = { Ocean: buildOcean, FallingWalls: buildFallingWalls, Maze: buildMaze, Sharks: buildSharks, Obby: buildObby, Chase: buildChase };
// Surface of each stage's "Stage N" wall, matching the stage it leads into
const WALL_LOOK = {
    FallingWalls: () => studWallMaterial(0x6c6a8a, 20, 13),
    Maze: () => studWallMaterial(0xd8a820, 20, 13),
    Sharks: () => studWallMaterial(0xe8c040, 20, 13),
    Obby: () => studWallMaterial(0x2a6ae8, 20, 13),
    Chase: () => studWallMaterial(0x8a2030, 20, 13),
};

function buildCourse() {
    STAGES.forEach((s, idx) => {
        const rng = rngFrom(100 + idx * 17);
        BUILDERS[s.type](idx, s, rng);
        const finish = idx === STAGES.length - 1;
        landing(idx, s, finish);
        if (idx === 0) {
            // Stage 1's title floats in front of the lobby tunnel
            textPlane([{ t: s.name, c: '#ffffff', s: '#1a1f5c', px: 150 }, { t: s.sub, c: s.subColor, s: '#1a1f5c', px: 110 }], 30, 1024, new V3(0, 20, s.zS - 5), new V3(0, 20, s.zS - 15));
        } else stageWall(STAGES[idx - 1], s, WALL_LOOK[s.type]());
        const tr = aabb(0, 20, s.zS + 3, s.w, 60, 2);
        tr.enter = () => actions.enterStage(idx);
        triggers.push(tr);
        if (finish) {
            texturedBox(s.w + 4, 90, 2, 0, 2, s.zE + 1, brickMaterial(0x5c6c94, 4, 15));
            solids.push(aabb(0, 2, s.zE + 1, s.w + 4, 90, 2));
            textPlane([{ t: 'YOU ESCAPED!', c: '#ffd028', s: '#16121f', px: 150 }, { t: 'More stages coming soon', c: '#ffffff', s: '#16121f', px: 70 }], 34, 1024, new V3(0, 24, s.zE - 0.2), new V3(0, 24, s.zE - 20));
        }
    });
}

// Stage 2's stone walls run on the server clock so every player sees the same timing.
// Returns true when a wall crushes the player box at (x, y, z).
export function updateSlabs(t, hitsPlayer) {
    const F = CFG.fall, cyc = F.raised + F.warn + F.fall + F.down + F.rise;
    let crushed = false;
    for (const s of slabs) {
        const k = ((t + s.phase) % cyc + cyc) % cyc;
        let bottom = SLAB_RAISE, crushing = false;
        if (k < F.raised) bottom = SLAB_RAISE;
        else if (k < F.raised + F.warn) bottom = SLAB_RAISE + Math.sin(k * 60) * 0.3;
        else if (k < F.raised + F.warn + F.fall) { crushing = true; const f = (k - F.raised - F.warn) / F.fall; bottom = SLAB_RAISE * (1 - f * f); }
        else if (k < F.raised + F.warn + F.fall + F.down) { bottom = 0; crushing = true; }
        else { const f = (k - F.raised - F.warn - F.fall - F.down) / F.rise; bottom = SLAB_RAISE * f * f * (3 - 2 * f); }
        // Dust puff and a thud the moment a wall lands near the camera
        const landed = bottom === 0;
        if (landed && !s.landed && Math.abs(s.z - camera.position.z) < 70) { s.onLand && s.onLand(s); }
        s.landed = landed;
        s.m.position.set(0, bottom + SLAB_H / 2, s.z);
        s.c.min.y = bottom; s.c.max.y = bottom + SLAB_H;
        if (crushing && hitsPlayer && hitsPlayer(s)) crushed = true;
    }
    return crushed;
}
// Callback for a wall landing (sound, dust, shake), set by main.js
export function onSlabLand(fn) { for (const s of slabs) s.onLand = fn; }

export function buildWorld() {
    buildLobby();
    buildCourse();
    refreshShop();
}
