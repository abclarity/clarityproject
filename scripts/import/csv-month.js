// ============================================
// CSV-IMPORT SYSTEM
// ============================================

(function() {
  'use strict';

  let selectedFile = null;
  let parsedData = null;
  let columnMapping = {};
  let selectedYear = null;
  let selectedMonth = null;

  const FUZZY_MATCHES = {
    'date': 'Datum',
    'Date': 'Datum',
    'Datum': 'Datum',

    // Paid Ads
    'Adspend': 'Adspend',
    'Ad Spend': 'Adspend',
    'Kosten': 'Adspend',
    'Impr': 'Impr',
    'Impressions': 'Impr',
    'Impressionen': 'Impr',
    'Reach': 'Reach',
    'Reichweite': 'Reach',
    'CPM': 'CPM',
    'Clicks': 'Clicks',
    'Klicks': 'Clicks',
    'Link Clicks': 'Clicks',
    'CTR': 'CTR',
    'CPC': 'CPC',

    // Funnel
    'Leads': 'Leads',
    'LP-%': 'LP%',
    'LP%': 'LP%',
    'CPL': 'CPL',
    'Survey': 'Survey',
    'VideoCR-%': 'VideoCR%',
    'VideoCR%': 'VideoCR%',
    'CPS': 'CPS',
    // SurveyQuali (alte Namen auch unterstützen)
    'SurveyQuali': 'SurveyQuali',
    'Survey Quali': 'SurveyQuali',
    'TF-Quali': 'SurveyQuali',  // 🔥 Alte CSV-Dateien unterstützen
    'TFQuali': 'SurveyQuali',
    'Qualified': 'SurveyQuali',

    // Cold Email (Sheet-Namen: "Emails Sent", "Opened")
    'Emails Sent': 'Emails Sent',
    'EmailsSent': 'Emails Sent',
    'Emails sent': 'Emails Sent',
    'Sent': 'Emails Sent',
    'Opened': 'Opened',
    'Emails Opened': 'Opened',
    'EmailsOpened': 'Opened',
    'Emails opened': 'Opened',
    'Emails Replied': 'Emails Replied',
    'EmailsReplied': 'Emails Replied',
    'Replied': 'Emails Replied',

    // Cold Calls (Sheet-Namen: "Calls Dialed", "Reached")
    'Calls Dialed': 'Calls Dialed',
    'CallsDialed': 'Calls Dialed',
    'Calls Made': 'Calls Dialed',
    'CallsMade': 'Calls Dialed',
    'Dialed': 'Calls Dialed',
    'Reached': 'Reached',
    'Calls Reached': 'Reached',
    'CallsReached': 'Reached',
    'Calls Answered': 'Reached',
    'CallsAnswered': 'Reached',
    'Answered': 'Reached',

    // 1-Call-Close (alte Namen → ClosingBooking/ClosingTermin/ClosingCall)
    'Calendly': 'ClosingBooking',
    'Bookings': 'ClosingBooking',
    'Booking': 'ClosingBooking',
    'Termine': 'ClosingTermin',
    'Termin': 'ClosingTermin',
    'Appointments': 'ClosingTermin',
    'SalesCall': 'ClosingCall',
    'Sales Call': 'ClosingCall',
    'Call': 'ClosingCall',

    // 2-Call-Close
    'SettingBooking': 'SettingBooking',
    'Setting Booking': 'SettingBooking',
    'Set-Book': 'SettingBooking',
    'SetBook': 'SettingBooking',
    'SettingTermin': 'SettingTermin',
    'Setting Termin': 'SettingTermin',
    'Set-Plan': 'SettingTermin',
    'SetPlan': 'SettingTermin',
    'SettingCall': 'SettingCall',
    'Setting Call': 'SettingCall',
    'ClosingBooking': 'ClosingBooking',
    'Closing Booking': 'ClosingBooking',
    'SC-Book': 'ClosingBooking',
    'SCBook': 'ClosingBooking',
    'ClosingTermin': 'ClosingTermin',
    'Closing Termin': 'ClosingTermin',
    'SC-Plan': 'ClosingTermin',
    'SCPlan': 'ClosingTermin',
    'ClosingCall': 'ClosingCall',
    'Closing Call': 'ClosingCall',

    // Revenue
    'SUR-%': 'SUR%',
    'SUR%': 'SUR%',
    'SUR-$': 'SUR-€',
    'SUR-€': 'SUR-€',
    'Units': 'Units',
    'Verkäufe': 'Units',
    'CC%': 'CC%',
    'LC%': 'LC%',
    'Revenue': 'Revenue',
    'Umsatz': 'Revenue',
    'Cash': 'Cash',
    'CC-Rate%': 'CCRate%',
    'CCRate%': 'CCRate%'
  };

  // === Get Import Fields for Active Funnel (dynamisch!) ===
  function getImportFieldsForActiveFunnel() {
    const activeFunnel = FunnelAPI.getActiveFunnelData();
    if (!activeFunnel || !activeFunnel.modules) {
      console.warn('⚠️ Kein aktiver Funnel oder keine Module gefunden');
      return ['Datum']; // Fallback
    }

    if (!window.FunnelModules || !window.FunnelModules.traffic || !window.FunnelModules.funnel || !window.FunnelModules.qualification || !window.FunnelModules.close || !window.FunnelModules.revenue) {
      console.warn('⚠️ FunnelModules nicht geladen');
      return ['Datum']; // Fallback
    }

    const allModules = [
      ...Object.values(window.FunnelModules.traffic),
      ...Object.values(window.FunnelModules.funnel),
      ...Object.values(window.FunnelModules.qualification),
      ...Object.values(window.FunnelModules.close),
      ...Object.values(window.FunnelModules.revenue)
    ];

    const inputFields = new Set(['Datum']);

    activeFunnel.modules.forEach(moduleId => {
      const module = allModules.find(m => m.id === moduleId);
      if (module && module.inputKeys) {
        module.inputKeys.forEach(key => inputFields.add(key));
      }
    });

    const result = Array.from(inputFields);
    console.log(`✅ Import-Felder für "${activeFunnel.name}":`, result);
    return result;
  }

  // === Setup Import Button ===
  window.setupImportButton = function() {
    const btn = document.getElementById('importDataBtn');
    if (!btn) return;

    if (btn.dataset.listenerSet === 'true') {
      console.log('⚠️ Listener bereits gesetzt, überspringe');
      return;
    }

    btn.addEventListener('click', openImportModal);
    btn.dataset.listenerSet = 'true';

    console.log('✅ Import-Button Listener gesetzt');
  };

  // === Open Import Modal ===
  function openImportModal() {
    console.log('🔵 openImportModal aufgerufen');

    const modal = document.getElementById('importModal');
    const funnelNameSpan = document.getElementById('importFunnelName');

    const activeFunnel = FunnelAPI.getActiveFunnelData();
    if (!activeFunnel) {
      if (window.Toast) {
        window.Toast.warning('Kein aktiver Funnel! Bitte erstelle zuerst einen Funnel.');
      }
      return;
    }

    funnelNameSpan.textContent = activeFunnel.name;

    selectedFile = null;
    parsedData = null;
    columnMapping = {};

    document.getElementById('csvFileInput').value = '';
    document.getElementById('selectedFileName').textContent = '';
    document.getElementById('nextToMapping').disabled = true;

    const monthSelectWrapper = document.getElementById('monthSelectWrapper');
    if (monthSelectWrapper) monthSelectWrapper.style.display = 'none';

    const monthSelect = document.getElementById('importMonthSelect');
    if (monthSelect) monthSelect.innerHTML = '';

    const monthHint = document.getElementById('monthHint');
    if (monthHint) monthHint.textContent = '';

    const mappingList = document.getElementById('columnMappingList');
    if (mappingList) mappingList.innerHTML = '';

    const summary = document.getElementById('importSummary');
    if (summary) summary.innerHTML = '';

    const mergeRadio = document.querySelector('input[name="conflictMode"][value="merge"]');
    if (mergeRadio) mergeRadio.checked = true;

    const warningTitle = document.getElementById('conflictWarningTitle');
    const warningText = document.getElementById('conflictWarningText');
    if (warningTitle) warningTitle.style.display = 'none';
    if (warningText) warningText.style.display = 'none';

    const radioButtons = document.querySelectorAll('input[name="conflictMode"]');
    radioButtons.forEach(radio => {
      radio.disabled = true;
      radio.parentElement.style.cursor = 'not-allowed';
      radio.parentElement.style.opacity = '0.5';
    });

    showStep(1);

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    setupStep1Listeners();
    updateButtonStates(0);

    console.log('✅ Modal geöffnet und zurückgesetzt');
  }

  // === Step 1 Listeners ===
  function setupStep1Listeners() {
    const selectCsvBtn = document.getElementById('selectCsvBtn');
    const csvFileInput = document.getElementById('csvFileInput');
    const nextBtn = document.getElementById('nextToMapping');
    const monthSelectWrapper = document.getElementById('monthSelectWrapper');
    const monthSelect = document.getElementById('importMonthSelect');

    selectCsvBtn.onclick = () => csvFileInput.click();

    csvFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      selectedFile = file;
      document.getElementById('selectedFileName').textContent = `📄 ${file.name}`;

      if (window.Loading) {
        window.Loading.show('CSV wird gelesen...');
      }

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (window.Loading) {
            window.Loading.hide();
          }

          parsedData = results.data;
          console.log('✅ CSV geparsed:', parsedData);

          const detectedMonth = detectMonthFromCSV(parsedData);

          if (detectedMonth) {
            populateMonthSelect(detectedMonth);
            monthSelectWrapper.style.display = 'block';
            nextBtn.disabled = false;
            if (window.Toast) {
              window.Toast.success('CSV erfolgreich geladen');
            }
          } else {
            if (window.Toast) {
              window.Toast.error('Kein gültiges Datum in der CSV gefunden!');
            }
            nextBtn.disabled = true;
          }
        },
        error: (error) => {
          if (window.Loading) {
            window.Loading.hide();
          }
          if (window.Toast) {
            window.Toast.error('Fehler beim Lesen der CSV-Datei: ' + error.message);
          }
          nextBtn.disabled = true;
        }
      });
    };

    nextBtn.onclick = async () => {
      const [y, m] = monthSelect.value.split('-');
      selectedYear = parseInt(y);
      selectedMonth = parseInt(m);

      const isNew = monthSelect.options[monthSelect.selectedIndex].dataset.isNew === 'true';
      if (isNew) {
        const activeFunnelId = FunnelAPI.getActiveFunnel();
        const funnels = FunnelAPI.loadFunnels();
        const activeFunnel = funnels.find(f => f.id === activeFunnelId);

        if (activeFunnel) {
          activeFunnel.months.push({ y: selectedYear, m: selectedMonth });
          await FunnelAPI.saveFunnels(funnels);
          await StorageAPI.saveMonthDataForFunnel(activeFunnelId, selectedYear, selectedMonth, {});
          console.log(`✅ Neuer Monat erstellt: ${selectedYear}-${selectedMonth}`);
        }
      }

      buildMappingUI();
      showStep(2);
    };
  }

  // === Build Mapping UI ===
  function buildMappingUI() {
    if (!parsedData || parsedData.length === 0) return;

    const mappingList = document.getElementById('columnMappingList');
    mappingList.innerHTML = '';

    const csvColumns = Object.keys(parsedData[0]);
    columnMapping = {};

    const importFields = getImportFieldsForActiveFunnel();

    importFields.forEach(clarityField => {
      let matchedCsvCol = null;
      let status = 'notfound';

      if (csvColumns.includes(clarityField)) {
        matchedCsvCol = clarityField;
        status = 'matched';
      } else {
        for (let csvCol of csvColumns) {
          if (FUZZY_MATCHES[csvCol] === clarityField) {
            matchedCsvCol = csvCol;
            status = 'suggested';
            break;
          }
        }
      }

      if (matchedCsvCol) {
        columnMapping[clarityField] = matchedCsvCol;
      }

      const row = document.createElement('div');
      row.className = `mapping-row ${status}`;

      const clarityColDiv = document.createElement('div');
      clarityColDiv.className = 'mapping-csv-col';
      clarityColDiv.textContent = clarityField;

      const arrow = document.createElement('div');
      arrow.className = 'mapping-arrow';
      arrow.textContent = '→';

      const csvColDiv = document.createElement('div');
      csvColDiv.className = 'mapping-clarity-col';

      const select = document.createElement('select');
      select.innerHTML = '<option value="">Leer lassen</option>';

      csvColumns.forEach(csvCol => {
        const option = document.createElement('option');
        option.value = csvCol;
        option.textContent = csvCol;
        if (csvCol === matchedCsvCol) option.selected = true;
        select.appendChild(option);
      });

      const statusDiv = document.createElement('div');
      statusDiv.className = `mapping-status ${status}`;

      if (status === 'matched') {
        statusDiv.textContent = '✅ Match';
      } else if (status === 'suggested') {
        statusDiv.textContent = '💡 Vorschlag';
      } else {
        statusDiv.textContent = '❌ Nicht gefunden';
      }

      select.onchange = (e) => {
        if (e.target.value) {
          columnMapping[clarityField] = e.target.value;
          row.className = 'mapping-row suggested';
          statusDiv.textContent = '💡 Zugeordnet';
          statusDiv.className = 'mapping-status suggested';
        } else {
          delete columnMapping[clarityField];
          row.className = 'mapping-row notfound';
          statusDiv.textContent = '⊘ Leer';
          statusDiv.className = 'mapping-status ignored';
        }
      };

      csvColDiv.appendChild(select);

      row.appendChild(clarityColDiv);
      row.appendChild(arrow);
      row.appendChild(csvColDiv);
      row.appendChild(statusDiv);

      mappingList.appendChild(row);
    });

    setupStep2Listeners();
  }

  // === Step 2 Listeners ===
  function setupStep2Listeners() {
    const proceedBtn = document.getElementById('proceedToImport');

    proceedBtn.onclick = () => {
      const activeFunnelId = FunnelAPI.getActiveFunnel();
      const existingData = StorageAPI.loadMonthDataForFunnel(activeFunnelId, selectedYear, selectedMonth);

      if (existingData && Object.keys(existingData).length > 0) {
        const date = new Date(selectedYear, selectedMonth, 1);
        const monthName = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
        document.getElementById('conflictMonthName').textContent = monthName;

        document.getElementById('conflictWarningTitle').style.display = 'block';
        document.getElementById('conflictWarningText').style.display = 'block';

        const radioButtons = document.querySelectorAll('input[name="conflictMode"]');
        radioButtons.forEach(radio => {
          radio.disabled = false;
          radio.parentElement.style.cursor = 'pointer';
          radio.parentElement.style.opacity = '1';
        });

        showStep(3);
        setupStep3Listeners();
      } else {
        performImport('merge');
      }
    };
  }

  // === Step 3 Listeners ===
  function setupStep3Listeners() {
    const confirmBtn = document.getElementById('confirmImport');

    confirmBtn.onclick = async () => {
      const mode = document.querySelector('input[name="conflictMode"]:checked').value;
      await performImport(mode);
    };
  }

  // === Step 4 Listeners ===
  function setupStep4Listeners() {
    const closeBtn = document.getElementById('closeImportModal');
    if (closeBtn) {
      closeBtn.onclick = closeImportModal;
    }
  }

  // === Perform Import ===
  async function performImport(mode) {
    if (window.Loading) {
      window.Loading.show('Daten werden importiert...');
    }

    try {
      const activeFunnelId = FunnelAPI.getActiveFunnel();

      // 🔥 Bei Overwrite: Lösche existierende Daten aus Supabase
      if (mode === 'overwrite') {
        await StorageAPI.deleteMonthDataFromSupabase(activeFunnelId, selectedYear, selectedMonth);
      }

      let importedDays = 0;
      let importedColumns = new Set();
      let skippedRows = 0;
      const batchRecords = []; // 🔥 Sammle alle Einträge für Batch-Insert

      parsedData.forEach(row => {
        const datumCsvCol = columnMapping['Datum'];
        const dateStr = datumCsvCol ? row[datumCsvCol] : null;
        if (!dateStr) {
          skippedRows++;
          return;
        }

        const parsedDate = parseDate(dateStr);
        if (!parsedDate) {
          skippedRows++;
          return;
        }

        const day = parsedDate.getDate();

        if (parsedDate.getFullYear() !== selectedYear || parsedDate.getMonth() !== selectedMonth) {
          skippedRows++;
          return;
        }

        importedDays++;

        Object.keys(columnMapping).forEach(clarityField => {
          if (clarityField === 'Datum') return;

          const csvCol = columnMapping[clarityField];
          const value = row[csvCol];

          if (!value || value.trim() === '') return;

          const numValue = parseNumber(value);
          if (isNaN(numValue)) return;

          // 🔥 Füge zu Batch-Records hinzu
          batchRecords.push({
            funnelId: activeFunnelId,
            year: selectedYear,
            month: selectedMonth,
            day: day,
            fieldName: clarityField,
            value: numValue
          });

          importedColumns.add(clarityField);
        });
      });

      // 🔥 Batch-Save zu Supabase (tracking_sheet_data)
      if (batchRecords.length > 0) {
        await StorageAPI.batchSaveFieldsToSupabase(batchRecords);
      }

      // 🔥 Recalculate KPIs nach Import
      if (window.calcAllRows) {
        const ALL_COLUMNS = window.ALL_COLUMNS || [];
        const INPUT_KEYS = window.INPUT_KEYS || [];
        const KPI_COLS = window.KPI_COLS || [];
        await window.calcAllRows(selectedYear, selectedMonth, ALL_COLUMNS, INPUT_KEYS, KPI_COLS, activeFunnelId);
      }

      if (window.Loading) {
        window.Loading.hide();
      }

      if (window.Toast) {
        window.Toast.success(`${importedDays} Tage erfolgreich importiert!`);
      }

      showImportSummary(importedDays, importedColumns, skippedRows);
      showStep(4);

      if (window.switchToMonth) {
        setTimeout(() => {
          window.switchToMonth(selectedYear, selectedMonth);
        }, 500);
      }
    } catch (err) {
      if (window.Loading) {
        window.Loading.hide();
      }
      if (window.Toast) {
        window.Toast.error('Fehler beim Importieren: ' + err.message);
      }
      console.error('Import error:', err);
    }
  }  // === Show Import Summary ===
  function showImportSummary(days, columns, skipped) {
    const summary = document.getElementById('importSummary');
    const colList = Array.from(columns).join(', ');

    summary.innerHTML = `
      <p><strong>✅ ${days} Tage importiert</strong></p>
      <p><strong>📊 Importierte Spalten:</strong> ${colList}</p>
      ${skipped > 0 ? `<p style="color: #ff9800;"><strong>⚠️ ${skipped} Zeilen übersprungen</strong> (ungültiges Datum oder außerhalb des Monats)</p>` : ''}
    `;

    setupStep4Listeners();
  }

  // === Parse Date ===
  function parseDate(str) {
    if (!str) return null;
    str = str.trim();

    let match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      let [, d, m, y] = match;
      y = y.length === 2 ? '20' + y : y;
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }

    match = str.match(/^(\d{1,2})\.  (\d{1,2})\. (\d{4})$/);
    if (match) {
      let [, d, m, y] = match;
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }

    match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      let [, y, m, d] = match;
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }

    match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (match) {
      let [, d, m, y] = match;
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }

    return null;
  }

  // === Detect Month from CSV ===
  function detectMonthFromCSV(data) {
    if (!data || data.length === 0) return null;

    for (let row of data) {
      for (let key in row) {
        const value = row[key];
        if (!value) continue;

        const date = parseDate(value.trim());
        if (date && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
          return { y: date.getFullYear(), m: date.getMonth() };
        }
      }
    }

    return null;
  }

  // === Populate Month Select ===
  function populateMonthSelect(detected) {
    const monthSelect = document.getElementById('importMonthSelect');
    const monthHint = document.getElementById('monthHint');
    const activeFunnel = FunnelAPI.getActiveFunnelData();

    monthSelect.innerHTML = '';

    const detectedLabel = new Date(detected.y, detected.m, 1).toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric'
    });

    const exists = activeFunnel.months.some(m => m.y === detected.y && m.m === detected.m);

    if (exists) {
      const option = document.createElement('option');
      option.value = `${detected.y}-${detected.m}`;
      option.textContent = detectedLabel;
      option.dataset.isNew = 'false';
      monthSelect.appendChild(option);

      monthHint.textContent = `✅ ${detectedLabel} wurde automatisch erkannt`;
      monthHint.style.color = '#4caf50';
    } else {
      const option = document.createElement('option');
      option.value = `${detected.y}-${detected.m}`;
      option.textContent = `${detectedLabel} (neu)`;
      option.dataset.isNew = 'true';
      monthSelect.appendChild(option);

      monthHint.textContent = `➕ ${detectedLabel} wird erstellt`;
      monthHint.style.color = '#ff9800';
    }
  }

  // === Parse Number ===
  function parseNumber(str) {
    if (typeof str === 'number') return str;
    if (!str) return NaN;

    str = String(str).trim();
    str = str.replace(/[€$%\s"]/g, '');
    str = str.replace(/\./g, '');
    str = str.replace(',', '.');

    return parseFloat(str);
  }

  // === Show Step ===
  function showStep(step) {
    const step1 = document.getElementById('importStep1');
    const step2 = document.getElementById('importStep2');
    const step3 = document.getElementById('importStep3');
    const step4 = document.getElementById('importStep4');

    if (step === 4) {
      if (step1) step1.classList.add('hidden');
      if (step2) step2.classList.add('hidden');
      if (step3) step3.classList.add('hidden');
      if (step4) step4.classList.remove('hidden');
    } else {
      if (step1) step1.classList.remove('hidden');
      if (step2) step2.classList.remove('hidden');
      if (step3) step3.classList.remove('hidden');
      if (step4) step4.classList.add('hidden');
    }

    if (step !== 1) {
      updateButtonStates(step);
    }
  }

  // === Update Button States ===
  function updateButtonStates(activeStep) {
    const nextToMapping = document.getElementById('nextToMapping');
    const proceedToImport = document.getElementById('proceedToImport');
    const cancelStep3 = document.getElementById('cancelImportStep3');
    const confirmImport = document.getElementById('confirmImport');
    const closeBtn = document.getElementById('closeImportModal');

    if (nextToMapping) nextToMapping.disabled = true;
    if (proceedToImport) proceedToImport.disabled = true;
    if (confirmImport) confirmImport.disabled = true;
    if (closeBtn) closeBtn.disabled = true;

    if (cancelStep3) cancelStep3.disabled = false;

    if (activeStep === 2) {
      if (proceedToImport) proceedToImport.disabled = false;
    } else if (activeStep === 3) {
      if (confirmImport) confirmImport.disabled = false;
    } else if (activeStep === 4) {
      if (closeBtn) closeBtn.disabled = false;
    }
  }

  // === Close Modal ===
  function closeImportModal() {
    console.log('🔴 closeImportModal aufgerufen');

    const modal = document.getElementById('importModal');
    modal.style.display = 'none';
    modal.classList.add('hidden');

    selectedFile = null;
    parsedData = null;
    columnMapping = {};

    document.getElementById('csvFileInput').value = '';
    document.getElementById('selectedFileName').textContent = '';
    document.getElementById('nextToMapping').disabled = true;

    const mappingList = document.getElementById('columnMappingList');
    if (mappingList) mappingList.innerHTML = '';

    const summary = document.getElementById('importSummary');
    if (summary) summary.innerHTML = '';

    const mergeRadio = document.querySelector('input[name="conflictMode"][value="merge"]');
    if (mergeRadio) mergeRadio.checked = true;

    const warningTitle = document.getElementById('conflictWarningTitle');
    const warningText = document.getElementById('conflictWarningText');
    if (warningTitle) warningTitle.style.display = 'none';
    if (warningText) warningText.style.display = 'none';

    const radioButtons = document.querySelectorAll('input[name="conflictMode"]');
    radioButtons.forEach(radio => {
      radio.disabled = true;
      radio.parentElement.style.cursor = 'not-allowed';
      radio.parentElement.style.opacity = '0.5';
    });

    showStep(1);

    console.log('✅ Modal geschlossen und zurückgesetzt');
  }

  window.closeImportModalFromButton = closeImportModal;

  document.addEventListener('DOMContentLoaded', () => {
    window.setupImportButton();
  });

})();