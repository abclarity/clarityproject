// scripts/month.js
// Monatsansicht: Tages-Tracking + Weekly-Summaries (Modular)

(function(window) {
  const { calculateKPIs, formatValue, weekdayLetter, isoWeekNumber, parseNumber } = ClarityUtils;
  const { euro, num2, int0 } = ClarityFormat;

  // ── Cell Drilldown: which tracking fields map to which event types ──
  const DRILLABLE_FIELDS = {
    'Leads':          ['lead'],
    'Survey':         ['survey', 'surveyQuali'],
    'SurveyQuali':    ['surveyQuali'],
    'SettingBooking': ['settingBooking'],
    'SettingTermin':  ['settingTermin'],
    'SettingCall':    ['settingCall'],
    'ClosingBooking': ['closingBooking'],
    'ClosingTermin':  ['closingTermin'],
    'ClosingCall':    ['closingCall'],
    'Units':          ['unit'],
  };

  const FIELD_LABELS = {
    'Leads': '📩 Leads', 'Survey': '📋 Survey', 'SurveyQuali': '✅ Survey Quali',
    'SettingBooking': '📅 Setting Booking', 'SettingTermin': '🎯 Setting Termin',
    'SettingCall': '📞 Setting Call', 'ClosingBooking': '📅 Closing Booking',
    'ClosingTermin': '🎯 Closing Termin', 'ClosingCall': '📞 Closing Call',
    'Units': '💰 Units',
  };

  // ── CR Drilldown: which CR columns are drillable (both sides have lead-level events) ──
  const DRILLABLE_CR_FIELDS = {
    // VideoCR-%: drillbar nur wenn Funnel einen Lead-Step hat (Indirect).
    // Bei Direct Funnel (Klicks→Survey) finden wir keine lead-Events → zeigen Hinweis.
    'VideoCR-%':     { numerator: ['survey', 'surveyQuali'], denominator: ['lead'],            label: '📉 Verloren · Video-CR' },
    'SurveyQuali-%': { numerator: ['surveyQuali'],   denominator: ['survey', 'surveyQuali'], label: '📉 Verloren · Quali-Rate' },
    'Booking-%':     { numerator: ['closingBooking'], denominator: ['surveyQuali', 'survey'], label: '📉 Verloren · Booking-Rate' },
    'Quali-%':       { numerator: ['closingTermin'],  denominator: ['closingBooking'],        label: '📉 Verloren · Bestätigungs-Rate' },
    'SUR-%':         { numerator: ['closingCall'],    denominator: ['closingTermin'],         label: '📉 Verloren · Show-up-Rate' },
    'SB-%':          { numerator: ['settingBooking'], denominator: ['surveyQuali', 'survey'], label: '📉 Verloren · Setting-Booking' },
    'SQ-%':          { numerator: ['settingTermin'],  denominator: ['settingBooking'],        label: '📉 Verloren · Setting-Quali' },
    'SS-%':          { numerator: ['settingCall'],    denominator: ['settingTermin'],         label: '📉 Verloren · Setting-Show-up' },
    'CB-%':          { numerator: ['closingBooking'], denominator: ['settingCall'],           label: '📉 Verloren · Closing-Booking' },
    'CQ-%':          { numerator: ['closingTermin'],  denominator: ['closingBooking'],        label: '📉 Verloren · Closing-Quali' },
    'CS-%':          { numerator: ['closingCall'],    denominator: ['closingTermin'],         label: '📉 Verloren · Closing-Show-up' },
    'CC%':           { numerator: ['unit'],           denominator: ['closingCall'],           label: '📉 Verloren · Close-Rate' },
    'LC%':           { numerator: ['unit'],           denominator: ['lead', 'survey'],        label: '📉 Verloren · Lead-to-Close' },
  };

  let _drilldownCurrentCell = null;

  function closeDrilldown() {
    const existing = document.getElementById('drilldownPopover');
    if (existing) existing.remove();
    _drilldownCurrentCell = null;
  }

  function positionPopover(popover, td) {
    const rect = td.getBoundingClientRect();
    const popW = 280;
    const margin = 8;

    // Try to place to the right; fall back to left if off-screen
    let left = rect.right + margin;
    if (left + popW > window.innerWidth - 8) {
      left = rect.left - popW - margin;
    }
    let top = rect.top;
    const popH = Math.min(380, window.innerHeight - rect.top - 16);
    if (top + popH > window.innerHeight - 8) {
      top = window.innerHeight - popH - 8;
    }

    popover.style.left  = Math.max(8, left) + 'px';
    popover.style.top   = Math.max(8, top)  + 'px';
  }

  async function showDrilldown(td, fieldName, day, funnelId, year, month) {
    // Toggle: clicking same cell closes the popover
    if (_drilldownCurrentCell === td) {
      closeDrilldown();
      return;
    }
    closeDrilldown();
    _drilldownCurrentCell = td;

    const eventTypes = DRILLABLE_FIELDS[fieldName];
    if (!eventTypes) return;

    const label = FIELD_LABELS[fieldName] || fieldName;
    const dateObj = new Date(year, month, day);
    const dateStr = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const dbDate  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const popover = document.createElement('div');
    popover.className = 'drilldown-popover';
    popover.id = 'drilldownPopover';
    popover.innerHTML = `
      <div class="drilldown-header">
        <span class="drilldown-title">${label} · ${dateStr}</span>
        <button class="drilldown-close" title="Schließen">✕</button>
      </div>
      <div class="drilldown-list"><div class="drilldown-loading">Lade…</div></div>
    `;
    document.body.appendChild(popover);
    positionPopover(popover, td);

    popover.querySelector('.drilldown-close').addEventListener('click', closeDrilldown);

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('mousedown', function outsideClick(e) {
        if (!popover.contains(e.target)) {
          closeDrilldown();
          document.removeEventListener('mousedown', outsideClick);
        }
      });
    }, 0);

    // Close on ESC
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { closeDrilldown(); document.removeEventListener('keydown', escHandler); }
    });

    try {
      const { data: events, error } = await window.SupabaseClient
        .from('events')
        .select('event_date, event_type, revenue, cash, leads!inner(name, primary_email)')
        .eq('funnel_id', funnelId)
        .in('event_type', eventTypes)
        .eq('is_spam', false)
        .gte('event_date', dbDate + 'T00:00:00')
        .lte('event_date', dbDate + 'T23:59:59')
        .order('event_date', { ascending: true });

      if (error) throw error;

      const list = popover.querySelector('.drilldown-list');
      if (!events || events.length === 0) {
        list.innerHTML = '<div class="drilldown-empty">Keine Einträge gefunden</div>';
        return;
      }

      const isUnits = fieldName === 'Units';
      list.innerHTML = events.map(ev => {
        const lead = ev.leads || {};
        const name  = lead.name  || '–';
        const email = lead.primary_email || '–';
        const time  = new Date(ev.event_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const revenueRow = isUnits && (ev.revenue || ev.cash)
          ? `<div class="drilldown-revenue">
               ${ev.revenue ? `Rev: ${euro.format(ev.revenue)}` : ''}
               ${ev.cash    ? ` · Cash: ${euro.format(ev.cash)}` : ''}
             </div>`
          : '';
        return `
          <div class="drilldown-item">
            <div class="drilldown-name">${name}</div>
            <div class="drilldown-time">${time}</div>
            <div class="drilldown-email">${email}</div>
            ${revenueRow}
          </div>`;
      }).join('');

      // Footer with count + copy button
      const footer = document.createElement('div');
      footer.className = 'drilldown-footer';
      footer.innerHTML = `
        <span>${events.length} Einträge</span>
        <button class="drilldown-copy-btn" title="E-Mails kopieren">Copy Emails</button>
      `;
      popover.appendChild(footer);

      footer.querySelector('.drilldown-copy-btn').addEventListener('click', () => {
        const emails = events
          .map(ev => (ev.leads?.primary_email || '').trim())
          .filter(Boolean)
          .join('\n');
        navigator.clipboard.writeText(emails).then(() => {
          const btn = footer.querySelector('.drilldown-copy-btn');
          btn.textContent = '✓ Kopiert!';
          setTimeout(() => { btn.textContent = 'Copy Emails'; }, 2000);
        });
      });

    } catch (err) {
      const list = popover.querySelector('.drilldown-list');
      list.innerHTML = '<div class="drilldown-empty">Fehler beim Laden</div>';
      console.error('❌ Drilldown Fehler:', err);
    }
  }

  // ── CR Drilldown: zeigt Leads die Schritt A hatten aber nicht Schritt B ──
  async function showCRDrilldown(td, crField, day, funnelId, year, month) {
    if (_drilldownCurrentCell === td) { closeDrilldown(); return; }
    closeDrilldown();
    _drilldownCurrentCell = td;

    const crDef = DRILLABLE_CR_FIELDS[crField];
    if (!crDef) return;

    const dbDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateStr = new Date(year, month, day).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const popover = document.createElement('div');
    popover.className = 'drilldown-popover';
    popover.id = 'drilldownPopover';
    popover.innerHTML = `
      <div class="drilldown-header">
        <span class="drilldown-title">${crDef.label} · ${dateStr}</span>
        <button class="drilldown-close" title="Schließen">✕</button>
      </div>
      <div class="drilldown-list"><div class="drilldown-loading">Lade…</div></div>
    `;
    document.body.appendChild(popover);
    positionPopover(popover, td);
    popover.querySelector('.drilldown-close').addEventListener('click', closeDrilldown);

    setTimeout(() => {
      document.addEventListener('mousedown', function outsideClick(e) {
        if (!popover.contains(e.target)) {
          closeDrilldown();
          document.removeEventListener('mousedown', outsideClick);
        }
      });
    }, 0);
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { closeDrilldown(); document.removeEventListener('keydown', escHandler); }
    });

    try {
      // Schritt A: Denominator-Events holen (wer hat den vorherigen Schritt gemacht?)
      const { data: denomEvents, error: denomErr } = await window.SupabaseClient
        .from('events')
        .select('lead_id, event_date, event_type, leads!inner(name, primary_email)')
        .eq('funnel_id', funnelId)
        .in('event_type', crDef.denominator)
        .eq('is_spam', false)
        .gte('event_date', dbDate + 'T00:00:00')
        .lte('event_date', dbDate + 'T23:59:59')
        .order('event_date', { ascending: true });

      if (denomErr) throw denomErr;

      // Schritt B: Numerator-Events holen (wer hat den nächsten Schritt gemacht?)
      const { data: numerEvents, error: numerErr } = await window.SupabaseClient
        .from('events')
        .select('lead_id')
        .eq('funnel_id', funnelId)
        .in('event_type', crDef.numerator)
        .eq('is_spam', false)
        .gte('event_date', dbDate + 'T00:00:00')
        .lte('event_date', dbDate + 'T23:59:59');

      if (numerErr) throw numerErr;

      const numerLeadIds = new Set((numerEvents || []).map(e => e.lead_id));

      // Verloren = hatte Schritt A, aber NICHT Schritt B (pro Lead nur einmal)
      const seenLeads = new Set();
      const lostLeads = (denomEvents || []).filter(ev => {
        if (numerLeadIds.has(ev.lead_id)) return false;
        if (seenLeads.has(ev.lead_id)) return false;
        seenLeads.add(ev.lead_id);
        return true;
      });

      const list = popover.querySelector('.drilldown-list');
      if (!denomEvents || denomEvents.length === 0) {
        list.innerHTML = '<div class="drilldown-empty">Kein vorheriger Schritt mit Lead-Daten in diesem Funnel-Typ</div>';
        const footer = document.createElement('div');
        footer.className = 'drilldown-footer';
        footer.innerHTML = '<span>0 Verloren</span>';
        popover.appendChild(footer);
        return;
      }
      if (lostLeads.length === 0) {
        list.innerHTML = '<div class="drilldown-empty">Alle haben konvertiert 🎉</div>';
      } else {
        list.innerHTML = lostLeads.map(ev => {
          const lead = ev.leads || {};
          const name  = lead.name || '–';
          const email = lead.primary_email || '–';
          const time  = new Date(ev.event_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          return `
            <div class="drilldown-item">
              <div class="drilldown-name">${name}</div>
              <div class="drilldown-time">${time}</div>
              <div class="drilldown-email">${email}</div>
            </div>`;
        }).join('');
      }

      const footer = document.createElement('div');
      footer.className = 'drilldown-footer';
      footer.innerHTML = `
        <span>${lostLeads.length} Verloren</span>
        ${lostLeads.length > 0 ? '<button class="drilldown-copy-btn">Copy Emails</button>' : ''}
      `;
      popover.appendChild(footer);

      if (lostLeads.length > 0) {
        footer.querySelector('.drilldown-copy-btn').addEventListener('click', () => {
          const emails = lostLeads.map(ev => (ev.leads?.primary_email || '').trim()).filter(Boolean).join('\n');
          navigator.clipboard.writeText(emails).then(() => {
            const btn = footer.querySelector('.drilldown-copy-btn');
            btn.textContent = '✓ Kopiert!';
            setTimeout(() => { btn.textContent = 'Copy Emails'; }, 2000);
          });
        });
      }

    } catch (err) {
      const list = popover.querySelector('.drilldown-list');
      list.innerHTML = '<div class="drilldown-empty">Fehler beim Laden</div>';
      console.error('❌ CR-Drilldown Fehler:', err);
    }
  }

  // === Wochen-Buckets (5 Wochen pro Monat) ===
  function getWeekBuckets(y, mIdx) {
    const dim = new Date(y, mIdx + 1, 0).getDate();
    const weeks = [];
    let bucket = [];

    for (let d = 1; d <= dim; d++) {
      const date = new Date(y, mIdx, d);
      const dow = date.getDay() || 7;
      bucket.push(d);
      if (dow === 7) {
        weeks.push(bucket);
        bucket = [];
      }
    }

    if (bucket.length > 0) weeks.push(bucket);
    return weeks.slice(0, 5);
  }

  // === KW-Nummer für eine Woche ===
  function getBucketKw(y, mIdx, bucket) {
    if (!bucket.length) return "—";
    const monday = bucket.find(d => {
      const date = new Date(y, mIdx, d);
      return (date.getDay() || 7) === 1;
    });
    const ref = new Date(y, mIdx, monday || bucket[0]);
    return "KW" + isoWeekNumber(ref);
  }

  // === Hauptfunktion: Monat laden ===
  async function loadMonth(y, mIdx) {
    const app = document.getElementById("app");
    app.innerHTML = "";

    // 🔥 Aktiven Funnel holen
    const activeFunnelId = FunnelAPI.getActiveFunnel();
    const activeFunnel = FunnelAPI.getActiveFunnelData();

    // 🔥 Funnel-Config mit dynamischen Spalten
    const config = FunnelAPI.getFunnelConfig(activeFunnel);
    const ALL_COLUMNS = config.columns;
    const INPUT_KEYS = config.inputs;
    const KPI_COLS = config.kpiCols;

    console.log("📊 Lade Monat:", { funnel: activeFunnel.name, columns: ALL_COLUMNS.length });

    // Tabellen-Container
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    wrap.innerHTML = `
      <div id="zoomArea">
        <table id="tracker">
          <thead>
            <tr>${ALL_COLUMNS.map(c => `<th>${c}</th>`).join("")}</tr>
          </thead>
          <tbody id="table-body"></tbody>
          <tfoot id="tfoot">
            <tr id="summary-head">
              <td rowspan="2" colspan="2" class="total-merged"><strong>TOTAL</strong></td>
              ${ALL_COLUMNS.slice(2).map(c => `<td class="repeat-head">${c}</td>`).join("")}
            </tr>
            <tr id="summary-row">
              ${ALL_COLUMNS.slice(2).map(c => `<td class="calc" data-key="${c}">–</td>`).join("")}
            </tr>
          </tfoot>
        </table>
      </div>
    `;
    app.appendChild(wrap);

    const tbody = document.getElementById("table-body");

    // 🔥 Daten für aktiven Funnel laden (ASYNC!) - FROM SUPABASE
    const saved = await StorageAPI.loadMonthDataFromSupabase(activeFunnelId, y, mIdx);

    // === Tageszeilen bauen ===
    const daysInMonth = new Date(y, mIdx + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(y, mIdx, d);
      const isoShort = dateObj.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit"
      });

      const tr = document.createElement("tr");
      tr.dataset.day = d;

      ALL_COLUMNS.forEach(col => {
        const td = document.createElement("td");

        if (col === "Tag") {
          td.textContent = weekdayLetter(dateObj);
          td.classList.add("weekday");
          if (dateObj.getDay() === 0) td.classList.add("sunday-cell");

          // 🔥 Setup Cell Selection for all cells
          if (window.CellSelection) {
            window.CellSelection.setupCell(td, null);
          }
        }
        else if (col === "Datum") {
          td.innerHTML = `<span class="date">${isoShort}</span>`;

          // 🔥 Setup Cell Selection for all cells
          if (window.CellSelection) {
            window.CellSelection.setupCell(td, null);
          }
        }
        else if (INPUT_KEYS.includes(col)) {
          const input = document.createElement("input");
          input.type = "text";
          input.className = `inp ${col}`;
          input.dataset.key = `${col}_${d}`;

          const val = saved[input.dataset.key];
          if (typeof val === "number") {
            input.value = ["Adspend", "Revenue", "Cash"].includes(col)
              ? euro.format(val)
              : int0.format(val);
          }

          // 🔥 FOCUS: Zeige rohen Wert (nur Zahlen)
          input.addEventListener("focus", async e => {
            const key = e.target.dataset.key;
            const data = await StorageAPI.loadMonthDataFromSupabase(activeFunnelId, y, mIdx);
            const rawValue = data[key];

            if (typeof rawValue === "number") {
              e.target.value = rawValue.toString().replace(".", ",");
            }
          });

          // 🔥 BLUR: Formatiere und speichere (GRANULAR SUPABASE)
          input.addEventListener("blur", async (e) => {
            const key = e.target.dataset.key;
            const inputValue = e.target.value.trim();
            const day = parseInt(key.split("_")[1]);
            const fieldName = key.split("_")[0];

            if (inputValue === "") {
              e.target.value = "";
              // Delete einzelnes Feld in Supabase (value = null löscht)
              await StorageAPI.saveFieldToSupabase(activeFunnelId, y, mIdx, day, fieldName, null);
              await calcAllRows(y, mIdx, ALL_COLUMNS, INPUT_KEYS, KPI_COLS, activeFunnelId);
              return;
            }

            const num = parseNumber(inputValue);

            if (isNaN(num)) {
              e.target.value = "";
              return;
            }

            // Speichere einzelnes Feld granular in Supabase
            await StorageAPI.saveFieldToSupabase(activeFunnelId, y, mIdx, day, fieldName, num);

            e.target.value = ["Adspend", "Revenue", "Cash"].includes(col)
              ? euro.format(num)
              : int0.format(num);

            await calcAllRows(y, mIdx, ALL_COLUMNS, INPUT_KEYS, KPI_COLS, activeFunnelId);
          });

          // 🔥 INPUT: Live-Update (während Tippen) - GRANULAR SUPABASE
          let inputTimeout;
          input.addEventListener("input", (e) => {
            clearTimeout(inputTimeout);

            inputTimeout = setTimeout(async () => {
              const key = e.target.dataset.key;
              const inputValue = e.target.value.trim();
              const day = parseInt(key.split("_")[1]);
              const fieldName = key.split("_")[0];

              if (inputValue === "") {
                // Delete einzelnes Feld in Supabase
                await StorageAPI.saveFieldToSupabase(activeFunnelId, y, mIdx, day, fieldName, null);
                await calcAllRows(y, mIdx, ALL_COLUMNS, INPUT_KEYS, KPI_COLS, activeFunnelId);
                return;
              }

              const num = parseNumber(inputValue);

              if (!isNaN(num)) {
                // Speichere einzelnes Feld granular in Supabase
                await StorageAPI.saveFieldToSupabase(activeFunnelId, y, mIdx, day, fieldName, num);
                await calcAllRows(y, mIdx, ALL_COLUMNS, INPUT_KEYS, KPI_COLS, activeFunnelId);
              }
            }, 300);
          });

          td.appendChild(input);

          // 🔥 Drilldown: intercept click on drillable fields with value > 0
          if (DRILLABLE_FIELDS[col]) {
            td.classList.add('drillable-cell');
            // 🔒 Gesperrt: Doppelklick auf td öffnet Drilldown
            td.addEventListener('dblclick', (e) => {
              const isLocked = document.getElementById('tracker')?.classList.contains('tracking-locked');
              if (!isLocked) return;
              const raw = saved[input.dataset.key];
              if (!raw || raw <= 0) return;
              showDrilldown(td, col, d, activeFunnelId, y, mIdx);
            });

            // 🔓 Entsperrt: Mousedown auf Input öffnet Drilldown
            td.addEventListener('mousedown', (e) => {
              const isLocked = document.getElementById('tracker')?.classList.contains('tracking-locked');
              if (isLocked) return;
              if (e.target !== input) return;
              const raw = saved[input.dataset.key];
              if (!raw || raw <= 0) return;
              e.preventDefault();
              showDrilldown(td, col, d, activeFunnelId, y, mIdx);
            });
          }

          // 🔥 Setup Cell Selection (Google Sheets behavior)
          if (window.CellSelection) {
            window.CellSelection.setupCell(td, input);
          }
        }
        else {
          td.textContent = "–";
          td.classList.add("calc");
          td.dataset.key = `${col}_${d}`;

          // 📉 CR-Drilldown: Doppelklick zeigt verlorene Leads
          if (DRILLABLE_CR_FIELDS[col]) {
            td.classList.add('drillable-cr-cell');
            td.addEventListener('dblclick', () => {
              if (td.textContent === '–') return;
              showCRDrilldown(td, col, d, activeFunnelId, y, mIdx);
            });
          }

          // 🔥 Setup Cell Selection for KPI cells
          if (window.CellSelection) {
            window.CellSelection.setupCell(td, null);
          }
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }

    addWeeklySection(ALL_COLUMNS, INPUT_KEYS, KPI_COLS);

    // Store params for recalculation (needed for Copy/Paste)
    setCurrentMonthParams(y, mIdx, ALL_COLUMNS, INPUT_KEYS, KPI_COLS, activeFunnelId);

    await calcAllRows(y, mIdx, ALL_COLUMNS, INPUT_KEYS, KPI_COLS, activeFunnelId);

    // 🔥 Setup Cell Selection for all remaining cells (thead, tfoot)
    setupRemainingCells();

    // Zoom initialisieren
    if (typeof window.globalZoomInit === "function") {
      window.globalZoomInit();
    }

    // 🔒 Lock-State nach jedem Render neu anwenden
    if (typeof window.applyLockState === 'function') {
      const isLocked = localStorage.getItem('clarity_tracking_locked') !== 'false';
      window.applyLockState(isLocked);
    }

    function setupRemainingCells() {
      if (!window.CellSelection) return;

      // Header cells (thead)
      const headerCells = document.querySelectorAll('#tracker thead th');
      headerCells.forEach(th => {
        if (window.CellSelection.isSelectableCell(th)) {
          window.CellSelection.setupCell(th, null);
        }
      });

      // Total row cells (tfoot)
      const totalCells = document.querySelectorAll('#tracker tfoot td');
      totalCells.forEach(td => {
        if (window.CellSelection.isSelectableCell(td)) {
          window.CellSelection.setupCell(td, null);
        }
      });
    }

    function addWeeklySection(ALL_COLUMNS, INPUT_KEYS, KPI_COLS) {
      const table = document.getElementById("tracker");

      const spacer = document.createElement("tr");
      spacer.innerHTML = `<td colspan="${ALL_COLUMNS.length}" style="background:var(--bg);height:10px;border:none;"></td>`;
      table.tFoot.appendChild(spacer);

      const header = document.createElement("tr");
      header.id = "weekly-header";

      ALL_COLUMNS.forEach((col, i) => {
        const td = document.createElement("td");

        if (i === 0) {
          td.colSpan = 2;
          td.textContent = "WEEKLY";
          td.style.cssText = "background:#333;color:#fff;text-align:center;font-weight:700;border:1px solid #444;";
          header.appendChild(td);
          return;
        }

        if (i === 1) return;

        td.textContent = col;
        td.style.cssText = "background:#333;color:#fff;text-align:center;font-weight:600;border:1px solid #444;";
        header.appendChild(td);
      });

      table.tFoot.appendChild(header);

      for (let w = 1; w <= 5; w++) {
        const tr = document.createElement("tr");
        tr.dataset.week = w;

        ALL_COLUMNS.forEach((col, i) => {
          const td = document.createElement("td");

          if (i === 0) {
            td.textContent = w;
            td.style.textAlign = "center";
          } else if (i === 1) {
            td.dataset.kw = "true";
            td.textContent = "–";
            td.style.textAlign = "center";
          } else {
            td.textContent = "–";
            td.dataset.key = `${col}_W${w}`;

            if (KPI_COLS.includes(col)) {
              td.classList.add("calc");
            }
          }

          td.style.fontWeight = "400";
          tr.appendChild(td);
        });

        table.tFoot.appendChild(tr);
      }
    }

    async function calcAllRows(y, mIdx, ALL_COLUMNS, INPUT_KEYS, KPI_COLS, activeFunnelId) {
      const data = await StorageAPI.loadMonthDataFromSupabase(activeFunnelId, y, mIdx);

      tbody.querySelectorAll("tr").forEach(row => {
        const d = row.dataset.day;
        if (!d) return;

        const get = k => parseFloat(data[`${k}_${d}`]) || 0;

        const vals = calculateKPIs({
          adspend: get("Adspend"),
          impr: get("Impr"),
          clicks: get("Clicks"),
          leads: get("Leads"),
          survey: get("Survey"),
          surveyQuali: get("SurveyQuali"),
          units: get("Units"),
          revenue: get("Revenue"),
          cash: get("Cash"),
          // 🔥 Cold Email
          emailsSent: get("Emails Sent"),
          opened: get("Opened"),
          // 🔥 Cold Calls
          callsDialed: get("Calls Dialed"),
          reached: get("Reached"),
          // 🔥 1-Call & 2-Call Close (NEUE NAMEN!)
          closingBooking: get("ClosingBooking"),
          closingTermin: get("ClosingTermin"),
          closingCall: get("ClosingCall"),
          settingBooking: get("SettingBooking"),
          settingTermin: get("SettingTermin"),
          settingCall: get("SettingCall")
        });

        for (const [k, v] of Object.entries(vals)) {
          const cell = row.querySelector(`[data-key="${k}_${d}"]`);
          if (cell) cell.textContent = formatValue(v, k);
        }
      });

      updateSummary(data, ALL_COLUMNS, INPUT_KEYS, daysInMonth);
      updateWeekly(data, ALL_COLUMNS, INPUT_KEYS, KPI_COLS);
    }

    function updateSummary(data, ALL_COLUMNS, INPUT_KEYS, daysInMonth) {
      const row = document.getElementById("summary-row");
      if (!row) return;

      const totals = {};
      INPUT_KEYS.forEach(k => (totals[k] = 0));

      for (let d = 1; d <= daysInMonth; d++) {
        INPUT_KEYS.forEach(k => {
          const v = data[`${k}_${d}`];
          if (typeof v === "number" && !isNaN(v)) totals[k] += v;
        });
      }

      const setSum = (key, val, isEuro = false) => {
        const cell = row.querySelector(`[data-key="${key}"]`);
        if (!cell) return;
        if (!val || isNaN(val)) {
          cell.textContent = "–";
          return;
        }
        cell.textContent = isEuro ? euro.format(val) : int0.format(val);
      };

      INPUT_KEYS.forEach(k =>
        setSum(k, totals[k], ["Adspend", "Revenue", "Cash"].includes(k))
      );

      // 🔥 Hilfsfunktion zum sicheren Abrufen
      const getTotal = (key) => totals[key] || 0;

      const calc = calculateKPIs({
        adspend: getTotal("Adspend"),
        impr: getTotal("Impr"),
        clicks: getTotal("Clicks"),
        leads: getTotal("Leads"),
        survey: getTotal("Survey"),
        surveyQuali: getTotal("SurveyQuali"),
        units: getTotal("Units"),
        revenue: getTotal("Revenue"),
        cash: getTotal("Cash"),
        emailsSent: getTotal("Emails Sent"),
        opened: getTotal("Opened"),
        callsDialed: getTotal("Calls Dialed"),
        reached: getTotal("Reached"),
        closingBooking: getTotal("ClosingBooking"),
        closingTermin: getTotal("ClosingTermin"),
        closingCall: getTotal("ClosingCall"),
        settingBooking: getTotal("SettingBooking"),
        settingTermin: getTotal("SettingTermin"),
        settingCall: getTotal("SettingCall")
      });

      for (const [k, v] of Object.entries(calc)) {
        const c = row.querySelector(`[data-key="${k}"]`);
        if (c) c.textContent = formatValue(v, k);
      }
    }

    function updateWeekly(data, ALL_COLUMNS, INPUT_KEYS, KPI_COLS) {
      const table = document.getElementById("tracker");
      const weeks = getWeekBuckets(y, mIdx);

      weeks.forEach((bucket, i) => {
        const w = i + 1;
        const r = table.querySelector(`tr[data-week="${w}"]`);
        if (!r) return;

        const kwCell = r.querySelector("td[data-kw]");
        if (kwCell) kwCell.textContent = bucket.length ? getBucketKw(y, mIdx, bucket) : "—";

        const totals = {};
        INPUT_KEYS.forEach(k => (totals[k] = 0));

        bucket.forEach(d => {
          INPUT_KEYS.forEach(k => {
            const v = data[`${k}_${d}`];
            if (typeof v === "number" && !isNaN(v)) totals[k] += v;
          });
        });

        INPUT_KEYS.forEach(k => {
          const c = r.querySelector(`[data-key="${k}_W${w}"]`);
          if (!c) return;
          const val = totals[k];
          c.textContent = !val || isNaN(val)
            ? "–"
            : (["Adspend", "Revenue", "Cash"].includes(k) ? euro.format(val) : int0.format(val));
        });

        // 🔥 Hilfsfunktion zum sicheren Abrufen
        const getTotal = (key) => totals[key] || 0;

        const calc = calculateKPIs({
          adspend: getTotal("Adspend"),
          impr: getTotal("Impr"),
          clicks: getTotal("Clicks"),
          leads: getTotal("Leads"),
          survey: getTotal("Survey"),
          surveyQuali: getTotal("SurveyQuali"),
          units: getTotal("Units"),
          revenue: getTotal("Revenue"),
          cash: getTotal("Cash"),
          emailsSent: getTotal("Emails Sent"),
          opened: getTotal("Opened"),
          callsDialed: getTotal("Calls Dialed"),
          reached: getTotal("Reached"),
          closingBooking: getTotal("ClosingBooking"),
          closingTermin: getTotal("ClosingTermin"),
          closingCall: getTotal("ClosingCall"),
          settingBooking: getTotal("SettingBooking"),
          settingTermin: getTotal("SettingTermin"),
          settingCall: getTotal("SettingCall")
        });

        KPI_COLS.forEach(k => {
          const c = r.querySelector(`[data-key="${k}_W${w}"]`);
          if (c) c.textContent = formatValue(calc[k], k);
        });
      });
    }
  }


  // === Export recalculate function for Copy/Paste ===
  let currentMonthParams = null;

  function setCurrentMonthParams(y, mIdx, cols, inputs, kpis, funnelId) {
    currentMonthParams = { y, mIdx, cols, inputs, kpis, funnelId };
  }

  async function recalculate() {
    if (!currentMonthParams) return;
    const { y, mIdx, cols, inputs, kpis, funnelId } = currentMonthParams;
    await calcAllRows(y, mIdx, cols, inputs, kpis, funnelId);
  }

  // Store params when loading month
  function loadMonthWrapper(y, mIdx) {
    loadMonth(y, mIdx);
  }

  window.MonthView = {
    loadMonth: loadMonthWrapper,
    recalculate
  };
})(window);