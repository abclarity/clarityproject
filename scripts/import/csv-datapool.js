(function(window) {

  const CSVImportDatapool = {
    csvData: null,
    mappedHeaders: {},
    surveyQuestions: {},  // Maps CSV column names to survey question labels
    qualificationRule: null,  // { questionLabel, qualifyingAnswers: [] }
    currentStep: 1,

    // Hilfsfunktion: Parst verschiedene Datumsformate und gibt ISO-String zurück
    parseEventDate(dateString) {
      if (!dateString) return null;

      const trimmed = dateString.trim();

      // Already ISO format (2025-01-01T00:29:48 or 2025-01-01 00:29:48)
      // Match YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM
      const isoWithTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (isoWithTimeMatch) {
        const [, year, month, day, hour, minute, second = '00'] = isoWithTimeMatch;
        return `${year}-${month}-${day}T${hour.padStart(2, '0')}:${minute}:${second}`;
      }

      // German format: DD.MM.YYYY HH:MM:SS or DD.MM.YYYY HH:MM
      const germanMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (germanMatch) {
        const [, day, month, year, hour, minute, second = '00'] = germanMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}`;
      }

      // US format: MM/DD/YYYY HH:MM:SS or MM/DD/YYYY HH:MM
      const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (usMatch) {
        const [, month, day, year, hour, minute, second = '00'] = usMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}`;
      }

      // Date only formats - use 00:00:00 as default time
      // DD.MM.YYYY
      const germanDateMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (germanDateMatch) {
        const [, day, month, year] = germanDateMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`;
      }

      // MM/DD/YYYY
      const usDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (usDateMatch) {
        const [, month, day, year] = usDateMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`;
      }

      // YYYY-MM-DD
      const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoDateMatch) {
        return `${trimmed}T00:00:00`;
      }

      // Fallback: Try native Date parsing
      try {
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch (e) {
        console.error('Failed to parse date:', trimmed, e);
      }

      return null;
    },

    // Spam detection – mirrors the same logic in the edge functions (threshold = 3)
    detectSpam(name, email, phone, surveyAnswers) {
      const reasons = [];
      let score = 0;

      const n = (name || '').toLowerCase().trim();
      const emailLower = (email || '').toLowerCase().trim();
      const local = emailLower.split('@')[0] || '';
      const domain = emailLower.split('@')[1] || '';
      const answers = Object.values(surveyAnswers || {}).join(' ').toLowerCase();
      const digits = (phone || '').replace(/\D/g, '');
      const VOWELS = /[aeiou]/;
      const CONS4 = /[bcdfghjklmnpqrstvwxyz]{4,}/i;

      // Hard rules (+3 → instant spam)
      if (/\btest\b/.test(n)) { score += 3; reasons.push('name contains "test"'); }
      if (['test','fake','spam','xyz','asdf'].includes(local)) { score += 3; reasons.push(`email local is "${local}"`); }
      const TEST_DOMAINS = ['test.com','test.de','test.org','test.net','example.com','example.de','example.org'];
      if (TEST_DOMAINS.includes(domain)) { score += 3; reasons.push(`test domain "${domain}"`); }
      if (/\b(scam|abzocken|spam)\b/.test(answers)) { score += 3; reasons.push('spam keyword in answers'); }
      if (/\b(fake|fuck|shit|scam|spam|hurensohn|arschloch)\b/.test(n)) { score += 3; reasons.push('profanity/spam in name'); }
      if (/\b(blabla|blablabla|xyz)\b/.test(n)) { score += 3; reasons.push('obvious fake name'); }
      if (digits.length > 0 && digits.length < 6) { score += 3; reasons.push(`phone too short (${digits.length} digits)`); }

      // Scoring rules (+1/+2)
      const parts = domain.split('.');
      if (parts.length >= 2 && (parts[parts.length - 2].length <= 1 || parts[parts.length - 1].length <= 1)) {
        score += 2; reasons.push(`suspicious domain "${domain}"`);
      }
      if (CONS4.test(n)) { score += 2; reasons.push('keyboard mash in name'); }
      const hasAllConsonantPart = n.split(/\s+/).some(p => p.length >= 3 && !VOWELS.test(p));
      if (hasAllConsonantPart) { score += 2; reasons.push('consonant-only word in name'); }
      const nameParts = n.split(/\s+/).filter(p => p.length > 0);
      if (nameParts.length >= 2 && nameParts.every(p => p.length === 1)) { score += 2; reasons.push('name is only single letters'); }
      if (digits.length >= 5 && new Set(digits).size === 1) { score += 2; reasons.push('phone all same digit'); }
      if (CONS4.test(local)) { score += 1; reasons.push('keyboard mash in email'); }
      if (CONS4.test(answers)) { score += 1; reasons.push('keyboard mash in answers'); }

      return { isSpam: score >= 3, score, reasons };
    },

    openModal(defaultEventType = 'lead') {
      this.defaultEventType = defaultEventType;
      const existingModal = document.getElementById('csvImportDatapoolModal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'csvImportDatapoolModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content csv-import-modal">
          <div class="csv-import-header">
            <h2>📤 CSV-Daten importieren</h2>
            <button class="close-btn" onclick="window.CSVImportDatapool.closeModal()">×</button>
          </div>

          <div id="csvStep1" class="csv-step">
            <p>Importiere deine historischen Event-Daten in den Datenpool.</p>
            <div class="file-upload-area" id="fileUploadArea">
              <div class="upload-icon">📁</div>
              <p><strong>CSV-Datei hier ablegen</strong> oder klicken zum Auswählen</p>
              <input type="file" id="csvFileInputDatapool" accept=".csv" style="display: none;" />
            </div>
            <div id="fileInfo" class="file-info hidden"></div>
          </div>

          <div id="csvStep2" class="csv-step hidden">
            <h3>Spalten zuordnen</h3>
            <p>Ordne die CSV-Spalten den Datenpool-Feldern zu:</p>
            <div id="columnMapping" class="column-mapping"></div>
            <button class="btn-primary" onclick="window.CSVImportDatapool.proceedToSurveyMapping()">
              Weiter
            </button>
          </div>

          <div id="csvStep3" class="csv-step hidden">
            <h3>Survey-Fragen auswählen (optional)</h3>
            <p>Wähle zusätzliche Spalten aus, die als Survey-Fragen gespeichert werden sollen:</p>
            <div id="surveyQuestionMapping" class="survey-question-mapping"></div>
            <div class="survey-step-buttons">
              <button class="btn-secondary" onclick="window.CSVImportDatapool.skipSurveyMapping()">
                Überspringen
              </button>
              <button class="btn-primary" onclick="window.CSVImportDatapool.proceedToQualificationStep()">
                Weiter
              </button>
            </div>
          </div>

          <div id="csvStep4" class="csv-step hidden">
            <h3>Survey-Qualifizierung (optional)</h3>
            <p>Definiere, welche Antworten zur Qualifizierung führen:</p>
            <div id="qualificationMapping" class="qualification-mapping">
              <label class="qualification-checkbox-label">
                <input type="checkbox" id="hasQualificationLogic" />
                Dieses Survey hat Qualifizierungslogik
              </label>
              
              <div id="qualificationSettings" class="qualification-settings hidden">
                <div class="qualification-field">
                  <label>Welche Frage bestimmt die Qualifizierung?</label>
                  <select id="qualificationQuestion" class="qualification-select">
                    <option value="">-- Bitte wählen --</option>
                  </select>
                </div>
                
                <div class="qualification-field">
                  <label>✅ Qualifizierende Antworten (komma-getrennt):</label>
                  <div id="qualifyingAnswers" class="answer-options-container">
                    <p style="color: #7f8c8d; font-style: italic;">Bitte wähle zuerst eine Frage aus.</p>
                  </div>
                  <p class="qualification-hint">Nur diese Antworten qualifizieren. Alle anderen disqualifizieren automatisch.</p>
                </div>
              </div>
            </div>
            <div class="survey-step-buttons">
              <button class="btn-secondary" onclick="window.CSVImportDatapool.skipQualification()">
                Überspringen
              </button>
              <button class="btn-primary" onclick="window.CSVImportDatapool.proceedToPreviewFromQualification()">
                Weiter zur Vorschau
              </button>
            </div>
          </div>

          <div id="csvStep5" class="csv-step hidden">
            <h3>Vorschau</h3>
            <p>Überprüfe die ersten 5 Zeilen:</p>
            <div id="previewTable" class="preview-table"></div>
            <div class="import-options">
              <label>
                <input type="checkbox" id="skipDuplicates" checked />
                Duplikate automatisch erkennen und zusammenführen
              </label>
            </div>
            <button class="btn-primary" onclick="window.CSVImportDatapool.startImport()">
              Import starten
            </button>
          </div>

          <div id="csvStep6" class="csv-step hidden">
            <h3>Import läuft...</h3>
            <div class="import-progress">
              <div class="progress-bar">
                <div id="progressFill" class="progress-fill" style="width: 0%"></div>
              </div>
              <p id="progressText">0 von 0 Zeilen verarbeitet...</p>
            </div>
          </div>

          <div id="csvStep7" class="csv-step hidden">
            <h3>✅ Import abgeschlossen!</h3>
            <div id="importSummary" class="import-summary"></div>
            <button class="btn-primary" id="closeImportBtn">
              Schließen
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      this.attachListeners();

      // Click outside to close
      setTimeout(() => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            this.closeModal();
          }
        });
      }, 0);
    },

    attachListeners() {
      const fileUploadArea = document.getElementById('fileUploadArea');
      const fileInput = document.getElementById('csvFileInputDatapool');

      fileUploadArea.addEventListener('click', () => fileInput.click());

      fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('dragover');
      });

      fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('dragover');
      });

      fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.handleFile(files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFile(e.target.files[0]);
        }
      });

      // Close button listener (wird nach Import sichtbar)
      // Verwende Event-Delegation, da der Button erst später erscheint
      document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'closeImportBtn') {
          this.closeModal();
        }
      });
    },

    closeModal() {
      const modal = document.getElementById('csvImportDatapoolModal');
      if (modal) {
        modal.remove();
      }
      
      // Datenpool neu laden, falls vorhanden
      if (window.DataPool && window.DataPool.loadTabData) {
        try {
          console.log('🔄 Refreshing DataPool after import...');
          window.DataPool.loadTabData();
        } catch (error) {
          console.error('❌ Error reloading DataPool:', error);
        }
      }
    },

    handleFile(file) {
      if (!file.name.endsWith('.csv')) {
        if (window.Toast) {
          window.Toast.error('Bitte wähle eine CSV-Datei aus');
        }
        return;
      }

      const fileInfo = document.getElementById('fileInfo');
      fileInfo.innerHTML = `
        <div class="file-name">📄 ${file.name}</div>
        <div class="file-size">${(file.size / 1024).toFixed(2)} KB</div>
      `;
      fileInfo.classList.remove('hidden');

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log('CSV parsed:', results);
          this.csvData = results;
          this.proceedToMapping();
        },
        error: (error) => {
          console.error('CSV parse error:', error);
          if (window.Toast) {
            window.Toast.error('Fehler beim Lesen der CSV-Datei');
          }
        }
      });
    },

    proceedToMapping() {
      this.currentStep = 2;
      document.getElementById('csvStep1').classList.add('hidden');
      document.getElementById('csvStep2').classList.remove('hidden');

      const headers = this.csvData.meta.fields;
      const mapping = document.getElementById('columnMapping');

      const EVENT_TYPES = [
        { id: 'lead', label: 'Leads' },
        { id: 'survey', label: 'Survey' },
        { id: 'surveyQuali', label: 'Survey Quali' },
        { id: 'settingBooking', label: 'Setting Booking' },
        { id: 'settingTermin', label: 'Setting Termin' },
        { id: 'settingCall', label: 'Setting Call' },
        { id: 'closingBooking', label: 'Closing Booking' },
        { id: 'closingTermin', label: 'Closing Termin' },
        { id: 'closingCall', label: 'Closing Call' },
        { id: 'unit', label: 'Units' }
      ];
      
      const eventType = EVENT_TYPES.find(t => t.id === this.defaultEventType);
      const eventLabel = eventType ? eventType.label : 'Events';

      const requiredFields = [
        { key: 'name', label: 'Name', required: false },
        { key: 'email', label: 'Email', required: true },
        { key: 'phone', label: 'Telefon', required: false },
        { key: 'event_date', label: 'Event-Datum', required: true },
        { key: 'source', label: 'Quelle', required: false },
        { key: 'utm_campaign', label: 'UTM Campaign', required: false }
      ];

      mapping.innerHTML = `
        <div class="import-info-box" style="background: #e3f2fd; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #2196f3;">
          <strong>ℹ️ Hinweis:</strong> Alle Kontakte werden als <strong>"${eventLabel}"</strong> hochgeladen.
        </div>
      ` + requiredFields.map(field => {
        const autoMatch = this.autoMatchHeader(headers, field.key);

        return `
          <div class="mapping-row">
            <label>${field.label}${field.required ? ' *' : ''}:</label>
            <select data-field="${field.key}">
              <option value="">-- Nicht zuordnen --</option>
              ${headers.map(h =>
                `<option value="${h}" ${h === autoMatch ? 'selected' : ''}>${h}</option>`
              ).join('')}
            </select>
          </div>
        `;
      }).join('');
    },

    autoMatchHeader(headers, fieldKey) {
      const patterns = {
        name: ['name', 'namen', 'vorname', 'nachname', 'full name', 'fullname'],
        email: ['email', 'e-mail', 'mail', 'emailadresse', 'e-mailadresse'],
        phone: ['phone', 'telefon', 'tel', 'mobile', 'handy'],
        event_date: ['event_date', 'date', 'datum', 'created', 'timestamp', 'time submitted'],
        source: ['source', 'quelle', 'traffic', 'utm_source', 'opt-in source'],
        utm_campaign: ['utm_campaign', 'utm campaign', 'campaign', 'kampagne']
      };

      const fieldPatterns = patterns[fieldKey] || [];

      for (const header of headers) {
        const headerLower = header.toLowerCase().trim();
        for (const pattern of fieldPatterns) {
          if (headerLower.includes(pattern) || pattern.includes(headerLower)) {
            return header;
          }
        }
      }

      return null;
    },

    proceedToPreview() {
      // 🔥 Direkt zur Vorschau springen (für Nicht-Survey-Events)
      this.renderPreview();
      this.currentStep = 5;
      document.getElementById('csvStep2').classList.add('hidden');
      document.getElementById('csvStep3').classList.add('hidden');
      document.getElementById('csvStep4').classList.add('hidden');
      document.getElementById('csvStep5').classList.remove('hidden');
    },

    proceedToSurveyMapping() {
      const selects = document.querySelectorAll('#columnMapping select');
      this.mappedHeaders = {};

      selects.forEach(select => {
        const field = select.dataset.field;
        const csvColumn = select.value;
        if (csvColumn) {
          this.mappedHeaders[field] = csvColumn;
        }
      });

      if (!this.mappedHeaders.email || !this.mappedHeaders.event_date) {
        if (window.Toast) {
          window.Toast.error('Bitte ordne mindestens Email und Event-Datum zu!');
        }
        return;
      }

      // 🔥 Survey-Fragen NUR bei "survey" Event-Type anzeigen
      if (this.defaultEventType === 'survey') {
        this.renderSurveyQuestionMapping();
        this.currentStep = 3;
        document.getElementById('csvStep2').classList.add('hidden');
        document.getElementById('csvStep3').classList.remove('hidden');
      } else {
        // Bei allen anderen Event-Types: Survey-Schritt UND Qualifikations-Schritt überspringen
        this.surveyQuestions = {}; // Keine Survey-Fragen
        this.qualificationRule = null; // Keine Qualifikation
        this.proceedToPreview(); // Direkt zur Vorschau springen
      }
    },

    renderSurveyQuestionMapping() {
      const container = document.getElementById('surveyQuestionMapping');
      if (!container || !this.csvData) return;

      // Get all CSV columns that are NOT mapped to lead fields
      const mappedColumns = Object.values(this.mappedHeaders);
      const allColumns = this.csvData.meta.fields || [];
      const unmappedColumns = allColumns.filter(col => !mappedColumns.includes(col) && col.trim());

      if (unmappedColumns.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">Keine zusätzlichen Spalten für Survey-Fragen verfügbar.</p>';
        return;
      }

      // Separate likely survey questions from other columns
      const likelySurvey = [];
      const otherColumns = [];

      unmappedColumns.forEach(col => {
        if (this.isLikelySurveyQuestion(col)) {
          likelySurvey.push(col);
        } else {
          otherColumns.push(col);
        }
      });

      let html = '<div class="survey-question-list">';
      html += '<p style="margin-bottom: 16px; color: #7f8c8d;">Wähle Spalten aus, die als Survey-Fragen gespeichert werden sollen. Du kannst die Bezeichnung anpassen:</p>';

      // Render likely survey questions (visible)
      if (likelySurvey.length > 0) {
        html += '<div class="survey-section-header"><span class="auto-detect-badge">✓ Automatisch erkannt</span></div>';
        likelySurvey.forEach((col, index) => {
          const shortLabel = this.generateShortLabel(col);
          html += `
            <div class="survey-question-item">
              <label>
                <input type="checkbox" class="survey-question-checkbox" data-column="${col}" data-index="${index}" checked />
                <span class="column-name">${col}</span>
              </label>
              <div class="survey-question-label-wrapper">
                <span class="survey-question-label-text">↳ Kurzform für Clarity:</span>
                <input 
                  type="text" 
                  class="survey-question-label" 
                  data-column="${col}"
                  placeholder="Kurze Bezeichnung..." 
                  value="${shortLabel}"
                />
              </div>
            </div>
          `;
        });
      }

      // Render other columns (collapsible)
      if (otherColumns.length > 0) {
        html += `
          <div class="other-columns-section">
            <button type="button" class="other-columns-toggle" onclick="this.classList.toggle('expanded'); this.nextElementSibling.classList.toggle('expanded');">
              <span class="toggle-icon">▶</span>
              Weitere Spalten (${otherColumns.length})
            </button>
            <div class="other-columns-list">
        `;
        
        otherColumns.forEach((col, index) => {
          const shortLabel = this.generateShortLabel(col);
          html += `
            <div class="survey-question-item">
              <label>
                <input type="checkbox" class="survey-question-checkbox" data-column="${col}" data-index="${likelySurvey.length + index}" />
                <span class="column-name">${col}</span>
              </label>
              <div class="survey-question-label-wrapper">
                <span class="survey-question-label-text">↳ Kurzform für Clarity:</span>
                <input 
                  type="text" 
                  class="survey-question-label" 
                  data-column="${col}"
                  placeholder="Kurze Bezeichnung..." 
                  value="${shortLabel}"
                  disabled
                />
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      }

      html += '</div>';
      container.innerHTML = html;

      // Add change listeners to enable/disable label inputs
      const checkboxes = container.querySelectorAll('.survey-question-checkbox');
      checkboxes.forEach(cb => {
        cb.addEventListener('change', (e) => {
          const column = e.target.dataset.column;
          const labelInput = container.querySelector(`.survey-question-label[data-column="${column}"]`);
          if (labelInput) {
            labelInput.disabled = !e.target.checked;
          }
        });
      });
    },

    generateShortLabel(longQuestion) {
      if (!longQuestion) return '';
      
      const MAX_LENGTH = 50;
      let label = longQuestion.trim();
      
      // Remove trailing comma or comma before question mark
      label = label.replace(/,\s*\?$/, '?').replace(/,\s*$/, '');
      
      // Already short enough
      if (label.length <= MAX_LENGTH) {
        return label.endsWith('?') ? label : label + '?';
      }
      
      // 1. "Was ist deine..." -> Extract just the noun
      // Example: "Was ist deine derzeitige Beschäftigung und wie..." -> "Derzeitige Beschäftigung?"
      const wasIstMatch = label.match(/^Was\s+ist\s+(deine?|Ihre?)\s+([^,?]+?)(?:\s+und\s+|\s*,|\?)/i);
      if (wasIstMatch) {
        const noun = wasIstMatch[2].trim();
        if (noun.length <= MAX_LENGTH - 1) {
          return noun.charAt(0).toUpperCase() + noun.slice(1) + '?';
        }
      }
      
      // 2. "Was passiert momentan..." -> Cut before subordinate clause
      // Example: "Was passiert momentan in deinem Leben, dass..." -> "Was passiert momentan in deinem Leben?"
      const subordinateWords = [' dass ', ' das ', ' wenn ', ' ob ', ' weil ', ' damit ', ' um ', ' sodass '];
      for (const word of subordinateWords) {
        const index = label.toLowerCase().indexOf(word);
        if (index > 15 && index <= MAX_LENGTH) {
          let cut = label.substring(0, index).trim();
          cut = cut.replace(/,\s*$/, ''); // Remove trailing comma
          return cut.endsWith('?') ? cut : cut + '?';
        }
      }
      
      // 3. "Wenn du einen Weg..." -> Cut at first comma if reasonable
      // Example: "Wenn du einen Weg gezeigt bekommen würdest, wie..." -> "Wenn du einen Weg gezeigt bekommen würdest?"
      const firstCommaIndex = label.indexOf(',');
      if (firstCommaIndex > 20 && firstCommaIndex <= MAX_LENGTH) {
        let cut = label.substring(0, firstCommaIndex).trim();
        return cut.endsWith('?') ? cut : cut + '?';
      }
      
      // 4. Extract first complete clause up to MAX_LENGTH
      const words = label.split(' ');
      let shortened = '';
      for (const word of words) {
        const testLength = (shortened + ' ' + word).trim().length;
        if (testLength <= MAX_LENGTH - 1) {
          shortened += (shortened ? ' ' : '') + word;
        } else {
          break;
        }
      }
      
      if (shortened.length > 20) {
        shortened = shortened.trim().replace(/,\s*$/, '');
        // Only add ellipsis if we cut significantly
        if (shortened.length < label.length - 10) {
          return shortened + '...?';
        }
        return shortened.endsWith('?') ? shortened : shortened + '?';
      }
      
      // Last resort: hard cut
      return label.substring(0, MAX_LENGTH - 1).trim() + '?';
    },

    isLikelySurveyQuestion(columnName) {
      if (!columnName) return false;
      
      const text = columnName.toLowerCase();
      
      // Strong indicators for survey questions
      const strongIndicators = [
        '?',  // Contains question mark
        'was ', 'wie ', 'wer ', 'wo ', 'wann ', 'warum ', 'welche',  // Question words
        'bist du', 'hast du', 'kannst du', 'möchtest du', 'willst du',  // Personal questions
        'deine ', 'deinen ', 'dein ',  // Personal pronouns
      ];

      // Check for strong indicators
      for (const indicator of strongIndicators) {
        if (text.includes(indicator)) return true;
      }

      // Additional patterns: long text (likely question) or contains specific keywords
      if (columnName.length > 40) return true;  // Long text likely a question

      const keywords = [
        'leben', 'beschäftigung', 'problem', 'lösung', 'ziel', 'herausforderung',
        'bereit', 'investieren', 'einkommen', 'situation', 'status', 'grund',
        'wunsch', 'traum', 'motivation', 'erwartung', 'erfahrung'
      ];

      for (const keyword of keywords) {
        if (text.includes(keyword)) return true;
      }

      // Date/time columns are NOT survey questions
      if (text.includes('date') || text.includes('datum') || text.includes('time') || text.includes('zeit')) {
        return false;
      }

      // Short technical columns are NOT survey questions
      if (columnName.length < 15 && !text.includes('?')) return false;

      return false;
    },

    skipSurveyMapping() {
      this.surveyQuestions = {};
      this.proceedToQualificationStep();
    },

    proceedToQualificationStep() {
      // Collect selected survey questions
      this.surveyQuestions = {};
      const checkboxes = document.querySelectorAll('.survey-question-checkbox:checked');
      
      checkboxes.forEach(cb => {
        const column = cb.dataset.column;
        const labelInput = document.querySelector(`.survey-question-label[data-column="${column}"]`);
        const label = labelInput ? labelInput.value.trim() : column;
        if (label) {
          this.surveyQuestions[column] = label;
        }
      });

      // Render qualification step
      this.renderQualificationStep();

      this.currentStep = 4;
      document.getElementById('csvStep3').classList.add('hidden');
      document.getElementById('csvStep4').classList.remove('hidden');
    },

    renderQualificationStep() {
      const checkbox = document.getElementById('hasQualificationLogic');
      const settings = document.getElementById('qualificationSettings');
      const select = document.getElementById('qualificationQuestion');

      // Populate dropdown with survey questions
      select.innerHTML = '<option value="">-- Bitte wählen --</option>';
      
      Object.entries(this.surveyQuestions).forEach(([column, label]) => {
        const option = document.createElement('option');
        option.value = column;
        option.textContent = label;
        select.appendChild(option);
      });

      // Toggle visibility based on checkbox
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          settings.classList.remove('hidden');
        } else {
          settings.classList.add('hidden');
        }
      });

      // When user selects a question, load all unique answers from CSV
      select.addEventListener('change', (e) => {
        const selectedColumn = e.target.value;
        if (selectedColumn) {
          this.renderAnswerOptions(selectedColumn);
        }
      });
    },

    renderAnswerOptions(columnName) {
      const container = document.getElementById('qualifyingAnswers');
      if (!container) return;

      // Extract all unique answers for this column from CSV data
      const uniqueAnswers = new Set();
      
      this.csvData.data.forEach(row => {
        const answer = row[columnName];
        if (answer && answer.trim()) {
          uniqueAnswers.add(answer.trim());
        }
      });

      // Sort answers alphabetically
      const sortedAnswers = Array.from(uniqueAnswers).sort((a, b) => 
        a.localeCompare(b, 'de', { sensitivity: 'base' })
      );

      if (sortedAnswers.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">Keine Antworten in dieser Spalte gefunden.</p>';
        return;
      }

      // Render as checkbox list
      let html = '<div class="answer-options-list">';
      
      sortedAnswers.forEach((answer, index) => {
        html += `
          <label class="answer-option-item">
            <input 
              type="checkbox" 
              class="answer-option-checkbox" 
              value="${answer.replace(/"/g, '&quot;')}"
              data-index="${index}"
            />
            <span class="answer-text">${answer}</span>
          </label>
        `;
      });

      html += '</div>';
      container.innerHTML = html;
    },

    skipQualification() {
      this.qualificationRule = null;
      this.proceedToPreviewFromQualification();
    },

    proceedToPreviewFromQualification() {
      const checkbox = document.getElementById('hasQualificationLogic');
      
      if (checkbox.checked) {
        const questionColumn = document.getElementById('qualificationQuestion').value;

        if (!questionColumn) {
          if (window.Toast) {
            window.Toast.error('Bitte wähle eine Frage aus!');
          }
          return;
        }

        // Collect checked answers
        const checkedBoxes = document.querySelectorAll('.answer-option-checkbox:checked');
        const qualifyingAnswers = Array.from(checkedBoxes).map(cb => cb.value);

        if (qualifyingAnswers.length === 0) {
          if (window.Toast) {
            window.Toast.error('Bitte wähle mindestens eine qualifizierende Antwort aus!');
          }
          return;
        }

        const questionLabel = this.surveyQuestions[questionColumn];

        this.qualificationRule = {
          questionColumn,
          questionLabel,
          qualifyingAnswers
        };
      } else {
        this.qualificationRule = null;
      }

      this.currentStep = 5;
      document.getElementById('csvStep4').classList.add('hidden');
      document.getElementById('csvStep5').classList.remove('hidden');

      this.renderPreview();
    },

    renderPreview() {
      const previewTable = document.getElementById('previewTable');
      const previewData = this.csvData.data.slice(0, 5);

      const headers = Object.keys(this.mappedHeaders);

      let html = '<table><thead><tr>';
      headers.forEach(h => {
        html += `<th>${h}</th>`;
      });
      html += '</tr></thead><tbody>';

      previewData.forEach(row => {
        html += '<tr>';
        headers.forEach(field => {
          const csvColumn = this.mappedHeaders[field];
          let value = row[csvColumn] || '-';
          
          // Show parsed date format for event_date field
          if (field === 'event_date' && value !== '-') {
            const parsedDate = this.parseEventDate(value);
            if (parsedDate) {
              value = `${value} → ${parsedDate}`;
            }
          }
          
          html += `<td>${value}</td>`;
        });
        html += '</tr>';
      });

      html += '</tbody></table>';
      previewTable.innerHTML = html;
    },

    async startImport() {
      this.currentStep = 6;
      document.getElementById('csvStep5').classList.add('hidden'); // 🔥 Vorschau ausblenden
      document.getElementById('csvStep6').classList.remove('hidden'); // 🔥 Progress anzeigen

      const skipDuplicates = document.getElementById('skipDuplicates').checked;
      const totalRows = this.csvData.data.length;
      let processedRows = 0;
      let createdLeads = 0;
      let updatedLeads = 0;
      let createdEvents = 0;
      let skippedRows = 0;

      const progressFill = document.getElementById('progressFill');
      const progressText = document.getElementById('progressText');

      // Batch processing: 500 rows at a time for maximum speed
      const BATCH_SIZE = 500;
      const batches = [];
      
      for (let i = 0; i < this.csvData.data.length; i += BATCH_SIZE) {
        batches.push(this.csvData.data.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        const leadBatch = [];
        const eventBatch = [];
        const emailToRowIndices = new Map(); // Map email -> array of row indices
        const seenEmails = new Set(); // Track unique emails in this batch
        const spamByEmail = new Map(); // email -> spam result

        // Prepare batch data
        for (let i = 0; i < batch.length; i++) {
          const row = batch[i];
          const email = row[this.mappedHeaders.email]?.trim();
          const phone = row[this.mappedHeaders.phone]?.trim();
          const name = row[this.mappedHeaders.name]?.trim();

          if (!email) {
            skippedRows++;
            continue;
          }

          const emailLower = email.toLowerCase();

          // Track all row indices for this email (for multiple events per lead)
          if (!emailToRowIndices.has(emailLower)) {
            emailToRowIndices.set(emailLower, []);
          }
          emailToRowIndices.get(emailLower).push(i);

          // Only add lead once per unique email in this batch
          if (!seenEmails.has(emailLower)) {
            seenEmails.add(emailLower);

            // Collect survey answers from this row for spam detection
            const rowSurveyAnswers = {};
            Object.entries(this.surveyQuestions).forEach(([csvColumn, label]) => {
              const answer = row[csvColumn];
              if (answer && answer.trim()) rowSurveyAnswers[label] = answer.trim();
            });

            const spam = this.detectSpam(name || null, email, phone || null, rowSurveyAnswers);
            spamByEmail.set(emailLower, spam);

            leadBatch.push({
              name: name || null,
              emails: [email],
              phones: phone ? [phone] : [],
              primary_email: email,
              primary_phone: phone || null,
              source: row[this.mappedHeaders.source] || null,
              utm_campaign: row[this.mappedHeaders.utm_campaign] || '',
              is_spam: spam.isSpam,
              lead_status: spam.isSpam ? 'spam' : 'new',
            });
          }
        }

        if (leadBatch.length === 0) continue;

        // Check for existing leads (always, not just when skipDuplicates is checked)
        // This ensures events are linked to existing leads
        const emails = leadBatch.map(l => l.primary_email);
        const phones = leadBatch.map(l => l.primary_phone).filter(p => p);
        
        let existingLeadsQuery = window.SupabaseClient
          .from('leads')
          .select('id, primary_email, primary_phone, name, source, utm_campaign, funnel_id');
        
        // Search by email OR phone using proper Supabase filter syntax
        if (phones.length > 0) {
          // Wrap emails and phones in quotes for PostgREST
          const emailsFormatted = emails.map(e => `"${e}"`).join(',');
          const phonesFormatted = phones.map(p => `"${p}"`).join(',');
          existingLeadsQuery = existingLeadsQuery.or(`primary_email.in.(${emailsFormatted}),primary_phone.in.(${phonesFormatted})`);
        } else {
          existingLeadsQuery = existingLeadsQuery.in('primary_email', emails);
        }
        
        const { data: existingLeads } = await existingLeadsQuery;

        const existingLeadMap = new Map();
        if (existingLeads) {
          existingLeads.forEach(lead => {
            // Map by email
            existingLeadMap.set(lead.primary_email.toLowerCase(), lead);
            // Map by phone if available
            if (lead.primary_phone) {
              existingLeadMap.set(lead.primary_phone, lead);
            }
          });
        }

        // Separate new leads from existing ones
        const newLeads = [];
        const existingLeadIds = new Map(); // email/phone -> lead_id
        
        leadBatch.forEach((lead, index) => {
          const email = lead.primary_email.toLowerCase();
          const phone = lead.primary_phone;
          
          // Check if lead exists by email or phone
          let existingLead = existingLeadMap.get(email);
          if (!existingLead && phone) {
            existingLead = existingLeadMap.get(phone);
          }
          
          if (existingLead) {
            existingLeadIds.set(email, existingLead.id);
            if (phone) existingLeadIds.set(phone, existingLead.id);
            updatedLeads++;
          } else if (skipDuplicates) {
            // Only add new leads if skipDuplicates is enabled
            lead.user_id = window.AuthAPI.getUserId();
            newLeads.push(lead);
          } else {
            // If skipDuplicates is disabled, still add to avoid creating events without leads
            lead.user_id = window.AuthAPI.getUserId();
            newLeads.push(lead);
          }
        });

          if (newLeads.length > 0) {
            const { data: insertedLeads, error: leadError } = await window.SupabaseClient
              .from('leads')
              .insert(newLeads)
              .select('id, primary_email');

            if (!leadError) {
              createdLeads += insertedLeads.length;

              // Prepare events for new leads (handle multiple events per lead)
              for (const lead of insertedLeads) {
                const emailLower = lead.primary_email.toLowerCase();
                const rowIndices = emailToRowIndices.get(emailLower) || [];
                
                // Create event for each occurrence of this email in the CSV
                for (const rowIndex of rowIndices) {
                  const row = batch[rowIndex];
                  const eventDate = row[this.mappedHeaders.event_date]?.trim();

                  if (eventDate && this.defaultEventType) {
                    // Convert to ISO format to preserve time
                    const isoDate = this.parseEventDate(eventDate);
                    if (isoDate) {
                      // Collect survey question answers
                      const surveyAnswers = {};
                      Object.entries(this.surveyQuestions).forEach(([csvColumn, label]) => {
                        const answer = row[csvColumn];
                        if (answer && answer.trim()) {
                          surveyAnswers[label] = answer.trim();
                        }
                      });

                      const isSpamNew = spamByEmail.get(lead.primary_email.toLowerCase())?.isSpam || false;
                      eventBatch.push({
                        user_id: window.AuthAPI.getUserId(),
                        lead_id: lead.id,
                        event_type: this.defaultEventType,
                        event_date: isoDate,
                        source: row[this.mappedHeaders.source] || null,
                        is_spam: isSpamNew,
                        metadata: Object.keys(surveyAnswers).length > 0 ? { survey_questions: surveyAnswers } : {}
                      });

                      // Check qualification logic
                      if (this.qualificationRule && Object.keys(surveyAnswers).length > 0) {
                        const qualAnswer = row[this.qualificationRule.questionColumn]?.trim();
                        if (qualAnswer) {
                          const isQualified = this.qualificationRule.qualifyingAnswers.some(
                            qa => qa.toLowerCase() === qualAnswer.toLowerCase()
                          );

                          if (isQualified) {
                            eventBatch.push({
                              user_id: window.AuthAPI.getUserId(),
                              lead_id: lead.id,
                              event_type: 'survey_qualified',
                              event_date: isoDate,
                              source: row[this.mappedHeaders.source] || null,
                              is_spam: isSpamNew,
                              metadata: {}
                            });
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          // Prepare events for existing leads (handle multiple events per lead)
          for (const [emailOrPhone, leadId] of existingLeadIds) {
            const emailLower = emailOrPhone.toLowerCase();
            const rowIndices = emailToRowIndices.get(emailLower) || [];
            
            // Create event for each occurrence of this email in the CSV
            for (const rowIndex of rowIndices) {
              const row = batch[rowIndex];
              const eventDate = row[this.mappedHeaders.event_date]?.trim();

              if (eventDate && this.defaultEventType) {
                // Convert to ISO format to preserve time
                const isoDate = this.parseEventDate(eventDate);
                if (isoDate) {
                  // Collect survey question answers
                  const surveyAnswers = {};
                  Object.entries(this.surveyQuestions).forEach(([csvColumn, label]) => {
                    const answer = row[csvColumn];
                    if (answer && answer.trim()) {
                      surveyAnswers[label] = answer.trim();
                    }
                  });

                  const isSpamExisting = spamByEmail.get(emailOrPhone.toLowerCase())?.isSpam || false;
                  eventBatch.push({
                    user_id: window.AuthAPI.getUserId(),
                    lead_id: leadId,
                    event_type: this.defaultEventType,
                    event_date: isoDate,
                    source: row[this.mappedHeaders.source] || null,
                    is_spam: isSpamExisting,
                    metadata: Object.keys(surveyAnswers).length > 0 ? { survey_questions: surveyAnswers } : {}
                  });

                  // Check qualification logic
                  if (this.qualificationRule && Object.keys(surveyAnswers).length > 0) {
                    const qualAnswer = row[this.qualificationRule.questionColumn]?.trim();
                    if (qualAnswer) {
                      const isQualified = this.qualificationRule.qualifyingAnswers.some(
                        qa => qa.toLowerCase() === qualAnswer.toLowerCase()
                      );

                      if (isQualified) {
                        eventBatch.push({
                          user_id: window.AuthAPI.getUserId(),
                          lead_id: leadId,
                          event_type: 'survey_qualified',
                          event_date: isoDate,
                          source: row[this.mappedHeaders.source] || null,
                          is_spam: isSpamExisting,
                          metadata: {}
                        });
                      }
                    }
                  }
                }
              }
            }
          }

        // Batch insert events
        if (eventBatch.length > 0) {
          const { data: insertedEvents, error: eventError } = await window.SupabaseClient
            .from('events')
            .insert(eventBatch);

          if (!eventError) {
            createdEvents += eventBatch.length;
          }
        }

        processedRows += batch.length;
        const progress = (processedRows / totalRows) * 100;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${processedRows} von ${totalRows} Zeilen verarbeitet...`;
      }

      this.showSummary(createdLeads, updatedLeads, createdEvents, skippedRows);
    },



    showSummary(createdLeads, updatedLeads, createdEvents, skippedRows) {
      this.currentStep = 7;
      document.getElementById('csvStep5').classList.add('hidden'); // 🔥 Vorschau ausblenden
      document.getElementById('csvStep6').classList.add('hidden');
      document.getElementById('csvStep7').classList.remove('hidden');

      const summary = document.getElementById('importSummary');
      summary.innerHTML = `
        <div class="summary-stats">
          <div class="summary-stat">
            <div class="summary-value">${createdLeads}</div>
            <div class="summary-label">Neue Leads erstellt</div>
          </div>
          <div class="summary-stat">
            <div class="summary-value">${updatedLeads}</div>
            <div class="summary-label">Leads aktualisiert</div>
          </div>
          <div class="summary-stat">
            <div class="summary-value">${createdEvents}</div>
            <div class="summary-label">Events importiert</div>
          </div>
          ${skippedRows > 0 ? `
            <div class="summary-stat">
              <div class="summary-value">${skippedRows}</div>
              <div class="summary-label">Zeilen übersprungen</div>
            </div>
          ` : ''}
        </div>
      `;

      if (window.Toast) {
        window.Toast.success('Import erfolgreich abgeschlossen!');
      }
    }
  };

  window.CSVImportDatapool = CSVImportDatapool;
  console.log('✅ CSV Import module loaded successfully');

})(window);
