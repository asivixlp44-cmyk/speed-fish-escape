// Procedural soundtrack and sound effects (Web Audio, no asset files).
// The track is an original 118 BPM tropical ocean tune: I–V–vi–IV in F with marimba
// arps and a steel-drum lead, 16 bars that loop through groove, hook, breakdown and drop.

let ctx = null, master, musicBus, sfxBus, reverb, delay, oceanGain;
let noiseBuf = null;
let musicOn = false, schedTimer = null, step = 0, nextTime = 0;
const settings = { music: 0.6, sfx: 0.8, master: 1 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('sfe_audio') || '{}')); } catch (e) { /* defaults */ }

const BPM = 118, STEP = 60 / BPM / 4;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// The song data below is written in C; KEY moves it up to F
const KEY = 5;
// Chord roots and triads (MIDI), one chord per bar: C, G, Am, F
const CHORDS = [
    { root: 36, notes: [60, 64, 67] },
    { root: 43, notes: [59, 62, 67] },
    { root: 45, notes: [57, 60, 64] },
    { root: 41, notes: [57, 60, 65] },
];
// Steel-drum hook, 4 bars x 16 steps: [step, midi, length in steps]
const HOOK = [
    [[0, 76, 3], [4, 79, 3], [8, 76, 2], [10, 74, 2], [12, 72, 4]],
    [[0, 74, 3], [4, 71, 3], [8, 74, 2], [10, 79, 6]],
    [[0, 76, 3], [4, 72, 3], [8, 76, 2], [10, 77, 2], [12, 79, 4]],
    [[0, 77, 3], [4, 76, 2], [6, 74, 2], [8, 72, 8]],
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

    // Shared reverb (generated impulse) and a dotted-eighth echo for the arp
    reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const ch = ir.getChannelData(c);
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    reverb.buffer = ir;
    const revGain = ctx.createGain(); revGain.gain.value = 0.28;
    reverb.connect(revGain).connect(musicBus);
    delay = ctx.createDelay(1);
    delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
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
function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.35);
}
function clap(t, gain) {
    for (let i = 0; i < 3; i++) noise(t + i * 0.011, i === 2 ? 0.16 : 0.03, 'bandpass', 1400, 1.2, (gain || 0.5), musicBus);
    const g = noise(t + 0.02, 0.2, 'bandpass', 1600, 0.8, 0.12, reverb);
    return g;
}
function hat(t, open) { noise(t, open ? 0.14 : 0.035, 'highpass', 7500, 0.7, open ? 0.16 : 0.12); }
function bass(t, n, dur) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = midi(n);
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + dur); f.Q.value = 6;
    env(g, t, 0.005, 0.32, dur * 0.8, 0.12, 0.04, t + dur);
    o.connect(f).connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.1);
}
function pad(t, notes, dur, open) {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(open ? 2600 : 900, t); f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.25);
    g.gain.setValueAtTime(0.06, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    // Sidechain-style pump on every beat
    for (let b = 1; b < 4; b++) { const bt = t + b * STEP * 4; g.gain.setValueAtTime(0.02, bt); g.gain.linearRampToValueAtTime(0.06, bt + STEP * 2.5); }
    f.connect(g); g.connect(musicBus); g.connect(reverb);
    for (const n of notes) for (const det of [-9, 9]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.4);
    }
}
// Marimba: sine body plus a quickly fading 4th harmonic for the mallet knock
function pluck(t, n, cutoff) {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t);
    g.gain.setValueAtTime(0.11, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    f.connect(g); g.connect(musicBus); g.connect(delay);
    for (const [mult, amp, dur] of [[1, 1, 0.35], [4, 0.35, 0.05]]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'sine'; o.frequency.value = midi(n) * mult;
        og.gain.setValueAtTime(amp, t); og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(og).connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
}
// Steel drum: bright inharmonic partials with a short pitch dip on the attack
function lead(t, n, dur) {
    const g = ctx.createGain();
    env(g, t, 0.005, 0.14, 0.15, 0.05, 0.25, t + dur);
    g.connect(musicBus); g.connect(reverb);
    for (const [mult, amp] of [[1, 1], [2, 0.5], [2.98, 0.22], [4.2, 0.1]]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(midi(n) * mult * 1.02, t); o.frequency.exponentialRampToValueAtTime(midi(n) * mult, t + 0.04);
        og.gain.value = amp;
        o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.3);
    }
}
function riser(t, dur) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(8000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + dur);
    src.connect(f).connect(g).connect(musicBus); src.start(t); src.stop(t + dur);
}

// One 16th-note step of the song
function playStep(s, t) {
    const bar = Math.floor(s / 16) % 16, i = s % 16, c = CHORDS[bar % 4];
    const chord = { root: c.root + KEY, notes: c.notes.map((n) => n + KEY) };
    const breakdown = bar >= 8 && bar < 12;
    const hookOn = (bar >= 4 && bar < 8) || bar >= 12;
    if (!breakdown && i % 4 === 0) kick(t);
    if (breakdown && bar === 11 && i >= 8) { if (i % 2 === 0) clap(t, 0.25 + (i - 8) * 0.04); }
    else if (i === 4 || i === 12) clap(t);
    if (!breakdown) hat(t, i % 4 === 2);
    else if (i % 4 === 2) hat(t, false);
    if (!breakdown && i % 2 === 0) {
        const pattern = [0, 0, 12, 0, 0, 12, 0, 7];
        bass(t, chord.root + pattern[(i / 2) % 8], STEP * 1.8);
    }
    if (i === 0) pad(t, chord.notes, STEP * 16, bar >= 12);
    const tones = chord.notes.concat(chord.notes.map((n) => n + 12));
    const cutoff = breakdown ? 600 + (bar - 8) * 900 + i * 60 : 2400;
    pluck(t, tones[(i * 5) % tones.length] + 12, cutoff);
    if (hookOn) for (const [st, n, l] of HOOK[bar % 4]) if (st === i) lead(t, n + KEY, STEP * l);
    if (bar === 11 && i === 0) riser(t, STEP * 16);
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
