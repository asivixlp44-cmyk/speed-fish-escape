import { T, texFrom } from './engine.js';

// Canvas-generated surface textures: cracked lava, water, bricks and hanging banners.

// Tileable Voronoi lava: bright yellow cell centres, orange body, dark cracks
function lavaCanvas() {
    const N = 256, seeds = [];
    let s = 1337;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 22; i++) seeds.push([rnd() * N, rnd() * N]);
    const c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d');
    const img = x.createImageData(N, N), d = img.data;
    for (let py = 0; py < N; py++) {
        for (let px = 0; px < N; px++) {
            let f1 = 1e9, f2 = 1e9;
            for (const [sx, sy] of seeds) {
                for (let ox = -N; ox <= N; ox += N) for (let oy = -N; oy <= N; oy += N) {
                    const dx = px - sx - ox, dy = py - sy - oy;
                    const dd = dx * dx + dy * dy;
                    if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
                }
            }
            const edge = Math.sqrt(f2) - Math.sqrt(f1);   // distance to the crack
            const centre = Math.min(1, Math.sqrt(f1) / 34); // 0 at the cell centre
            const i = (py * N + px) * 4;
            if (edge < 2.2) { d[i] = 150; d[i + 1] = 38; d[i + 2] = 8; }
            else {
                const k = Math.min(1, (edge - 2.2) / 5);
                const hot = (1 - centre) * k;
                d[i] = 255;
                d[i + 1] = Math.round(120 + 110 * hot);
                d[i + 2] = Math.round(10 + 60 * hot * hot);
            }
            d[i + 3] = 255;
        }
    }
    x.putImageData(img, 0, 0);
    return c;
}

function brickCanvas() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#b9b3c9'; x.fillRect(0, 0, 128, 128);
    const rows = 8, h = 128 / rows, w = 32;
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let r = 0; r < rows; r++) {
        const off = r % 2 ? w / 2 : 0;
        for (let b = -1; b < 128 / w + 1; b++) {
            const v = Math.round(225 + rnd() * 30);
            x.fillStyle = `rgb(${v},${v},${Math.min(255, v + 8)})`;
            x.fillRect(b * w + off + 1.5, r * h + 1.5, w - 3, h - 3);
            x.fillStyle = 'rgba(255,255,255,0.18)';
            x.fillRect(b * w + off + 1.5, r * h + 1.5, w - 3, 2);
        }
    }
    return c;
}

// Tileable cartoon water: cyan base with soft white caustic ridges (the stage lanes in the reference)
function waterCanvas() {
    const N = 256, seeds = [];
    let s = 4242;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 16; i++) seeds.push([rnd() * N, rnd() * N]);
    const c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d');
    const img = x.createImageData(N, N), d = img.data;
    for (let py = 0; py < N; py++) {
        for (let px = 0; px < N; px++) {
            let f1 = 1e9, f2 = 1e9;
            for (const [sx, sy] of seeds) {
                for (let ox = -N; ox <= N; ox += N) for (let oy = -N; oy <= N; oy += N) {
                    const dx = px - sx - ox, dy = py - sy - oy;
                    const dd = dx * dx + dy * dy;
                    if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
                }
            }
            const edge = Math.sqrt(f2) - Math.sqrt(f1);
            const i = (py * N + px) * 4;
            const k = Math.max(0, 1 - edge / 9);
            const w = k * k * (3 - 2 * k);
            d[i] = Math.round(40 + 205 * w);
            d[i + 1] = Math.round(200 + 55 * w);
            d[i + 2] = Math.round(235 + 20 * w);
            d[i + 3] = 255;
        }
    }
    x.putImageData(img, 0, 0);
    return c;
}

const lavaImg = lavaCanvas();
const brickImg = brickCanvas();
const waterImg = waterCanvas();
const waterAnimated = [];
const animated = [];
const cache = new Map();

function repeated(img, key, rx, ry) {
    rx = Math.max(1, Math.round(rx)); ry = Math.max(1, Math.round(ry));
    const id = key + rx + 'x' + ry;
    if (cache.has(id)) return cache.get(id);
    const t = texFrom(img);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(rx, ry);
    cache.set(id, t);
    return t;
}

// Unlit so it reads as glowing, but kept below the bloom threshold
export function lavaMaterial(rx, ry) {
    const id = 'lavaMat' + Math.round(rx) + 'x' + Math.round(ry);
    if (cache.has(id)) return cache.get(id);
    const m = new T.MeshBasicMaterial({ map: repeated(lavaImg, 'lava', rx, ry) });
    animated.push(m.map);
    cache.set(id, m);
    return m;
}
export function brickMaterial(color, rx, ry) {
    const id = 'brickMat' + color + Math.round(rx) + 'x' + Math.round(ry);
    if (cache.has(id)) return cache.get(id);
    const m = new T.MeshLambertMaterial({ color, map: repeated(brickImg, 'brick', rx, ry) });
    cache.set(id, m);
    return m;
}

// Walkable water lane; the caustics drift slowly (updateMaterials)
export function waterMaterial(rx, ry) {
    const id = 'waterMat' + Math.round(rx) + 'x' + Math.round(ry);
    if (cache.has(id)) return cache.get(id);
    const m = new T.MeshLambertMaterial({ map: repeated(waterImg, 'water', rx, ry) });
    waterAnimated.push(m.map);
    cache.set(id, m);
    return m;
}

// Hanging Atlantis banner with a fish and a vertical word
export function bannerMaterial(bg, word) {
    const id = 'banner' + bg + word;
    if (cache.has(id)) return cache.get(id);
    const c = document.createElement('canvas'); c.width = 128; c.height = 320;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
    x.fillStyle = g; x.fillRect(0, 0, 128, 300);
    x.beginPath(); x.moveTo(0, 300); x.lineTo(64, 320); x.lineTo(128, 300); x.fill();
    x.strokeStyle = '#ffd028'; x.lineWidth = 6; x.strokeRect(8, 8, 112, 284);
    x.font = '72px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('🐠', 64, 64);
    x.font = '700 40px Fredoka, sans-serif'; x.fillStyle = '#ffffff';
    x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.45)';
    [...word].forEach((ch, i) => { x.strokeText(ch, 64, 130 + i * 40); x.fillText(ch, 64, 130 + i * 40); });
    const m = new T.MeshLambertMaterial({ map: texFrom(c), transparent: true, side: T.DoubleSide });
    cache.set(id, m);
    return m;
}

export function updateMaterials(dt) {
    for (const t of animated) { t.offset.y = (t.offset.y + dt * 0.035) % 1; t.offset.x = (t.offset.x + dt * 0.01) % 1; }
    for (const t of waterAnimated) { t.offset.y = (t.offset.y + dt * 0.02) % 1; t.offset.x = (t.offset.x + dt * 0.012) % 1; }
}
