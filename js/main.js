(() => {
  /* ── Tab routing ────────────────────────────────────────── */
  const panels = {};
  let activeTab = 'live';

  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
    activeTab = name;

    if (name === 'training') trainingTab.render();
    if (name === 'config')   configTab.render();
    if (name === 'log')      logTab.render();
  }

  /* ── Bluetooth status UI ────────────────────────────────── */
  function setBtUI(status) {
    const dot = document.getElementById('bt-dot');
    const lbl = document.getElementById('bt-label');
    const btn = document.getElementById('btn-bt');

    const states = {
      connected:    { dot: 'connected',    lbl: 'CONNECTED',   btn: 'active' },
      scanning:     { dot: 'scanning',     lbl: 'SCANNING...',  btn: '' },
      connecting:   { dot: 'scanning',     lbl: 'CONNECTING…', btn: '' },
      disconnected: { dot: 'disconnected', lbl: 'BT',           btn: '' },
      error:        { dot: 'error',        lbl: 'ERROR',        btn: 'error' },
      unsupported:  { dot: 'error',        lbl: 'NO BLE',       btn: 'error' },
      simulating:   { dot: 'scanning',     lbl: 'DEMO',         btn: '' },
    };

    const s = states[status] || states.disconnected;
    if (dot) { dot.className = 'bt-dot'; dot.classList.add(s.dot); }
    if (lbl)  lbl.textContent = s.lbl;
    if (btn) {
      btn.className = 'btn-icon';
      if (s.btn) btn.classList.add(s.btn);
    }
  }

  /* ── Theme toggle ───────────────────────────────────────── */
  function initTheme() {
    const saved = localStorage.getItem('onyxSDI_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeBtn(saved);
  }

  function updateThemeBtn(theme) {
    const btn = document.getElementById('btn-theme');
    if (btn) btn.title = theme === 'dark' ? '라이트 모드' : '다크 모드';
  }

  function toggleTheme() {
    const cur  = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('onyxSDI_theme', next);
    updateThemeBtn(next);
  }

  /* ── Boot ───────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // Wire tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => switchTab(btn.dataset.tab);
    });

    // Init tab modules
    liveTab.init(document.getElementById('tab-live'));
    trainingTab.init(
      document.getElementById('tab-training'),
      (drill) => {
        switchTab('live');
        liveTab.startSession(drill);
      }
    );
    configTab.init(
      document.getElementById('tab-config'),
      () => {
        // After save → stay in CONFIG hub (drill list is visible there)
        // trainingTab will refresh on next visit
      }
    );
    logTab.init(document.getElementById('tab-log'));

    // Theme button
    document.getElementById('btn-theme').onclick = toggleTheme;

    // Bluetooth button: connect or disconnect
    document.getElementById('btn-bt').onclick = async () => {
      if (bluetooth.isConnected() || bluetooth.isSimulating()) {
        bluetooth.disconnect();
      } else {
        await bluetooth.connect();
      }
    };

    // BT callbacks
    bluetooth.onStatus = setBtUI;
    bluetooth.onData   = (values) => session.feed(values);

    // Show initial tab
    switchTab('live');
  });
})();
