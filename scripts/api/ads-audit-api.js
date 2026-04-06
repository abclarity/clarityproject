(function(window) {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────

  const STORAGE_COLUMNS_KEY  = 'clarity_ads_audit_columns';
  const STORAGE_DATE_KEY     = 'clarity_ads_audit_date_range';

  const ALL_COLUMNS = [
    { key: 'adspend',           label: 'Adspend',            format: 'currency' },
    { key: 'impressions',       label: 'Impressionen',       format: 'number'   },
    { key: 'reach',             label: 'Reach',              format: 'number'   },
    { key: 'clicks',            label: 'Klicks',             format: 'number'   },
    { key: 'ctr',               label: 'CTR',                format: 'percent'  },
    { key: 'cpc',               label: 'CPC',                format: 'currency' },
    { key: 'leads',             label: 'Leads',              format: 'number'   },
    { key: 'cpl',               label: 'CPL',                format: 'currency' },
    { key: 'surveys',           label: 'Surveys',            format: 'number'   },
    { key: 'cost_survey',       label: 'Cost/Survey',        format: 'currency' },
    { key: 'survey_quali',      label: 'Survey Quali',       format: 'number'   },
    { key: 'cost_survey_quali', label: 'Cost/SurveyQuali',   format: 'currency' },
    { key: 'setting_bookings',  label: 'Setting Bookings',   format: 'number'   },
    { key: 'cost_setting_bk',   label: 'Cost/Setting Bk.',   format: 'currency' },
    { key: 'setting_calls',     label: 'Setting Calls',      format: 'number'   },
    { key: 'cost_setting_call', label: 'Cost/Setting Call',  format: 'currency' },
    { key: 'closing_bookings',  label: 'Closing Bookings',   format: 'number'   },
    { key: 'cost_closing_bk',   label: 'Cost/Closing Bk.',   format: 'currency' },
    { key: 'closing_calls',     label: 'Closing Calls',      format: 'number'   },
    { key: 'cost_closing_call', label: 'Cost/Closing Call',  format: 'currency' },
    { key: 'sales',             label: 'Sales',              format: 'number'   },
    { key: 'cpa',               label: 'CPA',                format: 'currency' },
    { key: 'revenue',           label: 'Revenue',            format: 'currency' },
    { key: 'cash',              label: 'Cash',               format: 'currency' },
    { key: 'roas',              label: 'ROAS',               format: 'x'        },
  ];

  const DEFAULT_COLUMNS = [
    'adspend', 'leads', 'cpl',
    'closing_calls', 'cost_closing_call',
    'sales', 'cpa', 'revenue', 'cash', 'roas',
  ];

  // ── State ──────────────────────────────────────────────────────────────────

  let _container     = null;
  let _trafficData   = [];
  let _leads         = [];
  let _events        = [];
  let _currentView   = 'campaigns';   // 'campaigns' | 'adsets' | 'ads'
  let _campaignId    = null;
  let _campaignName  = '';
  let _adsetId       = null;
  let _adsetName     = '';
  let _dateRange     = loadPref(STORAGE_DATE_KEY, '30');
  let _visibleCols   = loadPref(STORAGE_COLUMNS_KEY, null) || [...DEFAULT_COLUMNS];

  // ── Persistence ────────────────────────────────────────────────────────────

  function loadPref(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch(e) { return fallback; }
  }

  function savePref(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  function fmtCurrency(v) {
    if (!v || isNaN(v)) return '<span class="audit-zero">—</span>';
    return '€\u202f' + v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtNumber(v) {
    if (v === undefined || v === null || isNaN(v) || v === 0) return '<span class="audit-zero">—</span>';
    return v.toLocaleString('de-DE');
  }

  function fmtPercent(v) {
    if (!v || isNaN(v)) return '<span class="audit-zero">—</span>';
    return v.toFixed(2) + '%';
  }

  function fmtX(v) {
    if (!v || isNaN(v)) return '<span class="audit-zero">—</span>';
    return v.toFixed(2) + 'x';
  }

  function fmtValue(key, value) {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (!col) return value;
    if (col.format === 'currency') return fmtCurrency(value);
    if (col.format === 'number')   return fmtNumber(value);
    if (col.format === 'percent')  return fmtPercent(value);
    if (col.format === 'x')        return fmtX(value);
    return value;
  }

  // ── Date helpers ───────────────────────────────────────────────────────────

  function getDateRange() {
    const end   = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(_dateRange, 10));
    return { start, end };
  }

  function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function fetchData() {
    if (!window.SupabaseClient) {
      console.error('❌ Ads Audit: Supabase Client nicht verfügbar');
      return false;
    }

    const { start, end } = getDateRange();

    try {
      // 1. Traffic metrics (all levels, facebook only)
      const { data: traffic, error: e1 } = await window.SupabaseClient
        .from('traffic_metrics')
        .select('campaign_id, campaign_name, ad_set_id, ad_set_name, ad_id, ad_name, adspend, impressions, reach, clicks, date, level')
        .eq('source', 'facebook-ads')
        .gte('date', fmtDate(start))
        .lte('date', fmtDate(end));

      if (e1) throw e1;
      _trafficData = traffic || [];

      // 2. Leads created in date range (only UTM fields needed)
      const { data: leads, error: e2 } = await window.SupabaseClient
        .from('leads')
        .select('id, utm_campaign, utm_content, utm_term, h_ad_id')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (e2) throw e2;
      _leads = leads || [];

      // 3. Events for those leads
      if (_leads.length > 0) {
        const leadIds = _leads.map(l => l.id);
        const { data: events, error: e3 } = await window.SupabaseClient
          .from('events')
          .select('lead_id, event_type, revenue, cash')
          .in('lead_id', leadIds)
          .eq('is_spam', false);

        if (e3) throw e3;
        _events = events || [];
      } else {
        _events = [];
      }

      return true;
    } catch (err) {
      console.error('❌ Ads Audit: Fehler beim Laden:', err);
      return false;
    }
  }

  // ── Data join & aggregation ────────────────────────────────────────────────

  function buildEventsByLead() {
    const map = {};
    _events.forEach(ev => {
      if (!map[ev.lead_id]) {
        map[ev.lead_id] = {
          survey: 0, surveyQuali: 0,
          settingBooking: 0, settingCall: 0,
          closingBooking: 0, closingCall: 0,
          unit: 0, revenue: 0, cash: 0,
        };
      }
      const b = map[ev.lead_id];
      if (ev.event_type in b) b[ev.event_type]++;
      if (ev.event_type === 'unit') {
        b.revenue += ev.revenue || 0;
        b.cash    += ev.cash    || 0;
      }
    });
    return map;
  }

  function aggregateSpend(trafficRows, groupKey) {
    const result = {};
    trafficRows.forEach(r => {
      const key = r[groupKey] || 'unknown';
      if (!result[key]) {
        result[key] = {
          adspend: 0, impressions: 0, reach: 0, clicks: 0,
          campaign_id: r.campaign_id, campaign_name: r.campaign_name,
          ad_set_id:   r.ad_set_id,   ad_set_name:   r.ad_set_name,
          ad_id:       r.ad_id,       ad_name:       r.ad_name,
        };
      }
      result[key].adspend     += r.adspend     || 0;
      result[key].impressions += r.impressions || 0;
      result[key].reach        = Math.max(result[key].reach, r.reach || 0);
      result[key].clicks      += r.clicks      || 0;
    });
    return result;
  }

  function computeMetrics(base) {
    const r = { ...base };
    r.ctr               = (r.clicks && r.impressions) ? (r.clicks / r.impressions * 100) : 0;
    r.cpc               = r.clicks            ? r.adspend / r.clicks            : 0;
    r.cpl               = r.leads             ? r.adspend / r.leads             : 0;
    r.cost_survey       = r.surveys           ? r.adspend / r.surveys           : 0;
    r.cost_survey_quali = r.survey_quali      ? r.adspend / r.survey_quali      : 0;
    r.cost_setting_bk   = r.setting_bookings  ? r.adspend / r.setting_bookings  : 0;
    r.cost_setting_call = r.setting_calls     ? r.adspend / r.setting_calls     : 0;
    r.cost_closing_bk   = r.closing_bookings  ? r.adspend / r.closing_bookings  : 0;
    r.cost_closing_call = r.closing_calls     ? r.adspend / r.closing_calls     : 0;
    r.cpa               = r.sales             ? r.adspend / r.sales             : 0;
    r.roas              = r.adspend           ? r.revenue  / r.adspend          : 0;
    return r;
  }

  function aggregateLeadEvents(leads, eventsByLead) {
    const agg = {
      survey: 0, surveyQuali: 0,
      settingBooking: 0, settingCall: 0,
      closingBooking: 0, closingCall: 0,
      unit: 0, revenue: 0, cash: 0,
    };
    leads.forEach(lead => {
      const ev = eventsByLead[lead.id] || {};
      agg.survey         += ev.survey         || 0;
      agg.surveyQuali    += ev.surveyQuali    || 0;
      agg.settingBooking += ev.settingBooking || 0;
      agg.settingCall    += ev.settingCall    || 0;
      agg.closingBooking += ev.closingBooking || 0;
      agg.closingCall    += ev.closingCall    || 0;
      agg.unit           += ev.unit           || 0;
      agg.revenue        += ev.revenue        || 0;
      agg.cash           += ev.cash           || 0;
    });
    return agg;
  }

  function buildRow(id, name, spend, leads, eventsByLead) {
    const agg = aggregateLeadEvents(leads, eventsByLead);
    return computeMetrics({
      id,
      name,
      is_unknown:       id === 'unknown',
      adspend:          spend.adspend     || 0,
      impressions:      spend.impressions || 0,
      reach:            spend.reach       || 0,
      clicks:           spend.clicks      || 0,
      leads:            leads.length,
      surveys:          agg.survey,
      survey_quali:     agg.surveyQuali,
      setting_bookings: agg.settingBooking,
      setting_calls:    agg.settingCall,
      closing_bookings: agg.closingBooking,
      closing_calls:    agg.closingCall,
      sales:            agg.unit,
      revenue:          agg.revenue,
      cash:             agg.cash,
    });
  }

  function sortRows(rows) {
    return rows.sort((a, b) => {
      if (a.is_unknown && !b.is_unknown) return 1;
      if (!a.is_unknown && b.is_unknown) return -1;
      return (b.adspend || 0) - (a.adspend || 0);
    });
  }

  function buildCampaignRows() {
    const eventsByLead = buildEventsByLead();

    // Prefer campaign-level rows; fall back to ad-level
    let trafficRows = _trafficData.filter(r => r.level === 'campaign');
    if (!trafficRows.length) trafficRows = _trafficData.filter(r => r.level === 'ad');
    const spendMap = aggregateSpend(trafficRows, 'campaign_id');

    const leadsByCampaign = {};
    _leads.forEach(lead => {
      const cid = lead.utm_campaign || 'unknown';
      if (!leadsByCampaign[cid]) leadsByCampaign[cid] = [];
      leadsByCampaign[cid].push(lead);
    });

    const allIds = new Set([...Object.keys(spendMap), ...Object.keys(leadsByCampaign)]);
    const rows = [];
    allIds.forEach(cid => {
      const spend = spendMap[cid] || {};
      const leads = leadsByCampaign[cid] || [];
      const name  = cid === 'unknown' ? 'Unbekannt / Nicht attributiert' : (spend.campaign_name || cid);
      rows.push(buildRow(cid, name, spend, leads, eventsByLead));
    });
    return sortRows(rows);
  }

  function buildAdsetRows(campaignId) {
    const eventsByLead = buildEventsByLead();

    let trafficRows = _trafficData.filter(r => r.campaign_id === campaignId && r.level === 'ad_set');
    if (!trafficRows.length) trafficRows = _trafficData.filter(r => r.campaign_id === campaignId && r.level === 'ad');
    const spendMap = aggregateSpend(trafficRows, 'ad_set_id');

    const campaignLeads = _leads.filter(l => l.utm_campaign === campaignId);
    const leadsByAdset = {};
    campaignLeads.forEach(lead => {
      const aid = lead.utm_content || 'unknown';
      if (!leadsByAdset[aid]) leadsByAdset[aid] = [];
      leadsByAdset[aid].push(lead);
    });

    const allIds = new Set([...Object.keys(spendMap), ...Object.keys(leadsByAdset)]);
    const rows = [];
    allIds.forEach(aid => {
      const spend = spendMap[aid] || {};
      const leads = leadsByAdset[aid] || [];
      const name  = aid === 'unknown' ? 'Unbekannt' : (spend.ad_set_name || aid);
      rows.push(buildRow(aid, name, spend, leads, eventsByLead));
    });
    return sortRows(rows);
  }

  function buildAdRows(adsetId, campaignId) {
    const eventsByLead = buildEventsByLead();

    const trafficRows = _trafficData.filter(r => r.ad_set_id === adsetId && r.level === 'ad');
    const spendMap = aggregateSpend(trafficRows, 'ad_id');

    const adsetLeads = _leads.filter(l => l.utm_content === adsetId);
    const leadsByAd = {};
    adsetLeads.forEach(lead => {
      const adId = lead.utm_term || lead.h_ad_id || 'unknown';
      if (!leadsByAd[adId]) leadsByAd[adId] = [];
      leadsByAd[adId].push(lead);
    });

    const allIds = new Set([...Object.keys(spendMap), ...Object.keys(leadsByAd)]);
    const rows = [];
    allIds.forEach(adId => {
      const spend = spendMap[adId] || {};
      const leads = leadsByAd[adId] || [];
      const name  = adId === 'unknown' ? 'Unbekannt' : (spend.ad_name || adId);
      rows.push(buildRow(adId, name, spend, leads, eventsByLead));
    });
    return sortRows(rows);
  }

  // ── HTML rendering ─────────────────────────────────────────────────────────

  function renderControls() {
    return `
      <div class="audit-controls">
        <div class="audit-controls-left">
          <select id="auditDateRange" class="audit-select">
            <option value="7"   ${_dateRange === '7'   ? 'selected' : ''}>Letzte 7 Tage</option>
            <option value="30"  ${_dateRange === '30'  ? 'selected' : ''}>Letzte 30 Tage</option>
            <option value="90"  ${_dateRange === '90'  ? 'selected' : ''}>Letzte 90 Tage</option>
            <option value="365" ${_dateRange === '365' ? 'selected' : ''}>Letztes Jahr</option>
          </select>
        </div>
        <button id="auditColumnBtn" class="audit-col-btn">⚙ Spalten anpassen</button>
      </div>
    `;
  }

  function renderBreadcrumb() {
    if (_currentView === 'campaigns') return '';
    let html = `<div class="audit-breadcrumb">`;
    html += `<button class="audit-crumb" data-nav="campaigns">Kampagnen</button>`;
    if (_currentView === 'adsets') {
      html += `<span class="audit-crumb-sep">›</span><span class="audit-crumb audit-crumb--active">${_campaignName}</span>`;
    } else if (_currentView === 'ads') {
      html += `<span class="audit-crumb-sep">›</span><button class="audit-crumb" data-nav="adsets">${_campaignName}</button>`;
      html += `<span class="audit-crumb-sep">›</span><span class="audit-crumb audit-crumb--active">${_adsetName}</span>`;
    }
    html += `</div>`;
    return html;
  }

  function renderTable(rows, drillable) {
    if (!rows.length) {
      return `<div class="audit-empty">Keine Daten für diesen Zeitraum gefunden.<br><small>Stelle sicher dass Facebook Ads synchronisiert sind und Leads mit UTM-Parametern vorhanden sind.</small></div>`;
    }

    const cols = _visibleCols
      .map(key => ALL_COLUMNS.find(c => c.key === key))
      .filter(Boolean);

    const headerCells = cols.map(c => `<th>${c.label}</th>`).join('');

    const bodyRows = rows.map(row => {
      const cells  = cols.map(c => `<td>${fmtValue(c.key, row[c.key])}</td>`).join('');
      const cls    = row.is_unknown ? 'audit-row audit-row--unknown' : (drillable ? 'audit-row audit-row--drillable' : 'audit-row');
      const drillBtn = (drillable && !row.is_unknown)
        ? `<button class="audit-drill-btn" title="Details anzeigen">›</button>`
        : '';
      const safeId   = (row.id   || '').replace(/"/g, '&quot;');
      const safeName = (row.name || '').replace(/"/g, '&quot;');
      return `<tr class="${cls}" data-id="${safeId}" data-name="${safeName}">
        <td class="audit-name-cell">${drillBtn}<span>${row.name}</span></td>
        ${cells}
      </tr>`;
    }).join('');

    return `
      <div class="audit-table-wrap">
        <table class="audit-table">
          <thead><tr><th>Name</th>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    `;
  }

  function renderColumnPickerModal() {
    const items = ALL_COLUMNS.map(col => {
      const checked = _visibleCols.includes(col.key);
      return `
        <div class="col-picker-item" draggable="true" data-key="${col.key}">
          <span class="col-picker-drag" aria-hidden="true">⠿</span>
          <label class="col-picker-label">
            <input type="checkbox" class="col-picker-check" value="${col.key}" ${checked ? 'checked' : ''} />
            ${col.label}
          </label>
        </div>
      `;
    }).join('');

    return `
      <div id="auditColumnModal" class="col-picker-overlay hidden">
        <div class="col-picker-modal">
          <div class="col-picker-header">
            <h3>Spalten anpassen</h3>
            <button id="colPickerClose" class="col-picker-close" aria-label="Schließen">✕</button>
          </div>
          <p class="col-picker-hint">Spalten per Häkchen aktivieren und per Drag & Drop sortieren.</p>
          <div class="col-picker-list" id="colPickerList">${items}</div>
          <div class="col-picker-footer">
            <button id="colPickerReset" class="audit-btn-secondary">Standard</button>
            <button id="colPickerApply" class="audit-btn-primary">Anwenden</button>
          </div>
        </div>
      </div>
    `;
  }

  function getRows() {
    if (_currentView === 'campaigns') return buildCampaignRows();
    if (_currentView === 'adsets')   return buildAdsetRows(_campaignId);
    return buildAdRows(_adsetId, _campaignId);
  }

  function paint() {
    if (!_container) return;
    const drillable = _currentView !== 'ads';
    const rows = getRows();

    _container.innerHTML = `
      <div class="audit-view">
        <div class="audit-page-header">
          <button class="audit-back-btn" id="auditBackBtn">← Scale It</button>
          <div>
            <h2 class="audit-title">Ads Audit</h2>
            <p class="audit-subtitle">Attribution: Last Click (Lead-Datum) · Facebook Ads</p>
          </div>
        </div>
        ${renderControls()}
        ${renderBreadcrumb()}
        ${renderTable(rows, drillable)}
      </div>
      ${renderColumnPickerModal()}
    `;

    attachListeners();
  }

  // ── Event listeners ────────────────────────────────────────────────────────

  function attachListeners() {
    // Back button → restore ScaleView
    const backBtn = document.getElementById('auditBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (window.ScaleView) window.ScaleView.render('ads', _container);
      });
    }

    // Date range
    const sel = document.getElementById('auditDateRange');
    if (sel) {
      sel.addEventListener('change', async (e) => {
        _dateRange = e.target.value;
        savePref(STORAGE_DATE_KEY, _dateRange);
        showSpinner();
        await fetchData();
        paint();
      });
    }

    // Column picker open
    const colBtn = document.getElementById('auditColumnBtn');
    if (colBtn) colBtn.addEventListener('click', () => {
      const m = document.getElementById('auditColumnModal');
      if (m) m.classList.remove('hidden');
    });

    // Table: drill-down via row click
    const tbody = _container.querySelector('.audit-table tbody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const row = e.target.closest('.audit-row--drillable');
        if (!row) return;
        const id   = row.dataset.id;
        const name = row.dataset.name;
        if (_currentView === 'campaigns') {
          _campaignId   = id;
          _campaignName = name;
          _currentView  = 'adsets';
        } else if (_currentView === 'adsets') {
          _adsetId      = id;
          _adsetName    = name;
          _currentView  = 'ads';
        }
        paint();
      });
    }

    // Breadcrumb navigation
    const crumb = _container.querySelector('.audit-breadcrumb');
    if (crumb) {
      crumb.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-nav]');
        if (!btn) return;
        if (btn.dataset.nav === 'campaigns') {
          _currentView = 'campaigns';
          _campaignId  = null; _campaignName = '';
          _adsetId     = null; _adsetName    = '';
        } else if (btn.dataset.nav === 'adsets') {
          _currentView = 'adsets';
          _adsetId     = null; _adsetName = '';
        }
        paint();
      });
    }

    attachColumnPickerListeners();
  }

  function attachColumnPickerListeners() {
    const modal   = document.getElementById('auditColumnModal');
    const list    = document.getElementById('colPickerList');
    if (!modal || !list) return;

    // Close
    document.getElementById('colPickerClose').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

    // Reset
    document.getElementById('colPickerReset').addEventListener('click', () => {
      // Re-order list items to default order and reset checks
      const defaultSet = new Set(DEFAULT_COLUMNS);
      // Sort DOM items to default order
      const allItems = Array.from(list.querySelectorAll('.col-picker-item'));
      const ordered = DEFAULT_COLUMNS.map(k => allItems.find(el => el.dataset.key === k)).filter(Boolean);
      const rest    = allItems.filter(el => !defaultSet.has(el.dataset.key));
      [...ordered, ...rest].forEach(el => list.appendChild(el));
      list.querySelectorAll('.col-picker-check').forEach(cb => {
        cb.checked = defaultSet.has(cb.value);
      });
    });

    // Apply
    document.getElementById('colPickerApply').addEventListener('click', () => {
      const checked = [];
      list.querySelectorAll('.col-picker-item').forEach(item => {
        const cb = item.querySelector('.col-picker-check');
        if (cb && cb.checked) checked.push(item.dataset.key);
      });
      _visibleCols = checked.length ? checked : [...DEFAULT_COLUMNS];
      savePref(STORAGE_COLUMNS_KEY, _visibleCols);
      modal.classList.add('hidden');
      paint();
    });

    // Drag & Drop reorder
    let dragEl = null;

    list.addEventListener('dragstart', (e) => {
      dragEl = e.target.closest('.col-picker-item');
      if (dragEl) {
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => dragEl && dragEl.classList.add('dragging'), 0);
      }
    });

    list.addEventListener('dragend', () => {
      if (dragEl) { dragEl.classList.remove('dragging'); dragEl = null; }
    });

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragEl) return;
      const target = e.target.closest('.col-picker-item');
      if (!target || target === dragEl) return;
      const rect = target.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        list.insertBefore(dragEl, target);
      } else {
        list.insertBefore(dragEl, target.nextSibling);
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showSpinner() {
    if (!_container) return;
    const wrap = _container.querySelector('.audit-table-wrap, .audit-empty');
    if (wrap) wrap.innerHTML = '<div class="audit-loading">Lade Daten…</div>';
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function render(container) {
    _container   = container;
    _currentView = 'campaigns';
    _campaignId  = null; _campaignName = '';
    _adsetId     = null; _adsetName    = '';

    if (!_container) return;

    // Initial loading state
    _container.innerHTML = `
      <div class="audit-view">
        <div class="audit-page-header">
          <button class="audit-back-btn" id="auditBackBtn">← Scale It</button>
          <div>
            <h2 class="audit-title">Ads Audit</h2>
            <p class="audit-subtitle">Attribution: Last Click (Lead-Datum) · Facebook Ads</p>
          </div>
        </div>
        <div class="audit-loading">Lade Daten…</div>
      </div>
    `;
    const backBtnEarly = document.getElementById('auditBackBtn');
    if (backBtnEarly) {
      backBtnEarly.addEventListener('click', () => {
        if (window.ScaleView) window.ScaleView.render('ads', _container);
      });
    }

    const ok = await fetchData();
    if (!ok) {
      _container.innerHTML = `
        <div class="audit-view">
          <div class="audit-header"><h2 class="audit-title">Ads Audit</h2></div>
          <div class="audit-empty">Fehler beim Laden. Bitte Seite neu laden.</div>
        </div>
      `;
      return;
    }

    paint();
  }

  window.AdsAuditAPI = { render };

})(window);
