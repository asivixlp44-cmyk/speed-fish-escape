import { T, UNIT, mat } from './engine.js';

// Blocky fish built from boxes, facing +Z with the belly just above y = 0.
// userData: seat (y of the rider's saddle), tail (group that wiggles), segs/arms for
// serpents and krakens, and len (body length) so callers can place things around it.

const EYE_W = 0xffffff, EYE_B = 0x141418, TOOTH = 0xfffff0;
const CONE = new T.ConeGeometry(0.5, 1, 6);
const MOUNT_SCALE = 1.4;

function maker(root) {
    return (sx, sy, sz, x, y, z, c, parent, o) => {
        const m = new T.Mesh(UNIT, mat(c, o));
        m.scale.set(sx, sy, sz); m.position.set(x, y, z);
        m.castShadow = !(o && o.neon);
        (parent || root).add(m);
        return m;
    };
}
function cone(parent, r, h, x, y, z, c, rx, rz) {
    const m = new T.Mesh(CONE, mat(c));
    m.scale.set(r * 2, h, r * 2); m.position.set(x, y, z);
    m.rotation.set(rx || 0, 0, rz || 0);
    m.castShadow = true; parent.add(m);
    return m;
}
function eyes(part, head, w, y, z, size, angry) {
    for (const s of [-1, 1]) {
        part(0.08, size, size, s * (w / 2 + 0.02), y, z, EYE_W, head);
        part(0.1, size * 0.55, size * 0.55, s * (w / 2 + 0.05), y - size * 0.05, z + size * 0.12, EYE_B, head);
        if (angry) {
            const b = part(0.12, size * 0.22, size * 1.1, s * (w / 2 + 0.06), y + size * 0.55, z, EYE_B, head);
            b.rotation.x = 0.45;
        }
    }
}
function teeth(part, parent, w, y, z, n, h, down) {
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - 0.5) * (w - 0.3);
        const m = part(0.18, h, 0.18, x, y + (down ? -h / 2 : h / 2), z, TOOTH, parent);
        m.rotation.z = 0.785;
    }
}
// Forked tail: a stem plus two lobes angled up and down
function tail(part, parent, h, w, color, spread) {
    const g = new T.Group();
    parent.add(g);
    part(w * 0.5, h * 0.45, 0.8, 0, 0, -0.4, color, g);
    for (const s of [-1, 1]) {
        const lobe = part(0.22, h * 0.75, 1.4, 0, s * h * 0.28, -1.2, color, g);
        lobe.rotation.x = -s * (spread || 0.55);
    }
    return g;
}

// Standard fish body used by most shapes. Returns { head, tail, top } in the fish group.
function fishBody(g, part, d, o) {
    const L = o.L, H = o.H, W = o.W, y = o.y;
    part(W, H, L, 0, y, 0, d.body);
    part(W * 0.92, H * 0.3, L * 0.9, 0, y - H * 0.38, 0.1, d.belly);
    const head = new T.Group(); head.position.set(0, y, L / 2); g.add(head);
    part(W * 0.86, H * 0.82, o.headL || 1.2, 0, 0, (o.headL || 1.2) / 2, d.body, head);
    part(W * 0.8, H * 0.24, (o.headL || 1.2) * 0.9, 0, -H * 0.3, (o.headL || 1.2) / 2, d.belly, head);
    const tl = new T.Group(); tl.position.set(0, y, -L / 2); g.add(tl);
    tail(part, tl, H * (o.tailH || 1.1), W, d.fin, o.spread);
    // Side fins
    for (const s of [-1, 1]) {
        const f = part(0.8, 0.14, 1.1, s * (W / 2 + 0.35), y - H * 0.2, L * 0.22, d.fin);
        f.rotation.z = s * -0.5; f.rotation.y = s * 0.4;
    }
    return { head, tail: tl, top: y + H / 2 };
}

const SHAPES = {
    clown(g, part, d) {
        const b = fishBody(g, part, d, { L: 4.6, H: 2.4, W: 2, y: 1.5 });
        for (const [z, w] of [[1.4, 0.5], [-0.3, 0.6], [-2.0, 0.4]]) {
            part(2.08, 2.46, w, 0, 1.5, z, d.stripe);
            part(2.1, 2.48, 0.12, 0, 1.5, z - w / 2 - 0.06, EYE_B);
            part(2.1, 2.48, 0.12, 0, 1.5, z + w / 2 + 0.06, EYE_B);
        }
        part(0.3, 0.7, 3, 0, 2.95, -0.2, d.body);
        part(0.32, 0.12, 3, 0, 3.32, -0.2, EYE_B);
        eyes(part, b.head, 1.72, 0.35, 0.75, 0.55);
        return b;
    },
    puffer(g, part, d) {
        const b = fishBody(g, part, d, { L: 3.4, H: 3, W: 3, y: 1.8, headL: 0.8, tailH: 0.7 });
        for (let i = 0; i < 18; i++) {
            const a = i / 18 * Math.PI * 2, r = 1.55;
            const ring = i % 2 ? 0.7 : -0.5;
            cone(g, 0.18, 0.7, Math.cos(a) * r, 1.8 + Math.sin(a) * r, ring, 0xf5f0d0, 0, -Math.PI / 2 + a);
        }
        part(0.3, 0.4, 0.3, 0, -0.2, 0.9, 0xff8a9a, b.head);
        eyes(part, b.head, 2.6, 0.5, 0.45, 0.8);
        return b;
    },
    snapper(g, part, d) {
        const b = fishBody(g, part, d, { L: 4.8, H: 2.6, W: 1.8, y: 1.6 });
        for (let i = 0; i < 5; i++) { const f = part(0.2, 1.1, 0.7, 0, 3.1, 1.2 - i * 0.7, d.fin); f.rotation.x = -0.4; }
        eyes(part, b.head, 1.55, 0.4, 0.7, 0.55);
        return b;
    },
    lion(g, part, d) {
        const b = fishBody(g, part, d, { L: 4.6, H: 2.4, W: 1.8, y: 1.6 });
        for (let i = 0; i < 6; i++) part(1.84, 2.42, 0.22, 0, 1.6, 1.8 - i * 0.75, d.stripe);
        for (let i = 0; i < 7; i++) {
            const f = part(0.12, 2.2, 0.12, 0, 3.6, 1.8 - i * 0.6, i % 2 ? d.body : d.fin);
            f.rotation.x = -0.35;
        }
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
            const f = part(0.1, 0.1, 2.4, s * 1.4, 1.2 - i * 0.18, 0.2 - i * 0.3, i % 2 ? d.body : d.fin);
            f.rotation.y = s * (0.6 + i * 0.15);
        }
        eyes(part, b.head, 1.55, 0.35, 0.7, 0.5, true);
        return b;
    },
    piranha(g, part, d) {
        const b = fishBody(g, part, d, { L: 4, H: 3, W: 2, y: 1.8, headL: 1.4 });
        part(1.8, 0.55, 0.5, 0, -0.95, 1.5, d.belly, b.head);
        teeth(part, b.head, 1.7, -0.7, 1.72, 6, 0.4, false);
        teeth(part, b.head, 1.5, -0.05, 1.45, 5, 0.35, true);
        part(0.25, 1, 2.2, 0, 3.6, -0.3, d.fin);
        eyes(part, b.head, 1.72, 0.55, 0.8, 0.55, true);
        return b;
    },
    sword(g, part, d) {
        const b = fishBody(g, part, d, { L: 5.2, H: 2.2, W: 1.8, y: 1.5 });
        part(0.3, 0.3, 4.2, 0, 0.1, 3.2, 0x9aa8c8, b.head);
        const sail = part(0.16, 2.2, 3.2, 0, 3.3, 0.6, d.fin); sail.rotation.x = -0.25;
        for (let i = 0; i < 4; i++) part(1.84, 0.25, 0.25, 0, 1.3 + i * 0.35, 1.8 - i * 0.9, 0x5a9bff);
        eyes(part, b.head, 1.55, 0.3, 0.65, 0.5);
        return b;
    },
    ray(g, part, d) {
        const body = part(4.6, 0.8, 4.6, 0, 1, 0, d.body); body.rotation.y = Math.PI / 4;
        const under = part(4.2, 0.2, 4.2, 0, 0.55, 0, d.belly); under.rotation.y = Math.PI / 4;
        const head = new T.Group(); head.position.set(0, 1, 2.6); g.add(head);
        part(1.4, 0.7, 1, 0, 0, 0, d.body, head);
        for (const s of [-1, 1]) {
            part(0.35, 0.3, 0.35, s * 0.55, 0.45, 0.1, EYE_W, head);
            part(0.2, 0.2, 0.2, s * 0.55, 0.55, 0.22, EYE_B, head);
        }
        const tl = new T.Group(); tl.position.set(0, 1, -3); g.add(tl);
        part(0.2, 0.2, 4.4, 0, 0, -2.1, d.fin, tl);
        cone(tl, 0.2, 0.8, 0, 0.3, -1.4, 0xe0e0e0);
        for (let i = 0; i < 5; i++) part(0.5, 0.1, 0.5, (i % 2 ? 1 : -1) * 0.9, 1.45, 0.8 - i * 0.6, d.fin);
        return { head, tail: tl, top: 1.4 };
    },
    hammer(g, part, d) {
        const b = SHAPES.shark(g, part, d, true);
        part(4.6, 0.6, 1, 0, 0.1, 1.5, d.body, b.head);
        const dorsal = part(0.3, 2, 1.6, 0, 3.3, 0, d.fin); dorsal.rotation.x = -0.45;
        for (const s of [-1, 1]) {
            part(0.3, 0.45, 0.45, s * 2.35, 0.1, 1.6, EYE_W, b.head);
            part(0.32, 0.25, 0.25, s * 2.4, 0.1, 1.72, EYE_B, b.head);
        }
        return b;
    },
    angler(g, part, d) {
        const b = fishBody(g, part, d, { L: 3.6, H: 3, W: 2.6, y: 1.8, headL: 1.6 });
        part(2.3, 0.7, 1, 0, -1.1, 1.3, d.belly, b.head);
        teeth(part, b.head, 2.2, -0.75, 1.72, 7, 0.55, false);
        teeth(part, b.head, 2.2, 0.1, 1.72, 7, 0.5, true);
        const stalk = part(0.15, 0.15, 2.2, 0, 1.9, 1.3, d.fin, b.head); stalk.rotation.x = 0.5;
        part(0.6, 0.6, 0.6, 0, 2.5, 2.5, d.glow, b.head, { neon: true });
        eyes(part, b.head, 2.3, 0.6, 0.6, 0.4, true);
        return b;
    },
    orca(g, part, d) {
        const b = SHAPES.shark(g, part, d, true);
        for (const s of [-1, 1]) part(0.1, 0.6, 1.2, s * 1.14, 0.45, 0.4, 0xf5f5f5, b.head);
        const dorsal = part(0.3, 2.8, 1.2, 0, 4.1, -0.2, d.fin); dorsal.rotation.x = -0.15;
        return b;
    },
    // Shared by shark-like fish; plain leaves out the teeth, gills and dorsal fin for the caller
    shark(g, part, d, plain) {
        const b = fishBody(g, part, d, { L: 5.4, H: 2.3, W: 2.2, y: 1.5, headL: 1.8, tailH: 1.5, spread: 0.7 });
        part(1.6, 0.8, 1, 0, 0.3, 2, d.body, b.head);
        if (!plain) {
            part(1.7, 0.5, 0.9, 0, -0.55, 1.8, 0x8a1c2c, b.head);
            teeth(part, b.head, 1.6, -0.35, 2.2, 6, 0.4, true);
            teeth(part, b.head, 1.5, -0.75, 2.15, 5, 0.35, false);
            for (const s of [-1, 1]) for (let i = 0; i < 3; i++) part(0.06, 0.9, 0.1, s * 1.12, 1.4, 1.8 - i * 0.3, d.fin);
            const dorsal = part(0.3, 2, 1.6, 0, 3.3, 0, d.fin); dorsal.rotation.x = -0.45;
        }
        eyes(part, b.head, 1.95, 0.35, 1.1, 0.42, !plain);
        return b;
    },
    serpent(g, part, d) {
        const segs = [];
        const head = new T.Group(); head.position.set(0, 1.8, 2.6); g.add(head);
        part(2, 1.8, 2.2, 0, 0, 0, d.body, head);
        part(1.8, 0.5, 1.8, 0, -0.75, 0.3, d.belly, head);
        part(1.4, 0.9, 1.2, 0, -0.3, 1.5, d.body, head);
        teeth(part, head, 1.3, -0.75, 2.1, 5, 0.35, true);
        for (const s of [-1, 1]) {
            const horn = part(0.3, 1.6, 0.3, s * 0.7, 1.3, -0.5, 0xfff0c0, head); horn.rotation.x = -0.6;
            const frill = part(0.12, 1.2, 1.4, s * 1.1, 0.3, -0.6, d.fin, head); frill.rotation.z = s * 0.4;
        }
        eyes(part, head, 1.95, 0.35, 0.5, 0.5, true);
        const tl = new T.Group(); g.add(tl);
        for (let i = 0; i < 7; i++) {
            const k = 1 - i * 0.1;
            const sg = new T.Group(); sg.position.set(0, 1.6, 1.2 - i * 1.3); tl.add(sg);
            part(1.8 * k, 1.8 * k, 1.4, 0, 0, 0, i % 2 ? d.body : d.fin, sg);
            part(1.6 * k, 0.4, 1.3, 0, -0.75 * k, 0, d.belly, sg);
            part(0.2, 0.8 * k, 0.9, 0, 1.1 * k, 0, 0xfff0c0, sg);
            segs.push(sg);
        }
        g.userData.segs = segs;
        return { head, tail: null, top: 2.5 };
    },
    kraken(g, part, d) {
        const head = new T.Group(); head.position.set(0, 2.6, 0); g.add(head);
        part(3.4, 2.6, 3.2, 0, 0.3, 0, d.body, head);
        part(2.8, 1, 2.6, 0, 1.9, -0.3, d.body, head);
        part(3.5, 0.4, 3.3, 0, -0.9, 0, d.belly, head);
        for (let i = 0; i < 6; i++) part(0.5, 0.5, 0.2, -1.2 + i * 0.5, 0.6 + (i % 2) * 0.6, -1.62, d.belly, head);
        eyes(part, head, 3.4, 0.2, 0.9, 0.9, true);
        const arms = [];
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2 + Math.PI / 8;
            const arm = new T.Group(); arm.position.set(Math.sin(a) * 1.4, 1.5, Math.cos(a) * 1.4); arm.rotation.y = a; g.add(arm);
            let parent = arm;
            for (let k = 0; k < 4; k++) {
                const seg = new T.Group(); seg.position.z = k ? 0.9 : 0; parent.add(seg);
                part(0.7 - k * 0.12, 0.6 - k * 0.1, 1, 0, 0, 0.45, k % 2 ? d.fin : d.body, seg);
                part(0.25, 0.15, 0.25, 0, -0.3, 0.45, d.belly, seg);
                parent = seg;
                arm.userData['s' + k] = seg;
            }
            arms.push(arm);
        }
        g.userData.arms = arms;
        return { head, tail: null, top: 4.4 };
    },
};

// Builds a new fish group for a catalogue entry (fishById[...]); gold turns it into a statue
export function buildFish(d, o) {
    o = o || {};
    const g = new T.Group();
    const inner = new T.Group(); g.add(inner);
    const def = o.gold ? { ...d, body: 0xffcd32, belly: 0xffe07a, fin: 0xe0a010, stripe: 0xfff0a0, glow: 0xffffff } : d;
    const part = maker(inner);
    const shape = SHAPES[d.shape] || SHAPES.clown;
    const b = shape(inner, part, def);
    // Mounts read about as long as the rider is tall, like the reference
    const size = (d.size || 1) * MOUNT_SCALE;
    inner.scale.setScalar(size);
    g.userData.inner = inner;
    g.userData.tail = b.tail;
    g.userData.head = b.head;
    g.userData.seat = b.top * size;
    g.userData.segs = inner.userData.segs;
    g.userData.arms = inner.userData.arms;
    g.userData.phase = Math.random() * 6;
    return g;
}

// Swim cycle: tail sway, body bob and roll; faster while the rider is moving
export function swimFish(g, dt, moving) {
    const u = g.userData;
    u.phase += dt * (moving ? 11 : 3.5);
    const s = Math.sin(u.phase);
    const amp = moving ? 0.5 : 0.25;
    if (u.tail) u.tail.rotation.y = s * amp;
    if (u.head) u.head.rotation.y = -s * amp * 0.15;
    u.inner.position.y = Math.sin(u.phase * 0.5) * (moving ? 0.12 : 0.2);
    u.inner.rotation.z = Math.sin(u.phase * 0.5) * 0.04;
    if (u.segs) u.segs.forEach((sg, i) => { sg.position.x = Math.sin(u.phase - i * 0.7) * (0.25 + i * 0.1); sg.rotation.y = Math.cos(u.phase - i * 0.7) * 0.25; });
    if (u.arms) u.arms.forEach((a, i) => {
        for (let k = 0; k < 4; k++) a.userData['s' + k].rotation.x = 0.25 + Math.sin(u.phase * 0.6 + i + k * 0.8) * 0.25 + k * 0.1;
    });
}
