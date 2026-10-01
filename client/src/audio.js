// Procedural soundtrack and sound effects (Web Audio, no asset files).
// The track is an original 80 BPM chill lo-fi ocean tune: lazy swung drums, warm
// electric piano 7th chords, an airy pad, a kalimba melody with echo, wave washes,
// bubble blips and the odd distant whale. 16 bars, looping.

let ctx = null, master, musicBus, sfxBus, reverb, delay, oceanGain;
let noiseBuf = null;
let musicOn = false, schedTimer = null, step = 0, nextTime = 0;
const settings = { music: 0.6, sfx: 0.8, master: 1 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('sfe_audio') || '{}')); } catch (e) { /* defaults */ }

const BPM = 80, STEP = 60 / BPM / 4;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// One chord per bar: Fmaj7, Em7, Dm7, Cmaj7 (root, then voicing in MIDI)
const CHORDS = [
    { root: 41, notes: [57, 60, 64, 65] },
    { root: 40, notes: [55, 59, 62, 64] },
    { root: 38, notes: [57, 60, 62, 65] },
    { root: 36, notes: [55, 59, 60, 64] },
];
// Kalimba phrases, 4 bars x 16 steps: [step, midi, length in steps]
const MELODY_A = [
    [[0, 72, 3], [3, 76, 3], [6, 79, 4], [10, 77, 2], [12, 76, 4]],
    [[0, 74, 4], [4, 71, 4], [8, 74, 2], [10, 76, 6]],
    [[0, 77, 3], [3, 76, 3], [6, 74, 2], [8, 72, 4], [12, 69, 4]],
    [[0, 71, 4], [4, 72, 4], [8, 76, 6], [14, 74, 2]],
];
const MELODY_B = [
    [[0, 84, 2], [2, 81, 2], [4, 79, 4], [10, 81, 2], [12, 84, 4]],
    [[0, 83, 4], [6, 79, 2], [8, 76, 8]],
    [[0, 81, 2], [2, 79, 2], [4, 77, 4], [8, 76, 2], [10, 74, 6]],
    [[0, 76, 4], [4, 79, 4], [8, 72, 8]],
];

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9;
    comp.connect(master).connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    applyVolumes();

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Long, wet reverb (generated impulse) and a dotted-eighth echo for the kalimba
    reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const ch = ir.getChannelData(c);
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    reverb.buffer = ir;
    const revGain = ctx.createGain(); revGain.gain.value = 0.42;
    reverb.connect(revGain).connect(musicBus);
    delay = ctx.createDelay(1);
    delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dlGain = ctx.createGain(); dlGain.gain.value = 0.35;
    delay.connect(fb).connect(delay);
    delay.connect(dlGain).connect(musicBus);

    startOcean();
    document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });
}

function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const m = settings.master ?? 1;
    musicBus.gain.setTargetAtTime(settings.music * 0.55 * m, t, 0.05);
    sfxBus.gain.setTargetAtTime(settings.sfx * m, t, 0.05);
    if (oceanGain) oceanGain.gain.setTargetAtTime(settings.sfx * 0.07 * m, t, 0.2);
}
export function getVolumes() { return { ...settings }; }
export function setVolume(kind, v) {
    settings[kind] = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('sfe_audio', JSON.stringify(settings)); } catch (e) { /* ignore */ }
    applyVolumes();
}

// ----- instruments -----
function env(g, t, a, peak, d, sustain, r, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
    if (end) { g.gain.setValueAtTime(Math.max(0.0001, sustain), end); g.gain.exponentialRampToValueAtTime(0.0001, end + r); }
}
function noise(t, dur, type, freq, q, gain, out) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out || musicBus);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    return g;
}
function kick(t, gain) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(gain || 0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.4);
}
// Soft rim click with a splash of reverb
function rim(t) {
    noise(t, 0.05, 'bandpass', 1800, 2, 0.12, musicBus);
    noise(t, 0.12, 'bandpass', 2200, 1, 0.06, reverb);
}
function shaker(t, gain) { noise(t, 0.05, 'highpass', 6000, 0.7, gain, musicBus); }
// Warm sine sub bass
function bass(t, n, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = midi(n);
    env(g, t, 0.02, 0.32, dur * 0.6, 0.18, 0.15, t + dur);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.25);
}
// Electric piano: sine body plus a bell-like 2nd partial, with a slow tremolo
function epiano(t, notes, dur, gain) {
    const g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain();
    env(g, t, 0.015, gain || 0.07, 0.6, (gain || 0.07) * 0.45, 0.6, t + dur);
    trem.frequency.value = 4.2; tg.gain.value = (gain || 0.07) * 0.25; trem.connect(tg).connect(g.gain);
    g.connect(musicBus); g.connect(reverb);
    for (const n of notes) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(n);
        o.detune.value = (Math.random() - 0.5) * 8;
        const h = ctx.createOscillator(), hg = ctx.createGain(); h.type = 'sine'; h.frequency.value = midi(n) * 2;
        hg.gain.setValueAtTime(0.25, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(g); h.connect(hg).connect(g);
        o.start(t); o.stop(t + dur + 0.7); h.start(t); h.stop(t + 0.5);
    }
    trem.start(t); trem.stop(t + dur + 0.7);
}
// Slow airy pad: detuned triangles through a soft lowpass that breathes in and out
function pad(t, notes, dur) {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.Q.value = 0.5;
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1300, t + dur / 2); f.frequency.linearRampToValueAtTime(500, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + dur * 0.35);
    g.gain.setValueAtTime(0.035, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    f.connect(g); g.connect(musicBus); g.connect(reverb);
    for (const n of notes) for (const det of [-7, 7]) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n + 12); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 1);
    }
}
// Kalimba / glass bell: sine with a short inharmonic ping, sent into the echo
function bell(t, n, dur) {
    const g = ctx.createGain();
    env(g, t, 0.004, 0.11, 0.35, 0.03, 0.6, t + dur);
    g.connect(musicBus); g.connect(delay); g.connect(reverb);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(n); o.connect(g);
    const p = ctx.createOscillator(), pg = ctx.createGain(); p.type = 'sine'; p.frequency.value = midi(n) * 5.4;
    pg.gain.setValueAtTime(0.35, t); pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    p.connect(pg).connect(g);
    o.start(t); o.stop(t + dur + 0.8); p.start(t); p.stop(t + 0.1);
}
// Distant whale call: slow sine glide drowned in reverb
function whale(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(340, t + 1.2); o.frequency.exponentialRampToValueAtTime(190, t + 2.8);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5; vg.gain.value = 6; vib.connect(vg).connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    o.connect(f).connect(g); g.connect(reverb); g.connect(musicBus);
    o.start(t); o.stop(t + 3.1); vib.start(t); vib.stop(t + 3.1);
}
// Little bubble blip rising in pitch
function blip(t) {
    const f0 = 500 + Math.random() * 400;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.07);
    g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(musicBus); g.connect(reverb); o.start(t); o.stop(t + 0.1);
}
// Wave wash that swells over two bars
function wave(t, dur) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1500, t + dur * 0.45); f.frequency.linearRampToValueAtTime(300, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(musicBus); src.start(t); src.stop(t + dur);
}

// One 16th-note step of the song. 16 bars: 2 bars of intro (pads and waves), then the
// groove; the bell melody plays in bars 4-7 and 10-15, bars 8-9 drop the drums.
function playStep(s, t) {
    const bar = Math.floor(s / 16) % 16, i = s % 16, chord = CHORDS[bar % 4];
    // Lazy swing: every off 16th lands a little late
    const st = t + (i % 2 ? STEP * 0.22 : 0);
    const intro = bar < 2, drop = bar === 8 || bar === 9;
    if (i === 0) {
        pad(t, chord.notes, STEP * 16);
        if (bar % 2 === 0) wave(t, STEP * 32);
        if (bar === 6 || bar === 14) whale(t + STEP * 4);
    }
    if (!intro) {
        if (i === 0) epiano(t, chord.notes, STEP * 9);
        if (i === 10) epiano(st, chord.notes.slice(1), STEP * 5, 0.05);
        if (i === 0 || i === 10) bass(st, chord.root, STEP * (i ? 5 : 9));
    } else if (i === 0) epiano(t, chord.notes, STEP * 15, 0.05);
    if (!intro && !drop) {
        if (i === 0 || i === 10 || (i === 7 && bar % 2)) kick(st, i === 7 ? 0.3 : 0.55);
        if (i === 4 || i === 12) rim(st);
        if (i % 2 === 0) shaker(st, i % 4 === 2 ? 0.045 : 0.025);
    }
    const melody = (bar >= 4 && bar < 8) || bar >= 10;
    if (melody) {
        const phrase = bar >= 12 ? MELODY_B : MELODY_A;
        for (const [at, n, l] of phrase[bar % 4]) if (at === i) bell(st, n, STEP * l);
    }
    if (Math.random() < 0.03) blip(t + Math.random() * STEP);
}

function scheduler() {
    while (nextTime < ctx.currentTime + 0.12) {
        playStep(step, nextTime);
        nextTime += STEP;
        step++;
    }
}
export function startMusic() {
    if (!ctx || musicOn) return;
    musicOn = true;
    step = 0; nextTime = ctx.currentTime + 0.1;
    schedTimer = setInterval(scheduler, 25);
}
export function stopMusic() { musicOn = false; clearInterval(schedTimer); }

// ----- ocean ambience -----
// Low rumbling water that swells like slow waves
function startOcean() {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 0.7;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.09; lg.gain.value = 160; lfo.connect(lg).connect(f.frequency);
    oceanGain = ctx.createGain(); oceanGain.gain.value = 0;
    src.connect(f).connect(oceanGain).connect(sfxBus);
    src.start(); lfo.start();
    applyVolumes();
}

// ----- sound effects -----
function tone(t, type, f0, f1, dur, gain, out) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || sfxBus); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
    click(t) { tone(t, 'triangle', 900, 500, 0.06, 0.25); },
    jump(t) { tone(t, 'sine', 260, 620, 0.14, 0.25); },
    land(t) { noise(t, 0.12, 'lowpass', 500, 1, 0.35, sfxBus); tone(t, 'sine', 120, 60, 0.1, 0.3); },
    step(t) { tone(t, 'sine', 300 + Math.random() * 200, 900 + Math.random() * 300, 0.06, 0.035); },
    pickup(t) { tone(t, 'sine', midi(84), null, 0.12, 0.3); tone(t + 0.07, 'sine', midi(91), null, 0.22, 0.3); },
    gain(t) { tone(t, 'triangle', midi(79), null, 0.08, 0.12); },
    hit(t) { tone(t, 'sine', 180, 50, 0.25, 0.7); noise(t, 0.25, 'lowpass', 1200, 1, 0.5, sfxBus); },
    death(t) { tone(t, 'sawtooth', 420, 60, 0.7, 0.25); noise(t, 0.5, 'lowpass', 800, 1, 0.3, sfxBus); },
    bubbles(t) { for (let i = 0; i < 7; i++) { const f = 300 + Math.random() * 500; tone(t + i * 0.07 + Math.random() * 0.03, 'sine', f, f * 2.6, 0.09, 0.14); } },
    splash(t) { noise(t, 0.6, 'lowpass', 2200, 0.8, 0.45, sfxBus); noise(t + 0.05, 0.35, 'highpass', 3000, 0.7, 0.12, sfxBus); },
    chomp(t) { tone(t, 'square', 160, 60, 0.12, 0.35); tone(t + 0.12, 'square', 140, 50, 0.14, 0.35); noise(t, 0.3, 'lowpass', 900, 1, 0.4, sfxBus); },
    roar(t) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 1.3);
        f.type = 'lowpass'; f.frequency.value = 600;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        o.connect(f).connect(g).connect(sfxBus); o.start(t); o.stop(t + 1.5);
        noise(t, 1.2, 'lowpass', 400, 1, 0.4, sfxBus);
    },
    levelUp(t) { [72, 76, 79, 84].forEach((n, i) => tone(t + i * 0.08, 'square', midi(n), null, 0.25, 0.12)); tone(t + 0.32, 'triangle', midi(88), null, 0.6, 0.2); },
    buy(t) { [79, 84, 88, 91, 96].forEach((n, i) => tone(t + i * 0.05, 'sine', midi(n), null, 0.3, 0.16)); },
    whoosh(t) {
        const src = ctx.createBufferSource(); src.buffer = noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
        f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.35);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        src.connect(f).connect(g).connect(sfxBus); src.start(t); src.stop(t + 0.55);
    },
    cheer(t) {
        // Big splash, a burst of bubbles and a fanfare
        SFX.splash(t);
        SFX.bubbles(t + 0.1);
        [77, 81, 84, 89, 93].forEach((n, i) => tone(t + 0.1 + i * 0.07, 'square', midi(n), null, 0.3, 0.08));
    },
    gate(t) {
        [84, 88, 91, 96, 100].forEach((n, i) => tone(t + i * 0.035, 'sine', midi(n), null, 0.5, 0.09));
        tone(t, 'triangle', 220, 880, 0.35, 0.12);
    },
    firework(t) { tone(t, 'sine', 900, 200, 0.35, 0.06); noise(t + 0.35, 0.4, 'lowpass', 2500, 0.8, 0.35, sfxBus); },
};
export function sfx(name) {
    if (!ctx || !SFX[name] || settings.sfx <= 0) return;
    SFX[name](ctx.currentTime + 0.005);
}
