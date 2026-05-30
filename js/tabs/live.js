const liveTab = (() => {
  let panel = null;

  /* ── SVG foot builder ───────────────────────────────────── */
  function buildFootSVG(opts = {}) {
    const { configMode = false, small = false } = opts;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 200 400');
    svg.setAttribute('xmlns', ns);
    svg.classList.add('foot-svg');
    if (small)      svg.classList.add('small');
    if (configMode) svg.classList.add('config-mode');

    // ── Body path ─────────────────────────────────────────
    // Left foot, plantar view (sole facing viewer), toes up.
    // Inner (medial) side = right of screen, outer (lateral) = left.
    // Path runs clockwise: across toe-row base → outer border → heel → inner border → back.
    const body = document.createElementNS(ns, 'path');
    body.setAttribute('class', 'foot-body');
    body.setAttribute('d', [
      'M 68 68',                          // outer end of toe-row base (little-toe side)
      'C 54 82 48 104 48 128',            // outer ball / 5th metatarsal
      'C 48 152 44 178 44 206',           // outer arch — concave inward
      'C 44 234 46 262 52 290',           // outer mid to heel
      'C 56 314 62 336 74 356',           // outer heel
      'C 86 372 102 382 118 380',         // heel bottom curve
      'C 134 378 148 366 154 350',        // inner heel
      'C 160 332 162 310 162 286',        // inner mid
      'C 162 260 160 234 158 210',        // inner arch — nearly vertical (medial arch)
      'C 156 186 158 162 160 138',        // inner forefoot
      'C 162 116 160 96 156 80',          // inner ball / 1st metatarsal
      'C 153 70 152 66 152 66',           // inner end of toe-row base (big-toe side)
      'C 136 66 118 66 100 66',           // across toe-row base (inner → center)
      'C 84 66 76 66 68 68',             // across toe-row base (center → outer)
      'Z',
    ].join(' '));
    svg.appendChild(body);

    // ── Toes (ellipses, protrude above y≈66) ─────────────
    // Left foot plantar: big toe at right (high cx), little toe at left (low cx).
    // Heights differ — big toe tallest, little toe shortest and lowest.
    const toes = [
      { cx:152, cy:46, rx:14, ry:22 }, // T1 big toe   → P1 tip at ~cy-ry = 24
      { cx:132, cy:38, rx:11, ry:17 }, // T2 2nd toe
      { cx:113, cy:36, rx:10, ry:15 }, // T3 3rd toe
      { cx:94,  cy:38, rx: 9, ry:13 }, // T4 4th toe
      { cx:76,  cy:48, rx: 8, ry:12 }, // T5 little toe → sits lower, at outer side
    ];
    toes.forEach(t => {
      const el = document.createElementNS(ns, 'ellipse');
      el.setAttribute('class', 'foot-toe');
      el.setAttribute('cx', t.cx);
      el.setAttribute('cy', t.cy);
      el.setAttribute('rx', t.rx);
      el.setAttribute('ry', t.ry);
      svg.appendChild(el);
    });

    // ── Pressure point dots + labels ─────────────────────
    // Each circle has BOTH id="Px" (for getElementById) AND data-id="Px" (for querySelector).
    const ppGroup = document.createElementNS(ns, 'g');
    ppGroup.setAttribute('class', 'pp-group');

    POINT_IDS.forEach(pid => {
      const pt  = PRESSURE_POINTS[pid];
      const dot = document.createElementNS(ns, 'circle');
      if (!configMode) dot.setAttribute('id', pid);         // getElementById only for live SVG
      dot.setAttribute('class', 'pp-dot');
      dot.setAttribute('data-id', pid);
      dot.setAttribute('data-state', 'inactive');
      dot.setAttribute('cx', pt.svgX);
      dot.setAttribute('cy', pt.svgY);
      dot.setAttribute('r', configMode ? 11 : 9);
      if (configMode) dot.setAttribute('data-selected', 'false');
      ppGroup.appendChild(dot);

      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('class', 'pp-id-text');
      txt.setAttribute('x', pt.svgX);
      txt.setAttribute('y', pt.svgY);
      txt.textContent = pid;
      ppGroup.appendChild(txt);
    });

    svg.appendChild(ppGroup);
    return svg;
  }

  /* ── Gauge bar builder ──────────────────────────────────── */
  function buildGauge(pt) {
    const row = document.createElement('div');
    row.className = 'gauge-row';
    row.dataset.pid = pt.id;

    const label = document.createElement('span');
    label.className = 'gauge-label';
    label.textContent = pt.id;
    label.title = pt.name;

    const track = document.createElement('div');
    track.className = 'gauge-track';

    const fill = document.createElement('div');
    fill.className = 'gauge-fill';

    // White dashed: effective THR marker
    const thrMarker = document.createElement('div');
    thrMarker.className = 'gauge-thr';
    thrMarker.style.left = '0%';

    // Amber dashed: reference marker (hidden until reference is set)
    const refMarker = document.createElement('div');
    refMarker.className = 'gauge-ref';
    refMarker.style.display = 'none';

    track.appendChild(fill);
    track.appendChild(thrMarker);
    track.appendChild(refMarker);

    const val = document.createElement('span');
    val.className = 'gauge-val mono';
    val.textContent = '---';

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(val);
    return row;
  }

  /* ── Render idle state ──────────────────────────────────── */
  function renderIdle() {
    panel.innerHTML = '';

    const hdr = document.createElement('div');
    hdr.className = 'session-header';

    const title = document.createElement('span');
    title.className = 'session-title';
    title.textContent = '훈련을 선택하세요';

    hdr.appendChild(title);
    panel.appendChild(hdr);

    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = 'TRAINING 탭에서<br>동작을 선택해 시작하세요.';
    panel.appendChild(empty);
  }

  /* ── Render active session ──────────────────────────────── */
  function renderActive(drill) {
    panel.innerHTML = '';

    // ── Session header ───────────────────────────────────
    const hdr = document.createElement('div');
    hdr.className = 'session-header';
    const titleEl = document.createElement('span');
    titleEl.className = 'session-title active';
    titleEl.id = 'live-title';
    titleEl.textContent = drill.title;
    const badgeEl = document.createElement('span');
    badgeEl.className = `badge badge-${drill.type}`;
    badgeEl.textContent = DRILL_TYPES[drill.type].label;
    hdr.appendChild(titleEl);
    hdr.appendChild(badgeEl);
    panel.appendChild(hdr);

    // ── Stats ────────────────────────────────────────────
    const stats = document.createElement('div');
    stats.className = 'live-stats';

    ['live-timer','live-alerts','live-quality'].forEach((id, i) => {
      const blk = document.createElement('div');
      blk.className = 'stat-block';
      const lbl = document.createElement('span');
      lbl.className = 'stat-label';
      lbl.textContent = ['TIME','ALERTS','QUALITY'][i];
      const val = document.createElement('span');
      val.className = 'stat-value';
      val.id = id;
      val.textContent = i === 0 ? '00:00' : i === 1 ? '0' : '100%';
      blk.appendChild(lbl);
      blk.appendChild(val);
      stats.appendChild(blk);
    });
    panel.appendChild(stats);

    // ── Alert banner ─────────────────────────────────────
    const banner = document.createElement('div');
    banner.className = 'alert-banner';
    banner.id = 'live-banner';
    panel.appendChild(banner);

    // ── Body: foot + gauges ──────────────────────────────
    const body = document.createElement('div');
    body.className = 'live-body';

    const footWrap = document.createElement('div');
    footWrap.className = 'foot-wrap';
    const footLbl = document.createElement('span');
    footLbl.className = 'foot-label';
    footLbl.textContent = 'LEFT';
    const svg = buildFootSVG();
    svg.id = 'live-svg';
    footWrap.appendChild(footLbl);
    footWrap.appendChild(svg);
    body.appendChild(footWrap);

    const gauges = document.createElement('div');
    gauges.className = 'live-gauges';
    gauges.id = 'live-gauges';
    drill.points.forEach(pt => gauges.appendChild(buildGauge(PRESSURE_POINTS[pt.id])));
    body.appendChild(gauges);
    panel.appendChild(body);

    // ── Right foot sub-display ────────────────────────────
    const sub = document.createElement('div');
    sub.className = 'sub-foot card card-sm';
    const subLbl = document.createElement('div');
    subLbl.className = 'sub-foot-label';
    subLbl.textContent = 'RIGHT / STATUS';
    const dots = document.createElement('div');
    dots.className = 'sub-dots';
    dots.id = 'live-sub-dots';
    drill.points.forEach(pt => {
      const d = document.createElement('span');
      d.className = 'sub-dot';
      d.dataset.pid = pt.id;
      d.title = pt.id;
      dots.appendChild(d);
    });
    sub.appendChild(subLbl);
    sub.appendChild(dots);
    panel.appendChild(sub);

    // ── Ref-saved info banner (separate from alert banner) ──
    const refBanner = document.createElement('div');
    refBanner.id = 'ref-banner';
    refBanner.className = 'ref-banner';
    panel.appendChild(refBanner);

    // ── Actions ───────────────────────────────────────────
    const actions = document.createElement('div');
    actions.className = 'live-actions';

    const btnEnd = document.createElement('button');
    btnEnd.className = 'btn btn-primary';
    btnEnd.textContent = 'END SESSION';
    btnEnd.onclick = () => {
      const log = session.end();
      if (log) renderIdle();
    };

    const btnMemo = document.createElement('button');
    btnMemo.className = 'btn btn-ghost';
    btnMemo.textContent = '+ MEMO';
    btnMemo.onclick = () => {
      const memo = prompt('메모 입력:');
      if (memo !== null) session.memo = memo;
    };

    // REF SAVE — disabled when BT not connected or session inactive
    const btnRef = document.createElement('button');
    btnRef.className = 'btn btn-ref';
    btnRef.id = 'btn-ref-save';
    btnRef.textContent = '◎ REF SAVE';
    btnRef.title = '현재 압점 값을 기준값으로 저장';
    btnRef.disabled = !bluetooth.isConnected();
    btnRef.onclick = () => saveReference(drill);

    actions.appendChild(btnEnd);
    actions.appendChild(btnMemo);
    actions.appendChild(btnRef);
    panel.appendChild(actions);

    // Set all pressure points to inactive initially, then activate drill points
    resetSVGPoints(drill);
  }

  /* ── SVG state helpers ──────────────────────────────────── */
  function resetSVGPoints(drill) {
    const svg = document.getElementById('live-svg');
    if (!svg) return;
    const activeIds = new Set(drill.points.map(p => p.id));
    svg.querySelectorAll('.pp-dot').forEach(dot => {
      dot.dataset.state = activeIds.has(dot.dataset.id) ? 'ok' : 'inactive';
    });
  }

  function updateSVG(drill, values, alerts) {
    const svg = document.getElementById('live-svg');
    if (!svg) return;
    const alertSet = new Map(alerts.map(a => [a.pointId, a.type]));
    drill.points.forEach(pt => {
      const dot   = svg.querySelector(`.pp-dot[data-id="${pt.id}"]`);
      if (!dot) return;
      const aType = alertSet.get(pt.id);
      dot.dataset.state = aType
        ? (aType === 'negative' ? 'alert-n' : 'alert-p')
        : 'ok';
    });
  }

  function updateGauges(drill, values, alerts) {
    const container = document.getElementById('live-gauges');
    if (!container) return;
    const alertMap = new Map(alerts.map(a => [a.pointId, a.type]));

    drill.points.forEach(pt => {
      const row = container.querySelector(`.gauge-row[data-pid="${pt.id}"]`);
      if (!row) return;
      const idx    = parseInt(pt.id.slice(1)) - 1;
      const val    = values[idx];
      const pct    = Math.round((val / MAX_SENSOR_VAL) * 100);

      // Effective THR (absolute or percent-of-reference)
      const effThr    = alertEngine.getEffectiveThr(pt);
      const thrPct    = Math.round((effThr / MAX_SENSOR_VAL) * 100);
      const aType     = alertMap.get(pt.id);

      const fill      = row.querySelector('.gauge-fill');
      const thrMarker = row.querySelector('.gauge-thr');
      const refMarker = row.querySelector('.gauge-ref');
      const valEl     = row.querySelector('.gauge-val');

      fill.style.width  = `${pct}%`;
      thrMarker.style.left = `${thrPct}%`;

      // Reference marker: amber, only when reference is set
      if (pt.reference !== null) {
        const refPct = Math.round((pt.reference / MAX_SENSOR_VAL) * 100);
        refMarker.style.display = 'block';
        refMarker.style.left    = `${refPct}%`;
      } else {
        refMarker.style.display = 'none';
      }

      fill.className  = 'gauge-fill'    + (aType === 'positive' ? ' alert-p' : aType === 'negative' ? ' alert-n' : '');
      valEl.className = 'gauge-val mono' + (aType === 'positive' ? ' alert-p' : aType === 'negative' ? ' alert-n' : '');
      valEl.textContent = String(val).padStart(4, ' ');
    });
  }

  function updateSubDots(drill, values, alerts) {
    const dots = document.getElementById('live-sub-dots');
    if (!dots) return;
    const alertMap = new Map(alerts.map(a => [a.pointId, a.type]));
    dots.querySelectorAll('.sub-dot').forEach(dot => {
      const aType = alertMap.get(dot.dataset.pid);
      dot.className = 'sub-dot' + (aType === 'positive' ? ' alert-p' : aType === 'negative' ? ' alert-n' : ' ok');
    });
  }

  /* ── REF SAVE ───────────────────────────────────────────── */
  function saveReference(drill) {
    if (!session.isActive) return;
    const values = session.currentValues;

    // Update store + live drill object simultaneously
    drill.points.forEach(pt => {
      const idx  = parseInt(pt.id.slice(1)) - 1;
      pt.reference = values[idx];                           // update live object
      store.updateDrillPointRef(drill.id, pt.id, values[idx]); // persist
    });

    // Show ref-saved banner for 2 s
    const banner = document.getElementById('ref-banner');
    if (banner) {
      const now  = new Date();
      const hms  = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(n => String(n).padStart(2, '0')).join(':');
      banner.textContent = `REFERENCE SAVED · ${hms}`;
      banner.classList.add('visible');
      clearTimeout(banner._timer);
      banner._timer = setTimeout(() => banner.classList.remove('visible'), 2000);
    }
  }

  let bannerTimer = null;
  function updateBanner(alerts) {
    const banner = document.getElementById('live-banner');
    if (!banner) return;
    if (!alerts.length) {
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => {
        banner.classList.remove('visible','positive','negative');
      }, 1500);
      return;
    }
    clearTimeout(bannerTimer);
    const hasNeg = alerts.some(a => a.type === 'negative');
    const hasGait = alerts.some(a => a.type === 'gait');
    const msgs = alerts.map(a => {
      if (a.type === 'gait') return '보행 순서 오류';
      const pt = PRESSURE_POINTS[a.pointId];
      return a.type === 'positive'
        ? `${pt.label} 압력 부족 (${a.value})`
        : `${pt.label} 과압 감지 (${a.value})`;
    });
    banner.textContent = msgs.join(' · ');
    banner.className = 'alert-banner visible ' + (hasGait || hasNeg ? 'negative' : 'positive');
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {
    buildFootSVG,

    init(panelEl) {
      panel = panelEl;
      renderIdle();
    },

    startSession(drill) {
      renderActive(drill);
      session.start(drill);

      session.onTick = (elapsed, quality, alertCount) => {
        const timerEl  = document.getElementById('live-timer');
        const alertsEl = document.getElementById('live-alerts');
        const qualEl   = document.getElementById('live-quality');
        if (timerEl)  timerEl.textContent  = session.fmtElapsed();
        if (alertsEl) alertsEl.textContent = alertCount;
        if (qualEl) {
          qualEl.textContent  = quality + '%';
          qualEl.className    = 'stat-value' + (quality >= 80 ? ' ok' : quality >= 50 ? ' warn' : ' danger');
        }
      };

      session.onValues = (values, alerts, accuracy) => {
        updateSVG(session.drill, values, alerts);
        updateGauges(session.drill, values, alerts);
        updateSubDots(session.drill, values, alerts);
        updateBanner(alerts);

        // REF SAVE button: enabled only when BT connected + session active
        const btnRefEl = document.getElementById('btn-ref-save');
        if (btnRefEl) btnRefEl.disabled = !bluetooth.isConnected();

        // If accuracy is available, reflect it in quality display
        if (accuracy !== null) {
          const qualEl = document.getElementById('live-quality');
          if (qualEl && !alerts.length) {
            // Show accuracy alongside session quality on no-alert samples
            qualEl.title = `기준값 대비 정확도: ${accuracy}%`;
          }
        }
      };

      session.onEnd = () => {
        renderIdle();
        // Switch to LOG tab to see the saved session
        setTimeout(() => document.querySelector('.tab-btn[data-tab="log"]')?.click(), 400);
      };

      // Start simulation if no real BT
      if (!bluetooth.isConnected()) bluetooth.startSimulation(drill);
    },
  };
})();
