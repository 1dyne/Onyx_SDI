const logTab = (() => {
  let panel     = null;
  let viewMode  = 'list';   // 'list' | 'detail'
  let detailId  = null;

  function fmt2(n) { return String(n).padStart(2, '0'); }
  function fmtDuration(s) {
    const m = Math.floor(s / 60);
    return `${fmt2(m)}:${fmt2(s % 60)}`;
  }
  function qualityClass(q) {
    return q >= 80 ? 'ok' : q >= 50 ? 'warn' : 'danger';
  }
  function qualityColor(q) {
    return q >= 80 ? 'var(--color-ok)' : q >= 50 ? 'var(--color-alert-n)' : 'var(--color-alert-p)';
  }

  /* ── Cumulative stats banner ────────────────────────────── */
  function buildStatsPanel() {
    const stats   = store.cumulativeStats();
    const wrap    = document.createElement('div');
    wrap.className = 'log-stats-grid';

    const items = [
      { label: 'TOTAL SESSIONS', value: stats.totalSessions },
      { label: 'TOTAL TIME',     value: fmtDuration(stats.totalDuration) },
      { label: 'AVG QUALITY',    value: stats.avgQuality + '%' },
    ];

    items.forEach(item => {
      const blk = document.createElement('div');
      blk.className = 'stat-block';
      blk.innerHTML = `
        <span class="stat-label">${item.label}</span>
        <span class="stat-value mono">${item.value}</span>
      `;
      wrap.appendChild(blk);
    });

    return wrap;
  }

  /* ── Session list ───────────────────────────────────────── */
  function renderList() {
    panel.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    heading.textContent = '누적 통계';
    panel.appendChild(heading);
    panel.appendChild(buildStatsPanel());

    const heading2 = document.createElement('div');
    heading2.className = 'section-heading';
    heading2.textContent = '세션 히스토리';
    panel.appendChild(heading2);

    const sessions = store.getSessions().slice().reverse();

    if (!sessions.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '아직 완료된 세션이 없습니다.<br>TRAINING 탭에서 훈련을 시작하세요.';
      panel.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'log-list';

    sessions.forEach(s => {
      const row = document.createElement('div');
      row.className = 'log-row';

      const titleEl = document.createElement('div');
      titleEl.className = 'log-row-title';
      titleEl.textContent = s.drillTitle || '(알 수 없음)';

      const dateEl = document.createElement('div');
      dateEl.className = 'log-row-date';
      dateEl.textContent = s.date;

      const subEl = document.createElement('div');
      subEl.className = 'log-row-sub';
      const typeLabel = DRILL_TYPES[s.drillType]?.label || s.drillType || '';
      subEl.textContent = `${typeLabel}  ·  ${fmtDuration(s.duration || 0)}  ·  경고 ${s.alertCount || 0}회`;

      const qEl = document.createElement('div');
      qEl.className = 'log-quality mono';
      qEl.style.color = qualityColor(s.quality || 0);
      qEl.textContent = (s.quality ?? '--') + '%';

      row.appendChild(titleEl);
      row.appendChild(dateEl);
      row.appendChild(subEl);
      row.appendChild(qEl);

      row.onclick = () => {
        detailId = s.sessionId;
        viewMode = 'detail';
        renderDetail(s);
      };

      list.appendChild(row);
    });

    panel.appendChild(list);
  }

  /* ── Session detail ─────────────────────────────────────── */
  function renderDetail(s) {
    panel.innerHTML = '';

    // Back button
    const back = document.createElement('div');
    back.className = 'detail-back';
    back.innerHTML = '‹ 목록으로';
    back.onclick = () => { viewMode = 'list'; renderList(); };
    panel.appendChild(back);

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'card card-sm';
    hdr.style.display = 'flex';
    hdr.style.flexDirection = 'column';
    hdr.style.gap = 'var(--gap-xs)';

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;align-items:center;gap:var(--gap-sm);';
    const titleEl = document.createElement('span');
    titleEl.style.cssText = 'font-weight:700;font-size:16px;flex:1;';
    titleEl.textContent = s.drillTitle || '세션';
    const badge = document.createElement('span');
    badge.className = `badge badge-${s.drillType || 'custom'}`;
    badge.textContent = DRILL_TYPES[s.drillType]?.label || s.drillType || '';
    titleRow.appendChild(titleEl);
    titleRow.appendChild(badge);

    const metaEl = document.createElement('div');
    metaEl.style.cssText = 'font-size:11px;color:var(--text-dim);font-family:var(--font-mono);';
    metaEl.textContent = `${s.date}  ·  ${fmtDuration(s.duration || 0)}  ·  경고 ${s.alertCount || 0}회`;

    hdr.appendChild(titleRow);
    hdr.appendChild(metaEl);
    panel.appendChild(hdr);

    // Key stats
    const statsGrid = document.createElement('div');
    statsGrid.className = 'live-stats';
    [
      { label: 'DURATION', value: fmtDuration(s.duration || 0) },
      { label: 'ALERTS',   value: s.alertCount || 0 },
      { label: 'QUALITY',  value: (s.quality ?? '--') + '%' },
    ].forEach(item => {
      const blk = document.createElement('div');
      blk.className = 'stat-block';
      blk.innerHTML = `<span class="stat-label">${item.label}</span>
        <span class="stat-value mono ${item.label === 'QUALITY' ? qualityClass(s.quality) : ''}">${item.value}</span>`;
      statsGrid.appendChild(blk);
    });
    panel.appendChild(statsGrid);

    // Per-point stats
    if (s.pointStats && Object.keys(s.pointStats).length) {
      const heading = document.createElement('div');
      heading.className = 'section-heading';
      heading.textContent = '압점별 평균';
      panel.appendChild(heading);

      const ptList = document.createElement('div');
      ptList.style.display = 'flex';
      ptList.style.flexDirection = 'column';
      ptList.style.gap = 'var(--gap-xs)';

      Object.entries(s.pointStats).forEach(([pid, stat]) => {
        const pp  = PRESSURE_POINTS[pid];
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:var(--gap-sm);padding:6px var(--gap-md);background:var(--bg-card);border:1px solid var(--border);';

        const idEl = document.createElement('span');
        idEl.style.cssText = 'font-family:var(--font-mono);font-size:11px;color:var(--text-muted);width:28px;';
        idEl.textContent = pid;

        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'font-size:12px;color:var(--text-dim);flex:1;';
        nameEl.textContent = pp?.label || pid;

        const avgEl = document.createElement('span');
        avgEl.style.cssText = 'font-family:var(--font-mono);font-size:12px;';
        avgEl.textContent = `avg ${stat.avg}`;

        const alertEl = document.createElement('span');
        alertEl.style.cssText = 'font-size:11px;color:var(--color-alert-p);font-family:var(--font-mono);min-width:50px;text-align:right;';
        alertEl.textContent = stat.alertCount ? `⚠ ${stat.alertCount}` : '';

        row.appendChild(idEl);
        row.appendChild(nameEl);
        row.appendChild(avgEl);
        row.appendChild(alertEl);
        ptList.appendChild(row);
      });

      panel.appendChild(ptList);
    }

    // Alert timeline (simplified)
    if (s.alertTimeline?.length) {
      const heading = document.createElement('div');
      heading.className = 'section-heading';
      heading.textContent = `경고 타임라인 (${s.alertTimeline.length}건)`;
      panel.appendChild(heading);

      const tl = document.createElement('div');
      tl.style.cssText = 'display:flex;flex-direction:column;gap:2px;max-height:160px;overflow-y:auto;';

      // Group by second to reduce noise
      const grouped = {};
      s.alertTimeline.forEach(a => {
        const key = a.time;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(a);
      });

      Object.entries(grouped).slice(0, 50).forEach(([t, alerts]) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:var(--gap-sm);font-size:11px;font-family:var(--font-mono);color:var(--text-dim);';
        const time = document.createElement('span');
        time.style.color = 'var(--text-muted)';
        time.textContent = fmtDuration(parseInt(t));
        const pts = document.createElement('span');
        pts.textContent = alerts.map(a => a.pointId).join(' ');
        const type = document.createElement('span');
        type.style.marginLeft = 'auto';
        const hasNeg = alerts.some(a => a.type === 'negative' || a.type === 'gait');
        type.style.color = hasNeg ? 'var(--color-alert-n)' : 'var(--color-alert-p)';
        type.textContent = hasNeg ? '▼' : '▲';
        row.appendChild(time);
        row.appendChild(pts);
        row.appendChild(type);
        tl.appendChild(row);
      });

      panel.appendChild(tl);
    }

    // Memo
    const memoHeading = document.createElement('div');
    memoHeading.className = 'section-heading';
    memoHeading.textContent = '메모';
    panel.appendChild(memoHeading);

    const memoEl = document.createElement('div');
    memoEl.style.cssText = 'font-size:13px;color:var(--text-dim);padding:var(--gap-sm) 0;min-height:32px;';
    memoEl.textContent = s.memo || '(메모 없음)';
    panel.appendChild(memoEl);
  }

  return {
    init(panelEl) { panel = panelEl; },

    render() {
      viewMode = 'list';
      renderList();
    },
  };
})();
