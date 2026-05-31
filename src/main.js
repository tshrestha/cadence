import "./style.css";

(() => {
  "use strict";

  // ───────────────────────── constants & state ─────────────────────────
  const MIN_BPM = 120, MAX_BPM = 240, DEFAULT_BPM = 180;
  const ARC_START = 225, ARC_SWEEP = 270;   // degrees, top-based clockwise
  const CX = 150, CY = 150, R = 120;

  const state = {
    bpm: DEFAULT_BPM,
    playing: false,
    sound: "click",
    accent: 0,
    volume: 0.7,
    vibrate: false,
    wake: true,
    stride: 0.95,
    steps: 0,
    startedAt: 0,
  };

  // ───────────────────────── element refs ─────────────────────────
  const $ = (id) => document.getElementById(id);
  const dial = $("dial"), bpmEl = $("bpm"), catEl = $("cat");
  const progPath = $("progPath"), trackPath = $("trackPath"), knob = $("knob");
  const playBtn = $("play"), playLabel = $("playLabel");
  const stepsEl = $("steps"), elapsedEl = $("elapsed"), distEl = $("distEst");

  // ───────────────────────── tempo helpers ─────────────────────────
  function polar(deg) {
    const a = (deg - 90) * Math.PI / 180;
    return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
  }
  function t2deg(t) { return ARC_START + t * ARC_SWEEP; }
  function bpm2t(b) { return (b - MIN_BPM) / (MAX_BPM - MIN_BPM); }

  function cadenceLabel(b) {
    if (b < 150) return "Easy · Recovery";
    if (b < 165) return "Long Run";
    if (b < 174) return "Steady";
    if (b < 182) return "Optimal · 180";
    if (b < 192) return "Tempo";
    return "Sprint";
  }

  // build the static arc + ticks once
  (function buildGauge() {
    const [sx, sy] = polar(ARC_START);
    const [ex, ey] = polar(ARC_START + ARC_SWEEP);
    trackPath.setAttribute("d", `M ${sx} ${sy} A ${R} ${R} 0 1 1 ${ex} ${ey}`);

    const ticks = $("ticks");
    const total = MAX_BPM - MIN_BPM;            // 120 units
    for (let v = MIN_BPM; v <= MAX_BPM; v += 5) {
      const t = (v - MIN_BPM) / total;
      const deg = t2deg(t);
      const major = v % 20 === 0;
      const r1 = R + 12, r2 = R + (major ? 22 : 18);
      const a = (deg - 90) * Math.PI / 180;
      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", CX + r1 * Math.cos(a));
      ln.setAttribute("y1", CY + r1 * Math.sin(a));
      ln.setAttribute("x2", CX + r2 * Math.cos(a));
      ln.setAttribute("y2", CY + r2 * Math.sin(a));
      if (major) ln.classList.add("major");
      ticks.appendChild(ln);
    }
  })();

  function renderTempo() {
    const t = bpm2t(state.bpm);
    const deg = t2deg(t);
    const [sx, sy] = polar(ARC_START);
    const [px, py] = polar(deg);
    const large = (t * ARC_SWEEP) > 180 ? 1 : 0;
    progPath.setAttribute("d", `M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${px} ${py}`);
    knob.setAttribute("transform", `translate(${px} ${py})`);
    bpmEl.textContent = state.bpm;
    catEl.textContent = cadenceLabel(state.bpm);
    updateStats();
    syncPresets();
  }

  function setBpm(b, fromDrag) {
    b = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(b)));
    if (b === state.bpm) return;
    state.bpm = b;
    renderTempo();
    if (state.playing) scheduleLoopRebuild();   // coalesces rapid changes (drag / tap)
    if (!fromDrag && navigator.vibrate && state.vibrate) navigator.vibrate(8);
  }

  // ───────────────────────── dial drag ─────────────────────────
  function pointerToBpm(clientX, clientY) {
    const svg = $("gauge").getBoundingClientRect();
    const x = (clientX - svg.left) / svg.width * 300;
    const y = (clientY - svg.top) / svg.height * 300;
    let deg = Math.atan2(y - CY, x - CX) * 180 / Math.PI + 90; // top-based
    deg = (deg + 360) % 360;
    let rel = (deg - ARC_START + 360) % 360;                    // 0..360
    if (rel > ARC_SWEEP) rel = (rel < ARC_SWEEP + (360 - ARC_SWEEP) / 2) ? ARC_SWEEP : 0;
    return MIN_BPM + (rel / ARC_SWEEP) * (MAX_BPM - MIN_BPM);
  }
  let dragging = false;
  dial.addEventListener("pointerdown", (e) => {
    dragging = true; dial.setPointerCapture(e.pointerId);
    setBpm(pointerToBpm(e.clientX, e.clientY), true);
  });
  dial.addEventListener("pointermove", (e) => {
    if (dragging) setBpm(pointerToBpm(e.clientX, e.clientY), true);
  });
  const endDrag = () => { dragging = false; };
  dial.addEventListener("pointerup", endDrag);
  dial.addEventListener("pointercancel", endDrag);

  // ───────────────────────── +/- with hold-to-repeat ─────────────────────────
  function holdRepeat(btn, delta) {
    let to, iv;
    const fire = () => setBpm(state.bpm + delta);
    const start = (e) => {
      e.preventDefault(); fire();
      to = setTimeout(() => { iv = setInterval(fire, 70); }, 380);
    };
    const stop = () => { clearTimeout(to); clearInterval(iv); };
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointerleave", stop);
    btn.addEventListener("pointercancel", stop);
  }
  holdRepeat($("minus"), -1);
  holdRepeat($("plus"), 1);

  // ───────────────────────── presets ─────────────────────────
  const PRESETS = [160, 168, 174, 180, 186, 192];
  const presetWrap = $("presets");
  PRESETS.forEach((v) => {
    const b = document.createElement("button");
    b.className = "preset"; b.textContent = v; b.dataset.v = v;
    b.addEventListener("click", () => setBpm(v));
    presetWrap.appendChild(b);
  });
  function syncPresets() {
    [...presetWrap.children].forEach((b) => b.classList.toggle("active", +b.dataset.v === state.bpm));
  }

  // ───────────────────────── tap tempo ─────────────────────────
  let taps = [];
  $("tap").addEventListener("click", () => {
    const now = performance.now();
    taps = taps.filter((t) => now - t < 2500);
    taps.push(now);
    const tapEl = $("tap");
    tapEl.classList.add("lit");
    setTimeout(() => tapEl.classList.remove("lit"), 120);
    if (taps.length >= 2) {
      let sum = 0;
      for (let i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
      const avg = sum / (taps.length - 1);
      setBpm(60000 / avg);
    }
  });

  // ───────────────────────── stats ─────────────────────────
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }
  function updateStats() {
    const dist = state.steps * state.stride; // meters
    distEl.textContent = dist >= 1000 ? (dist / 1000).toFixed(2) + "k" : Math.round(dist) + "m";
    stepsEl.textContent = state.steps;
  }

  // ═════════════════════════ AUDIO ENGINE ═════════════════════════
  // iOS suspends the AudioContext AND freezes JS timers when the screen
  // locks, so a timer-driven note scheduler dies in the background. Instead
  // we bake one accent-period of audio into a buffer and play it on a
  // *looping* AudioBufferSourceNode — the loop runs in the audio engine with
  // zero JS per beat. To stop iOS from suspending the context, the output is
  // routed into a hidden <audio> element (via a MediaStream); an actively
  // playing media element keeps the audio session alive with the screen off.
  let ctx = null, master = null, streamDest = null, keepAudio = null, loopSource = null;
  let phaseBeats = 0, phaseTime = 0, phaseBeatDur = 60 / DEFAULT_BPM, lastBeatShown = -1;
  let loopRebuildTO = null, rafId = null, mediaSessionInit = false;
  const clickCache = new Map();   // `${sound}:${accent}` → Float32Array of one click

  function initAudio() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = state.volume;

    // The metronome is heard through this media element, NOT ctx.destination —
    // that is what lets it keep playing while the iPhone is locked.
    streamDest = ctx.createMediaStreamDestination();
    master.connect(streamDest);
    keepAudio = document.createElement("audio");
    keepAudio.srcObject = streamDest.stream;
    keepAudio.setAttribute("playsinline", "");
    keepAudio.setAttribute("webkit-playsinline", "");
    keepAudio.style.display = "none";
    document.body.appendChild(keepAudio);

    // If iOS pauses the element on an interruption, resume it while running.
    keepAudio.addEventListener("pause", () => {
      if (state.playing) { ctx.resume().catch(() => {}); keepAudio.play().catch(() => {}); }
    });
    if (ctx.addEventListener) {
      ctx.addEventListener("statechange", () => {
        if (state.playing && ctx.state !== "running") ctx.resume().catch(() => {});
      });
    }
  }

  // Render a single click into a Float32Array, reusing the exact synth voices
  // (oscillator / band-passed noise) via an OfflineAudioContext.
  function voiceInto(ac, dest, time, sound, accent) {
    if (sound === "off") return;
    const g = ac.createGain();
    g.connect(dest);
    const peak = accent ? 1 : 0.7;
    if (sound === "wood") {
      const len = Math.floor(ac.sampleRate * 0.05);
      const nb = ac.createBuffer(1, len, ac.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = nb;
      const bp = ac.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = accent ? 2600 : 1800; bp.Q.value = 7;
      src.connect(bp); bp.connect(g);
      g.gain.setValueAtTime(peak, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
      src.start(time); src.stop(time + 0.05);
    } else {
      const osc = ac.createOscillator();
      const beep = sound === "beep";
      osc.type = beep ? "sine" : "triangle";
      osc.frequency.value = accent ? (beep ? 1320 : 1600) : (beep ? 880 : 1050);
      osc.connect(g);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(peak, time + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, time + (beep ? 0.06 : 0.035));
      osc.start(time); osc.stop(time + 0.08);
    }
  }

  async function renderClick(sound, accent) {
    const sr = ctx.sampleRate;
    const oac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      1, Math.ceil(0.13 * sr), sr
    );
    voiceInto(oac, oac.destination, 0, sound, accent);
    const rendered = await oac.startRendering();
    return rendered.getChannelData(0).slice();
  }

  // Ensure both accent variants of a sound are cached (one-time per sound).
  async function ensureClicks(sound) {
    if (sound === "off") return;
    for (const accent of [false, true]) {
      const key = sound + ":" + (accent ? 1 : 0);
      if (!clickCache.has(key)) clickCache.set(key, await renderClick(sound, accent));
    }
  }

  // Bake one loop period (1 beat, or `accent` beats when accents are on).
  function buildLoopBuffer() {
    const beatDur = 60 / state.bpm;
    const beats = state.accent > 0 ? state.accent : 1;
    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.round(beatDur * beats * sr));
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    if (state.sound !== "off") {
      for (let i = 0; i < beats; i++) {
        const isAccent = state.accent > 0 && i === 0;
        const click = clickCache.get(state.sound + ":" + (isAccent ? 1 : 0));
        if (!click) continue;
        const off = Math.round(i * beatDur * sr);
        for (let j = 0; j < click.length && off + j < len; j++) out[off + j] += click[j];
      }
    }
    return buf;
  }

  function currentBeats() {
    if (!phaseTime) return 0;
    return phaseBeats + Math.max(0, ctx.currentTime - phaseTime) / phaseBeatDur;
  }

  // (Re)start the looping source, preserving the running beat count.
  function restartLoop() {
    const startBeats = state.playing ? Math.floor(currentBeats()) : 0;
    if (loopSource) {
      try { loopSource.stop(); } catch (e) {}
      try { loopSource.disconnect(); } catch (e) {}
    }
    loopSource = ctx.createBufferSource();
    loopSource.buffer = buildLoopBuffer();
    loopSource.loop = true;
    loopSource.connect(master);
    const t0 = ctx.currentTime + 0.06;
    loopSource.start(t0);
    phaseBeats = startBeats;
    phaseTime = t0;
    phaseBeatDur = 60 / state.bpm;
  }

  function scheduleLoopRebuild() {
    if (!state.playing || loopRebuildTO) return;
    loopRebuildTO = setTimeout(() => { loopRebuildTO = null; if (state.playing) restartLoop(); }, 90);
  }

  // ───────────────────────── visual beat sync ─────────────────────────
  // Driven off the audio clock, so the step count stays correct even after
  // the screen was off (rAF is paused in the background, then catches up).
  function ensureVisualLoop() {
    if (rafId == null && state.playing) rafId = requestAnimationFrame(visualLoop);
  }
  function visualLoop() {
    rafId = null;
    if (!state.playing) return;
    const cur = Math.floor(currentBeats());
    if (cur > lastBeatShown) {
      lastBeatShown = cur;
      state.steps = cur;
      flashBeat();
    }
    if (state.startedAt) elapsedEl.textContent = fmtTime(performance.now() - state.startedAt);
    updateStats();
    rafId = requestAnimationFrame(visualLoop);
  }
  let flashTO;
  function flashBeat() {
    bpmEl.classList.add("beat");
    clearTimeout(flashTO);
    flashTO = setTimeout(() => bpmEl.classList.remove("beat"), 80);
    if (state.vibrate && navigator.vibrate) navigator.vibrate(12);
  }

  // ───────────────────────── media session (lock-screen + background) ─────────────────────────
  function setMediaSession(playing) {
    if (!("mediaSession" in navigator)) return;
    try {
      if (!mediaSessionInit) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Cadence",
          artist: "Running cadence metronome",
          artwork: [{ src: "icon.svg", sizes: "512x512", type: "image/svg+xml" }],
        });
        navigator.mediaSession.setActionHandler("play", () => { if (!state.playing) start(); });
        navigator.mediaSession.setActionHandler("pause", () => { if (state.playing) stop(); });
        navigator.mediaSession.setActionHandler("stop", () => { if (state.playing) stop(); });
        mediaSessionInit = true;
      }
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    } catch (e) {}
  }

  // ───────────────────────── transport ─────────────────────────
  async function start() {
    initAudio();
    if (ctx.state !== "running") { try { await ctx.resume(); } catch (e) {} }
    await ensureClicks(state.sound);
    state.playing = true;
    state.steps = 0;
    state.startedAt = performance.now();
    lastBeatShown = -1;
    phaseBeats = 0; phaseTime = 0;
    restartLoop();
    try { await keepAudio.play(); } catch (e) {}
    setMediaSession(true);
    ensureVisualLoop();
    playBtn.classList.add("running");
    playLabel.textContent = "Stop";
    requestWakeLock();
  }
  function stop() {
    state.playing = false;
    if (loopSource) {
      try { loopSource.stop(); } catch (e) {}
      try { loopSource.disconnect(); } catch (e) {}
      loopSource = null;
    }
    if (keepAudio) { try { keepAudio.pause(); } catch (e) {} }
    setMediaSession(false);
    playBtn.classList.remove("running");
    playLabel.textContent = "Start";
    bpmEl.classList.remove("beat");
    releaseWakeLock();
  }
  playBtn.addEventListener("click", () => state.playing ? stop() : start());

  // ───────────────────────── wake lock ─────────────────────────
  let wakeLock = null;
  async function requestWakeLock() {
    if (!state.wake || !("wakeLock" in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {}
  }
  function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.playing) {
      requestWakeLock();
      if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
      if (keepAudio && keepAudio.paused) keepAudio.play().catch(() => {});
      ensureVisualLoop();
    }
  });

  // ───────────────────────── settings sheet ─────────────────────────
  const scrim = $("scrim"), sheet = $("sheet");
  const openSheet = () => { scrim.classList.add("open"); sheet.classList.add("open"); };
  const closeSheet = () => { scrim.classList.remove("open"); sheet.classList.remove("open"); };
  $("settingsBtn").addEventListener("click", openSheet);
  scrim.addEventListener("click", closeSheet);

  function wireSeg(id, key, parse, after) {
    const seg = $(id);
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button"); if (!btn) return;
      [...seg.children].forEach((b) => b.classList.toggle("on", b === btn));
      state[key] = parse(btn.dataset.v);
      persist();
      if (after) after();
    });
  }
  wireSeg("soundSeg", "sound", (v) => v, async () => {
    if (state.playing) { await ensureClicks(state.sound); restartLoop(); }
  });
  wireSeg("accentSeg", "accent", (v) => +v, () => { if (state.playing) restartLoop(); });

  function wireToggle(id, key) {
    const el = $(id);
    el.addEventListener("click", () => {
      el.classList.toggle("on");
      state[key] = el.classList.contains("on");
      persist();
    });
  }
  wireToggle("vibToggle", "vibrate");
  wireToggle("wakeToggle", "wake");

  $("vol").addEventListener("input", (e) => {
    state.volume = +e.target.value / 100;
    $("volSub").textContent = e.target.value + "%";
    if (master) master.gain.setTargetAtTime(state.volume, ctx.currentTime, 0.01);
    persist();
  });
  $("stride").addEventListener("input", (e) => {
    state.stride = +e.target.value / 100;
    $("strideSub").textContent = state.stride.toFixed(2) + " m — for distance estimate";
    updateStats(); persist();
  });

  // ───────────────────────── persistence ─────────────────────────
  function persist() {
    try {
      localStorage.setItem("cadence", JSON.stringify({
        bpm: state.bpm, sound: state.sound, accent: state.accent,
        volume: state.volume, vibrate: state.vibrate, wake: state.wake, stride: state.stride,
      }));
    } catch (e) {}
  }
  function restore() {
    let s; try { s = JSON.parse(localStorage.getItem("cadence")); } catch (e) {}
    if (!s) return;
    Object.assign(state, s);
    // reflect into UI
    const segSet = (id, val) => [...$(id).children].forEach((b) => b.classList.toggle("on", b.dataset.v == val));
    segSet("soundSeg", state.sound); segSet("accentSeg", state.accent);
    $("vibToggle").classList.toggle("on", state.vibrate);
    $("wakeToggle").classList.toggle("on", state.wake);
    $("vol").value = Math.round(state.volume * 100); $("volSub").textContent = Math.round(state.volume * 100) + "%";
    $("stride").value = Math.round(state.stride * 100); $("strideSub").textContent = state.stride.toFixed(2) + " m — for distance estimate";
  }

  // ───────────────────────── keyboard (desktop) ─────────────────────────
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); state.playing ? stop() : start(); }
    else if (e.code === "ArrowUp" || e.code === "ArrowRight") setBpm(state.bpm + 1);
    else if (e.code === "ArrowDown" || e.code === "ArrowLeft") setBpm(state.bpm - 1);
  });

  // ───────────────────────── boot ─────────────────────────
  restore();
  renderTempo();
  elapsedEl.textContent = "00:00";

  // Service worker is registered automatically by vite-plugin-pwa.
})();
