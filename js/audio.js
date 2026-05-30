const audio = (() => {
  let ctx        = null;
  let lastPlayAt = 0;
  const THROTTLE = 500; // ms — minimum gap between any two sounds

  /* ── AudioContext: lazy init, resumed on first play ─────── */
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ── Primitive: play a single oscillator tone ───────────── */
  function tone(freq, startOffset, duration, vol, type = 'sine') {
    try {
      const c    = getCtx();
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type            = type;
      osc.frequency.value = freq;
      const t0 = c.currentTime + startOffset;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.start(t0);
      osc.stop(t0 + duration + 0.01);
    } catch (_) {}
  }

  /* ── Sound definitions ──────────────────────────────────── */
  const SOUNDS = {
    // 압력 부족 경고: 440Hz 단음 0.4 s
    positive(vol) { tone(440, 0, 0.4, vol); },

    // 과압 경고: 880Hz 단음 0.4 s
    negative(vol) { tone(880, 0, 0.4, vol); },

    // 보행 시퀀스 오류: 600Hz → 800Hz 이중음 0.6 s
    gait(vol) {
      tone(600, 0,    0.28, vol);
      tone(800, 0.3,  0.3,  vol);
    },

    // 성공 피드백: 523Hz + 659Hz 화음 0.6 s (C5 + E5)
    success(vol) {
      tone(523, 0, 0.6, vol * 0.7);
      tone(659, 0, 0.6, vol * 0.7);
    },

    // IMU 발 틀어짐 경고: 300→600Hz 스윕 0.5 s
    imu(vol) {
      try {
        const c    = getCtx();
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = 'sine';
        const t0 = c.currentTime;
        osc.frequency.setValueAtTime(300, t0);
        osc.frequency.linearRampToValueAtTime(600, t0 + 0.45);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
        osc.start(t0);
        osc.stop(t0 + 0.51);
      } catch (_) {}
    },
  };

  /* ── Public API ─────────────────────────────────────────── */
  return {
    /* Call once on user gesture (session start) to unlock AudioContext */
    init() {
      try { getCtx(); } catch (_) {}
    },

    /* Play a sound type with per-type throttle logic.
       Success has a separate throttle (longer gap is fine). */
    play(type) {
      const now = Date.now();
      // Success uses a relaxed throttle (1.5 s); alerts use THROTTLE
      const gap = type === 'success' ? 1500 : THROTTLE;
      if (now - lastPlayAt < gap) return;
      lastPlayAt = now;

      const vol   = store.getSettings().audioVolume;
      const fn    = SOUNDS[type];
      if (fn) fn(vol);
    },

    /* Play immediately (ignores throttle) — used for TEST button */
    test(type) {
      const vol = store.getSettings().audioVolume;
      const fn  = SOUNDS[type];
      if (fn) { try { getCtx(); fn(vol); } catch (_) {} }
    },
  };
})();
