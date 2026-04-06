(function(window) {
  'use strict';

  const CloseAPI = {

    // ── State ──────────────────────────────────────────────────────────────────
    connection: null,          // close_connections row
    setupData: null,           // { dispositions, stages, custom_fields, suggested_... }
    outcomeMappings: [],       // close_call_outcome_mappings rows
    fieldMappings: [],         // close_field_mappings rows
    stageMappings: [],         // close_stage_mappings rows

    // ── Modal ──────────────────────────────────────────────────────────────────
    async openConnectionModal() {
      const modal = document.getElementById('closeio-modal');
      if (!modal) { console.error('❌ Close.io modal nicht gefunden'); return; }

      modal.style.display = 'flex';
      document.getElementById('closeio-content').innerHTML = `
        <div style="text-align:center;padding:2rem;">
          <div style="font-size:1.5rem;color:#666;">Wird geladen…</div>
        </div>`;

      try {
        await this._loadConnectionStatus();
        this.renderConnectionUI();
      } catch (err) {
        console.error('❌ Close.io modal laden fehlgeschlagen:', err);
        window.Toast.error('Fehler beim Laden der Close.io-Verbindung.');
      }
    },

    closeConnectionModal() {
      const modal = document.getElementById('closeio-modal');
      if (modal) modal.style.display = 'none';
    },

    // ── Connection Status ──────────────────────────────────────────────────────
    async _loadConnectionStatus() {
      const { data: { user } } = await window.SupabaseClient.auth.getUser();
      if (!user) { this.connection = null; return; }

      const { data, error } = await window.SupabaseClient
        .from('close_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      this.connection = data || null;
    },

    // ── Render: Main UI ────────────────────────────────────────────────────────
    renderConnectionUI() {
      const content = document.getElementById('closeio-content');
      if (!content) return;

      if (!this.connection) {
        content.innerHTML = `
          <div style="max-width:480px;margin:0 auto;padding:1rem 0;">
            <div style="text-align:center;margin-bottom:2rem;">
              <div style="font-size:3rem;margin-bottom:0.5rem;">📞</div>
              <h3 style="margin:0 0 0.5rem;">Close.io verbinden</h3>
              <p style="color:#666;font-size:14px;margin:0;">
                Füge deinen Close.io API Key ein. Den findest du unter<br>
                <strong>Settings → API Keys</strong> in deinem Close.io Account.
              </p>
            </div>
            <div style="margin-bottom:1rem;">
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#444;">API Key</label>
              <input
                id="closeio-api-key-input"
                type="password"
                placeholder="api_xxxxxxxxxxxxxxxxxxxxxxxx"
                style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;font-family:monospace;box-sizing:border-box;"
                onkeydown="if(event.key==='Enter') window.CloseAPI.connect()"
              />
            </div>
            <button class="btn-primary" style="width:100%;padding:12px;" onclick="window.CloseAPI.connect()">
              🔗 Verbinden
            </button>
          </div>`;
        return;
      }

      // Connected state
      const conn = this.connection;
      content.innerHTML = `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:1.5rem;">
            <div>
              <span style="color:#16a34a;font-weight:600;">✓ Verbunden</span>
              ${conn.organization_name ? `<span style="color:#666;margin-left:8px;">· ${conn.organization_name}</span>` : ''}
            </div>
            <button class="btn-secondary" style="font-size:12px;padding:5px 12px;color:#dc2626;border-color:#fca5a5;" onclick="window.CloseAPI.disconnect()">
              Trennen
            </button>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:1rem;">
            <button class="btn-primary" onclick="window.CloseAPI.openMappingModal()">
              ⚙️ Mappings konfigurieren
            </button>
            <button class="btn-secondary" onclick="window.CloseAPI.showMappingSummary()">
              📋 Aktuelle Mappings
            </button>
          </div>

          <!-- Historical Import -->
          <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:14px;margin-bottom:8px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:4px;">📥 Rückwirkend importieren</div>
            <div style="font-size:12px;color:#666;margin-bottom:10px;">
              Importiert Close.io Calls der letzten N Tage als Call-Events. Bereits importierte Calls werden übersprungen.
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button class="btn-secondary" style="font-size:12px;padding:6px 14px;" onclick="window.CloseAPI.importHistorical(30)">30 Tage</button>
              <button class="btn-secondary" style="font-size:12px;padding:6px 14px;" onclick="window.CloseAPI.importHistorical(90)">90 Tage</button>
              <button class="btn-secondary" style="font-size:12px;padding:6px 14px;" onclick="window.CloseAPI.importHistorical(180)">180 Tage</button>
            </div>
            <div id="closeio-import-status" style="margin-top:8px;font-size:12px;color:#666;"></div>
          </div>

          <!-- Closing Termine sync -->
          <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:14px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:4px;">✅ Closing Termine anlegen</div>
            <div style="font-size:12px;color:#666;margin-bottom:10px;">
              Legt für alle qualifizierten Setting Calls (Setter hat Lead qualifiziert) einen Closing Termin im Datenpool an.
            </div>
            <button class="btn-secondary" style="font-size:12px;padding:6px 14px;" onclick="window.CloseAPI.syncClosingTermins()">Closing Termine synchronisieren</button>
            <div id="closeio-termins-status" style="margin-top:8px;font-size:12px;color:#666;"></div>
          </div>

          <div id="closeio-mapping-summary" style="margin-top:1rem;"></div>
        </div>`;

      // Load and show mapping summary in background
      this._loadMappingSummary();
    },

    // ── Connect ────────────────────────────────────────────────────────────────
    async connect() {
      const input = document.getElementById('closeio-api-key-input');
      const apiKey = input?.value?.trim();
      if (!apiKey) { window.Toast.error('Bitte API Key eingeben.'); return; }

      const btn = document.querySelector('#closeio-content .btn-primary');
      if (btn) { btn.disabled = true; btn.textContent = 'Verbinden…'; }

      try {
        const result = await this._callSync({ action: 'connect', api_key: apiKey });
        window.Toast.success(`Close.io verbunden: ${result.organization_name || 'Erfolgreich'}`);
        await this._loadConnectionStatus();
        this.renderConnectionUI();
        // Automatically open mapping modal after connect
        setTimeout(() => this.openMappingModal(), 300);
      } catch (err) {
        console.error('❌ Close.io connect fehlgeschlagen:', err);
        window.Toast.error('Verbindung fehlgeschlagen: ' + (err.message || 'Ungültiger API Key'));
        if (btn) { btn.disabled = false; btn.textContent = '🔗 Verbinden'; }
      }
    },

    // ── Sync Closing Termins ───────────────────────────────────────────────────
    async syncClosingTermins() {
      const statusEl = document.getElementById('closeio-termins-status');
      const btn = document.querySelector('#closeio-content button[onclick*="syncClosingTermins"]');
      if (statusEl) statusEl.innerHTML = `<span style="color:#1877f2;">⏳ Wird synchronisiert…</span>`;
      if (btn) btn.disabled = true;

      try {
        const result = await this._callSync({ action: 'sync_closing_termins' });
        const msg = `✅ ${result.created} Closing Termine angelegt · ${result.skipped} übersprungen${result.errors ? ` · ${result.errors} Fehler` : ''}`;
        if (statusEl) statusEl.innerHTML = `<span style="color:#16a34a;">${msg}</span>`;
        if (result.created > 0) window.Toast.success(`${result.created} Closing Termine im Datenpool angelegt`);
        else window.Toast.success('Sync abgeschlossen — keine neuen Closing Termine.');
      } catch (err) {
        console.error('❌ Close.io syncClosingTermins fehlgeschlagen:', err);
        if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626;">❌ Fehler: ${err.message}</span>`;
        window.Toast.error('Sync fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
      } finally {
        if (btn) btn.disabled = false;
      }
    },

    // ── Historical Import ──────────────────────────────────────────────────────
    async importHistorical(days) {
      const statusEl = document.getElementById('closeio-import-status');
      const btns = document.querySelectorAll('#closeio-content .btn-secondary[onclick*="importHistorical"]');

      if (statusEl) statusEl.innerHTML = `<span style="color:#1877f2;">⏳ Importiere letzte ${days} Tage…</span>`;
      btns.forEach(b => b.disabled = true);

      try {
        const result = await this._callSync({ action: 'import_historical', days });
        const msg = `✅ ${result.imported} importiert · ${result.skipped} übersprungen${result.errors ? ` · ${result.errors} Fehler` : ''}`;
        if (statusEl) statusEl.innerHTML = `<span style="color:#16a34a;">${msg}</span>`;
        if (result.imported > 0) window.Toast.success(`Close.io Import: ${result.imported} Call-Events importiert`);
        else window.Toast.success('Import abgeschlossen — keine neuen Calls gefunden.');
      } catch (err) {
        console.error('❌ Close.io historical import fehlgeschlagen:', err);
        if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626;">❌ Fehler: ${err.message}</span>`;
        window.Toast.error('Import fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
      } finally {
        btns.forEach(b => b.disabled = false);
      }
    },

    // ── Disconnect ─────────────────────────────────────────────────────────────
    async disconnect() {
      if (!confirm('Close.io-Verbindung wirklich trennen? Alle Mappings werden gelöscht.')) return;

      try {
        await this._callSync({ action: 'disconnect' });
        this.connection = null;
        this.outcomeMappings = [];
        this.fieldMappings = [];
        this.stageMappings = [];
        window.Toast.success('Close.io getrennt.');
        this.renderConnectionUI();
      } catch (err) {
        console.error('❌ Close.io disconnect fehlgeschlagen:', err);
        window.Toast.error('Fehler beim Trennen der Verbindung.');
      }
    },

    // ── Mapping Modal ──────────────────────────────────────────────────────────
    async openMappingModal() {
      // Remove existing if open
      const existing = document.getElementById('closeio-mapping-modal');
      if (existing) existing.remove();

      // Create modal with loading state
      const modal = document.createElement('div');
      modal.id = 'closeio-mapping-modal';
      modal.className = 'modal';
      modal.style.cssText = 'display:flex;z-index:10003;';
      modal.innerHTML = `
        <div class="modal-content" style="max-width:720px;max-height:85vh;overflow-y:auto;">
          <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
            <h2 style="margin:0;">⚙️ Close.io Mappings</h2>
            <button onclick="document.getElementById('closeio-mapping-modal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#666;">×</button>
          </div>
          <div id="closeio-mapping-content">
            <div style="text-align:center;padding:2rem;color:#666;">Wird geladen…</div>
          </div>
        </div>`;
      document.body.appendChild(modal);

      try {
        const [setupData, savedMappings] = await Promise.all([
          this._callSync({ action: 'fetch_setup_data' }),
          this._callSync({ action: 'get_mappings' }),
        ]);
        this.setupData = setupData;
        this.outcomeMappings = savedMappings.outcome_mappings || [];
        this.fieldMappings = savedMappings.field_mappings || [];
        this.stageMappings = savedMappings.stage_mappings || [];

        this._renderMappingContent();
      } catch (err) {
        console.error('❌ Close.io setup data laden fehlgeschlagen:', err);
        document.getElementById('closeio-mapping-content').innerHTML =
          `<div style="color:#dc2626;padding:1rem;">Fehler beim Laden: ${err.message}</div>`;
      }
    },

    _renderMappingContent() {
      const content = document.getElementById('closeio-mapping-content');
      if (!content || !this.setupData) return;

      const callOutcomes = this.setupData.call_outcomes || [];
      const customFields = this.setupData.custom_fields || [];
      const suggested = this.setupData.suggested_outcome_mappings || [];

      // Build outcome mapping rows (use saved or suggested)
      const outcomeRows = callOutcomes.map(outcome => {
        const saved = this.outcomeMappings.find(m => m.close_outcome_id === outcome.id);
        const sug = suggested.find(s => s.close_outcome_id === outcome.id);
        return saved || sug || { close_outcome_id: outcome.id, close_disposition: outcome.label, clarity_call_type: null, clarity_status: null };
      });

      const outcomeTable = callOutcomes.length === 0
        ? '<p style="color:#666;font-size:14px;">Keine Call Outcomes in Close.io gefunden. Stelle sicher, dass du Call Outcomes in Close.io eingerichtet hast und mindestens einen Call geloggt hast.</p>'
        : `<table style="width:100%;min-width:0!important;border-collapse:collapse;font-size:13px;table-layout:fixed;background:transparent;">
            <colgroup>
              <col>
              <col style="width:110px;">
              <col style="width:158px;">
            </colgroup>
            <thead>
              <tr>
                <th style="text-align:left!important;padding:8px 6px;white-space:normal!important;">Close.io Call Outcome</th>
                <th style="text-align:left!important;padding:8px 6px;white-space:normal!important;">Call-Typ</th>
                <th style="text-align:left!important;padding:8px 6px;white-space:normal!important;">Status in Clarity</th>
              </tr>
            </thead>
            <tbody>
              ${outcomeRows.map((row, i) => {
                const savedLabel = (row.close_disposition && row.close_disposition !== row.close_outcome_id) ? row.close_disposition : '';
                const shortId = (row.close_outcome_id || '').slice(-8);
                return `
                <tr style="border-bottom:1px solid #f0f0f0;" data-outcome-index="${i}" data-outcome-id="${row.close_outcome_id || ''}">
                  <td style="padding:4px 6px;text-align:left!important;">
                    <input type="text" data-field="outcome_label"
                      value="${savedLabel}"
                      placeholder="Name… (ID: …${shortId})"
                      style="width:100%;box-sizing:border-box;padding:5px 8px;font-size:12px;border:1px solid #ddd;border-radius:4px;background:#fff;color:#222;pointer-events:auto;cursor:text;outline:none;text-align:left!important;"
                      onfocus="this.style.borderColor='#1877f2'"
                      onblur="this.style.borderColor='#ddd'"
                    />
                  </td>
                  <td style="padding:6px 12px 6px 6px;white-space:nowrap;text-align:left!important;">
                    <select data-field="clarity_call_type" style="width:100%;font-size:12px;padding:4px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;">
                      <option value="" ${!row.clarity_call_type ? 'selected' : ''}>– wählen –</option>
                      <option value="setting" ${row.clarity_call_type === 'setting' ? 'selected' : ''}>Setting Call</option>
                      <option value="closing" ${row.clarity_call_type === 'closing' ? 'selected' : ''}>Closing Call</option>
                    </select>
                  </td>
                  <td style="padding:6px 12px 6px 6px;white-space:nowrap;text-align:left!important;">
                    <select data-field="clarity_status" style="width:100%;font-size:12px;padding:4px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;">
                      <option value="">– ignorieren –</option>
                      <option value="showed" ${row.clarity_status === 'showed' ? 'selected' : ''}>✅ Stattgefunden</option>
                      <option value="no_show" ${row.clarity_status === 'no_show' ? 'selected' : ''}>🚫 No Show</option>
                      <option value="canceled" ${row.clarity_status === 'canceled' ? 'selected' : ''}>❌ Abgesagt</option>
                      <option value="disqualified" ${row.clarity_status === 'disqualified' ? 'selected' : ''}>🔴 Disqualifiziert</option>
                    </select>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>`;

      // Build field mapping UI — separate Setter and Closer
      const savedSetter = this.fieldMappings.find(m => m.clarity_field === 'assigned_setter');
      const savedCloser = this.fieldMappings.find(m => m.clarity_field === 'assigned_closer');

      // Setter
      const setterIsCloseUser = !savedSetter || savedSetter.close_field_id === '__close_user__';
      const setterCustomFieldVal = (savedSetter && savedSetter.close_field_id !== '__close_user__')
        ? `${savedSetter.close_field_id}|${savedSetter.close_field_name}` : '';

      // Closer
      const closerIsCloseUser = savedCloser?.close_field_id === '__close_user__';
      const closerCustomFieldVal = (savedCloser && savedCloser.close_field_id !== '__close_user__')
        ? `${savedCloser.close_field_id}|${savedCloser.close_field_name}` : '';

      const buildPersonSection = ({ id, label, isCloseUser, customFieldVal }) => `
        <div style="padding:14px;background:#f9f9f9;border-radius:8px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${label}</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;">
              <input type="radio" name="${id}-source" value="close_user" ${isCloseUser ? 'checked' : ''}
                style="margin-top:3px;"
                onchange="document.getElementById('${id}-custom-field-row').style.display='none'">
              <span>
                <strong>Close.io Nutzer</strong> der den Call geloggt hat
                <span style="display:block;font-size:11px;color:#888;margin-top:1px;">Name kommt automatisch aus dem Close.io Account der den Call geloggt hat</span>
              </span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
              <input type="radio" name="${id}-source" value="custom_field" ${!isCloseUser ? 'checked' : ''}
                onchange="document.getElementById('${id}-custom-field-row').style.display='flex'">
              <span>Custom Field:</span>
            </label>
            <div id="${id}-custom-field-row" style="display:${!isCloseUser ? 'flex' : 'none'};padding-left:24px;">
              <select id="closeio-field-${id}" style="font-size:13px;padding:6px 10px;border:1px solid #ddd;border-radius:6px;min-width:200px;">
                <option value="">– Feld auswählen –</option>
                ${customFields.map(f => `<option value="${f.id}|${f.name}" ${customFieldVal === `${f.id}|${f.name}` ? 'selected' : ''}>${f.name} (${f.type})</option>`).join('')}
              </select>
            </div>
          </div>
        </div>`;

      const fieldSection = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${buildPersonSection({ id: 'setter', label: '👤 Setter-Name', isCloseUser: setterIsCloseUser, customFieldVal: setterCustomFieldVal })}
          ${buildPersonSection({ id: 'closer', label: '🎯 Closer-Name', isCloseUser: closerIsCloseUser, customFieldVal: closerCustomFieldVal })}
        </div>`;

      content.innerHTML = `
        <!-- Section 1: Call Outcomes -->
        <div style="margin-bottom:2rem;">
          <h3 style="margin:0 0 6px;font-size:15px;">📞 Call Outcomes</h3>
          <p style="color:#666;font-size:13px;margin:0 0 1rem;">
            Ordne jedem Close.io Call-Outcome einen Clarity-Status zu. Zeilen ohne Status werden ignoriert.
          </p>
          <div id="closeio-outcome-table" style="overflow-x:auto;">${outcomeTable}</div>
        </div>

        <!-- Section 2: Custom Fields -->
        <div style="margin-bottom:2rem;">
          <h3 style="margin:0 0 6px;font-size:15px;">🏷️ Custom Fields</h3>
          <p style="color:#666;font-size:13px;margin:0 0 1rem;">
            Mappe Close.io Custom Fields auf Clarity-Felder (z.B. "Closer" → Setter/Closer Name).
          </p>
          ${fieldSection}
        </div>

        <!-- Footer Buttons -->
        <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:1rem;border-top:1px solid #eee;">
          <button class="btn-secondary" onclick="document.getElementById('closeio-mapping-modal').remove()">
            Abbrechen
          </button>
          <button class="btn-primary" onclick="window.CloseAPI.saveMappings()">
            ✓ Mappings speichern
          </button>
        </div>`;
    },

    // ── Save Mappings ──────────────────────────────────────────────────────────
    async saveMappings() {
      const modal = document.getElementById('closeio-mapping-modal');
      if (!modal || !this.setupData) return;

      const callOutcomes = this.setupData.call_outcomes || [];

      // Read outcome mappings from table
      const outcomeMappings = [];
      const rows = modal.querySelectorAll('tr[data-outcome-index]');
      rows.forEach((row, i) => {
        const outcome = callOutcomes[i];
        if (!outcome) return;
        const status = row.querySelector('[data-field="clarity_status"]')?.value || '';
        if (!status) return; // Skip rows set to "ignorieren"
        const label = row.querySelector('[data-field="outcome_label"]')?.value?.trim() || outcome.label || outcome.id;
        outcomeMappings.push({
          close_outcome_id: outcome.id,
          close_disposition: label,
          clarity_call_type: row.querySelector('[data-field="clarity_call_type"]')?.value || null,
          clarity_status: status,
        });
      });

      // Read field mappings — Setter and Closer with identical logic
      const fieldMappings = [];
      for (const { radioName, selectId, clarityField } of [
        { radioName: 'setter-source', selectId: 'closeio-field-setter', clarityField: 'assigned_setter' },
        { radioName: 'closer-source', selectId: 'closeio-field-closer', clarityField: 'assigned_closer' },
      ]) {
        const source = modal.querySelector(`input[name="${radioName}"]:checked`)?.value || 'close_user';
        if (source === 'close_user') {
          fieldMappings.push({ close_field_id: '__close_user__', close_field_name: 'Close.io Nutzer (wer hat den Call geloggt)', clarity_field: clarityField });
        } else {
          const val = modal.querySelector(`#${selectId}`)?.value || '';
          if (val) {
            const [fieldId, fieldName] = val.split('|');
            fieldMappings.push({ close_field_id: fieldId, close_field_name: fieldName, clarity_field: clarityField });
          }
        }
      }

      const saveBtn = modal.querySelector('.btn-primary');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Speichern…'; }

      try {
        await this._callSync({
          action: 'save_mappings',
          outcome_mappings: outcomeMappings,
          field_mappings: fieldMappings,
          stage_mappings: [],
        });

        this.outcomeMappings = outcomeMappings;
        this.fieldMappings = fieldMappings;

        window.Toast.success(`${outcomeMappings.length} Outcome-Mappings gespeichert.`);
        modal.remove();
        this._loadMappingSummary();
      } catch (err) {
        console.error('❌ Mappings speichern fehlgeschlagen:', err);
        window.Toast.error('Fehler beim Speichern: ' + err.message);
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '✓ Mappings speichern'; }
      }
    },

    // ── Mapping Summary ────────────────────────────────────────────────────────
    async _loadMappingSummary() {
      try {
        const saved = await this._callSync({ action: 'get_mappings' });
        this.outcomeMappings = saved.outcome_mappings || [];
        this.fieldMappings = saved.field_mappings || [];
        this.showMappingSummary();
      } catch (err) {
        console.error('❌ Mapping summary laden fehlgeschlagen:', err);
      }
    },

    showMappingSummary() {
      const container = document.getElementById('closeio-mapping-summary');
      if (!container) return;

      const count = this.outcomeMappings.length;
      const closerField = this.fieldMappings.find(f => f.clarity_field === 'assigned_to');

      if (count === 0 && !closerField) {
        container.innerHTML = `
          <div style="padding:12px;background:#fff8e7;border:1px solid #fbbf24;border-radius:8px;font-size:13px;color:#92400e;">
            ⚠️ Noch keine Mappings konfiguriert. Klicke auf "Mappings konfigurieren".
          </div>`;
        return;
      }

      container.innerHTML = `
        <div style="padding:12px;background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;font-size:13px;">
          <div style="font-weight:600;margin-bottom:6px;color:#444;">Aktive Konfiguration:</div>
          <div style="color:#555;">📞 ${count} Call-Outcome${count !== 1 ? 's' : ''} gemappt</div>
          ${closerField ? `<div style="color:#555;margin-top:2px;">🏷️ "${closerField.close_field_name}" → Setter/Closer Name</div>` : ''}
        </div>`;
    },

    // ── Edge Function Helper ───────────────────────────────────────────────────
    async _callSync(body) {
      const { data: { session } } = await window.SupabaseClient.auth.getSession();
      if (!session) throw new Error('Nicht angemeldet');

      const res = await fetch(
        `${window.SupabaseClient.supabaseUrl}/functions/v1/close-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
  };

  window.CloseAPI = CloseAPI;

})(window);
