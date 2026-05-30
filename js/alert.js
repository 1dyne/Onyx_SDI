const alertEngine = (() => {

  /* ── Effective THR: 절대값 vs 기준값% ─────────────────── */
  function getEffectiveThr(point) {
    if (point.thrMode === 'percent' && point.reference !== null) {
      return Math.round(point.reference * (point.thrPercent / 100));
    }
    return point.thr;
  }

  /* ── Accuracy vs reference (null if no reference set) ── */
  function calcAccuracy(points, currentValues) {
    const refPoints = points.filter(p => p.reference !== null);
    if (!refPoints.length) return null;
    const avg = refPoints.reduce((sum, p) => {
      const idx = parseInt(p.id.slice(1)) - 1;
      return sum + (currentValues[idx] / p.reference) * 100;
    }, 0) / refPoints.length;
    return Math.round(avg);
  }

  /* ── Main check: returns { alerts, accuracy } ───────────
     Audio is orchestrated by session.js which has full context
     (gait errors + alerts + accuracy all in one place).       */
  function check(drill, values) {
    const alerts = [];
    for (const pt of drill.points) {
      const idx = parseInt(pt.id.slice(1)) - 1;
      const val = values[idx];
      const thr = getEffectiveThr(pt);
      if (pt.direction === 'positive' && val < thr) {
        alerts.push({ pointId: pt.id, type: 'positive', value: val, thr });
      } else if (pt.direction === 'negative' && val > thr) {
        alerts.push({ pointId: pt.id, type: 'negative', value: val, thr });
      }
    }
    const accuracy = calcAccuracy(drill.points, values);
    return { alerts, accuracy };
  }

  /* ── Gait sequence checker factory ─────────────────────── */
  function createGaitChecker() {
    let phase           = 0;
    let phaseActiveTime = 0;
    const TIMEOUT       = 3000;

    return {
      check(values, now = Date.now()) {
        const isGroupActive = (group) =>
          group.some(pid => values[parseInt(pid.slice(1)) - 1] > GAIT_ACTIVE_THR);

        if (phase > 0 && (now - phaseActiveTime) > TIMEOUT) phase = 0;

        const currentGroup = GAIT_SEQUENCE[phase];
        if (isGroupActive(currentGroup)) {
          const futureActive = GAIT_SEQUENCE.slice(phase + 1).some(isGroupActive);
          if (futureActive) {
            phase = 0;
            return { gaitError: true };
          }
          if (phase < GAIT_SEQUENCE.length - 1) {
            phase++;
            phaseActiveTime = now;
          } else {
            phase = 0;
          }
        }
        return { gaitError: false };
      },
      reset() { phase = 0; },
    };
  }

  return { check, getEffectiveThr, calcAccuracy, createGaitChecker };
})();
