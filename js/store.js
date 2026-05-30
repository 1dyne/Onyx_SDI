const store = (() => {
  const K = {
    drills:   'onyxSDI_drills',
    sessions: 'onyxSDI_sessions',
    settings: 'onyxSDI_settings',
  };

  const SETTINGS_DEFAULTS = {
    audioVolume:         0.5,
    alertSoundEnabled:   true,   // 경고음 (positive / negative / gait) 활성화
    successSoundEnabled: true,   // 성공음 활성화
    successThreshold:    90,     // 성공 판정 기준 정확도 (%)
  };

  // Fill in any missing v0.2 fields on a point object (migration-safe)
  function migratePoint(pt) {
    return Object.assign(
      { reference: null, thrMode: 'absolute', thrPercent: 80 },
      pt,
    );
  }

  function load(key)       { return JSON.parse(localStorage.getItem(key) || '[]'); }
  function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

  return {
    /* ── Drills ─────────────────────────────────────────── */
    /* ── Settings (global audio/success prefs) ──────────── */
    getSettings() {
      const saved = JSON.parse(localStorage.getItem(K.settings) || '{}');
      return Object.assign({}, SETTINGS_DEFAULTS, saved);
    },
    saveSettings(patch) {
      const merged = Object.assign(this.getSettings(), patch);
      localStorage.setItem(K.settings, JSON.stringify(merged));
    },

    /* ── Drills ─────────────────────────────────────────── */
    getDrills() {
      return load(K.drills).map(d => ({
        ...d,
        points: (d.points || []).map(migratePoint),
      }));
    },

    getDrill(id) { return this.getDrills().find(d => d.id === id) || null; },

    saveDrill(drill) {
      const list = this.getDrills();
      const idx  = list.findIndex(d => d.id === drill.id);
      if (idx >= 0) list[idx] = drill; else list.push(drill);
      save(K.drills, list);
    },

    deleteDrill(id) {
      save(K.drills, this.getDrills().filter(d => d.id !== id));
    },

    /* Save a single point's reference value into a persisted drill */
    updateDrillPointRef(drillId, pid, refValue) {
      const drills = load(K.drills).map(d => ({
        ...d,
        points: (d.points || []).map(migratePoint),
      }));
      const drill = drills.find(d => d.id === drillId);
      if (!drill) return;
      const pt = drill.points.find(p => p.id === pid);
      if (pt) pt.reference = refValue;
      save(K.drills, drills);
    },

    newDrillId() { return 'drill_' + Date.now(); },

    /* ── Sessions ───────────────────────────────────────── */
    getSessions()          { return load(K.sessions); },
    getSession(id)         { return this.getSessions().find(s => s.sessionId === id) || null; },
    getSessionsByDrill(id) { return this.getSessions().filter(s => s.drillId === id); },

    saveSession(s) {
      const list = this.getSessions();
      const idx  = list.findIndex(x => x.sessionId === s.sessionId);
      if (idx >= 0) list[idx] = s; else list.push(s);
      save(K.sessions, list);
    },

    deleteSession(id) {
      save(K.sessions, this.getSessions().filter(s => s.sessionId !== id));
    },

    newSessionId() {
      const d  = new Date();
      const ds = d.toISOString().slice(0, 10).replace(/-/g, '');
      return `s_${ds}_${Date.now().toString().slice(-5)}`;
    },

    /* ── Cumulative stats ───────────────────────────────── */
    cumulativeStats() {
      const sessions = this.getSessions();
      if (!sessions.length) return { totalSessions: 0, totalDuration: 0, avgQuality: 0 };
      const totalDuration = sessions.reduce((a, s) => a + (s.duration || 0), 0);
      const avgQuality    = Math.round(sessions.reduce((a, s) => a + (s.quality || 0), 0) / sessions.length);
      return { totalSessions: sessions.length, totalDuration, avgQuality };
    },
  };
})();
