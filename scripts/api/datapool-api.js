(function(window) {

  const ITEMS_PER_PAGE = 50;

  const EVENT_TYPES = [
    { id: 'lead', label: 'Leads', icon: '📩' },
    { id: 'survey', label: 'Survey', icon: '📋' },
    { id: 'surveyQuali', label: 'Survey Quali', icon: '✅' },
    { id: 'settingBooking', label: 'Setting Booking', icon: '🥈' },
    { id: 'settingTermin', label: 'Setting Termin', icon: '📆' },
    { id: 'settingCall', label: 'Setting Call', icon: '☎️' },
    { id: 'closingBooking', label: 'Closing Booking', icon: '🥇' },
    { id: 'closingTermin', label: 'Closing Termin', icon: '✅' },
    { id: 'closingCall', label: 'Closing Call', icon: '📞' },
    { id: 'unit', label: 'Units', icon: '💰' }
  ];

  // Maps module IDs → which event types they require in the Datenpool
  const MODULE_TO_EVENT_TYPES = {
    'paid-ads': [], 'organic': [], 'cold-email': [], 'cold-calls': [],
    'classic-vsl': ['lead', 'survey'], 'classic-vsl-organic': ['lead', 'survey'],
    'direct-vsl': ['survey'], 'direct-vsl-organic': ['survey'],
    'classic-vsl-no-survey': ['lead'], 'classic-vsl-no-survey-organic': ['lead'], 'direct-no-survey': ['lead'],
    'survey-qualified': ['survey', 'surveyQuali'], 'survey-qualified-organic': ['survey', 'surveyQuali'],
    'survey-unqualified': ['survey'], 'no-survey': [],
    'direct-call-booking': ['settingBooking', 'settingTermin', 'settingCall'],
    'direct-call-booking-coldcalls': ['settingBooking', 'settingTermin', 'settingCall'],
    'direct-call-booking-coldcalls-withclicks': ['settingBooking', 'settingTermin', 'settingCall'],
    '1-call-close': ['closingBooking', 'closingTermin', 'closingCall'],
    '1-call-close-organic': ['closingBooking', 'closingTermin', 'closingCall'],
    '2-call-close': ['settingBooking', 'settingTermin', 'settingCall', 'closingBooking', 'closingTermin', 'closingCall'],
    '2-call-close-organic': ['settingBooking', 'settingTermin', 'settingCall', 'closingBooking', 'closingTermin', 'closingCall'],
    'revenue-paid': ['unit'], 'revenue-organic': ['unit'],
  };

  function getActiveFunnelEventTypes() {
    const funnels = window.FunnelAPI?.loadFunnels() || [];
    if (!funnels.length) return EVENT_TYPES;
    const needed = new Set();
    funnels.forEach(f => (f.modules || []).forEach(mid => (MODULE_TO_EVENT_TYPES[mid] || []).forEach(et => needed.add(et))));
    if (!needed.size) return EVENT_TYPES;
    return EVENT_TYPES.filter(t => needed.has(t.id));
  }

  const TRAFFIC_SOURCES = [
    { id: 'facebook-ads', label: 'Facebook Ads', icon: '📘' },
    { id: 'google-ads', label: 'Google Ads', icon: '🔍', disabled: true },
    { id: 'cold-calls', label: 'Cold Calls', icon: '📞', disabled: true },
    { id: 'cold-emails', label: 'Cold E-Mails', icon: '📧', disabled: true },
    { id: 'organic', label: 'Organic', icon: '🌱', disabled: true }
  ];

  // ============================================
  // CAMPAIGN COLUMNS CONFIGURATION
  // ============================================
  const CAMPAIGN_COLUMNS = [
    // Meta
    { id: 'campaign', label: 'KAMPAGNE', category: 'meta', defaultVisible: true, type: 'string' },
    { id: 'dailyBudget', label: 'DAILY BUDGET', category: 'meta', defaultVisible: true, type: 'currency' },
    { id: 'eventsFired', label: 'EVENTS FIRED', category: 'meta', defaultVisible: true, type: 'number' },
    { id: 'period', label: 'ZEITRAUM', category: 'meta', defaultVisible: true, type: 'string' },
    
    // Traffic Metrics
    { id: 'adSpend', label: 'AD SPEND', category: 'traffic', defaultVisible: true, type: 'currency' },
    { id: 'impressions', label: 'IMPRESSIONS', category: 'traffic', defaultVisible: true, type: 'number' },
    { id: 'cpm', label: 'CPM-€', category: 'traffic', defaultVisible: false, type: 'currency', formula: (d) => d.impressions ? (d.adSpend / d.impressions * 1000) : 0 },
    { id: 'clicks', label: 'CLICKS', category: 'traffic', defaultVisible: true, type: 'number' },
    { id: 'ctr', label: 'CTR', category: 'traffic', defaultVisible: true, type: 'percentage', formula: (d) => d.impressions ? (d.clicks / d.impressions * 100) : 0 },
    { id: 'cpc', label: 'CPC-€', category: 'traffic', defaultVisible: true, type: 'currency', formula: (d) => d.clicks ? (d.adSpend / d.clicks) : 0 },
    
    // Lead Metrics
    { id: 'leads', label: 'LEADS', category: 'leads', defaultVisible: true, type: 'number', hasTooltip: true },
    { id: 'lpRate', label: 'LP-%', category: 'leads', defaultVisible: false, type: 'percentage', formula: (d) => d.clicks ? (d.leads / d.clicks * 100) : 0 },
    { id: 'cpl', label: 'CPL-€', category: 'leads', defaultVisible: false, type: 'currency', formula: (d) => d.leads ? (d.adSpend / d.leads) : 0 },
    
    // Survey Metrics
    { id: 'survey', label: 'SURVEY', category: 'survey', defaultVisible: false, type: 'number' },
    { id: 'videoCR', label: 'VIDEOCR-%', category: 'survey', defaultVisible: false, type: 'percentage', formula: (d) => d.leads ? (d.survey / d.leads * 100) : 0 },
    { id: 'cps', label: 'Survey-€', category: 'survey', defaultVisible: false, type: 'currency', formula: (d) => d.survey ? (d.adSpend / d.survey) : 0 },
    { id: 'surveyQuali', label: 'SURVEYQUALI', category: 'survey', defaultVisible: false, type: 'number' },
    { id: 'surveyQualiRate', label: 'SURVEYQUALI-%', category: 'survey', defaultVisible: false, type: 'percentage', formula: (d) => d.survey ? (d.surveyQuali / d.survey * 100) : 0 },
    { id: 'surveyQualiCost', label: 'SURVEYQUALI-€', category: 'survey', defaultVisible: false, type: 'currency', formula: (d) => d.surveyQuali ? (d.adSpend / d.surveyQuali) : 0 },
    
    // Setting Metrics (2-Call Close)
    { id: 'settingBooking', label: 'SETTINGBOOKING', category: 'setting', defaultVisible: false, type: 'number' },
    { id: 'sbRate', label: 'SB-%', category: 'setting', defaultVisible: false, type: 'percentage', formula: (d) => d.surveyQuali ? (d.settingBooking / d.surveyQuali * 100) : 0 },
    { id: 'sbCost', label: 'SB-€', category: 'setting', defaultVisible: false, type: 'currency', formula: (d) => d.settingBooking ? (d.adSpend / d.settingBooking) : 0 },
    { id: 'settingTermin', label: 'SETTINGTERMIN', category: 'setting', defaultVisible: false, type: 'number' },
    { id: 'sqRate', label: 'SQ-%', category: 'setting', defaultVisible: false, type: 'percentage', formula: (d) => d.settingBooking ? (d.settingTermin / d.settingBooking * 100) : 0 },
    { id: 'stCost', label: 'ST-€', category: 'setting', defaultVisible: false, type: 'currency', formula: (d) => d.settingTermin ? (d.adSpend / d.settingTermin) : 0 },
    { id: 'settingCall', label: 'SETTINGCALL', category: 'setting', defaultVisible: false, type: 'number' },
    { id: 'ssRate', label: 'SS-%', category: 'setting', defaultVisible: false, type: 'percentage', formula: (d) => d.settingTermin ? (d.settingCall / d.settingTermin * 100) : 0 },
    { id: 'ssCost', label: 'SS-€', category: 'setting', defaultVisible: false, type: 'currency', formula: (d) => d.settingCall ? (d.adSpend / d.settingCall) : 0 },
    
    // Closing Metrics (2-Call Close)
    { id: 'closingBooking', label: 'CLOSINGBOOKING', category: 'closing', defaultVisible: false, type: 'number' },
    { id: 'cbRate', label: 'CB-%', category: 'closing', defaultVisible: false, type: 'percentage', formula: (d) => d.settingCall ? (d.closingBooking / d.settingCall * 100) : 0 },
    { id: 'cbCost', label: 'CB-€', category: 'closing', defaultVisible: false, type: 'currency', formula: (d) => d.closingBooking ? (d.adSpend / d.closingBooking) : 0 },
    { id: 'closingTermin', label: 'CLOSINGTERMIN', category: 'closing', defaultVisible: false, type: 'number' },
    { id: 'cqRate', label: 'CQ-%', category: 'closing', defaultVisible: false, type: 'percentage', formula: (d) => d.closingBooking ? (d.closingTermin / d.closingBooking * 100) : 0 },
    { id: 'ctCost', label: 'CT-€', category: 'closing', defaultVisible: false, type: 'currency', formula: (d) => d.closingTermin ? (d.adSpend / d.closingTermin) : 0 },
    { id: 'closingCall', label: 'CLOSINGCALL', category: 'closing', defaultVisible: false, type: 'number' },
    { id: 'csRate', label: 'CS-%', category: 'closing', defaultVisible: false, type: 'percentage', formula: (d) => d.closingTermin ? (d.closingCall / d.closingTermin * 100) : 0 },
    { id: 'csCost', label: 'CS-€', category: 'closing', defaultVisible: false, type: 'currency', formula: (d) => d.closingCall ? (d.adSpend / d.closingCall) : 0 },
    
    // Sales Metrics
    { id: 'units', label: 'UNITS', category: 'sales', defaultVisible: true, type: 'number' },
    { id: 'ccRate', label: 'CC%', category: 'sales', defaultVisible: false, type: 'percentage', formula: (d) => d.closingCall ? (d.units / d.closingCall * 100) : 0 },
    { id: 'lcRate', label: 'LC%', category: 'sales', defaultVisible: false, type: 'percentage', formula: (d) => d.leads ? (d.units / d.leads * 100) : 0 },
    
    // Financial Metrics
    { id: 'revenue', label: 'REVENUE', category: 'financial', defaultVisible: true, type: 'currency' },
    { id: 'cash', label: 'CASH', category: 'financial', defaultVisible: true, type: 'currency' },
    { id: 'cashCollectionRate', label: 'CC-RATE%', category: 'financial', defaultVisible: false, type: 'percentage', formula: (d) => d.revenue ? (d.cash / d.revenue * 100) : 0 },
    { id: 'cpa', label: 'CPA', category: 'financial', defaultVisible: false, type: 'currency', formula: (d) => d.units ? (d.adSpend / d.units) : 0 },
    { id: 'epaC', label: 'EPA-C', category: 'financial', defaultVisible: false, type: 'currency', formula: (d) => d.units ? (d.cash / d.units) : 0 },
    { id: 'rProfitLoss', label: 'R-P/L', category: 'financial', defaultVisible: false, type: 'currency', formula: (d) => d.revenue - d.adSpend },
    { id: 'cProfitLoss', label: 'C-P/L', category: 'financial', defaultVisible: false, type: 'currency', formula: (d) => d.cash - d.adSpend },
    { id: 'rRoi', label: 'R-ROI', category: 'financial', defaultVisible: false, type: 'multiplier', formula: (d) => d.adSpend ? (d.revenue / d.adSpend) : 0 },
    { id: 'cRoi', label: 'C-ROI', category: 'financial', defaultVisible: true, type: 'multiplier', formula: (d) => d.adSpend ? (d.cash / d.adSpend) : 0 }
  ];

  const DataPool = {
    loadedRows: 0,
    totalItems: 0,
    currentMainTab: 'traffic',  // 'traffic' or 'conversions' - default to traffic
    currentTab: 'lead',
    currentTrafficSource: 'facebook-ads',  // Active traffic source tab
    currentTrafficLevel: 'overview',  // 'overview', 'campaigns', 'adsets', 'ads'
    visibleColumns: [],  // Array of visible column IDs
    selectedLeads: new Set(),
    surveyQuestions: [],  // Unique survey question labels in current tab
    eventsByLead: {},  // Maps lead_id to array of event_types
    filters: {
      search: '',
      funnel: '',
      source: '',
      dateFrom: '',
      dateTo: ''
    },
    sortBy: 'event_date',
    sortOrder: 'desc',

    async init() {
      console.log('🔧 Initializing DataPool...');
      const container = document.getElementById('datapoolView');
      if (!container) {
        console.error('❌ DataPool container not found');
        return;
      }

      container.innerHTML = `
        <div class="datapool-header">
          <h1>Datenpool</h1>
          <div class="datapool-actions">
            <button id="addLeadBtn" class="datapool-btn">
              ➕ Neuer Lead
            </button>
            <button id="csvImportBtn" class="datapool-btn">
              📤 CSV Import
            </button>
            <button id="unitImportBtn" class="datapool-btn datapool-btn--unit">
              💰 Unit erfassen
            </button>
            <button id="integrationsBtn" class="datapool-btn">
              🔌 Integrationen
            </button>
          </div>
        </div>

        <div class="datapool-main-tabs">
          <button class="datapool-main-tab ${this.currentMainTab === 'traffic' ? 'active' : ''}"
                  data-main-tab="traffic">
            Traffic Sources
          </button>
          <button class="datapool-main-tab ${this.currentMainTab === 'conversions' ? 'active' : ''}"
                  data-main-tab="conversions">
            Conversions
          </button>
        </div>

        <div id="trafficSourcesContent" class="datapool-content" style="display: ${this.currentMainTab === 'traffic' ? 'block' : 'none'}">
          <div class="datapool-tabs">
            ${TRAFFIC_SOURCES.map(source => `
              <button class="datapool-tab ${source.id === this.currentTrafficSource ? 'active' : ''} ${source.disabled ? 'datapool-tab-disabled' : ''}"
                      data-traffic-source="${source.id}"
                      ${source.disabled ? 'disabled title="Noch nicht verfügbar"' : ''}>
                ${source.icon} ${source.label}
              </button>
            `).join('')}
          </div>

          <div class="traffic-level-tabs" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex;">
              <button class="traffic-level-tab ${this.currentTrafficLevel === 'overview' ? 'active' : ''}"
                      data-level="overview">
                📊 Übersicht
              </button>
              <button class="traffic-level-tab ${this.currentTrafficLevel === 'campaigns' ? 'active' : ''}"
                      data-level="campaigns">
                📈 Kampagnen
              </button>
              <button class="traffic-level-tab ${this.currentTrafficLevel === 'adsets' ? 'active' : ''}"
                      data-level="adsets">
                🎯 Ad-Sets
              </button>
              <button class="traffic-level-tab ${this.currentTrafficLevel === 'ads' ? 'active' : ''}"
                      data-level="ads">
                🖼️ Ads
              </button>
            </div>
            ${this.currentTrafficSource === 'facebook-ads' && this.currentTrafficLevel === 'overview' ? `
              <div style="display: flex; gap: 8px; margin-right: 12px;">
                <button class="btn-primary" onclick="window.FacebookTraffic.openSyncModal()" style="font-size: 12px; padding: 5px 10px; font-weight: 600; background: #3498db; border-color: #3498db; margin-right: 8px;">
                  🔄 Sync zu Tracking Sheets
                </button>
                <button class="btn-secondary" onclick="window.FacebookTraffic.toggleDateRangeDropdown(event)" style="font-size: 12px; padding: 5px 10px;">
                  📅 Zeitraum
                </button>
                <button class="btn-secondary" onclick="window.FacebookTraffic.syncNow()" style="font-size: 12px; padding: 5px 10px;">
                  🔄 Jetzt synchronisieren
                </button>
                <button class="btn-secondary" onclick="window.FacebookTraffic.manageAccounts()" style="font-size: 12px; padding: 5px 10px;">
                  ⚙️ Ad Accounts verwalten
                </button>
                <button class="btn-secondary" onclick="window.FacebookTraffic.disconnect()" style="font-size: 12px; padding: 5px 10px; background: #e74c3c; border-color: #c0392b; color: white; border-radius: 6px;">
                  🔌 Verbindung trennen
                </button>
              </div>
            ` : ''}
          </div>

          <div id="trafficOverviewContent" style="display: ${this.currentTrafficLevel === 'overview' ? 'block' : 'none'}">
            <div id="facebookTrafficContainer"></div>
            <div class="traffic-table-container" style="display: none;">
              <table class="datapool-table">
                <thead id="trafficTableHead">
                </thead>
                <tbody id="trafficTableBody">
                  <tr>
                    <td colspan="10" class="loading-cell">Laden...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div id="trafficCampaignsContent" style="display: ${this.currentTrafficLevel === 'campaigns' ? 'block' : 'none'}">
            <div id="facebookTrafficCampaignsContainer"></div>
          </div>

          <div id="trafficAdsetsContent" style="display: ${this.currentTrafficLevel === 'adsets' ? 'block' : 'none'}">
            <div id="facebookTrafficAdsetsContainer"></div>
          </div>

          <div id="trafficAdsContent" style="display: ${this.currentTrafficLevel === 'ads' ? 'block' : 'none'}">
            <div id="facebookTrafficAdsContainer"></div>
          </div>
        </div>

        <div id="conversionsContent" class="datapool-content" style="display: ${this.currentMainTab === 'conversions' ? 'block' : 'none'}">
          <div class="datapool-tabs">
            ${getActiveFunnelEventTypes().map(type => `
              <button class="datapool-tab ${type.id === this.currentTab ? 'active' : ''}"
                      data-tab="${type.id}">
                ${type.icon} ${type.label}
              </button>
            `).join('')}
          </div>

          <div class="datapool-filters">
            <input type="text" id="searchInput" placeholder="Suche nach Name, E-Mail oder Telefon..." />

            <select id="funnelFilter">
              <option value="">Alle Funnels</option>
            </select>

            <select id="sourceFilter">
              <option value="">Alle Traffic Sources</option>
            </select>

            <input type="date" id="dateFromFilter" placeholder="Von" />
            <input type="date" id="dateToFilter" placeholder="Bis" />

            <button id="applyFiltersBtn" class="datapool-btn">Filtern</button>
            <button id="resetFiltersBtn" class="datapool-btn">Zurücksetzen</button>
          </div>

          <div id="bulkActionsBar" class="bulk-actions-bar hidden">
            <div class="bulk-actions-info">
              <span id="selectedCount">0</span> Leads ausgewählt
              <button id="selectAllInEventBtn" class="datapool-btn">
                ☑️ Alle auswählen
              </button>
            </div>
            <div class="bulk-actions-buttons">
              <button id="bulkCopyBtn" class="datapool-btn">
                📋 Kopieren
              </button>
              <button id="bulkExportBtn" class="datapool-btn">
                💾 Exportieren
              </button>
              <button id="bulkDeleteEventsBtn" class="datapool-btn btn-danger">
                🗑️ Events löschen
              </button>
              <button id="bulkDeleteLeadsBtn" class="datapool-btn">
                ❌ Leads löschen
              </button>
            </div>
          </div>

          <div class="datapool-table-container">
            <table class="datapool-table">
              <thead id="tableHead">
              </thead>
              <tbody id="tableBody">
                <tr>
                  <td colspan="10" class="loading-cell">Laden...</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="datapool-pagination">
            <button id="loadMoreBtn" class="datapool-btn" style="display: none;">
              Weitere 50 Zeilen laden
            </button>
            <div id="loadMoreInfo" style="text-align: center; color: #666; margin-top: 10px;"></div>
          </div>
        </div>
      `;

      await this.loadFunnelOptions();
      this.loadVisibleColumns(); // Load column preferences
      this.attachListeners();
      this.updateButtonLabels();

      // Ensure currentTab is one of the active event types for this user's funnels
      const activeFunnelTypes = getActiveFunnelEventTypes();
      if (!activeFunnelTypes.find(t => t.id === this.currentTab)) {
        this.currentTab = activeFunnelTypes[0]?.id || 'survey';
      }

      if (this.currentMainTab === 'traffic') {
        // Auto-init Facebook Ads if it's the default selection
        if (this.currentTrafficSource === 'facebook-ads' && this.currentTrafficLevel === 'overview') {
          if (window.FacebookTraffic) {
            window.FacebookTraffic.init();
          } else {
            console.warn('⚠️ FacebookTraffic module not loaded');
          }
        } else {
          // Load generic traffic data for other sources
          this.renderTrafficTableHeaders();
          await this.loadTrafficData();
        }
      } else {
        this.renderTableHeaders();
        this.updateSortIcons(); // Show correct sort icon on initial load
        await this.loadTabData();
      }
    },

    async loadFunnelOptions() {
      const funnels = FunnelAPI.loadFunnels();
      const funnelFilter = document.getElementById('funnelFilter');
      if (funnelFilter) {
        funnels.forEach(funnel => {
          const option = document.createElement('option');
          option.value = funnel.id;
          option.textContent = funnel.name;
          funnelFilter.appendChild(option);
        });
      }
    },

    attachListeners() {
      // Main Tab Switcher
      document.querySelectorAll('.datapool-main-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const mainTabId = e.currentTarget.dataset.mainTab;
          this.switchMainTab(mainTabId);
        });
      });

      // Traffic Source Tabs
      document.querySelectorAll('[data-traffic-source]').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const sourceId = e.currentTarget.dataset.trafficSource;
          this.switchTrafficSource(sourceId);
        });
      });

      // Traffic Level Tabs (Drill-Down)
      document.querySelectorAll('.traffic-level-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const level = e.currentTarget.dataset.level;
          this.switchTrafficLevel(level);
        });
      });

      // Column Selector Button
      const columnSelectorBtn = document.getElementById('columnSelectorBtn');
      if (columnSelectorBtn) {
        columnSelectorBtn.addEventListener('click', () => {
          this.showColumnSelector();
        });
      }

      // Conversion Sub-Tabs
      document.querySelectorAll('.datapool-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const tabId = e.currentTarget.dataset.tab;
          if (tabId) {
            this.switchTab(tabId);
          }
        });
      });

      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.filters.search = e.target.value;
        });

        // Enter-Taste startet die Suche
        searchInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.loadedRows = 0;
            this.loadTabData();
          }
        });
      }

      const funnelFilter = document.getElementById('funnelFilter');
      if (funnelFilter) {
        funnelFilter.addEventListener('change', (e) => {
          this.filters.funnel = e.target.value;
        });
      }

      const sourceFilter = document.getElementById('sourceFilter');
      if (sourceFilter) {
        sourceFilter.addEventListener('change', (e) => {
          this.filters.source = e.target.value;
        });
      }

      const dateFromFilter = document.getElementById('dateFromFilter');
      if (dateFromFilter) {
        dateFromFilter.addEventListener('change', (e) => {
          this.filters.dateFrom = e.target.value;
        });
      }

      const dateToFilter = document.getElementById('dateToFilter');
      if (dateToFilter) {
        dateToFilter.addEventListener('change', (e) => {
          this.filters.dateTo = e.target.value;
        });
      }

      const applyFiltersBtn = document.getElementById('applyFiltersBtn');
      if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
          this.loadedRows = 0;
          this.loadTabData();
        });
      }

      const resetFiltersBtn = document.getElementById('resetFiltersBtn');
      if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
          this.resetFilters();
        });
      }

      {
      }

      const loadMoreBtn = document.getElementById('loadMoreBtn');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          this.loadMoreRows();
        });
      }

      const addLeadBtn = document.getElementById('addLeadBtn');
      if (addLeadBtn) {
        addLeadBtn.addEventListener('click', () => {
          this.openConversionModal();
        });
      }

      const csvImportBtn = document.getElementById('csvImportBtn');
      if (csvImportBtn) {
        csvImportBtn.addEventListener('click', () => {
          this.openCSVImport();
        });
      }

      const unitImportBtn = document.getElementById('unitImportBtn');
      if (unitImportBtn) {
        unitImportBtn.addEventListener('click', () => {
          this.openUnitImportModal();
        });
      }

      const integrationsBtn = document.getElementById('integrationsBtn');
      if (integrationsBtn) {
        integrationsBtn.addEventListener('click', () => {
          this.openIntegrationsModal();
        });
      }

      // Bulk Actions Listeners
      const bulkCopyBtn = document.getElementById('bulkCopyBtn');
      if (bulkCopyBtn) {
        bulkCopyBtn.addEventListener('click', () => {
          this.bulkCopyEmails();
        });
      }

      const bulkExportBtn = document.getElementById('bulkExportBtn');
      if (bulkExportBtn) {
        bulkExportBtn.addEventListener('click', () => {
          this.bulkExportCSV();
        });
      }

      const bulkDeleteEventsBtn = document.getElementById('bulkDeleteEventsBtn');
      if (bulkDeleteEventsBtn) {
        bulkDeleteEventsBtn.addEventListener('click', () => {
          this.bulkDeleteEvents();
        });
      }

      const bulkDeleteLeadsBtn = document.getElementById('bulkDeleteLeadsBtn');
      if (bulkDeleteLeadsBtn) {
        bulkDeleteLeadsBtn.addEventListener('click', () => {
          this.bulkDeleteLeads();
        });
      }

      const selectAllInEventBtn = document.getElementById('selectAllInEventBtn');
      if (selectAllInEventBtn) {
        selectAllInEventBtn.addEventListener('click', () => {
          this.selectAllInCurrentTab();
        });
      }
    },

    attachSortListeners() {
      document.querySelectorAll('.datapool-table th[data-sort]').forEach(th => {
        th.addEventListener('click', (e) => {
          const sortField = e.target.dataset.sort;
          if (this.sortBy === sortField) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
          } else {
            this.sortBy = sortField;
            this.sortOrder = 'asc';
          }
          this.loadedRows = 0;
          this.updateSortIcons();
          this.loadTabData();
        });
      });
    },

    switchMainTab(mainTabId) {
      this.currentMainTab = mainTabId;

      // Toggle Main Tab Buttons
      document.querySelectorAll('.datapool-main-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mainTab === mainTabId);
      });

      // Toggle Content Areas
      const trafficContent = document.getElementById('trafficSourcesContent');
      const conversionsContent = document.getElementById('conversionsContent');

      if (trafficContent) {
        trafficContent.style.display = mainTabId === 'traffic' ? 'block' : 'none';
      }
      if (conversionsContent) {
        conversionsContent.style.display = mainTabId === 'conversions' ? 'block' : 'none';
      }

      // Toggle Action Buttons (nur bei Conversions)
      const actionsBar = document.querySelector('.datapool-actions');
      if (actionsBar) {
        actionsBar.style.display = mainTabId === 'conversions' ? 'flex' : 'none';
      }

      // Load data for active tab
      if (mainTabId === 'traffic') {
        this.renderTrafficTableHeaders();
        this.loadTrafficData();
      } else {
        this.renderTableHeaders();
        this.loadTabData();
      }
    },

    loadTrafficData() {
      console.log('🚀 Loading Traffic Data for:', this.currentTrafficSource);
      
      const trafficTableBody = document.getElementById('trafficTableBody');
      if (!trafficTableBody) return;

      // Placeholder: 30 Tage Mock-Daten für aktuelle Monat
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      let rows = '';
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        rows += `
          <tr>
            <td>${dateStr}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
          </tr>
        `;
      }

      trafficTableBody.innerHTML = rows;
    },

    renderTrafficTableHeaders() {
      const tableHead = document.getElementById('trafficTableHead');
      if (!tableHead) return;

      tableHead.innerHTML = `
        <tr>
          <th>Datum</th>
          <th>Ad Spend</th>
          <th>Impressions</th>
          <th>Reach</th>
          <th>CPM</th>
          <th>CTR</th>
          <th>Clicks</th>
          <th>CPC</th>
          <th>FB Leads</th>
          <th>FB CPL</th>
        </tr>
      `;
    },

    switchTrafficSource(sourceId) {
      this.currentTrafficSource = sourceId;

      // Auto-select Übersicht when switching to Facebook Ads
      if (sourceId === 'facebook-ads') {
        this.currentTrafficLevel = 'overview';
        
        // Update tab UI immediately
        document.querySelectorAll('.traffic-level-tab').forEach(tab => {
          tab.classList.toggle('active', tab.dataset.level === 'overview');
        });
      }

      // Toggle active state
      document.querySelectorAll('[data-traffic-source]').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.trafficSource === sourceId);
      });

      // Initialize Facebook Traffic module if Facebook Ads selected
      if (sourceId === 'facebook-ads') {
        if (window.FacebookTraffic) {
          // Set view before init
          window.FacebookTraffic.currentView = 'overview';
          window.FacebookTraffic.init();
        } else {
          console.warn('⚠️ FacebookTraffic module not loaded');
        }
      } else {
        this.loadTrafficData();
      }
    },

    switchTrafficLevel(level) {
      this.currentTrafficLevel = level;

      // Toggle active state
      document.querySelectorAll('.traffic-level-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.level === level);
      });

      // Toggle content areas
      const overviewContent = document.getElementById('trafficOverviewContent');
      const campaignsContent = document.getElementById('trafficCampaignsContent');
      const adsetsContent = document.getElementById('trafficAdsetsContent');
      const adsContent = document.getElementById('trafficAdsContent');

      if (overviewContent) overviewContent.style.display = level === 'overview' ? 'block' : 'none';
      if (campaignsContent) campaignsContent.style.display = level === 'campaigns' ? 'block' : 'none';
      if (adsetsContent) adsetsContent.style.display = level === 'adsets' ? 'block' : 'none';
      if (adsContent) adsContent.style.display = level === 'ads' ? 'block' : 'none';

      // Load data for active level
      if (level === 'overview') {
        // Initialize Facebook Traffic if that's the active source
        if (this.currentTrafficSource === 'facebook-ads' && window.FacebookTraffic) {
          if (!window.FacebookTraffic.initialized) {
            // First time initialization
            window.FacebookTraffic.init();
          } else {
            // Just switch view without re-initializing
            window.FacebookTraffic.currentView = 'overview';
            window.FacebookTraffic.render();
          }
        } else {
          this.loadTrafficData();
        }
      } else if (level === 'campaigns') {
        if (this.currentTrafficSource === 'facebook-ads' && window.FacebookTraffic) {
          window.FacebookTraffic.currentView = 'campaigns';
          if (!window.FacebookTraffic.initialized) {
            window.FacebookTraffic.init();
          } else {
            window.FacebookTraffic.render();
          }
        } else {
          this.loadCampaignsData();
          this.attachCampaignFilters();
        }
      } else if (level === 'adsets') {
        if (this.currentTrafficSource === 'facebook-ads' && window.FacebookTraffic) {
          window.FacebookTraffic.currentView = 'adsets';
          if (!window.FacebookTraffic.initialized) {
            window.FacebookTraffic.init();
          } else {
            window.FacebookTraffic.render();
          }
        }
      } else if (level === 'ads') {
        if (this.currentTrafficSource === 'facebook-ads' && window.FacebookTraffic) {
          window.FacebookTraffic.currentView = 'ads';
          if (!window.FacebookTraffic.initialized) {
            window.FacebookTraffic.init();
          } else {
            window.FacebookTraffic.render();
          }
        }
      }
    },

    attachCampaignFilters() {
      const timeRange = document.getElementById('campaignTimeRange');
      const customRange = document.getElementById('customDateRange');
      const loadBtn = document.getElementById('loadCampaignsBtn');

      if (timeRange) {
        timeRange.addEventListener('change', (e) => {
          if (customRange) {
            customRange.style.display = e.target.value === 'custom' ? 'flex' : 'none';
          }
        });
      }

      if (loadBtn) {
        loadBtn.addEventListener('click', () => {
          this.loadCampaignsData();
        });
      }
    },

    loadCampaignsData() {
      console.log('📈 Loading Campaigns Data for:', this.currentTrafficSource);
      
      const thead = document.getElementById('campaignsTableHead');
      const tbody = document.getElementById('campaignsTableBody');
      if (!thead || !tbody) return;

      // Build table header based on visible columns
      const visibleCols = CAMPAIGN_COLUMNS.filter(col => this.visibleColumns.includes(col.id));
      
      thead.innerHTML = `
        <tr>
          ${visibleCols.map(col => {
            const align = col.id === 'campaign' ? 'left' : 'center';
            return `<th style="text-align: ${align};">${col.label}</th>`;
          }).join('')}
        </tr>
      `;

      // Mock-Daten für Testing (werden später durch echte Supabase-Daten ersetzt)
      const mockCampaigns = [
        {
          campaign: 'Black Friday Sale 2025',
          period: '06.12. - 12.12.',
          dailyBudget: 350,
          eventsFired: 1243,
          adSpend: 2450.00,
          impressions: 125000,
          clicks: 3200,
          fbLeads: 145,
          leads: 138,
          survey: 112,
          surveyQuali: 95,
          settingBooking: 28,
          settingTermin: 26,
          settingCall: 24,
          closingBooking: 18,
          closingTermin: 16,
          closingCall: 15,
          units: 12,
          revenue: 23400.00,
          cash: 18500.00
        },
        {
          campaign: 'VSL Evergreen Q4',
          period: '06.12. - 12.12.',
          dailyBudget: 250,
          eventsFired: 856,
          adSpend: 1800.00,
          impressions: 98000,
          clicks: 2450,
          fbLeads: 98,
          leads: 92,
          survey: 78,
          surveyQuali: 65,
          settingBooking: 19,
          settingTermin: 18,
          settingCall: 16,
          closingBooking: 12,
          closingTermin: 11,
          closingCall: 10,
          units: 8,
          revenue: 15600.00,
          cash: 12400.00
        },
        {
          campaign: 'Retargeting - Website Visitors',
          period: '06.12. - 12.12.',
          dailyBudget: 200,
          eventsFired: 421,
          adSpend: 580.00,
          impressions: 45000,
          clicks: 1250,
          fbLeads: 52,
          leads: 48,
          survey: 41,
          surveyQuali: 35,
          settingBooking: 11,
          settingTermin: 10,
          settingCall: 9,
          closingBooking: 7,
          closingTermin: 6,
          closingCall: 6,
          units: 5,
          revenue: 9750.00,
          cash: 7800.00
        }
      ];

      let rows = '';
      mockCampaigns.forEach(data => {
        rows += '<tr>';
        
        visibleCols.forEach(col => {
          let value = '';
          let style = '';
          
          // Get value (raw or calculated)
          if (col.formula) {
            value = col.formula(data);
          } else {
            value = data[col.id] || 0;
          }
          
          // Format based on type
          if (col.type === 'currency') {
            value = value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
          } else if (col.type === 'percentage') {
            value = value.toFixed(2) + ' %';
          } else if (col.type === 'number') {
            value = value.toLocaleString('de-DE');
          } else if (col.type === 'multiplier') {
            value = value.toFixed(2) + 'x';
          }
          
          // Styling
          if (col.id === 'campaign') {
            style = 'font-weight: 600; text-align: left;';
          } else {
            // All other columns centered, default black color
            style = 'text-align: center;';
          }
          
          // Leads cell with tooltip
          if (col.id === 'leads' && col.hasTooltip) {
            rows += `<td class="leads-cell" data-fb-leads="${data.fbLeads}" data-backend-leads="${data.leads}" style="${style} cursor: help; position: relative;">${value}</td>`;
          } else {
            rows += `<td style="${style}">${value}</td>`;
          }
        });
        
        rows += '</tr>';
      });

      tbody.innerHTML = rows || `<tr><td colspan="${visibleCols.length}" class="loading-cell">Keine Daten gefunden</td></tr>`;
      
      // Attach tooltips
      this.attachLeadsTooltips();
    },

    attachLeadsTooltips() {
      const leadsCells = document.querySelectorAll('.leads-cell');
      
      leadsCells.forEach(cell => {
        const fbLeads = cell.getAttribute('data-fb-leads');
        const backendLeads = cell.getAttribute('data-backend-leads');
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'leads-tooltip';
        tooltip.innerHTML = `
          <div style="margin-bottom: 4px;"><strong>Facebook Leads:</strong> ${fbLeads}</div>
          <div><strong>Backend Leads:</strong> ${backendLeads}</div>
        `;
        tooltip.style.display = 'none';
        cell.appendChild(tooltip);
        
        // Show/hide on hover
        cell.addEventListener('mouseenter', () => {
          tooltip.style.display = 'block';
        });
        
        cell.addEventListener('mouseleave', () => {
          tooltip.style.display = 'none';
        });
      });
    },

    // ============================================
    // COLUMN MANAGEMENT
    // ============================================
    
    loadVisibleColumns() {
      try {
        const saved = localStorage.getItem('datapool_visible_columns');
        if (saved) {
          this.visibleColumns = JSON.parse(saved);
        } else {
          // Default: Nur defaultVisible Spalten
          this.visibleColumns = CAMPAIGN_COLUMNS
            .filter(col => col.defaultVisible)
            .map(col => col.id);
        }
      } catch (err) {
        this.visibleColumns = CAMPAIGN_COLUMNS
          .filter(col => col.defaultVisible)
          .map(col => col.id);
      }
    },

    saveVisibleColumns() {
      try {
        localStorage.setItem('datapool_visible_columns', JSON.stringify(this.visibleColumns));
      } catch (err) {
        console.error('❌ Error saving column preferences:', err);
      }
    },

    showColumnSelector() {
      // Create modal
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content column-selector-modal" style="max-width: 1100px; max-height: 85vh; overflow: hidden; padding: 0;">
          <div class="column-selector-header">
            <h2>Spalten konfigurieren</h2>
            <button class="close-modal-btn" id="columnCloseBtn">✕</button>
          </div>
          
          <div class="column-selector-body">
            <!-- Left: Categories -->
            <div class="column-categories-sidebar" id="categorySidebar">
              <div class="category-tab active" data-category="meta">Kampagnen-Info</div>
              <div class="category-tab" data-category="traffic">Traffic Metriken</div>
              <div class="category-tab" data-category="leads">Lead Metriken</div>
              <div class="category-tab" data-category="survey">Survey Metriken</div>
              <div class="category-tab" data-category="setting">Setting Metriken (2-Call Close)</div>
              <div class="category-tab" data-category="closing">Closing Metriken</div>
              <div class="category-tab" data-category="sales">Sales Metriken</div>
              <div class="category-tab" data-category="financial">Finanz-Metriken</div>
            </div>
            
            <!-- Middle: All categories with checkboxes -->
            <div class="column-checkboxes-area" id="columnCheckboxesScrollArea">
              <div id="columnCheckboxesContent">
                ${this.renderAllCategoriesWithCheckboxes()}
              </div>
            </div>
            
            <!-- Right: Selected columns -->
            <div class="selected-columns-area">
              <h3>${this.visibleColumns.length} Spalten ausgewählt</h3>
              <div id="selectedColumnsList">
                ${this.renderSelectedColumnsList()}
              </div>
            </div>
          </div>
          
          <div class="column-selector-footer">
            <button id="columnSelectAll" class="datapool-btn">Alle auswählen</button>
            <button id="columnSelectNone" class="datapool-btn">Alle abwählen</button>
            <button id="columnSelectDefault" class="datapool-btn">Standard</button>
            <div style="flex: 1;"></div>
            <button id="columnCancelBtn" class="datapool-btn">Abbrechen</button>
            <button id="columnSaveBtn" class="datapool-btn" style="background: #27ae60; color: white;">Speichern</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.classList.remove('hidden');

      // Scroll spy: Update active category based on scroll position
      const scrollArea = document.getElementById('columnCheckboxesScrollArea');
      const sidebar = document.getElementById('categorySidebar');
      
      scrollArea.addEventListener('scroll', () => {
        const sections = scrollArea.querySelectorAll('.category-section');
        let currentCategory = 'meta';
        
        sections.forEach(section => {
          const rect = section.getBoundingClientRect();
          const containerRect = scrollArea.getBoundingClientRect();
          
          // Check if section is in viewport
          if (rect.top <= containerRect.top + 100) {
            currentCategory = section.dataset.category;
          }
        });
        
        // Update active tab
        document.querySelectorAll('.category-tab').forEach(tab => {
          tab.classList.toggle('active', tab.dataset.category === currentCategory);
        });
      });

      // Category tab click: Scroll to section
      document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const category = e.currentTarget.dataset.category;
          const section = document.querySelector(`.category-section[data-category="${category}"]`);
          
          if (section) {
            // Get scroll container
            const scrollContainer = document.getElementById('columnCheckboxesScrollArea');
            const sectionTop = section.offsetTop;
            
            // Scroll with 85px offset from top (more space above)
            scrollContainer.scrollTo({
              top: sectionTop - 85,
              behavior: 'smooth'
            });
          }
        });
      });

      // Initial checkbox listeners
      this.attachColumnCheckboxListeners();

      // Event listeners
      document.getElementById('columnSelectAll').addEventListener('click', () => {
        // Select ALL checkboxes (all categories)
        document.querySelectorAll('.column-checkbox').forEach(cb => {
          cb.checked = true;
          const colId = cb.value;
          if (!this.visibleColumns.includes(colId)) {
            this.visibleColumns.push(colId);
          }
        });
        this.updateSelectedColumnsList();
      });

      document.getElementById('columnSelectNone').addEventListener('click', () => {
        // Deselect ALL checkboxes (all categories)
        document.querySelectorAll('.column-checkbox').forEach(cb => {
          cb.checked = false;
          const colId = cb.value;
          this.visibleColumns = this.visibleColumns.filter(id => id !== colId);
        });
        this.updateSelectedColumnsList();
      });

      document.getElementById('columnSelectDefault').addEventListener('click', () => {
        // Reset to all default columns (across all categories)
        this.visibleColumns = CAMPAIGN_COLUMNS
          .filter(col => col.defaultVisible)
          .map(col => col.id);
        
        // Update checkboxes in current view
        document.querySelectorAll('.column-checkbox').forEach(cb => {
          const colId = cb.value;
          cb.checked = this.visibleColumns.includes(colId);
        });
        
        this.updateSelectedColumnsList();
      });

      document.getElementById('columnSaveBtn').addEventListener('click', () => {
        // visibleColumns is already maintained by checkbox listeners
        // Just save to localStorage and reload table
        this.saveVisibleColumns();
        this.loadCampaignsData(); // Reload table with new columns
        modal.remove();
        if (window.Toast) {
          window.Toast.success('Spalten-Konfiguration gespeichert');
        }
      });

      document.getElementById('columnCancelBtn').addEventListener('click', () => {
        modal.remove();
      });

      document.getElementById('columnCloseBtn').addEventListener('click', () => {
        modal.remove();
      });

      // Click outside to close
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    },

    attachColumnCheckboxListeners() {
      document.querySelectorAll('.column-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const colId = e.target.value;
          const isChecked = e.target.checked;
          
          // Update visibleColumns array
          if (isChecked) {
            if (!this.visibleColumns.includes(colId)) {
              this.visibleColumns.push(colId);
            }
          } else {
            this.visibleColumns = this.visibleColumns.filter(id => id !== colId);
          }
          
          // Update selected list
          this.updateSelectedColumnsList();
        });
      });
    },

    updateSelectedColumnsList() {
      const list = document.getElementById('selectedColumnsList');
      const count = document.querySelector('.selected-columns-area h3');
      
      if (list) {
        list.innerHTML = this.renderSelectedColumnsListFromArray(this.visibleColumns);
      }
      
      if (count) {
        count.textContent = `${this.visibleColumns.length} Spalten ausgewählt`;
      }
    },

    renderColumnCheckboxesForCategory(category) {
      const cols = CAMPAIGN_COLUMNS.filter(col => col.category === category);
      
      return `
        <div class="column-checkboxes-list">
          ${cols.map(col => `
            <label class="column-checkbox-label">
              <input type="checkbox" 
                     class="column-checkbox" 
                     value="${col.id}"
                     ${this.visibleColumns.includes(col.id) ? 'checked' : ''} />
              <span>${col.label}</span>
            </label>
          `).join('')}
        </div>
      `;
    },

    renderAllCategoriesWithCheckboxes() {
      const categories = [
        { id: 'meta', label: 'Kampagnen-Info' },
        { id: 'traffic', label: 'Traffic Metriken' },
        { id: 'leads', label: 'Lead Metriken' },
        { id: 'survey', label: 'Survey Metriken' },
        { id: 'setting', label: 'Setting Metriken (2-Call Close)' },
        { id: 'closing', label: 'Closing Metriken' },
        { id: 'sales', label: 'Sales Metriken' },
        { id: 'financial', label: 'Finanz-Metriken' }
      ];

      return categories.map(cat => {
        const cols = CAMPAIGN_COLUMNS.filter(col => col.category === cat.id);
        
        return `
          <div class="category-section" data-category="${cat.id}">
            <div class="category-section-header">
              <h3>${cat.label}</h3>
            </div>
            <div class="column-checkboxes-list">
              ${cols.map(col => `
                <label class="column-checkbox-label">
                  <input type="checkbox" 
                         class="column-checkbox" 
                         value="${col.id}"
                         ${this.visibleColumns.includes(col.id) ? 'checked' : ''} />
                  <span>${col.label}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');
    },

    renderSelectedColumnsList() {
      return this.renderSelectedColumnsListFromArray(this.visibleColumns);
    },

    renderSelectedColumnsListFromArray(columnIds) {
      if (columnIds.length === 0) {
        return '<div class="no-columns-selected">Keine Spalten ausgewählt</div>';
      }
      
      // Sort columnIds by their order in CAMPAIGN_COLUMNS
      const sortedColumnIds = columnIds.slice().sort((a, b) => {
        const indexA = CAMPAIGN_COLUMNS.findIndex(col => col.id === a);
        const indexB = CAMPAIGN_COLUMNS.findIndex(col => col.id === b);
        return indexA - indexB;
      });
      
      const html = sortedColumnIds.map(colId => {
        const col = CAMPAIGN_COLUMNS.find(c => c.id === colId);
        if (!col) return '';
        
        return `
          <div class="selected-column-item">
            <span class="drag-handle">⋮⋮</span>
            <span class="column-name">${col.label}</span>
            <button class="remove-column-btn" data-column-id="${colId}">✕</button>
          </div>
        `;
      }).join('');
      
      // Attach remove button listeners after rendering
      setTimeout(() => {
        document.querySelectorAll('.remove-column-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const colId = e.currentTarget.dataset.columnId;
            
            // Remove from visibleColumns
            this.visibleColumns = this.visibleColumns.filter(id => id !== colId);
            
            // Update checkbox in current view if exists
            const checkbox = document.querySelector(`.column-checkbox[value="${colId}"]`);
            if (checkbox) {
              checkbox.checked = false;
            }
            
            // Update selected list
            this.updateSelectedColumnsList();
          });
        });
      }, 0);
      
      return html;
    },

    switchTab(tabId) {
      this.currentTab = tabId;
      this.loadedRows = 0;

      document.querySelectorAll('.datapool-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
      });

      this.updateButtonLabels();
      this.renderTableHeaders();
      this.loadTabData();
    },

    updateButtonLabels() {
      const eventType = EVENT_TYPES.find(t => t.id === this.currentTab);
      if (!eventType) return;

      const isUnit = this.currentTab === 'unit';

      const addLeadBtn = document.getElementById('addLeadBtn');
      if (addLeadBtn) {
        if (isUnit) {
          addLeadBtn.style.display = 'none';
        } else {
          addLeadBtn.style.display = '';
          const singular = eventType.label.endsWith('s') ? eventType.label.slice(0, -1) : eventType.label;
          addLeadBtn.textContent = `➕ ${singular} erfassen`;
        }
      }

      const csvImportBtn = document.getElementById('csvImportBtn');
      if (csvImportBtn) {
        csvImportBtn.style.display = isUnit ? 'none' : 'none'; // immer versteckt – Funktion im kombiniertem Modal
      }

      const unitImportBtn = document.getElementById('unitImportBtn');
      if (unitImportBtn) {
        unitImportBtn.style.display = isUnit ? '' : 'none';
      }
    },

    renderTableHeaders() {
      const tableHead = document.getElementById('tableHead');
      if (!tableHead) return;

      const isUnitsTab = this.currentTab === 'unit';

      tableHead.innerHTML = `
        <tr>
          <th class="checkbox-col">
            <input type="checkbox" id="selectAllCheckbox" title="Alle auswählen" />
          </th>
          <th data-sort="name">Name ▼</th>
          <th data-sort="primary_email">E-Mail ▼</th>
          <th data-sort="primary_phone">Telefon ▼</th>
          <th data-sort="event_date">Zeitpunkt der Conversion ▼</th>
          <th data-sort="funnel_id">Funnel ▼</th>
          <th data-sort="source">Traffic Source ▼</th>
          ${isUnitsTab ? '<th data-sort="revenue">Revenue ▼</th>' : ''}
          ${isUnitsTab ? '<th data-sort="cash">Cash ▼</th>' : ''}
          <th>Events</th>
          <th>Aktionen</th>
        </tr>
      `;

      this.attachSortListeners();
      this.attachSelectAllListener();
      this.updateSortIcons();
    },

    attachSelectAllListener() {
      const selectAllCheckbox = document.getElementById('selectAllCheckbox');
      if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
          const checkboxes = document.querySelectorAll('.lead-checkbox');
          checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const leadId = cb.dataset.leadId;
            if (e.target.checked) {
              this.selectedLeads.add(leadId);
            } else {
              this.selectedLeads.delete(leadId);
            }
          });
          this.updateBulkActionsBar();
        });
      }
    },

    updateBulkActionsBar() {
      const bulkActionsBar = document.getElementById('bulkActionsBar');
      const selectedCount = document.getElementById('selectedCount');
      
      if (bulkActionsBar && selectedCount) {
        selectedCount.textContent = this.selectedLeads.size;
        
        if (this.selectedLeads.size > 0) {
          bulkActionsBar.classList.remove('hidden');
        } else {
          bulkActionsBar.classList.add('hidden');
        }
      }
    },

    updateSortIcons() {
      document.querySelectorAll('.datapool-table th[data-sort]').forEach(th => {
        const sortField = th.dataset.sort;
        const text = th.textContent.replace(' ▼', '').replace(' ▲', '');
        if (this.sortBy === sortField) {
          th.textContent = text + (this.sortOrder === 'asc' ? ' ▲' : ' ▼');
        } else {
          th.textContent = text + ' ▼';
        }
      });
    },

    resetFilters() {
      this.filters = {
        search: '',
        funnel: '',
        source: '',
        dateFrom: '',
        dateTo: ''
      };

      document.getElementById('searchInput').value = '';
      document.getElementById('funnelFilter').value = '';
      document.getElementById('sourceFilter').value = '';
      document.getElementById('dateFromFilter').value = '';
      document.getElementById('dateToFilter').value = '';

      this.loadedRows = 0;
      this.loadTabData();
    },

    async loadTabData() {
      const tbody = document.getElementById('tableBody');
      if (!tbody) return;

      const isUnitsTab = this.currentTab === 'unit';
      const colCount = isUnitsTab ? 10 : 8;
      tbody.innerHTML = `<tr class="message-row"><td colspan="${colCount}" class="loading-cell">Laden...</td></tr>`;

      try {
        // Map tab IDs to actual event types
        const eventTypeMap = {
          'lead': 'lead',
          'survey': 'survey',
          'surveyQuali': 'surveyQuali',
          'settingBooking': 'settingBooking',
          'settingTermin': 'settingTermin',
          'settingCall': 'settingCall',
          'closingBooking': 'closingBooking',
          'closingTermin': 'closingTermin',
          'closingCall': 'closingCall',
          'unit': 'unit'
        };

        const actualEventType = eventTypeMap[this.currentTab] || this.currentTab;

        let query = window.SupabaseClient
          .from('events')
          .select(`
            id,
            event_type,
            event_date,
            funnel_id,
            event_source,
            revenue,
            cash,
            metadata,
            is_spam,
            created_at,
            leads!inner (
              id,
              name,
              primary_email,
              primary_phone,
              country
            )
          `, { count: 'exact' })
          .eq('event_type', actualEventType);

        if (this.filters.funnel) {
          query = query.eq('funnel_id', this.filters.funnel);
        }

        if (this.filters.source) {
          query = query.eq('event_source', this.filters.source);
        }

        if (this.filters.dateFrom) {
          query = query.gte('event_date', this.filters.dateFrom);
        }

        if (this.filters.dateTo) {
          query = query.lte('event_date', this.filters.dateTo);
        }


        // Search filter: First get matching lead IDs if search is active
        let leadIds = null;
        if (this.filters.search) {
          const searchTerm = `%${this.filters.search}%`;
          const { data: matchingLeads, error: searchError } = await window.SupabaseClient
            .from('leads')
            .select('id')
            .or(`name.ilike.${searchTerm},primary_email.ilike.${searchTerm},primary_phone.ilike.${searchTerm}`);

          if (searchError) {
            console.error('❌ Error searching leads:', searchError);
            tbody.innerHTML = `<tr class="message-row"><td colspan="${colCount}" class="error-cell">Fehler beim Suchen</td></tr>`;
            return;
          }

          if (!matchingLeads || matchingLeads.length === 0) {
            tbody.innerHTML = `<tr class="message-row"><td colspan="${colCount}" class="empty-cell">Keine Treffer gefunden</td></tr>`;
            this.loadedRows = 0;
            this.totalItems = 0;
            this.updateLoadMoreButton();
            return;
          }

          leadIds = matchingLeads.map(l => l.id);
          query = query.in('lead_id', leadIds);
        }

        query = query.order(this.sortBy, { ascending: this.sortOrder === 'asc' });

        // Initial load or reload: get first 50 rows
        query = query.range(0, ITEMS_PER_PAGE - 1);

        const { data, error, count } = await query;

        if (error) {
          console.error('❌ Error loading tab data:', error);
          tbody.innerHTML = `<tr class="message-row"><td colspan="${colCount}" class="error-cell">Fehler beim Laden der Daten</td></tr>`;
          return;
        }

        this.totalItems = count || 0;
        await this.loadFilterOptions();

        if (!data || data.length === 0) {
          tbody.innerHTML = `<tr class="message-row"><td colspan="${colCount}" class="empty-cell">Keine Einträge vorhanden</td></tr>`;
          this.loadedRows = 0;
          this.updateLoadMoreButton();
          return;
        }

        // Load ALL events for these leads (for Events column)
        const eventLeadIds = [...new Set(data.map(e => e.leads.id))];
        await this.loadEventsForLeads(eventLeadIds);

        tbody.innerHTML = '';
        data.forEach(event => {
          const item = {
            event_id: event.id,
            lead_id: event.leads.id,
            lead_name: event.leads.name,
            lead_email: event.leads.primary_email,
            lead_phone: event.leads.primary_phone,
            event_date: event.event_date,
            funnel_id: event.funnel_id,
            source: event.event_source,
            revenue: event.revenue,
            cash: event.cash,
            is_spam: event.is_spam,
            created_at: event.created_at
          };
          const row = this.createDataRow(item);
          tbody.appendChild(row);
        });

        this.loadedRows = data.length;
        this.updateLoadMoreButton();
      } catch (err) {
        console.error('❌ Error loading tab data:', err);
        tbody.innerHTML = `<tr class="message-row"><td colspan="${colCount}" class="error-cell">Fehler beim Laden der Daten</td></tr>`;
      }
    },

    async loadFilterOptions() {
      try {
        const { data: sources } = await window.SupabaseClient
          .from('events')
          .select('event_source')
          .not('event_source', 'is', null)
          .neq('event_source', '');

        const uniqueSources = [...new Set(sources?.map(s => s.event_source) || [])];
        const sourceFilter = document.getElementById('sourceFilter');
        if (sourceFilter) {
          const currentValue = sourceFilter.value;
          sourceFilter.innerHTML = '<option value="">Alle Traffic Sources</option>';
          uniqueSources.forEach(source => {
            const option = document.createElement('option');
            option.value = source;
            option.textContent = source;
            sourceFilter.appendChild(option);
          });
          sourceFilter.value = currentValue;
        }
      } catch (err) {
        console.error('❌ Error loading filter options:', err);
      }
    },

    async loadEventsForLeads(leadIds) {
      if (!leadIds || leadIds.length === 0) return;

      try {
        const { data: allEvents, error } = await window.SupabaseClient
          .from('events')
          .select('lead_id, event_type')
          .in('lead_id', leadIds)
          .order('event_date', { ascending: true });

        if (error) {
          console.error('❌ Error loading events for leads:', error);
          return;
        }

        // Group events by lead_id
        this.eventsByLead = {};
        allEvents?.forEach(event => {
          if (!this.eventsByLead[event.lead_id]) {
            this.eventsByLead[event.lead_id] = [];
          }
          this.eventsByLead[event.lead_id].push(event.event_type);
        });
      } catch (err) {
        console.error('❌ Error loading events for leads:', err);
      }
    },

    generateEventIcons(leadId) {
      const iconMap = {
        'lead': '📩',
        'survey': '📋',
        'survey_qualified': '✅',
        'surveyQuali': '✅',
        'settingBooking': '🥈',
        'settingTermin': '📆',
        'settingCall': '☎️',
        'closingBooking': '🥇',
        'closingTermin': '✅',
        'closingCall': '📞',
        'unit': '💰'
      };

      const eventOrder = [
        'lead',
        'survey',
        'survey_qualified',
        'surveyQuali',
        'settingBooking',
        'settingTermin',
        'settingCall',
        'closingBooking',
        'closingTermin',
        'closingCall',
        'unit'
      ];

      const events = this.eventsByLead[leadId] || [];
      if (events.length === 0) return '-';

      // Get unique events and sort by journey order
      const uniqueEvents = [...new Set(events)];
      const sortedEvents = uniqueEvents.sort((a, b) => {
        const indexA = eventOrder.indexOf(a);
        const indexB = eventOrder.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      return sortedEvents
        .map(type => iconMap[type] || '')
        .filter(icon => icon)
        .join(' ');
    },

    createDataRow(item) {
      const tr = document.createElement('tr');
      tr.dataset.eventId = item.event_id;
      tr.dataset.leadId = item.lead_id;

      const eventDateTime = new Date(item.event_date);
      const eventDate = eventDateTime.toLocaleDateString('de-DE') + ' ' + 
                        eventDateTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const eventsIcons = this.generateEventIcons(item.lead_id);
      const isUnitsTab = this.currentTab === 'unit';

      const isChecked = this.selectedLeads.has(item.lead_id);

      // Get funnel name from funnel_id
      let funnelDisplay = '-';
      if (item.funnel_id) {
        const funnels = window.FunnelAPI?.loadFunnels() || [];
        const funnel = funnels.find(f => f.id === item.funnel_id);
        funnelDisplay = funnel ? funnel.name : item.funnel_id;
      }

      const spamBadge = item.is_spam
        ? `<span class="spam-badge" title="Als Spam erkannt – wird nicht im Tracking Sheet gezählt">🚫 Spam</span>`
        : '';

      // Units ohne zugeordnete Source hervorheben
      const isUnattributed = isUnitsTab && !item.source;
      if (isUnattributed) tr.classList.add('unit-unattributed');

      const unattributedBadge = isUnattributed
        ? `<span class="unattributed-badge" title="Kein Lead/Funnel gefunden – bitte manuell zuordnen">Nicht zugeordnet</span>`
        : '';

      tr.innerHTML = `
        <td class="checkbox-col">
          <input type="checkbox" class="lead-checkbox" data-lead-id="${item.lead_id}" ${isChecked ? 'checked' : ''} />
        </td>
        <td>${spamBadge}${unattributedBadge}${item.lead_name || '-'}</td>
        <td>${item.lead_email || '-'}</td>
        <td>${item.lead_phone || '-'}</td>
        <td>${eventDate}</td>
        <td>${funnelDisplay}</td>
        <td>${item.source || '-'}</td>
        ${isUnitsTab ? `<td>${item.revenue ? item.revenue.toFixed(2) + ' €' : '-'}</td>` : ''}
        ${isUnitsTab ? `<td>${item.cash ? item.cash.toFixed(2) + ' €' : '-'}</td>` : ''}
        <td class="events-cell">${eventsIcons}</td>
        <td class="actions-cell">
          <button class="btn-icon view-btn" data-lead-id="${item.lead_id}" title="Lead ansehen">👁️</button>
          <button class="btn-icon spam-toggle-btn ${item.is_spam ? 'is-spam' : ''}" data-lead-id="${item.lead_id}" data-is-spam="${item.is_spam ? '1' : '0'}" title="${item.is_spam ? 'Spam-Markierung entfernen' : 'Als Spam markieren'}">🚫</button>
          <button class="btn-icon delete-btn" data-event-id="${item.event_id}" title="Event löschen">🗑️</button>
        </td>
      `;

      // Checkbox listener
      const checkbox = tr.querySelector('.lead-checkbox');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          const leadId = checkbox.dataset.leadId;
          if (checkbox.checked) {
            this.selectedLeads.add(leadId);
          } else {
            this.selectedLeads.delete(leadId);
          }
          this.updateBulkActionsBar();
        });
        
        // Prevent row click when clicking checkbox
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }

      const viewBtn = tr.querySelector('.view-btn');
      if (viewBtn) {
        viewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openLeadDetail(item.lead_id);
        });
      }

      const deleteBtn = tr.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteEvent(item.event_id);
        });
      }

      const spamToggleBtn = tr.querySelector('.spam-toggle-btn');
      if (spamToggleBtn) {
        spamToggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const leadId = spamToggleBtn.dataset.leadId;
          const currentIsSpam = spamToggleBtn.dataset.isSpam === '1';
          this.toggleSpam(leadId, currentIsSpam);
        });
      }

      tr.addEventListener('click', () => {
        this.openLeadDetail(item.lead_id);
      });

      return tr;
    },

    updateLoadMoreButton() {
      const loadMoreBtn = document.getElementById('loadMoreBtn');
      const loadMoreInfo = document.getElementById('loadMoreInfo');
      
      if (loadMoreBtn && loadMoreInfo) {
        const hasMore = this.loadedRows < this.totalItems;
        loadMoreBtn.style.display = hasMore ? 'block' : 'none';
        
        if (this.totalItems > 0) {
          loadMoreInfo.textContent = `${this.loadedRows} von ${this.totalItems} Einträgen angezeigt`;
        } else {
          loadMoreInfo.textContent = '';
        }
      }
    },

    async loadMoreRows() {
      const tbody = document.getElementById('tableBody');
      if (!tbody) return;

      const isUnitsTab = this.currentTab === 'unit';
      const colCount = isUnitsTab ? 10 : 8;

      try {
        // Map tab IDs to actual event types
        const eventTypeMap = {
          'lead': 'lead',
          'survey': 'survey',
          'surveyQuali': 'surveyQuali',
          'settingBooking': 'settingBooking',
          'settingTermin': 'settingTermin',
          'settingCall': 'settingCall',
          'closingBooking': 'closingBooking',
          'closingTermin': 'closingTermin',
          'closingCall': 'closingCall',
          'unit': 'unit'
        };

        const actualEventType = eventTypeMap[this.currentTab] || this.currentTab;

        let query = window.SupabaseClient
          .from('events')
          .select(`
            id,
            event_type,
            event_date,
            funnel_id,
            event_source,
            revenue,
            cash,
            metadata,
            is_spam,
            created_at,
            leads!inner (
              id,
              name,
              primary_email,
              primary_phone,
              country
            )
          `)
          .eq('event_type', actualEventType);

        if (this.filters.funnel) {
          query = query.eq('funnel_id', this.filters.funnel);
        }

        if (this.filters.source) {
          query = query.eq('event_source', this.filters.source);
        }

        if (this.filters.dateFrom) {
          query = query.gte('event_date', this.filters.dateFrom);
        }

        if (this.filters.dateTo) {
          query = query.lte('event_date', this.filters.dateTo);
        }


        // Search filter: First get matching lead IDs if search is active
        if (this.filters.search) {
          const searchTerm = `%${this.filters.search}%`;
          const { data: matchingLeads, error: searchError } = await window.SupabaseClient
            .from('leads')
            .select('id')
            .or(`name.ilike.${searchTerm},primary_email.ilike.${searchTerm},primary_phone.ilike.${searchTerm}`);

          if (searchError) {
            console.error('❌ Error searching leads:', searchError);
            if (window.Toast) {
              window.Toast.error('Fehler beim Suchen');
            }
            return;
          }

          if (!matchingLeads || matchingLeads.length === 0) {
            return; // No more rows to load
          }

          const leadIds = matchingLeads.map(l => l.id);
          query = query.in('lead_id', leadIds);
        }

        query = query.order(this.sortBy, { ascending: this.sortOrder === 'asc' });

        // Load next 50 rows
        const offset = this.loadedRows;
        query = query.range(offset, offset + ITEMS_PER_PAGE - 1);

        const { data, error } = await query;

        if (error) {
          console.error('❌ Error loading more rows:', error);
          if (window.Toast) {
            window.Toast.error('Fehler beim Laden weiterer Zeilen');
          }
          return;
        }

        if (!data || data.length === 0) {
          return;
        }

        // Load events for the new leads
        const newLeadIds = [...new Set(data.map(e => e.leads.id))];
        await this.loadEventsForLeads(newLeadIds);

        data.forEach(event => {
          const item = {
            event_id: event.id,
            lead_id: event.leads.id,
            lead_name: event.leads.name,
            lead_email: event.leads.primary_email,
            lead_phone: event.leads.primary_phone,
            event_date: event.event_date,
            funnel_id: event.funnel_id,
            source: event.event_source,
            revenue: event.revenue,
            cash: event.cash,
            is_spam: event.is_spam,
            created_at: event.created_at
          };
          const row = this.createDataRow(item);
          tbody.appendChild(row);
        });

        this.loadedRows += data.length;
        this.updateLoadMoreButton();
      } catch (err) {
        console.error('❌ Error loading more rows:', err);
        if (window.Toast) {
          window.Toast.error('Fehler beim Laden weiterer Zeilen');
        }
      }
    },

    async deleteEvent(eventId) {
      if (!confirm('Möchten Sie dieses Event wirklich löschen?')) {
        return;
      }

      try {
        const { error } = await window.SupabaseClient
          .from('events')
          .delete()
          .eq('id', eventId);

        if (error) {
          console.error('❌ Error deleting event:', error);
          if (window.Toast) {
            window.Toast.error('Fehler beim Löschen des Events');
          }
          return;
        }

        if (window.Toast) {
          window.Toast.success('Event erfolgreich gelöscht');
        }

        await this.loadTabData();
      } catch (err) {
        console.error('❌ Error deleting event:', err);
        if (window.Toast) {
          window.Toast.error('Fehler beim Löschen des Events');
        }
      }
    },

    async toggleSpam(leadId, currentIsSpam) {
      const newIsSpam = !currentIsSpam;
      try {
        const { error: leadError } = await window.SupabaseClient
          .from('leads')
          .update({
            is_spam: newIsSpam,
            lead_status: newIsSpam ? 'spam' : 'new',
          })
          .eq('id', leadId);

        if (leadError) {
          console.error('❌ Error toggling spam on lead:', leadError);
          if (window.Toast) window.Toast.error('Fehler beim Aktualisieren');
          return;
        }

        const { error: eventError } = await window.SupabaseClient
          .from('events')
          .update({ is_spam: newIsSpam })
          .eq('lead_id', leadId);

        if (eventError) {
          console.error('❌ Error toggling spam on events:', eventError);
          if (window.Toast) window.Toast.error('Fehler beim Aktualisieren der Events');
          return;
        }

        if (window.Toast) {
          window.Toast.success(newIsSpam ? 'Als Spam markiert' : 'Spam-Markierung entfernt');
        }
        await this.loadTabData();
      } catch (err) {
        console.error('❌ Error toggling spam:', err);
        if (window.Toast) window.Toast.error('Fehler beim Aktualisieren');
      }
    },

    openConversionModal() {
      const existing = document.getElementById('conversionModal');
      if (existing) existing.remove();

      const eventType = EVENT_TYPES.find(t => t.id === this.currentTab);
      const label = eventType ? eventType.label : 'Event';
      const singular = label.endsWith('s') ? label.slice(0, -1) : label;
      const icon = eventType ? eventType.icon : '➕';

      const funnels = window.FunnelAPI?.loadFunnels() || [];
      const funnelOptions = funnels.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
      const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

      const modal = document.createElement('div');
      modal.id = 'conversionModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content unit-import-modal">
          <div class="modal-header">
            <h2>${icon} ${singular} erfassen</h2>
            <button class="close-btn" id="conversionModalCloseBtn">×</button>
          </div>
          <div class="unit-import-tabs">
            <button class="unit-import-tab active" data-tab="manual">Manuell</button>
            <button class="unit-import-tab" data-tab="csv">CSV hochladen</button>
          </div>
          <div id="convTabManual" class="unit-import-tab-content" style="display:block;">
            <div class="modal-body">
              <div class="form-group">
                <label>Name</label>
                <input type="text" id="convName" placeholder="Max Mustermann" />
              </div>
              <div class="form-group">
                <label>E-Mail *</label>
                <input type="email" id="convEmail" placeholder="email@beispiel.de" />
              </div>
              <div class="form-group">
                <label>Telefon</label>
                <input type="text" id="convPhone" placeholder="+49 ..." />
              </div>
              <div class="form-group">
                <label>Funnel</label>
                <select id="convFunnel">
                  <option value="">Kein Funnel</option>
                  ${funnelOptions}
                </select>
              </div>
              <div class="form-group">
                <label>Zeitpunkt</label>
                <input type="datetime-local" id="convDate" value="${nowLocal}" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" id="convManualCancelBtn">Abbrechen</button>
              <button class="btn-primary" id="convManualSaveBtn">Erstellen</button>
            </div>
          </div>
          <div id="convTabCsv" class="unit-import-tab-content" style="display:none;">
            <div class="modal-body">
              <p style="color: #7f8c8d; font-size: 14px; margin-bottom: 16px;">
                CSV-Datei mit den Event-Daten hochladen. Spalten werden im nächsten Schritt zugeordnet.
              </p>
              <div class="file-upload-area" id="convCsvDropZone">
                <div class="upload-icon">📂</div>
                <div>CSV-Datei hier ablegen oder klicken</div>
                <input type="file" id="convCsvFileInput" accept=".csv" style="display:none;" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" id="convCsvCancelBtn">Abbrechen</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Tab switching
      modal.querySelectorAll('.unit-import-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          modal.querySelectorAll('.unit-import-tab').forEach(t => t.classList.remove('active'));
          modal.querySelectorAll('.unit-import-tab-content').forEach(c => c.style.display = 'none');
          tab.classList.add('active');
          const target = modal.querySelector(`#convTab${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`);
          if (target) target.style.display = 'block';
        });
      });

      modal.querySelector('#conversionModalCloseBtn').addEventListener('click', () => modal.remove());
      modal.querySelector('#convManualCancelBtn').addEventListener('click', () => modal.remove());
      modal.querySelector('#convCsvCancelBtn').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

      // Manual save → reuse existing createLead logic
      modal.querySelector('#convManualSaveBtn').addEventListener('click', () => {
        const email = modal.querySelector('#convEmail').value.trim();
        if (!email) { window.Toast?.error('E-Mail ist erforderlich'); return; }
        const name = modal.querySelector('#convName').value.trim();
        const phone = modal.querySelector('#convPhone').value.trim();
        const funnelId = modal.querySelector('#convFunnel').value;
        const dateVal = modal.querySelector('#convDate').value;
        const eventDate = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
        modal.remove();
        this._saveConversionEntry({ email, name, phone, funnelId, eventDate });
      });

      // CSV drop zone → pass file to CSVImportDatapool
      const dropZone = modal.querySelector('#convCsvDropZone');
      const fileInput = modal.querySelector('#convCsvFileInput');
      const launchCsvImport = (file) => {
        modal.remove();
        if (window.CSVImportDatapool) {
          window.CSVImportDatapool.openModal(this.currentTab);
          // Pre-load file after modal is mounted
          setTimeout(() => {
            const dp = window.CSVImportDatapool;
            if (dp._processFile) dp._processFile(file);
          }, 100);
        }
      };
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
      dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) launchCsvImport(e.dataTransfer.files[0]); });
      fileInput.addEventListener('change', () => { if (fileInput.files[0]) launchCsvImport(fileInput.files[0]); });
    },

    openAddLeadModal() {
      const modal = this.createLeadModal(null);
      document.body.appendChild(modal);
    },

    async openEditLeadModal(leadId) {
      try {
        const { data: lead, error } = await window.SupabaseClient
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .maybeSingle();

        if (error || !lead) {
          console.error('❌ Error loading lead:', error);
          if (window.Toast) {
            window.Toast.error('Lead nicht gefunden');
          }
          return;
        }

        const modal = this.createLeadModal(lead);
        document.body.appendChild(modal);
      } catch (err) {
        console.error('❌ Error opening edit modal:', err);
        if (window.Toast) {
          window.Toast.error('Fehler beim Laden der Lead-Daten');
        }
      }
    },

    createLeadModal(lead) {
      const isEdit = lead !== null;
      const modal = document.createElement('div');
      modal.id = 'leadModal';
      modal.className = 'modal';

      const funnels = FunnelAPI.loadFunnels();
      const funnelOptions = funnels.map(f =>
        `<option value="${f.id}" ${lead && lead.funnel_id === f.id ? 'selected' : ''}>${f.name}</option>`
      ).join('');

      // Default datetime = now, formatted for datetime-local input
      const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);
      const existingDate = lead?.created_at
        ? new Date(new Date(lead.created_at) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : nowLocal;

      // Determine label for the modal title based on active tab
      const eventType = EVENT_TYPES.find(t => t.id === this.currentTab);
      const tabLabel = eventType ? eventType.label : 'Lead';

      modal.innerHTML = `
        <div class="modal-content lead-modal">
          <div class="modal-header">
            <h2>${isEdit ? 'Lead bearbeiten' : tabLabel + ' hinzufügen'}</h2>
            <button class="close-btn" onclick="document.getElementById('leadModal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Name *</label>
              <input type="text" id="leadName" value="${lead?.name || ''}" required />
            </div>

            <div class="form-group">
              <label>E-Mail *</label>
              <input type="email" id="leadEmail" value="${lead?.primary_email || ''}" required />
            </div>

            <div class="form-group">
              <label>Telefon</label>
              <input type="text" id="leadPhone" value="${lead?.primary_phone || ''}" />
            </div>

            <div class="form-group">
              <label>Funnel</label>
              <select id="leadFunnel">
                <option value="">Kein Funnel</option>
                ${funnelOptions}
              </select>
            </div>

            <div class="form-group">
              <label>Zeitpunkt der Buchung</label>
              <input type="datetime-local" id="leadBookingDate" value="${existingDate}" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="document.getElementById('leadModal').remove()">
              Abbrechen
            </button>
            <button class="btn-primary" id="saveLeadBtn">
              ${isEdit ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </div>
      `;

      const saveBtn = modal.querySelector('#saveLeadBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          if (isEdit) {
            this.updateLead(lead.id);
          } else {
            this.createLead();
          }
        });
      }

      // Click outside to close
      setTimeout(() => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.remove();
          }
        });
      }, 0);

      return modal;
    },

    async _saveConversionEntry({ email, name, phone, funnelId, eventDate }) {
      const userId = window.AuthAPI?.getUserId();
      if (!userId) { window.Toast?.error('Nicht eingeloggt'); return; }
      try {
        const { data: existingLead } = await window.SupabaseClient
          .from('leads').select('id').eq('user_id', userId).eq('primary_email', email).maybeSingle();

        let leadId;
        if (existingLead) {
          leadId = existingLead.id;
        } else {
          const { data: newLead, error: leadError } = await window.SupabaseClient
            .from('leads')
            .insert([{ user_id: userId, name: name || null, primary_email: email, emails: [email],
                        primary_phone: phone || null, phones: phone ? [phone] : [],
                        funnel_id: funnelId || null, lead_status: 'new',
                        metadata: { created_from: 'manual' }, created_at: eventDate }])
            .select().single();
          if (leadError) { console.error('❌ Lead erstellen fehlgeschlagen:', leadError); window.Toast?.error('Fehler beim Erstellen des Leads'); return; }
          leadId = newLead.id;
        }

        const { error: eventError } = await window.SupabaseClient
          .from('events')
          .insert([{ user_id: userId, lead_id: leadId, event_type: this.currentTab,
                      event_date: eventDate, funnel_id: funnelId || null,
                      is_spam: false, metadata: { created_from: 'manual' } }]);
        if (eventError) { console.error('❌ Event erstellen fehlgeschlagen:', eventError); window.Toast?.error('Fehler beim Erstellen des Events'); return; }

        window.Toast?.success('Erfolgreich erstellt');
        await this.loadTabData();
      } catch (err) {
        console.error('❌ _saveConversionEntry fehlgeschlagen:', err);
        window.Toast?.error('Fehler beim Speichern');
      }
    },

    async createLead() {
      const name = document.getElementById('leadName')?.value.trim();
      const email = document.getElementById('leadEmail')?.value.trim();
      const phone = document.getElementById('leadPhone')?.value.trim();
      const funnelId = document.getElementById('leadFunnel')?.value;
      const bookingDateRaw = document.getElementById('leadBookingDate')?.value;
      const bookingDate = bookingDateRaw ? new Date(bookingDateRaw).toISOString() : new Date().toISOString();

      if (!name || !email) {
        if (window.Toast) {
          window.Toast.error('Name und E-Mail sind erforderlich');
        }
        return;
      }

      const userId = window.AuthAPI.getUserId();

      try {
        // Check if lead already exists by email
        let lead = null;
        const { data: existingLead } = await window.SupabaseClient
          .from('leads')
          .select('id, name, primary_email')
          .eq('user_id', userId)
          .eq('primary_email', email)
          .maybeSingle();

        if (existingLead) {
          lead = existingLead;
        } else {
          const leadData = {
            user_id: userId,
            name,
            primary_email: email,
            emails: [email],
            primary_phone: phone || null,
            phones: phone ? [phone] : [],
            funnel_id: funnelId || null,
            lead_status: 'new',
            metadata: { created_from: 'manual' },
            created_at: bookingDate,
          };

          const { data: newLead, error: leadError } = await window.SupabaseClient
            .from('leads')
            .insert([leadData])
            .select()
            .single();

          if (leadError) {
            console.error('❌ Error creating lead:', leadError);
            console.error('Lead data attempted:', leadData);
            if (window.Toast) {
              window.Toast.error(`Fehler beim Erstellen des Leads: ${leadError.message || leadError.code || 'Unbekannter Fehler'}`);
            }
            return;
          }
          lead = newLead;
        }

        const eventData = {
          user_id: userId,
          lead_id: lead.id,
          event_type: this.currentTab,
          event_date: bookingDate,
          funnel_id: funnelId || null,
          is_spam: false,
          metadata: { created_from: 'manual' },
        };

        const { error: eventError } = await window.SupabaseClient
          .from('events')
          .insert([eventData]);

        if (eventError) {
          console.error('❌ Error creating event:', eventError);
          if (window.Toast) {
            window.Toast.error(`Fehler beim Erstellen des Events: ${eventError.message}`);
          }
          return;
        }

        if (window.Toast) {
          window.Toast.success('Erfolgreich erstellt');
        }

        document.getElementById('leadModal')?.remove();
        await this.loadTabData();
      } catch (err) {
        console.error('❌ Error creating lead:', err);
        if (window.Toast) {
          window.Toast.error('Fehler beim Erstellen des Leads');
        }
      }
    },

    async updateLead(leadId) {
      const name = document.getElementById('leadName')?.value.trim();
      const email = document.getElementById('leadEmail')?.value.trim();
      const phone = document.getElementById('leadPhone')?.value.trim();
      const source = document.getElementById('leadSource')?.value.trim();
      const utmCampaign = document.getElementById('leadUtmCampaign')?.value.trim();
      const country = document.getElementById('leadCountry')?.value.trim();
      const funnelId = document.getElementById('leadFunnel')?.value;

      if (!name || !email) {
        if (window.Toast) {
          window.Toast.error('Name und E-Mail sind erforderlich');
        }
        return;
      }

      try {
        const { data: currentLead } = await window.SupabaseClient
          .from('leads')
          .select('emails, phones')
          .eq('id', leadId)
          .maybeSingle();

        let emails = currentLead?.emails || [];
        if (!emails.includes(email)) {
          emails = [email, ...emails];
        }

        let phones = currentLead?.phones || [];
        if (phone && !phones.includes(phone)) {
          phones = [phone, ...phones];
        }

        const leadData = {
          name,
          primary_email: email,
          emails,
          primary_phone: phone || null,
          phones,
          source: source || null,
          utm_campaign: utmCampaign || '',
          country: country || '',
          funnel_id: funnelId || null
        };

        const { error } = await window.SupabaseClient
          .from('leads')
          .update(leadData)
          .eq('id', leadId);

        if (error) {
          console.error('❌ Error updating lead:', error);
          if (window.Toast) {
            window.Toast.error('Fehler beim Aktualisieren des Leads');
          }
          return;
        }

        if (window.Toast) {
          window.Toast.success('Lead erfolgreich aktualisiert');
        }

        document.getElementById('leadModal')?.remove();
        await this.loadTabData();
      } catch (err) {
        console.error('❌ Error updating lead:', err);
        if (window.Toast) {
          window.Toast.error('Fehler beim Aktualisieren des Leads');
        }
      }
    },

    async deleteLead(leadId) {
      if (!confirm('Möchten Sie diesen Lead wirklich löschen? Dies wird auch alle zugehörigen Events löschen.')) {
        return;
      }

      try {
        const { error } = await window.SupabaseClient
          .from('leads')
          .delete()
          .eq('id', leadId);

        if (error) {
          console.error('❌ Error deleting lead:', error);
          if (window.Toast) {
            window.Toast.error('Fehler beim Löschen des Leads');
          }
          return;
        }

        if (window.Toast) {
          window.Toast.success('Lead erfolgreich gelöscht');
        }

        await this.loadTabData();
      } catch (err) {
        console.error('❌ Error deleting lead:', err);
        if (window.Toast) {
          window.Toast.error('Fehler beim Löschen des Leads');
        }
      }
    },

    async openLeadDetail(leadId) {
      try {
        const { data: lead, error: leadError } = await window.SupabaseClient
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .maybeSingle();

        if (leadError || !lead) {
          console.error('❌ Error loading lead:', leadError);
          if (window.Toast) {
            window.Toast.error('Lead nicht gefunden');
          }
          return;
        }

        // 🔍 DEBUG: Check lead metadata
        console.log('📋 Lead Metadata:', lead.metadata);
        if (lead.metadata) {
          console.log('  - survey_questions (CSV):', lead.metadata.survey_questions);
          console.log('  - typeform_answers (Typeform):', lead.metadata.typeform_answers);
        }

        const { data: events, error: eventsError } = await window.SupabaseClient
          .from('events')
          .select('*')
          .eq('lead_id', leadId)
          .order('event_date', { ascending: false })
          .order('created_at', { ascending: false });
        
        // Additional client-side sort: If same timestamp, survey comes before survey_qualified
        if (events && events.length > 1) {
          events.sort((a, b) => {
            const dateA = new Date(a.event_date).getTime();
            const dateB = new Date(b.event_date).getTime();
            
            if (dateA !== dateB) {
              return dateB - dateA; // Newer first
            }
            
            // Same date: survey should appear AFTER survey_qualified in display (below)
            // Since we're showing newest first, survey_qualified should be higher (later in array = earlier in display)
            if (a.event_type === 'survey' && b.event_type === 'survey_qualified') {
              return 1; // a comes after b (survey below)
            }
            if (a.event_type === 'survey_qualified' && b.event_type === 'survey') {
              return -1; // a comes before b (survey_qualified above)
            }
            
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        }

        if (eventsError) {
          console.error('❌ Error loading events:', eventsError);
        }

        // Attribution lookup via h_ad_id → traffic_metrics
        let attribution = null;
        if (lead.h_ad_id) {
          const { data: attrData } = await window.SupabaseClient
            .from('traffic_metrics')
            .select('campaign_name, ad_set_name, ad_name')
            .eq('ad_id', lead.h_ad_id)
            .eq('level', 'ad')
            .limit(1)
            .maybeSingle();
          attribution = attrData || null;
        }

        // Load call_events for this lead (Close.io setting + closing calls)
        const { data: callEvents } = await window.SupabaseClient
          .from('call_events')
          .select('*')
          .eq('lead_email', lead.primary_email)
          .order('appointment_date', { ascending: false });

        this.showLeadDetailModal(lead, events || [], attribution, callEvents || []);
      } catch (err) {
        console.error('❌ Error opening lead detail:', err);
        if (window.Toast) {
          window.Toast.error('Fehler beim Laden der Lead-Daten');
        }
      }
    },

    showLeadDetailModal(lead, events, attribution = null, callEvents = []) {
      const existingModal = document.getElementById('leadDetailModal');
      if (existingModal) existingModal.remove();

      // Check if there are any survey questions in events OR lead metadata
      const hasSurveyData =
        // Any survey/surveyQuali event = always show tab (webhook leads)
        events.some(e => e.event_type === 'survey' || e.event_type === 'surveyQuali') ||
        // Check events for stored answers (CSV import)
        events.some(e =>
          e.metadata && (
            (e.metadata.survey_questions && Object.keys(e.metadata.survey_questions).length > 0) ||
            (e.metadata.typeform_answers && Object.keys(e.metadata.typeform_answers).length > 0) ||
            (e.metadata.answers && Array.isArray(e.metadata.answers) && e.metadata.answers.length > 0)
          )
        ) ||
        // Check lead metadata (Typeform stores in lead.metadata)
        (lead.metadata && (
          (lead.metadata.survey_questions && Object.keys(lead.metadata.survey_questions).length > 0) ||
          (lead.metadata.typeform_answers && Object.keys(lead.metadata.typeform_answers).length > 0)
        ));

      // Check if there are any closing call bookings or Close.io call_events
      const hasClosingCallData = events.some(e =>
        e.event_type === 'closingBooking' || e.event_type === 'closingTermin' || e.event_type === 'closingCall'
      ) || callEvents.length > 0;

      const hasExtraTabs = hasSurveyData || hasClosingCallData;

      // Traffic Source: Facebook Ads wenn Attribution vorhanden, sonst roher source-Wert
      const trafficSourceLabel = attribution ? 'Facebook Ads' : (lead.source || '-');

      // Funnel Name: Name aus FunnelAPI laden, Fallback auf ID
      const funnels = window.FunnelAPI?.loadFunnels() || [];
      const matchedFunnel = funnels.find(f => f.id === lead.funnel_id);
      const funnelLabel = matchedFunnel ? matchedFunnel.name : (lead.funnel_id || '-');

      console.log('🔍 hasSurveyData:', hasSurveyData);
      console.log('  - Events with survey data:', events.filter(e => e.metadata && (e.metadata.survey_questions || e.metadata.typeform_answers)).length);
      console.log('  - Lead has survey data:', lead.metadata && (lead.metadata.survey_questions || lead.metadata.typeform_answers));

      const modal = document.createElement('div');
      modal.id = 'leadDetailModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content lead-detail-modal">
          <div class="lead-detail-header">
            <h2>${lead.name || 'Unbekannt'}</h2>
            <button class="close-btn" onclick="document.getElementById('leadDetailModal').remove()">×</button>
          </div>

          ${hasExtraTabs ? `
            <div class="lead-detail-tabs">
              <button class="lead-tab active" data-tab="journey">User Journey</button>
              ${hasSurveyData ? `<button class="lead-tab" data-tab="survey">Survey</button>` : ''}
              ${hasClosingCallData ? `<button class="lead-tab" data-tab="closing">Closing Call</button>` : ''}
            </div>
          ` : ''}

          <div class="lead-detail-content">
            <div id="journeyTab" class="lead-tab-content active">
              <div class="lead-detail-info">
                <div class="info-group">
                  <strong>E-Mail:</strong>
                  <span style="display:inline-flex;align-items:center;gap:6px;">
                    ${lead.primary_email || '-'}
                    ${lead.primary_email ? `<button onclick="navigator.clipboard.writeText('${lead.primary_email}').then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='⎘',1500)})" title="E-Mail kopieren" style="background:none;border:none;cursor:pointer;font-size:17px;padding:0 2px;color:#888;line-height:1;">⎘</button>` : ''}
                  </span>
                </div>
                <div class="info-group">
                  <strong>Telefon:</strong> ${lead.primary_phone || '-'}
                </div>
                <div class="info-group">
                  <strong>Traffic Source:</strong> ${trafficSourceLabel}
                </div>
                <div class="info-group">
                  <strong>Funnel:</strong> ${funnelLabel}
                </div>
                <div class="info-group">
                  <strong>Erstellt am:</strong> ${new Date(lead.created_at).toLocaleString('de-DE')}
                </div>
              </div>
              <div class="lead-timeline">
                <h3>Timeline</h3>
                ${this.renderTimelineWithoutSurvey(events, attribution, callEvents)}
              </div>
            </div>

            ${hasSurveyData ? `
              <div id="surveyTab" class="lead-tab-content">
                ${this.renderSurveyAnswers(lead, events)}
              </div>
            ` : ''}
            ${hasClosingCallData ? `
              <div id="closingTab" class="lead-tab-content">
                ${this.renderClosingCallDetails(events, callEvents)}
              </div>
            ` : ''}
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Add tab switching functionality
      if (hasExtraTabs) {
        const tabButtons = modal.querySelectorAll('.lead-tab');
        tabButtons.forEach(btn => {
          btn.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            modal.querySelectorAll('.lead-tab').forEach(t => t.classList.remove('active'));
            modal.querySelectorAll('.lead-tab-content').forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab
            btn.classList.add('active');
            const tabName = btn.dataset.tab;
            const content = modal.querySelector(`#${tabName}Tab`);
            if (content) {
              content.classList.add('active');
            }
          });
        });
      }

      // Click outside to close
      setTimeout(() => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.remove();
          }
        });
      }, 0);
    },

    renderTimelineWithoutSurvey(events, attribution = null, callEvents = []) {
      if ((!events || events.length === 0) && callEvents.length === 0) {
        return '<div class="timeline-empty">Keine Events vorhanden</div>';
      }

      const eventLabels = {
        lead: '📩 Lead',
        survey: '📋 Survey',
        survey_qualified: '✅ Survey Qualified',
        surveyQuali: '✅ Survey Quali',
        settingBooking: '🥈 Setting Booking',
        settingTermin: '📆 Setting Termin',
        settingCall: '☎️ Setting Call',
        closingBooking: '🥇 Closing Booking',
        closingTermin: '✅ Closing Termin',
        closingCall: '📞 Closing Call',
        unit: '💰 Unit'
      };

      // Map call_event status → readable label for timeline
      const callStatusLabels = {
        showed:      { setting: '☎️ Setting Call – Qualifiziert', closing: '📞 Closing Call – Stattgefunden' },
        no_show:     { setting: '🚫 Setting Call – No Show',      closing: '🚫 Closing Call – No Show' },
        canceled:    { setting: '❌ Setting Call – Abgesagt',     closing: '❌ Closing Call – Abgesagt' },
        disqualified:{ setting: '🔴 Setting Call – Disqualifiziert', closing: '🔴 Closing Call – Disqualifiziert' },
        scheduled:   { setting: '📆 Setting Call – Geplant',     closing: '📆 Closing Call – Geplant' },
      };

      // Build timeline entries from events table
      const allItems = (events || []).map(event => {
        const ts = new Date(event.event_date).getTime();
        const label = eventLabels[event.event_type] || event.event_type;
        const revenue = event.revenue > 0 ? ` – ${event.revenue.toFixed(2)} €` : '';
        const html = `
          <div class="timeline-item">
            <div class="timeline-date">${new Date(event.event_date).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</div>
            <div class="timeline-content">
              <div class="timeline-label">${label}</div>
              <div class="timeline-details">Funnel: ${event.funnel_id || '-'} | Quelle: ${event.source || '-'}${revenue}</div>
            </div>
          </div>`;
        return { ts, html };
      });

      // Add call_events to timeline (skip setting+showed — already represented by closingTermin event)
      for (const ce of (callEvents || [])) {
        if (ce.call_type === 'setting' && ce.status === 'showed') continue; // closingTermin covers this
        const date = ce.appointment_date ? new Date(ce.appointment_date) : null;
        if (!date) continue;
        const labels = callStatusLabels[ce.status] || {};
        const label = labels[ce.call_type] || `📞 ${ce.call_type} – ${ce.status}`;
        const detail = ce.assigned_to ? `Bearbeitet von: ${ce.assigned_to}` : 'Close.io';
        const html = `
          <div class="timeline-item" style="border-left:3px solid #e9ecef;padding-left:8px;">
            <div class="timeline-date">${date.toLocaleDateString('de-DE')}</div>
            <div class="timeline-content">
              <div class="timeline-label">${label}</div>
              <div class="timeline-details">${detail}</div>
            </div>
          </div>`;
        allItems.push({ ts: date.getTime(), html });
      }

      // Sort descending by timestamp
      allItems.sort((a, b) => b.ts - a.ts);

      // Ad-Click entry (2 min before earliest)
      if (attribution && attribution.ad_name && allItems.length > 0) {
        const earliest = allItems[allItems.length - 1].ts;
        const clickTime = new Date(earliest - 2 * 60 * 1000);
        allItems.push({
          ts: clickTime.getTime(),
          html: `
            <div class="timeline-item timeline-item-ad-click">
              <div class="timeline-date">${clickTime.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</div>
              <div class="timeline-content">
                <div class="timeline-label">🖱️ Auf Ad geklickt</div>
                <div class="timeline-details timeline-ad-name">${attribution.ad_name}</div>
              </div>
            </div>`
        });
      }

      return allItems.map(i => i.html).join('');
    },

    renderSurveyAnswers(lead, events) {
      let html = '';
      let surveyEventFound = false;

      // 1. Check events for survey_questions (CSV), typeform_answers, or raw answers (webhook fallback)
      const surveyEvents = events.filter(e =>
        e.event_type === 'survey' || e.event_type === 'surveyQuali' ||
        (e.metadata && (e.metadata.survey_questions || e.metadata.typeform_answers))
      );

      // Pre-check: does any survey event have actual answers?
      const anyEventHasAnswers = surveyEvents.some(e => {
        const q = (e.metadata?.survey_questions) || (e.metadata?.typeform_answers);
        if (q && Object.keys(q).length > 0) return true;
        if (e.metadata?.answers && Array.isArray(e.metadata.answers)) {
          return e.metadata.answers.some(a => a.type !== 'email' && a.type !== 'phone_number');
        }
        return false;
      });

      surveyEvents.forEach(event => {
        surveyEventFound = true;
        const eventDateTime = new Date(event.event_date);
        const date = eventDateTime.toLocaleDateString('de-DE');
        const time = eventDateTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        // Get questions: prefer formatted answers, fall back to raw answers array
        let questions = (event.metadata?.survey_questions) || (event.metadata?.typeform_answers) || null;

        // If questions is empty/null but raw answers exist, build from raw array
        if ((!questions || Object.keys(questions).length === 0) && event.metadata?.answers && Array.isArray(event.metadata.answers)) {
          questions = {};
          event.metadata.answers.forEach(a => {
            if (a.type === 'email' || a.type === 'phone_number') return;
            let val = a[a.type];
            if (val && typeof val === 'object' && val.label) val = val.label;
            if (val && typeof val === 'object' && Array.isArray(val.labels)) val = val.labels.join(', ');
            if (typeof val === 'boolean') val = val ? 'Ja' : 'Nein';
            if (typeof val === 'number') val = String(val);
            const label = a.field?.ref || a.field?.id || 'Frage';
            if (val) questions[label] = String(val);
          });
        }

        // No answers: skip silently if answers already exist anywhere (lead metadata or other events)
        if (!questions || Object.keys(questions).length === 0) {
          if (html.length > 0 || anyEventHasAnswers) return; // hide duplicate empty event
          const icon = event.event_type === 'surveyQuali' ? '✅' : '📋';
          const label = event.event_type === 'surveyQuali' ? 'Survey Qualifiziert' : 'Typeform Survey';
          html += `
            <div class="survey-section">
              <div class="survey-section-header">
                <span class="survey-icon">${icon}</span>
                <span class="survey-event-type">${label}</span>
                <span class="survey-date">${date} ${time}</span>
              </div>
              <div class="survey-empty" style="padding:12px 0;color:#999;font-size:14px;">Survey erfasst – Antworten nicht verfügbar</div>
            </div>
          `;
          return;
        }

        let questionsHTML = '';
        Object.entries(questions).forEach(([question, answer]) => {
          let displayAnswer = answer;
          if (typeof answer === 'object' && answer !== null && answer.label) displayAnswer = answer.label;
          questionsHTML += `
            <div class="survey-answer-item">
              <div class="survey-question">${question}</div>
              <div class="survey-answer">${displayAnswer}</div>
            </div>
          `;
        });

        const icon = event.event_type === 'surveyQuali' ? '✅' : '📋';
        const label = event.event_type === 'surveyQuali' ? 'Survey Qualifiziert' : 'Typeform Survey';
        html += `
          <div class="survey-section">
            <div class="survey-section-header">
              <span class="survey-icon">${icon}</span>
              <span class="survey-event-type">${label}</span>
              <span class="survey-date">${date} ${time}</span>
            </div>
            <div class="survey-answers">
              ${questionsHTML}
            </div>
          </div>
        `;
      });

      // 2. Fallback: lead.metadata.typeform_answers – only if no event rendered answers
      if (!html && lead.metadata && lead.metadata.typeform_answers && Object.keys(lead.metadata.typeform_answers).length > 0) {
        const submittedAt = lead.metadata.typeform_submitted_at || lead.created_at;
        const eventDateTime = new Date(submittedAt);
        const date = eventDateTime.toLocaleDateString('de-DE');
        const time = eventDateTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        let questionsHTML = '';
        Object.entries(lead.metadata.typeform_answers).forEach(([question, answer]) => {
          let displayAnswer = answer;
          if (typeof answer === 'object' && answer !== null && answer.label) displayAnswer = answer.label;
          questionsHTML += `
            <div class="survey-answer-item">
              <div class="survey-question">${question}</div>
              <div class="survey-answer">${displayAnswer}</div>
            </div>
          `;
        });

        html += `
          <div class="survey-section">
            <div class="survey-section-header">
              <span class="survey-icon">📝</span>
              <span class="survey-event-type">Typeform Survey</span>
              <span class="survey-date">${date} ${time}</span>
            </div>
            <div class="survey-answers">
              ${questionsHTML}
            </div>
          </div>
        `;
      }

      if (!html) {
        if (surveyEventFound) {
          return '<div class="survey-empty">Survey erfasst – Antworten nicht verfügbar</div>';
        }
        return '<div class="survey-empty">Keine Survey-Daten vorhanden</div>';
      }

      return html;
    },

    renderClosingCallDetails(events, callEvents = []) {
      // Only show Calendly bookings — closingTermin from close_crm is shown in the Close.io section below
      const closingEvents = events.filter(e =>
        e.event_type === 'closingBooking' && e.event_source !== 'close_crm'
      );

      if (closingEvents.length === 0) {
        return '<div class="survey-empty">Keine Closing-Call-Daten vorhanden</div>';
      }

      const eventLabels = {
        closingBooking: { icon: '🥇', label: 'Closing Call gebucht' },
        closingTermin:  { icon: '✅', label: 'Closing Termin bestätigt' },
        closingCall:    { icon: '📞', label: 'Closing Call' }
      };

      const calendarySections = closingEvents.map(event => {
        const meta = event.metadata || {};
        const { icon, label } = eventLabels[event.event_type] || { icon: '📅', label: event.event_type };

        const bookedAt = meta.booking_created_at || event.event_date;
        const bookedStr = new Date(bookedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

        let scheduledStr = '-';
        if (meta.call_scheduled_time) {
          scheduledStr = new Date(meta.call_scheduled_time).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' });
        }

        let bookingAnswersItems = '';
        if (meta.booking_answers && Object.keys(meta.booking_answers).length > 0) {
          Object.entries(meta.booking_answers).forEach(([question, answer]) => {
            if (!answer) return;
            bookingAnswersItems += `
              <div class="survey-answer-item">
                <div class="survey-question">${question}</div>
                <div class="survey-answer">${answer}</div>
              </div>`;
          });
        }

        return `
          <div class="survey-section">
            <div class="survey-section-header">
              <span class="survey-icon">${icon}</span>
              <span class="survey-event-type">${label}</span>
              <span class="survey-date">${new Date(event.event_date).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <div class="survey-answers">
              <div class="survey-answer-item">
                <div class="survey-question">Call findet statt am</div>
                <div class="survey-answer closing-call-scheduled">${scheduledStr}</div>
              </div>
              ${bookingAnswersItems}
              <div class="survey-answer-item">
                <div class="survey-question">Gebucht am</div>
                <div class="survey-answer">${bookedStr}</div>
              </div>
            </div>
          </div>`;
      }).join('');

      // Close.io call history
      const callStatusConfig = {
        showed:       { setting: { icon: '✅', label: 'Setting Call – Qualifiziert' },   closing: { icon: '✅', label: 'Closing Call – Stattgefunden' } },
        no_show:      { setting: { icon: '🚫', label: 'Setting Call – No Show' },        closing: { icon: '🚫', label: 'Closing Call – No Show' } },
        canceled:     { setting: { icon: '❌', label: 'Setting Call – Abgesagt' },       closing: { icon: '❌', label: 'Closing Call – Abgesagt' } },
        disqualified: { setting: { icon: '🔴', label: 'Setting Call – Disqualifiziert' },closing: { icon: '🔴', label: 'Closing Call – Disqualifiziert' } },
        scheduled:    { setting: { icon: '📆', label: 'Setting Call – Geplant' },        closing: { icon: '📆', label: 'Closing Call – Geplant' } },
      };

      let closeSection = '';
      if (callEvents.length > 0) {
        // Show oldest first: Setting Call → Closing Call Geplant → Closing Call Stattgefunden
        const sortedCalls = [...callEvents].sort((a, b) => {
          const da = a.appointment_date || '';
          const db = b.appointment_date || '';
          if (da !== db) return da < db ? -1 : 1;
          // Same date: setting before closing
          if (a.call_type !== b.call_type) return a.call_type === 'setting' ? -1 : 1;
          // Same type: scheduled before showed
          const order = { scheduled: 0, showed: 1, no_show: 1, canceled: 1, disqualified: 1 };
          return (order[a.status] ?? 2) - (order[b.status] ?? 2);
        });
        const rows = sortedCalls.map(ce => {
          const cfg = (callStatusConfig[ce.status] || {})[ce.call_type] || { icon: '📞', label: `${ce.call_type} – ${ce.status}` };
          const dateStr = ce.appointment_date ? new Date(ce.appointment_date).toLocaleDateString('de-DE') : '-';
          return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f0f0f0;">
              <span style="font-size:16px;">${cfg.icon}</span>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:600;">${cfg.label}</div>
                <div style="font-size:12px;color:#888;">${dateStr}${ce.assigned_to ? ` · ${ce.assigned_to}` : ''}</div>
              </div>
            </div>`;
        }).join('');

        closeSection = `
          <div class="survey-section" style="margin-top:16px;">
            <div class="survey-section-header">
              <span class="survey-icon">📞</span>
              <span class="survey-event-type">Close.io Anrufe</span>
            </div>
            <div style="padding:0 4px;">${rows}</div>
          </div>`;
      }

      return (calendarySections || '') + closeSection;
    },

    // ============================================
    // UNIT IMPORT
    // ============================================

    openUnitImportModal(defaultTab = 'manual') {
      const existing = document.getElementById('unitImportModal');
      if (existing) existing.remove();

      const funnels = window.FunnelAPI?.loadFunnels() || [];
      const funnelOptions = funnels.map(f =>
        `<option value="${f.id}">${f.name}</option>`
      ).join('');

      // Pre-compute Google Sheet link HTML (avoid nested template literals)
      const unitSavedUrl = localStorage.getItem('clarity_units_sheet_url') || '';
      let unitSheetHtml = '<div class="unit-csv-format-hint" style="margin-top: 8px;"><div style="font-size: 13px; color: #7f8c8d; margin-bottom: 6px;">Dein Google Sheet</div>';
      if (unitSavedUrl) {
        unitSheetHtml += '<div style="display: flex; align-items: center; gap: 8px;"><a id="unitSheetLink" href="' + unitSavedUrl + '" target="_blank" rel="noopener noreferrer" style="flex: 1; color: #1a73e8; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📊 Google Sheet öffnen</a><button id="unitSheetEditBtn" class="btn-secondary" style="font-size: 11px; padding: 4px 8px; flex-shrink: 0;">✏️ Ändern</button></div><div id="unitSheetInputWrap" style="display:none; margin-top: 6px;">';
      } else {
        unitSheetHtml += '<div id="unitSheetInputWrap">';
      }
      unitSheetHtml += '<div style="display: flex; gap: 8px; margin-top: 4px;"><input id="unitSheetInput" type="url" placeholder="https://docs.google.com/spreadsheets/d/..." value="' + unitSavedUrl + '" style="flex: 1; font-size: 13px; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px;" /><button id="unitSheetSaveBtn" class="btn-primary" style="font-size: 12px; padding: 6px 12px; flex-shrink: 0;">Speichern</button></div></div></div>';

      const modal = document.createElement('div');
      modal.id = 'unitImportModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content unit-import-modal">
          <div class="modal-header">
            <h2>💰 Unit erfassen</h2>
            <button class="close-btn" id="unitImportCloseBtn">×</button>
          </div>

          <div class="unit-import-tabs">
            <button class="unit-import-tab active" data-tab="manual">Manuell</button>
            <button class="unit-import-tab" data-tab="csv">CSV hochladen</button>
          </div>

          <!-- MANUELL TAB -->
          <div id="unitTabManual" class="unit-import-tab-content active">
            <div class="modal-body unit-import-form">
              <div class="unit-form-grid">
                <div class="form-group">
                  <label>E-Mail <span class="required">*</span></label>
                  <input type="email" id="unitEmail" placeholder="kunde@beispiel.de" />
                  <small class="form-hint">Bestehender Lead wird automatisch gefunden</small>
                </div>
                <div class="form-group">
                  <label>Name (optional)</label>
                  <input type="text" id="unitName" placeholder="Max Mustermann" />
                </div>
                <div class="form-group">
                  <label>Datum des Abschlusses <span class="required">*</span></label>
                  <input type="date" id="unitDate" value="${new Date().toISOString().split('T')[0]}" />
                </div>
                <div class="form-group">
                  <label>Funnel</label>
                  <select id="unitFunnel">
                    <option value="">— Kein Funnel —</option>
                    ${funnelOptions}
                  </select>
                </div>
                <div class="form-group">
                  <label>Revenue (gesamt) <span class="required">*</span></label>
                  <input type="number" id="unitRevenue" placeholder="5000" min="0" step="0.01" />
                </div>
                <div class="form-group">
                  <label>Upfront Cash <span class="required">*</span></label>
                  <input type="number" id="unitUfCash" placeholder="2000" min="0" step="0.01" />
                  <small class="form-hint">Sofortiger Zahlungseingang</small>
                </div>
              </div>

              <div class="unit-installments-section">
                <div class="unit-installments-header">
                  <h3>Raten (optional)</h3>
                  <button class="datapool-btn" id="addInstallmentBtn" type="button">+ Rate hinzufügen</button>
                </div>
                <div class="form-hint" style="margin-bottom: 12px;">
                  Nur ausfüllen wenn Revenue &gt; Upfront Cash. Raten werden für Projections gespeichert.
                </div>
                <div id="installmentsList"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" id="unitManualCancelBtn">Abbrechen</button>
              <button class="btn-primary" id="unitManualSaveBtn">Unit speichern</button>
            </div>
          </div>

          <!-- CSV TAB -->
          <div id="unitTabCsv" class="unit-import-tab-content" style="display:none;">
            <div class="modal-body">
              <div class="unit-csv-format-hint">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                  <div>
                    <strong>Spalten:</strong> <code>email, datum, revenue, uf_cash</code>
                    <div style="margin-top: 4px; color: #7f8c8d; font-size: 12px;">
                      Datum-Format: YYYY-MM-DD · Dezimaltrennzeichen: Punkt
                    </div>
                  </div>
                  <button id="unitCsvDownloadTemplate" class="btn-secondary" style="white-space: nowrap; flex-shrink: 0;">⬇️ Vorlage</button>
                </div>
              </div>
              ${unitSheetHtml}

              <div class="file-upload-area" id="unitCsvDropZone">
                <div class="upload-icon">📂</div>
                <div>CSV-Datei hier ablegen oder klicken</div>
                <input type="file" id="unitCsvFileInput" accept=".csv" style="display:none;" />
              </div>

              <div id="unitCsvPreview" style="display:none;">
                <div class="unit-csv-preview-table-wrap">
                  <table class="preview-table-inner">
                    <thead id="unitCsvPreviewHead"></thead>
                    <tbody id="unitCsvPreviewBody"></tbody>
                  </table>
                </div>
                <div id="unitCsvPreviewMeta" style="font-size:13px; color:#7f8c8d; margin-top:8px;"></div>
              </div>

            </div>
            <div class="modal-footer">
              <button class="btn-secondary" id="unitCsvCancelBtn">Abbrechen</button>
              <button class="btn-primary" id="unitCsvImportBtn" disabled>Importieren</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      this._bindUnitImportModal(modal);

      if (defaultTab === 'csv') {
        const csvTab = modal.querySelector('[data-tab="csv"]');
        if (csvTab) csvTab.click();
      }
    },

    _bindUnitImportModal(modal) {
      let csvRows = null;

      // Close
      modal.querySelector('#unitImportCloseBtn').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

      // Tab switching
      modal.querySelectorAll('.unit-import-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          modal.querySelectorAll('.unit-import-tab').forEach(t => t.classList.remove('active'));
          modal.querySelectorAll('.unit-import-tab-content').forEach(c => c.style.display = 'none');
          tab.classList.add('active');
          const target = modal.querySelector(`#unitTab${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`);
          if (target) target.style.display = 'block';
        });
      });

      // Cancel buttons
      modal.querySelector('#unitManualCancelBtn').addEventListener('click', () => modal.remove());
      modal.querySelector('#unitCsvCancelBtn').addEventListener('click', () => modal.remove());

      // Download CSV template
      modal.querySelector('#unitCsvDownloadTemplate').addEventListener('click', () => {
        const today = new Date().toISOString().slice(0, 10);
        const csv = `email,datum,revenue,uf_cash\nmax.mustermann@email.de,${today},3000,1500`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'clarity_units_vorlage.csv';
        a.click();
        URL.revokeObjectURL(url);
      });

      // Google Sheet link – save & edit
      modal.querySelector('#unitSheetSaveBtn')?.addEventListener('click', () => {
        const url = modal.querySelector('#unitSheetInput')?.value?.trim();
        if (!url) return;
        localStorage.setItem('clarity_units_sheet_url', url);
        this.openUnitImportModal('csv');
      });
      modal.querySelector('#unitSheetEditBtn')?.addEventListener('click', () => {
        const wrap = modal.querySelector('#unitSheetInputWrap');
        if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
      });

      // Add installment row
      modal.querySelector('#addInstallmentBtn').addEventListener('click', () => {
        this._addInstallmentRow(modal);
      });

      // Save manual
      modal.querySelector('#unitManualSaveBtn').addEventListener('click', () => {
        this._saveUnitManual(modal);
      });

      // CSV drop zone
      const dropZone = modal.querySelector('#unitCsvDropZone');
      const fileInput = modal.querySelector('#unitCsvFileInput');

      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) this._handleUnitCsvFile(modal, file, rows => { csvRows = rows; });
      });
      fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) this._handleUnitCsvFile(modal, fileInput.files[0], rows => { csvRows = rows; });
      });

      // CSV Import button
      modal.querySelector('#unitCsvImportBtn').addEventListener('click', () => {
        if (csvRows) this._importUnitCsvRows(modal, csvRows);
      });
    },

    _addInstallmentRow(modal) {
      const list = modal.querySelector('#installmentsList');
      const idx = list.children.length + 1;
      const row = document.createElement('div');
      row.className = 'installment-row';
      row.innerHTML = `
        <span class="installment-label">Rate ${idx}</span>
        <input type="date" class="installment-date" placeholder="Datum" />
        <input type="number" class="installment-amount" placeholder="Betrag" min="0" step="0.01" />
        <button class="btn-icon remove-installment-btn" type="button" title="Entfernen">✕</button>
      `;
      row.querySelector('.remove-installment-btn').addEventListener('click', () => {
        row.remove();
        // Re-label remaining rows
        modal.querySelectorAll('.installment-row').forEach((r, i) => {
          r.querySelector('.installment-label').textContent = `Rate ${i + 1}`;
        });
      });
      list.appendChild(row);
    },

    async _saveUnitManual(modal) {
      const email = modal.querySelector('#unitEmail').value.trim().toLowerCase();
      const name = modal.querySelector('#unitName').value.trim();
      const date = modal.querySelector('#unitDate').value;
      const funnelId = modal.querySelector('#unitFunnel').value || null;
      const revenue = parseFloat(modal.querySelector('#unitRevenue').value) || 0;
      const ufCash = parseFloat(modal.querySelector('#unitUfCash').value) || 0;

      if (!email || !date || !revenue) {
        window.Toast?.error('E-Mail, Datum und Revenue sind Pflichtfelder');
        return;
      }

      const saveBtn = modal.querySelector('#unitManualSaveBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Speichern...';

      try {
        const result = await this._saveUnitEntry({ email, name, date, funnelId, revenue, ufCash, installments: this._readInstallments(modal) });
        if (result.success) {
          window.Toast?.success(result.message);
          modal.remove();
          if (this.currentTab === 'unit') await this.loadTabData();
        } else {
          window.Toast?.error(result.error);
        }
      } catch (err) {
        console.error('❌ Unit save error:', err);
        window.Toast?.error('Fehler beim Speichern');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Unit speichern';
      }
    },

    _readInstallments(modal) {
      const rows = modal.querySelectorAll('.installment-row');
      const installments = [];
      rows.forEach((row, i) => {
        const dueDate = row.querySelector('.installment-date').value;
        const amount = parseFloat(row.querySelector('.installment-amount').value) || 0;
        if (dueDate && amount > 0) {
          installments.push({ installment_number: i + 1, due_date: dueDate, amount });
        }
      });
      return installments;
    },

    async _saveUnitEntry({ email, name, date, funnelId, revenue, ufCash, installments }) {
      const userId = window.AuthAPI?.getUserId();
      if (!userId) return { success: false, error: 'Nicht eingeloggt' };

      // 1. Lead suchen
      const { data: existingLead } = await window.SupabaseClient
        .from('leads')
        .select('id, name, funnel_id, source')
        .eq('user_id', userId)
        .eq('primary_email', email)
        .maybeSingle();

      let leadId;
      let isNewLead = false;

      if (existingLead) {
        leadId = existingLead.id;
      } else {
        // Neuer Lead – nicht zugeordnet
        isNewLead = true;
        const { data: newLead, error: leadError } = await window.SupabaseClient
          .from('leads')
          .insert([{
            user_id: userId,
            primary_email: email,
            emails: [email],
            name: name || null,
            source: null,
            lead_source: 'unit-import',
            funnel_id: funnelId,
            metadata: {}
          }])
          .select('id')
          .single();

        if (leadError) {
          console.error('❌ Lead create error:', leadError);
          return { success: false, error: `Lead konnte nicht erstellt werden: ${leadError.message}` };
        }
        leadId = newLead.id;
      }

      // 2. Unit Event anlegen
      const { data: unitEvent, error: eventError } = await window.SupabaseClient
        .from('events')
        .insert([{
          user_id: userId,
          lead_id: leadId,
          event_type: 'unit',
          event_date: date,
          funnel_id: funnelId || (existingLead?.funnel_id) || null,
          source: existingLead?.source || null,
          event_source: existingLead?.source || null,
          revenue,
          cash: ufCash,
          metadata: {}
        }])
        .select('id')
        .single();

      if (eventError) {
        console.error('❌ Event create error:', eventError);
        return { success: false, error: `Event konnte nicht erstellt werden: ${eventError.message}` };
      }

      // 3. Raten speichern
      if (installments.length > 0) {
        const ratenRows = installments.map(inst => ({
          user_id: userId,
          unit_event_id: unitEvent.id,
          lead_id: leadId,
          installment_number: inst.installment_number,
          due_date: inst.due_date,
          amount: inst.amount
        }));

        const { error: rateError } = await window.SupabaseClient
          .from('payment_schedule')
          .insert(ratenRows);

        if (rateError) {
          console.error('❌ Payment schedule error:', rateError);
          // Non-fatal: Unit wurde schon gespeichert
        }
      }

      const msg = isNewLead
        ? `Unit gespeichert. Neuer Lead angelegt (nicht zugeordnet) – bitte Funnel manuell prüfen.`
        : `Unit bei bestehendem Lead "${existingLead.name || email}" gespeichert.`;

      return { success: true, message: msg };
    },

    _handleUnitCsvFile(modal, file, onParsed) {
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) {
          window.Toast?.error('CSV hat keine Datenzeilen');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const required = ['email', 'datum', 'revenue', 'uf_cash'];
        const missing = required.filter(r => !headers.includes(r));
        if (missing.length > 0) {
          window.Toast?.error(`Fehlende Spalten: ${missing.join(', ')}`);
          return;
        }

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(',').map(c => c.trim());
          const row = {};
          headers.forEach((h, idx) => { row[h] = cells[idx] || ''; });
          if (row.email && row.datum) rows.push(row);
        }

        if (rows.length === 0) {
          window.Toast?.error('Keine gültigen Zeilen gefunden');
          return;
        }

        // Preview
        const previewArea = modal.querySelector('#unitCsvPreview');
        const thead = modal.querySelector('#unitCsvPreviewHead');
        const tbody = modal.querySelector('#unitCsvPreviewBody');
        const meta = modal.querySelector('#unitCsvPreviewMeta');

        thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        tbody.innerHTML = rows.slice(0, 5).map(row =>
          `<tr>${headers.map(h => `<td>${row[h] || '-'}</td>`).join('')}</tr>`
        ).join('');

        meta.textContent = `${rows.length} Zeile(n) gefunden${rows.length > 5 ? ' (Vorschau: erste 5)' : ''}`;
        previewArea.style.display = 'block';
        modal.querySelector('#unitCsvImportBtn').disabled = false;

        onParsed(rows);
      };
      reader.readAsText(file);
    },

    async _importUnitCsvRows(modal, rows) {
      const importBtn = modal.querySelector('#unitCsvImportBtn');
      importBtn.disabled = true;
      importBtn.textContent = 'Importiere...';

      let success = 0, errors = 0;

      for (const row of rows) {
        const entry = {
          email: (row.email || '').toLowerCase().trim(),
          name: row.name || '',
          date: window.CSVImportDatapool?.parseEventDate(row.datum) || row.datum,
          funnelId: null, // wird automatisch vom Lead übernommen
          revenue: parseFloat(row.revenue) || 0,
          ufCash: parseFloat(row.uf_cash) || 0,
          installments: []
        };
        if (!entry.email || !entry.date) { errors++; continue; }
        const result = await this._saveUnitEntry(entry);
        if (result.success) { success++; } else { errors++; }
      }

      importBtn.textContent = 'Importieren';
      importBtn.disabled = false;

      window.Toast?.success(`${success} Unit(s) importiert${errors ? `, ${errors} Fehler` : ''}`);
      modal.remove();
      if (this.currentTab === 'unit') await this.loadTabData();
    },

    openCSVImport() {
      if (this.currentTab === 'unit') {
        this.openUnitImportModal('csv');
        return;
      }
      if (window.CSVImportDatapool) {
        window.CSVImportDatapool.openModal(this.currentTab);
      } else {
        console.error('❌ CSV Import module not loaded');
        if (window.Toast) {
          window.Toast.error('CSV Import nicht verfügbar');
        }
      }
    },

    openIntegrationsModal() {
      const modal = document.getElementById('integrations-modal');
      if (modal) {
        modal.style.display = 'flex';
      } else {
        console.error('❌ Integrations modal not found');
      }
    },

    // ====================================
    // Bulk Action Functions
    // ====================================

    bulkCopyEmails() {
      console.log('📋 bulkCopyEmails called, selectedLeads:', this.selectedLeads.size);
      if (this.selectedLeads.size === 0) {
        window.Toast.info('Keine Leads ausgewählt');
        return;
      }

      // Get emails from table rows
      const emails = [];
      const rows = document.querySelectorAll('.datapool-table tbody tr');
      rows.forEach(row => {
        const checkbox = row.querySelector('.lead-checkbox');
        if (checkbox && checkbox.checked) {
          const emailCell = row.querySelector('td:nth-child(4)'); // Email column
          if (emailCell && emailCell.textContent.trim()) {
            emails.push(emailCell.textContent.trim());
          }
        }
      });

      if (emails.length === 0) {
        window.Toast.error('Keine E-Mail-Adressen gefunden');
        return;
      }

      // Copy to clipboard
      const emailString = emails.join(', ');
      navigator.clipboard.writeText(emailString).then(() => {
        window.Toast.success(`${emails.length} E-Mail-Adressen kopiert`);
      }).catch(err => {
        console.error('❌ Clipboard error:', err);
        window.Toast.error('Fehler beim Kopieren');
      });
    },

    async bulkExportCSV() {
      console.log('💾 bulkExportCSV called, selectedLeads:', this.selectedLeads.size);
      if (this.selectedLeads.size === 0) {
        window.Toast.info('Keine Leads ausgewählt');
        return;
      }

      try {
        // Query full lead data from Supabase (UUIDs as strings)
        const leadIds = Array.from(this.selectedLeads);
        const { data: leads, error } = await window.SupabaseClient
          .from('leads')
          .select('*')
          .in('id', leadIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (!leads || leads.length === 0) {
          window.Toast.error('Keine Daten zum Exportieren');
          return;
        }

        // Generate CSV manually
        const columns = ['id', 'funnel_id', 'name', 'primary_email', 'primary_phone', 'utm_source', 'utm_medium', 'utm_campaign', 'country', 'created_at'];
        const header = columns.join(',');
        const rows = leads.map(lead => {
          return columns.map(col => {
            const value = lead[col] || '';
            // Escape quotes and wrap in quotes if contains comma/quote/newline
            const stringValue = String(value).replace(/"/g, '""');
            return /[,"\n]/.test(stringValue) ? `"${stringValue}"` : stringValue;
          }).join(',');
        });
        const csv = [header, ...rows].join('\n');

        // Trigger download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `clarity_leads_${new Date().toISOString().slice(0, 10)}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        window.Toast.success(`${leads.length} Leads exportiert`);
      } catch (error) {
        console.error('❌ Export error:', error);
        window.Toast.error('Fehler beim Exportieren');
      }
    },

    async bulkDeleteEvents() {
      console.log('🗑️ bulkDeleteEvents called, selectedLeads:', this.selectedLeads.size);
      if (this.selectedLeads.size === 0) {
        window.Toast.info('Keine Leads ausgewählt');
        return;
      }

      try {
        // Get event IDs from selected rows in table
        const eventIds = [];
        const rows = document.querySelectorAll('.datapool-table tbody tr');
        rows.forEach(row => {
          const checkbox = row.querySelector('.lead-checkbox');
          if (checkbox && checkbox.checked && row.dataset.eventId) {
            eventIds.push(row.dataset.eventId);
          }
        });

        if (eventIds.length === 0) {
          window.Toast.error('Keine Events ausgewählt');
          return;
        }

        // Confirmation dialog
        const confirmed = confirm(
          `⚠️ ${eventIds.length} ${this.currentTab}-Events löschen?\n\n` +
          `Die Leads bleiben erhalten, nur Events werden gelöscht.`
        );

        if (!confirmed) return;

        const { error } = await window.SupabaseClient
          .from('events')
          .delete()
          .in('id', eventIds);

        if (error) throw error;

        window.Toast.success(`${eventIds.length} Events gelöscht`);
        
        // Refresh view
        this.selectedLeads.clear();
        this.updateBulkActionsBar();
        await this.loadTabData();
      } catch (error) {
        console.error('❌ Delete events error:', error);
        window.Toast.error('Fehler beim Löschen der Events');
      }
    },

    async bulkDeleteLeads() {
      console.log('❌ bulkDeleteLeads called, selectedLeads:', this.selectedLeads.size);
      if (this.selectedLeads.size === 0) {
        window.Toast.info('Keine Leads ausgewählt');
        return;
      }

      const leadIds = Array.from(this.selectedLeads);

      // Strong confirmation with CASCADE warning
      const confirmed = confirm(
        `🚨 WARNUNG: ${leadIds.length} Leads permanent löschen?\n\n` +
        `Dies löscht die Leads UND alle zugehörigen Events!\n` +
        `Diese Aktion kann NICHT rückgängig gemacht werden.`
      );

      if (!confirmed) return;

      // Double confirmation for safety
      const doubleConfirmed = confirm(
        `Wirklich ${leadIds.length} Leads + alle Events löschen?`
      );

      if (!doubleConfirmed) return;

      try {
        // Use UUID strings directly, no parseInt needed
        const { error } = await window.SupabaseClient
          .from('leads')
          .delete()
          .in('id', leadIds);

        if (error) throw error;

        window.Toast.success(`${leadIds.length} Leads gelöscht`);
        
        // Clear selection and refresh
        this.selectedLeads.clear();
        this.updateBulkActionsBar();
        await this.loadTabData();
      } catch (error) {
        console.error('❌ Delete leads error:', error);
        window.Toast.error('Fehler beim Löschen der Leads');
      }
    },

    async selectAllInCurrentTab() {
      console.log('☑️ selectAllInCurrentTab called, currentTab:', this.currentTab);
      
      const btn = document.getElementById('selectAllInEventBtn');
      const isActive = btn && btn.classList.contains('active');
      
      // If already all selected, deselect all
      if (isActive) {
        this.selectedLeads.clear();
        
        // Uncheck all visible checkboxes
        const checkboxes = document.querySelectorAll('.lead-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        
        // Update header checkbox
        const headerCheckbox = document.querySelector('#selectAllCheckbox');
        if (headerCheckbox) headerCheckbox.checked = false;
        
        if (btn) {
          btn.classList.remove('active');
          btn.innerHTML = '☑️ Alle auswählen';
        }
        
        this.updateBulkActionsBar();
        window.Toast.info('Alle Leads abgewählt');
        return;
      }
      
      try {
        // Query ALL lead IDs for current event type from Supabase
        // For survey tabs: include both survey+surveyQuali so all typeform leads are captured
        const surveyTypes = ['survey', 'surveyQuali'];
        let query = window.SupabaseClient
          .from('events')
          .select('lead_id', { count: 'exact' });
        if (surveyTypes.includes(this.currentTab)) {
          query = query.in('event_type', surveyTypes);
        } else {
          query = query.eq('event_type', this.currentTab);
        }

        // Apply filters if any
        if (this.filters.search) {
          const searchPattern = `%${this.filters.search}%`;
          const { data: matchingLeads } = await window.SupabaseClient
            .from('leads')
            .select('id')
            .or(`name.ilike.${searchPattern},primary_email.ilike.${searchPattern},primary_phone.ilike.${searchPattern}`);
          
          if (matchingLeads && matchingLeads.length > 0) {
            const leadIds = matchingLeads.map(l => l.id);
            query = query.in('lead_id', leadIds);
          } else {
            window.Toast.info('Keine Leads gefunden');
            return;
          }
        }

        if (this.filters.funnel) {
          query = query.eq('funnel_id', this.filters.funnel);
        }

        if (this.filters.source) {
          query = query.eq('event_source', this.filters.source);
        }

        if (this.filters.dateFrom) {
          query = query.gte('event_date', this.filters.dateFrom);
        }

        if (this.filters.dateTo) {
          query = query.lte('event_date', this.filters.dateTo);
        }

        const { data: allEvents, error, count } = await query;

        if (error) throw error;

        if (!allEvents || allEvents.length === 0) {
          window.Toast.info('Keine Leads in diesem Tab');
          return;
        }

        // Get unique lead IDs
        const allLeadIds = [...new Set(allEvents.map(e => e.lead_id))];

        // Add all to selection
        allLeadIds.forEach(id => this.selectedLeads.add(id));

        // Update visible checkboxes
        const checkboxes = document.querySelectorAll('.lead-checkbox');
        checkboxes.forEach(cb => {
          if (this.selectedLeads.has(cb.dataset.leadId)) {
            cb.checked = true;
          }
        });

        // Update header checkbox
        const headerCheckbox = document.querySelector('#selectAllCheckbox');
        if (headerCheckbox) {
          headerCheckbox.checked = true;
        }

        // Mark button as active
        if (btn) {
          btn.classList.add('active');
          btn.innerHTML = '✅ Alle ausgewählt';
        }

        this.updateBulkActionsBar();
        window.Toast.success(`${allLeadIds.length} Leads ausgewählt (${count} Events)`);
      } catch (error) {
        console.error('❌ Select all error:', error);
        window.Toast.error('Fehler beim Auswählen');
      }
    }
  };

  window.DataPool = DataPool;

})(window);
