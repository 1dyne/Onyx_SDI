const session = (() => {
  const state = {
    active:        false,
    drill:         null,
    sessionId:     null,
    startTime:     null,
    elapsed:       0,         // seconds
    alertCount:    0,
    totalSamples:  0,
    goodSamples:   0,
    currentValues: [0,0,0,0,0,0,0],
    activeAlerts:  [],
    alertTimeline: [],        // { time, pointId, type }
    pointStats:    {},        // pid → { sum, count, alertCount }
    memo:          '',
    gaitChecker:   null,
    timerInterval: null,
    lastBeepAt:    0,
    yawRef:        null,   // calibrated reference yaw (degrees)
    currentImu:    { yaw: 0, pitch: 0, roll: 0 },
  };

  // Callbacks
  let onTick   = null;   // (elapsed, quality, alertCount)
  let onValues = null;   // (values, alerts)
  let onEnd    = null;   // (sessionLog)

  function fmt2(n) { return String(n).padStart(2,'0'); }

  function computeQuality() {
    if (!state.totalSamples) return 100;
    return Math.round((state.goodSamples / state.totalSamples) * 100);
  }

  return {
    get elapsed()      { return state.elapsed; },
    get alertCount()   { return state.alertCount; },
    get currentValues(){ return state.currentValues; },
    get activeAlerts() { return state.activeAlerts; },
    get isActive()     { return state.active; },
    get drill()        { return state.drill; },
    get memo()         { return state.memo; },
    set memo(v)        { state.memo = v; },
    get currentImu()   { return state.currentImu; },
    get yawRef()       { return state.yawRef; },

    calibrateYaw() {
      state.yawRef = state.currentImu.yaw;
      return state.yawRef;
    },

    set onTick(fn)    { onTick   = fn; },
    set onValues(fn)  { onValues = fn; },
    set onEnd(fn)     { onEnd    = fn; },

    quality() { return computeQuality(); },

    fmtElapsed() {
      const m = Math.floor(state.elapsed / 60);
      const s = state.elapsed % 60;
      return `${fmt2(m)}:${fmt2(s)}`;
    },

    start(drill) {
      // Unlock AudioContext on this user gesture (session start tap)
      audio.init();

      Object.assign(state, {
        active:        true,
        drill,
        sessionId:     store.newSessionId(),
        startTime:     Date.now(),
        elapsed:       0,
        alertCount:    0,
        totalSamples:  0,
        goodSamples:   0,
        currentValues: [0,0,0,0,0,0,0],
        activeAlerts:  [],
        alertTimeline: [],
        memo:          '',
        pointStats:    {},
        lastBeepAt:    0,
        yawRef:        null,
        currentImu:    { yaw: 0, pitch: 0, roll: 0 },
      });

      for (const pt of drill.points) {
        state.pointStats[pt.id] = { sum: 0, count: 0, alertCount: 0 };
      }

      state.gaitChecker = drill.type === 'gait'
        ? alertEngine.createGaitChecker()
        : null;

      state.timerInterval = setInterval(() => {
        state.elapsed++;
        onTick?.(state.elapsed, computeQuality(), state.alertCount);
      }, 1000);
    },

    feed(values) {
      if (!state.active) return;
      state.currentValues = values;

      // Extract IMU (indices 4,5,6 = roll, pitch, yaw — matches firmware format)
      const roll  = values[4] ?? 0;
      const pitch = values[5] ?? 0;
      const yaw   = values[6] ?? 0;
      state.currentImu = { yaw, pitch, roll };

      // Auto-calibrate on first valid sample if not yet set
      if (state.yawRef === null) state.yawRef = yaw;

      state.totalSamples++;

      // FSR alert check (only indices 0-3)
      const fsrValues = [...values.slice(0, 4), 0, 0, 0];
      const { alerts, accuracy } = alertEngine.check(state.drill, fsrValues);

      // Gait check (stateful, lives in session)
      if (state.gaitChecker) {
        const { gaitError } = state.gaitChecker.check(values);
        if (gaitError) alerts.push({ pointId: 'GAIT', type: 'gait', value: 0, thr: 0 });
      }

      // IMU yaw deviation check
      if (state.yawRef !== null) {
        const tolerance = state.drill.yawTolerance ?? 10;
        let yawDelta = yaw - state.yawRef;
        // Normalize to [-180, 180]
        if (yawDelta > 180) yawDelta -= 360;
        if (yawDelta < -180) yawDelta += 360;
        if (Math.abs(yawDelta) > tolerance) {
          alerts.push({ pointId: 'IMU', type: 'imu', value: Math.round(yawDelta * 10) / 10, thr: tolerance });
        }
      }

      // Update per-point stats
      for (const pt of state.drill.points) {
        const idx  = parseInt(pt.id.slice(1)) - 1;
        const stat = state.pointStats[pt.id];
        stat.sum  += values[idx];
        stat.count++;
      }

      const hasAlert = alerts.length > 0;
      if (!hasAlert) {
        state.goodSamples++;

        // Success sound: only when accuracy is known and meets threshold
        const { successSoundEnabled, successThreshold } = store.getSettings();
        if (successSoundEnabled && accuracy !== null && accuracy >= successThreshold) {
          audio.play('success');  // audio.js handles its own throttle (1.5 s)
        }
      } else {
        state.alertCount++;
        for (const a of alerts) {
          if (a.pointId !== 'GAIT') state.pointStats[a.pointId].alertCount++;
          state.alertTimeline.push({ time: state.elapsed, ...a });
        }
        // Play alert sound — audio.js throttles at 500 ms
        const { alertSoundEnabled } = store.getSettings();
        if (alertSoundEnabled) {
          const types = alerts.map(a => a.type);
          if (types.includes('imu'))             audio.play('imu');
          else if (types.includes('gait'))       audio.play('gait');
          else if (types.includes('negative'))   audio.play('negative');
          else                                   audio.play('positive');
        }
      }

      state.activeAlerts = alerts;
      // Pass accuracy to UI so quality display can reflect it
      onValues?.(values, alerts, accuracy);
    },

    end() {
      if (!state.active) return null;
      state.active = false;
      clearInterval(state.timerInterval);
      bluetooth.stopSimulation?.();

      const quality    = computeQuality();
      const pointStats = {};
      for (const [pid, s] of Object.entries(state.pointStats)) {
        pointStats[pid] = {
          avg:        s.count ? Math.round(s.sum / s.count) : 0,
          alertCount: s.alertCount,
        };
      }

      const log = {
        sessionId:     state.sessionId,
        drillId:       state.drill.id,
        drillTitle:    state.drill.title,
        drillType:     state.drill.type,
        date:          new Date().toISOString().slice(0, 10),
        duration:      state.elapsed,
        alertCount:    state.alertCount,
        quality,
        memo:          state.memo,
        pointStats,
        alertTimeline: state.alertTimeline,
      };

      store.saveSession(log);
      onEnd?.(log);
      return log;
    },
  };
})();
