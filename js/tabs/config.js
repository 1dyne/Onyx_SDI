const configTab = (() => {
  let panel   = null;
  let onSaved = null;  // callback () → void

  // Wizard state
  let draft = {};
  let step  = 0;       // 0 = hub, 1-3 = wizard steps

  function resetDraft() {
    draft = {
      id:                 null,
      title:              '',
      type:               'static',
      points:             [],
      showPlacementAlert: true,
    };
  }

  function makeDefaultPoint(pid) {
    return {
      id:         pid,
      thr:        PRESSURE_POINTS[pid].defaultDirection === 'positive' ? 300 : 150,
      direction:  PRESSURE_POINTS[pid].defaultDirection,
      reference:  null,
      thrMode:    'absolute',
      thrPercent: 80,
    };
  }

  /* ── Step indicator (3 steps) ───────────────────────────── */
  function buildStepDots(current) {
    const wrap = document.createElement('div');
    wrap.className = 'wizard-steps';
    for (let i = 1; i <= 3; i++) {
      const d = document.createElement('div');
      d.className = 'wizard-step-dot ' + (i < current ? 'done' : i === current ? 'active' : '');
      wrap.appendChild(d);
    }
    return wrap;
  }

  /* ══════════════════════════════════════════════════════════
     HUB VIEW — 저장된 동작 목록 + 오디오 설정
  ══════════════════════════════════════════════════════════ */
  function renderHub() {
    step = 0;
    panel.innerHTML = '';

    /* ── DRILLS 섹션 ───────────────────────────────────────── */
    const drillsHdr = document.createElement('div');
    drillsHdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--gap-sm);';

    const drillsTitle = document.createElement('div');
    drillsTitle.className = 'section-heading';
    drillsTitle.style.borderBottom = 'none';
    drillsTitle.textContent = 'DRILLS';

    const btnNew = document.createElement('button');
    btnNew.className = 'btn btn-primary';
    btnNew.style.fontSize = '11px';
    btnNew.style.padding  = '6px 12px';
    btnNew.textContent = '+ 새 동작';
    btnNew.onclick = () => {
      resetDraft();
      step = 1;
      renderStep1();
    };

    drillsHdr.appendChild(drillsTitle);
    drillsHdr.appendChild(btnNew);
    panel.appendChild(drillsHdr);

    const drills = store.getDrills();

    if (!drills.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.padding = 'var(--gap-lg) var(--gap-md)';
      empty.innerHTML = '등록된 동작이 없습니다.<br><span style="font-size:11px;opacity:.6">+ 새 동작 버튼으로 추가하세요.</span>';
      panel.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = 'var(--gap-sm)';

      drills.forEach(drill => {
        const row = document.createElement('div');
        row.className = 'card card-sm';
        row.style.cssText = 'display:flex;align-items:center;gap:var(--gap-sm);';

        const info = document.createElement('div');
        info.style.flex = '1';
        info.style.minWidth = '0';

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        titleEl.textContent = drill.title;

        const sub = document.createElement('div');
        sub.style.cssText = 'font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;letter-spacing:.06em;';
        sub.textContent = `${DRILL_TYPES[drill.type]?.label || drill.type}  ·  ${drill.points.map(p => p.id).join(' ')}`;

        info.appendChild(titleEl);
        info.appendChild(sub);

        const badge = document.createElement('span');
        badge.className = `badge badge-${drill.type}`;
        badge.style.flexShrink = '0';
        badge.textContent = DRILL_TYPES[drill.type]?.label || drill.type;

        // ✏️ Edit
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-icon';
        btnEdit.title = '수정';
        btnEdit.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        btnEdit.onclick = (e) => {
          e.stopPropagation();
          editDrill(drill);
        };

        // 🗑️ Delete
        const btnDel = document.createElement('button');
        btnDel.className = 'btn-icon';
        btnDel.style.color = 'var(--color-alert-p)';
        btnDel.style.borderColor = 'transparent';
        btnDel.title = '삭제';
        btnDel.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
        btnDel.onclick = (e) => {
          e.stopPropagation();
          if (!confirm(`"${drill.title}" 동작을 삭제할까요?`)) return;
          store.deleteDrill(drill.id);
          renderHub();
        };

        row.appendChild(info);
        row.appendChild(badge);
        row.appendChild(btnEdit);
        row.appendChild(btnDel);
        list.appendChild(row);
      });

      panel.appendChild(list);
    }

    /* ── AUDIO 설정 섹션 ────────────────────────────────────── */
    const audioDiv = document.createElement('div');
    audioDiv.style.marginTop = 'var(--gap-lg)';

    const audioHdr = document.createElement('div');
    audioHdr.className = 'section-heading';
    audioHdr.style.marginBottom = 'var(--gap-sm)';
    audioHdr.textContent = 'AUDIO';
    audioDiv.appendChild(audioHdr);

    const cfg = store.getSettings();

    /* 경고음 card */
    const alertCard = document.createElement('div');
    alertCard.className = 'card card-sm';
    alertCard.style.cssText = 'display:flex;flex-direction:column;gap:var(--gap-sm);margin-bottom:var(--gap-sm);';

    // 경고음 활성화 토글
    const alertToggleRow = buildToggleRow(
      '경고음 사용',
      cfg.alertSoundEnabled !== false,
      (checked) => store.saveSettings({ alertSoundEnabled: checked }),
    );
    alertCard.appendChild(alertToggleRow);

    // 볼륨 슬라이더 + TEST 버튼
    const volLbl = document.createElement('div');
    volLbl.className = 'form-label';
    volLbl.textContent = '음량';
    alertCard.appendChild(volLbl);

    const volRow = document.createElement('div');
    volRow.className = 'slider-row';
    const volSlider = document.createElement('input');
    volSlider.type  = 'range';
    volSlider.min   = 0;
    volSlider.max   = 100;
    volSlider.value = Math.round((cfg.audioVolume ?? 0.5) * 100);
    const volVal = document.createElement('span');
    volVal.className = 'slider-val';
    volVal.textContent = volSlider.value;
    volSlider.addEventListener('input', () => {
      volVal.textContent = volSlider.value;
      store.saveSettings({ audioVolume: parseInt(volSlider.value) / 100 });
    });
    const btnTest = document.createElement('button');
    btnTest.className = 'btn btn-ghost';
    btnTest.style.cssText = 'font-size:11px;padding:4px 10px;white-space:nowrap;flex-shrink:0;';
    btnTest.textContent = '▶ TEST';
    btnTest.onclick = () => audio.test('positive');
    volRow.appendChild(volSlider);
    volRow.appendChild(volVal);
    volRow.appendChild(btnTest);
    alertCard.appendChild(volRow);

    audioDiv.appendChild(alertCard);

    /* 성공음 card */
    const sucCard = document.createElement('div');
    sucCard.className = 'card card-sm';
    sucCard.style.cssText = 'display:flex;flex-direction:column;gap:var(--gap-sm);';

    // 성공음 토글
    const sucToggleRow = buildToggleRow(
      '성공음 사용',
      cfg.successSoundEnabled !== false,
      (checked) => {
        store.saveSettings({ successSoundEnabled: checked });
        sucThrSlider.disabled = !checked;
      },
    );
    sucCard.appendChild(sucToggleRow);

    const sucLbl = document.createElement('div');
    sucLbl.className = 'form-label';
    sucLbl.textContent = '성공 기준 (정확도 %)';
    sucCard.appendChild(sucLbl);

    const sucThrRow = document.createElement('div');
    sucThrRow.className = 'slider-row';
    const sucThrSlider = document.createElement('input');
    sucThrSlider.type     = 'range';
    sucThrSlider.min      = 70;
    sucThrSlider.max      = 100;
    sucThrSlider.value    = cfg.successThreshold ?? 90;
    sucThrSlider.disabled = !(cfg.successSoundEnabled !== false);
    const sucThrVal = document.createElement('span');
    sucThrVal.className   = 'slider-val';
    sucThrVal.textContent = sucThrSlider.value + '%';
    sucThrSlider.addEventListener('input', () => {
      sucThrVal.textContent = sucThrSlider.value + '%';
      store.saveSettings({ successThreshold: parseInt(sucThrSlider.value) });
    });
    const btnTestSuc = document.createElement('button');
    btnTestSuc.className = 'btn btn-ghost';
    btnTestSuc.style.cssText = 'font-size:11px;padding:4px 10px;white-space:nowrap;flex-shrink:0;';
    btnTestSuc.textContent = '▶ TEST';
    btnTestSuc.onclick = () => audio.test('success');
    sucThrRow.appendChild(sucThrSlider);
    sucThrRow.appendChild(sucThrVal);
    sucThrRow.appendChild(btnTestSuc);
    sucCard.appendChild(sucThrRow);

    audioDiv.appendChild(sucCard);
    panel.appendChild(audioDiv);

    /* ── REF SAVE 안내 ─────────────────────────────────────── */
    const refNote = document.createElement('div');
    refNote.style.cssText = `
      margin-top: var(--gap-lg);
      padding: var(--gap-sm) var(--gap-md);
      border-left: 2px solid var(--border-hi);
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: .06em;
      color: var(--text-muted);
      line-height: 1.6;
    `;
    refNote.innerHTML =
      '<span style="color:var(--color-accent-text);">◎ REF SAVE</span> — ' +
      'LIVE 세션 진행 중 나타나는 버튼.<br>' +
      '현재 압력값을 기준값으로 저장합니다.<br>' +
      '기준값이 저장된 후 동작 설정(Step 3)에서<br>' +
      '<em>기준값의 %</em> 모드를 사용할 수 있습니다.';
    panel.appendChild(refNote);
  }

  /* ── Helper: 토글 행 생성 ────────────────────────────────── */
  function buildToggleRow(labelText, initialChecked, onChange) {
    const row = document.createElement('div');
    row.className = 'toggle-row';

    const lbl = document.createElement('label');
    lbl.className = 'toggle-label';
    lbl.textContent = labelText;

    const sw = document.createElement('label');
    sw.className = 'toggle-switch';
    const chk = document.createElement('input');
    chk.type    = 'checkbox';
    chk.checked = initialChecked;
    chk.onchange = () => onChange(chk.checked);
    const sliderEl = document.createElement('span');
    sliderEl.className = 'toggle-slider';
    sw.appendChild(chk);
    sw.appendChild(sliderEl);

    row.appendChild(lbl);
    row.appendChild(sw);
    return row;
  }

  /* ══════════════════════════════════════════════════════════
     WIZARD — Step 1: 제목 + 타입
  ══════════════════════════════════════════════════════════ */
  function renderStep1() {
    panel.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    heading.textContent = draft.id ? 'CONFIG — 동작 수정' : 'CONFIG — 새 동작';
    panel.appendChild(heading);
    panel.appendChild(buildStepDots(1));

    const lbl1 = document.createElement('div');
    lbl1.className = 'form-label';
    lbl1.style.marginBottom = 'var(--gap-xs)';
    lbl1.textContent = '동작 제목';
    panel.appendChild(lbl1);

    const input = document.createElement('input');
    input.className   = 'form-input';
    input.type        = 'text';
    input.placeholder = '예: 정적 하중 유지';
    input.value       = draft.title;
    input.maxLength   = 40;
    panel.appendChild(input);

    const lbl2 = document.createElement('div');
    lbl2.className = 'form-label';
    lbl2.style.margin = 'var(--gap-md) 0 var(--gap-xs)';
    lbl2.textContent = '경고 조건 타입';
    panel.appendChild(lbl2);

    const typeSelector = document.createElement('div');
    typeSelector.className = 'type-selector';

    const refreshTypes = (selected) => {
      typeSelector.querySelectorAll('.type-btn').forEach((b, i) => {
        const k = Object.keys(DRILL_TYPES)[i];
        b.className = 'type-btn' + (k === selected ? ` selected-${k}` : '');
      });
    };

    Object.entries(DRILL_TYPES).forEach(([key, dt]) => {
      const btn = document.createElement('button');
      btn.className = 'type-btn' + (draft.type === key ? ` selected-${key}` : '');
      btn.textContent = dt.label;
      btn.onclick = () => { draft.type = key; refreshTypes(key); };
      typeSelector.appendChild(btn);
    });
    panel.appendChild(typeSelector);

    if (draft.type === 'gait') {
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:11px;color:var(--text-dim);margin-top:var(--gap-xs);';
      hint.textContent = 'Gait 모드: Heel → Met → Toe-1 순서를 자동으로 체크합니다.';
      panel.appendChild(hint);
    }

    const nav = document.createElement('div');
    nav.className = 'wizard-nav';

    const btnBack = document.createElement('button');
    btnBack.className = 'btn btn-ghost';
    btnBack.textContent = '← 취소';
    btnBack.onclick = () => renderHub();

    const btnNext = document.createElement('button');
    btnNext.className = 'btn btn-primary';
    btnNext.textContent = '다음 — 압점 선택';
    btnNext.onclick = () => {
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      draft.title = v;
      step = 2;
      renderStep2();
    };

    nav.appendChild(btnBack);
    nav.appendChild(btnNext);
    panel.appendChild(nav);
  }

  /* ══════════════════════════════════════════════════════════
     WIZARD — Step 2: 압점 선택
  ══════════════════════════════════════════════════════════ */
  function renderStep2() {
    panel.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    heading.textContent = 'CONFIG — 압점 선택 (4개)';
    panel.appendChild(heading);
    panel.appendChild(buildStepDots(2));

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-dim);';
    hint.textContent = '발 실루엣에서 활성화할 압점을 정확히 4개 선택하세요.';
    panel.appendChild(hint);

    const footWrap = document.createElement('div');
    footWrap.className = 'foot-wrap';
    footWrap.style.margin = 'var(--gap-sm) auto';

    const footLbl = document.createElement('span');
    footLbl.className = 'foot-label';
    footLbl.textContent = 'LEFT — 탭하여 선택';
    footWrap.appendChild(footLbl);

    const svg = liveTab.buildFootSVG({ configMode: true });
    svg.id = 'config-svg';

    const selected = new Set(draft.points.map(p => p.id));

    svg.querySelectorAll('.pp-dot').forEach(dot => {
      const pid = dot.dataset.id;
      if (selected.has(pid)) {
        dot.dataset.selected = 'true';
        dot.dataset.state    = 'ok';
      } else {
        dot.dataset.selected = 'false';
        dot.dataset.state    = 'inactive';
      }

      dot.addEventListener('click', () => {
        const isSel = dot.dataset.selected === 'true';
        if (!isSel && selected.size >= REQUIRED_POINTS) return;
        if (isSel) {
          selected.delete(pid);
          dot.dataset.selected = 'false';
          dot.dataset.state    = 'inactive';
        } else {
          selected.add(pid);
          dot.dataset.selected = 'true';
          dot.dataset.state    = 'ok';
        }
        countEl.innerHTML = `<span class="num ${selected.size === REQUIRED_POINTS ? 'full' : ''}">${selected.size}</span> / ${REQUIRED_POINTS} 선택됨`;
      });
    });

    footWrap.appendChild(svg);
    panel.appendChild(footWrap);

    const countEl = document.createElement('div');
    countEl.className = 'pp-select-count';
    countEl.innerHTML = `<span class="num ${selected.size === REQUIRED_POINTS ? 'full' : ''}">${selected.size}</span> / ${REQUIRED_POINTS} 선택됨`;
    panel.appendChild(countEl);

    const nav = document.createElement('div');
    nav.className = 'wizard-nav';

    const btnBack = document.createElement('button');
    btnBack.className = 'btn btn-ghost';
    btnBack.textContent = '← 뒤로';
    btnBack.onclick = () => { step = 1; renderStep1(); };

    const btnNext = document.createElement('button');
    btnNext.className = 'btn btn-primary';
    btnNext.textContent = '다음 — 압점 설정';
    btnNext.onclick = () => {
      if (selected.size !== REQUIRED_POINTS) {
        countEl.style.color = 'var(--color-alert-p)';
        return;
      }
      const prev = new Map(draft.points.map(p => [p.id, p]));
      draft.points = [...selected].map(pid => prev.get(pid) || makeDefaultPoint(pid));
      step = 3;
      renderStep3();
    };

    nav.appendChild(btnBack);
    nav.appendChild(btnNext);
    panel.appendChild(nav);
  }

  /* ══════════════════════════════════════════════════════════
     WIZARD — Step 3: 압점별 설정 + 배치 알림 + 저장
  ══════════════════════════════════════════════════════════ */
  function renderStep3() {
    panel.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    heading.textContent = 'CONFIG — 압점 설정';
    panel.appendChild(heading);
    panel.appendChild(buildStepDots(3));

    draft.points.forEach(pt => {
      const pp   = PRESSURE_POINTS[pt.id];
      const card = document.createElement('div');
      card.className = 'point-cfg';

      // 헤더
      const hdr = document.createElement('div');
      hdr.className = 'point-cfg-header';
      const idBadge = document.createElement('span');
      idBadge.className = 'point-id-badge';
      idBadge.textContent = pt.id;
      const name = document.createElement('span');
      name.style.cssText = 'font-size:13px;font-weight:600;';
      name.textContent = `${pp.name} · ${pp.label}`;
      hdr.appendChild(idBadge);
      hdr.appendChild(name);
      card.appendChild(hdr);

      // ── THR 설정 방식 ──────────────────────────────────────
      const thrModeLbl = document.createElement('div');
      thrModeLbl.className = 'form-label';
      thrModeLbl.textContent = 'THR 설정 방식';
      card.appendChild(thrModeLbl);

      const thrModeRow = document.createElement('div');
      thrModeRow.className = 'dir-toggle';
      thrModeRow.style.marginBottom = 'var(--gap-sm)';

      const btnAbs = document.createElement('button');
      btnAbs.className = 'dir-btn' + (pt.thrMode !== 'percent' ? ' selected-positive' : '');
      btnAbs.textContent = '절대값';

      const btnPct = document.createElement('button');
      btnPct.className = 'dir-btn' + (pt.thrMode === 'percent' ? ' selected-positive' : '');
      btnPct.textContent = '기준값의 %';
      if (pt.reference === null) {
        btnPct.disabled = true;
        btnPct.style.opacity = '0.4';
        btnPct.title = 'LIVE 세션에서 ◎ REF SAVE 후 사용 가능';
      }

      // ── 절대값 슬라이더 ────────────────────────────────────
      const absSection = document.createElement('div');
      absSection.style.display = pt.thrMode === 'percent' ? 'none' : 'block';

      const absLbl = document.createElement('div');
      absLbl.className = 'form-label';
      absLbl.textContent = 'THR 임계값 (0 – 1023)';
      absSection.appendChild(absLbl);

      const absRow = document.createElement('div');
      absRow.className = 'slider-row';
      const absSlider = document.createElement('input');
      absSlider.type  = 'range';
      absSlider.min   = 0;
      absSlider.max   = MAX_SENSOR_VAL;
      absSlider.value = pt.thr;
      const absVal = document.createElement('span');
      absVal.className = 'slider-val';
      absVal.textContent = pt.thr;
      absSlider.addEventListener('input', () => {
        pt.thr = parseInt(absSlider.value);
        absVal.textContent = pt.thr;
      });
      absRow.appendChild(absSlider);
      absRow.appendChild(absVal);
      absSection.appendChild(absRow);

      // ── 기준값 % 슬라이더 ──────────────────────────────────
      const pctSection = document.createElement('div');
      pctSection.style.display = pt.thrMode === 'percent' ? 'block' : 'none';

      if (pt.reference === null) {
        const pctHint = document.createElement('div');
        pctHint.style.cssText = 'font-size:11px;color:var(--color-alert-n);';
        pctHint.textContent = 'LIVE 세션 → ◎ REF SAVE 먼저 진행하세요.';
        pctSection.appendChild(pctHint);
      } else {
        const pctLbl = document.createElement('div');
        pctLbl.className = 'form-label';
        pctLbl.textContent = `기준값(${pt.reference})의 %`;
        pctSection.appendChild(pctLbl);

        const pctRow = document.createElement('div');
        pctRow.className = 'slider-row';
        const pctSlider = document.createElement('input');
        pctSlider.type  = 'range';
        pctSlider.min   = 50;
        pctSlider.max   = 100;
        pctSlider.value = pt.thrPercent ?? 80;
        const pctVal = document.createElement('span');
        pctVal.className = 'slider-val';
        pctVal.textContent = (pt.thrPercent ?? 80) + '%';
        pctSlider.addEventListener('input', () => {
          pt.thrPercent = parseInt(pctSlider.value);
          pctVal.textContent = pt.thrPercent + '%';
          pctVal.title = `실제 THR ≈ ${Math.round(pt.reference * pt.thrPercent / 100)}`;
        });
        pctRow.appendChild(pctSlider);
        pctRow.appendChild(pctVal);
        pctSection.appendChild(pctRow);
      }

      // Mode toggle handlers
      btnAbs.onclick = () => {
        pt.thrMode = 'absolute';
        btnAbs.className = 'dir-btn selected-positive';
        btnPct.className = 'dir-btn';
        absSection.style.display = 'block';
        pctSection.style.display = 'none';
      };
      btnPct.onclick = () => {
        if (pt.reference === null) return;
        pt.thrMode = 'percent';
        btnAbs.className = 'dir-btn';
        btnPct.className = 'dir-btn selected-positive';
        absSection.style.display = 'none';
        pctSection.style.display = 'block';
      };

      thrModeRow.appendChild(btnAbs);
      thrModeRow.appendChild(btnPct);
      card.appendChild(thrModeRow);
      card.appendChild(absSection);
      card.appendChild(pctSection);

      // ── 경고 방향 ──────────────────────────────────────────
      const dirLbl = document.createElement('div');
      dirLbl.className = 'form-label';
      dirLbl.textContent = '경고 방향';
      card.appendChild(dirLbl);

      const dirToggle = document.createElement('div');
      dirToggle.className = 'dir-toggle';

      const btnPos = document.createElement('button');
      btnPos.className = 'dir-btn' + (pt.direction === 'positive' ? ' selected-positive' : '');
      btnPos.textContent = '▲ POSITIVE';

      const btnNeg = document.createElement('button');
      btnNeg.className = 'dir-btn' + (pt.direction === 'negative' ? ' selected-negative' : '');
      btnNeg.textContent = '▼ NEGATIVE';

      btnPos.onclick = () => {
        pt.direction = 'positive';
        btnPos.className = 'dir-btn selected-positive';
        btnNeg.className = 'dir-btn';
      };
      btnNeg.onclick = () => {
        pt.direction = 'negative';
        btnPos.className = 'dir-btn';
        btnNeg.className = 'dir-btn selected-negative';
      };

      dirToggle.appendChild(btnPos);
      dirToggle.appendChild(btnNeg);
      card.appendChild(dirToggle);

      panel.appendChild(card);
    });

    // ── 배치 알림 토글 ─────────────────────────────────────
    const placementRow = buildToggleRow(
      '훈련 시작 전 FSR 배치 알림 표시',
      draft.showPlacementAlert !== false,
      (checked) => { draft.showPlacementAlert = checked; },
    );
    placementRow.className += ' card card-sm';
    placementRow.style.marginTop = 'var(--gap-sm)';
    panel.appendChild(placementRow);

    // ── Nav ────────────────────────────────────────────────
    const nav = document.createElement('div');
    nav.className = 'wizard-nav';

    const btnBack = document.createElement('button');
    btnBack.className = 'btn btn-ghost';
    btnBack.textContent = '← 뒤로';
    btnBack.onclick = () => { step = 2; renderStep2(); };

    const btnSave = document.createElement('button');
    btnSave.className = 'btn btn-ok';
    btnSave.textContent = '저장';
    btnSave.onclick = () => {
      if (!draft.id) draft.id = store.newDrillId();
      store.saveDrill({ ...draft });
      resetDraft();
      step = 0;
      onSaved?.();
      renderHub();
    };

    nav.appendChild(btnBack);
    nav.appendChild(btnSave);
    panel.appendChild(nav);
  }

  /* ── Edit entry point ───────────────────────────────────── */
  function editDrill(drill) {
    draft = {
      id:                 drill.id,
      title:              drill.title,
      type:               drill.type,
      points:             drill.points.map(p => ({ ...makeDefaultPoint(p.id), ...p })),
      showPlacementAlert: drill.showPlacementAlert !== false,
    };
    step = 1;
    renderStep1();
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {
    init(panelEl, savedCallback) {
      panel   = panelEl;
      onSaved = savedCallback;
      resetDraft();
    },

    render() {
      renderHub();
    },

    editDrill,
  };
})();
