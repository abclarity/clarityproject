// Typeform Integration API - OAuth Flow (like Facebook Ads)
// Handles OAuth connection, form fetching, and webhook setup

(function(window) {
  'use strict';

  const TYPEFORM_CLIENT_ID = '3AmLEv9ajY7TGd9dq8Yb3Nmv2gbbnW5BnbaJRADV2zz5';
  const TYPEFORM_AUTH_URL = 'https://admin.typeform.com/oauth/authorize';
  const OAUTH_SCOPES = 'accounts:read forms:read webhooks:write responses:read';

  const TypeformAPI = {
    connectionStatus: null,
    availableForms: [],
    selectedForm: null,

    // ==================== MAIN MODAL ====================
    async openConnectionModal() {
      const modal = document.getElementById('typeform-modal');
      if (!modal) {
        console.error('Typeform modal not found');
        return;
      }

      // Load connection status
      await this.checkConnectionStatus();
      
      // Render UI based on connection status
      this.renderConnectionUI();

      modal.style.display = 'flex';
    },

    closeConnectionModal() {
      const modal = document.getElementById('typeform-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    },

    // ==================== CONNECTION STATUS ====================
    async checkConnectionStatus() {
      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        if (!userId) {
          this.connectionStatus = null;
          return;
        }

        // Check if user has active Typeform connection
        const { data, error } = await window.SupabaseClient
          .from('typeform_connections')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
          console.error('Error checking connection:', error);
          this.connectionStatus = null;
          return;
        }

        this.connectionStatus = data || null;

        // If connected, load forms
        if (this.connectionStatus) {
          await this.loadConnectedForms();
        }
      } catch (error) {
        console.error('Error checking connection status:', error);
        this.connectionStatus = null;
      }
    },

    // ==================== OAUTH FLOW ====================
    async initiateOAuth() {
      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        if (!userId) {
          window.Toast.error('Bitte zuerst anmelden');
          return;
        }

        // Build OAuth URL
        const redirectUri = `${window.SupabaseClient.supabaseUrl}/functions/v1/typeform-oauth`;
        const state = userId;

        const authUrl = new URL(TYPEFORM_AUTH_URL);
        authUrl.searchParams.set('client_id', TYPEFORM_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', OAUTH_SCOPES);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('response_type', 'code');

        // Open OAuth popup
        const popup = window.open(
          authUrl.toString(),
          'Typeform OAuth',
          'width=600,height=700,left=100,top=100'
        );

        if (!popup) {
          window.Toast.error('Popup wurde blockiert. Bitte Popup-Blocker deaktivieren.');
          return;
        }

        // Listen for OAuth callback
        window.addEventListener('message', async (event) => {
          if (event.data.type === 'TYPEFORM_OAUTH_SUCCESS') {
            popup.close();
            window.Toast.success(`Typeform verbunden: ${event.data.email}`);
            
            // Reload connection status and forms
            await this.checkConnectionStatus();
            this.renderConnectionUI();
          } else if (event.data.type === 'TYPEFORM_OAUTH_ERROR') {
            popup.close();
            window.Toast.error(`Verbindung fehlgeschlagen: ${event.data.error}`);
          }
        });

      } catch (error) {
        console.error('OAuth error:', error);
        window.Toast.error('Fehler beim OAuth-Flow');
      }
    },

    async disconnectTypeform() {
      if (!confirm('Typeform-Verbindung wirklich trennen? Alle Formulare werden deaktiviert.')) {
        return;
      }

      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        // Deactivate connection
        const { error } = await window.SupabaseClient
          .from('typeform_connections')
          .update({ is_active: false })
          .eq('user_id', userId);

        if (error) throw error;

        // Deactivate all forms
        await window.SupabaseClient
          .from('typeform_forms')
          .update({ is_active: false })
          .eq('user_id', userId);

        window.Toast.success('Typeform-Verbindung getrennt');
        
        this.connectionStatus = null;
        this.availableForms = [];
        this.renderConnectionUI();
      } catch (error) {
        console.error('Error disconnecting:', error);
        window.Toast.error('Fehler beim Trennen der Verbindung');
      }
    },

    // ==================== FORM MANAGEMENT ====================
    async loadConnectedForms() {
      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        // Load forms from database (already connected)
        const { data, error } = await window.SupabaseClient
          .from('typeform_forms')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;

        this.availableForms = data || [];
      } catch (error) {
        console.error('Error loading forms:', error);
        window.Toast.error('Fehler beim Laden der Formulare');
      }
    },

    async fetchFormsFromTypeform() {
      try {
        window.Loading.show('Formulare werden geladen...');

        const session = await window.SupabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        // Call typeform-sync Edge Function to fetch forms
        const response = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/typeform-sync`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'fetch_forms' }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Fehler beim Laden der Formulare');
        }

        const data = await response.json();
        
        window.Loading.hide();
        
        return data.forms || [];
      } catch (error) {
        console.error('Error fetching forms:', error);
        window.Loading.hide();
        window.Toast.error(error.message);
        return [];
      }
    },

    async openFormSetupModal() {
      // Fetch forms from Typeform API
      const forms = await this.fetchFormsFromTypeform();
      
      if (forms.length === 0) {
        window.Toast.error('Keine Formulare gefunden. Erstelle zuerst ein Formular in Typeform.');
        return;
      }

      // Show setup modal with form selection
      this.renderFormSetupModal(forms);
    },

    async setupWebhook(formId, formTitle, funnelId, qualificationFieldId, qualifyingAnswers) {
      try {
        window.Loading.show('Webhook wird eingerichtet...');

        const session = await window.SupabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        // Call typeform-sync Edge Function to setup webhook
        const response = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/typeform-sync`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'setup_webhook',
              form_id: formId,
              funnel_id: funnelId,
              qualification_field_id: qualificationFieldId,
              qualifying_answers: qualifyingAnswers,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Webhook-Einrichtung fehlgeschlagen');
        }

        const data = await response.json();
        
        window.Loading.hide();
        window.Toast.success(`Formular "${formTitle}" erfolgreich verbunden!`);
        
        // Show import modal for historical data
        this.showImportModal(formId, formTitle);
        
        // Reload forms and UI
        await this.loadConnectedForms();
        this.renderConnectionUI();
        this.closeFormSetupModal();
      } catch (error) {
        console.error('Error setting up webhook:', error);
        window.Loading.hide();
        window.Toast.error(error.message);
      }
    },

    async deleteFormMapping(formId) {
      if (!confirm('⚠️ Formular-Verbindung löschen?\n\nDies löscht auch:\n- Alle zugehörigen Leads\n- Alle zugehörigen Events\n- Die Import-Historie\n\nBeim nächsten Verbinden werden alle Daten neu importiert.')) {
        return;
      }

      try {
        window.Loading.show('Lösche Formular-Daten...');
        
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        // Step 1: Get form's funnel_id and lead IDs BEFORE deleting log
        const { data: formMapping } = await window.SupabaseClient
          .from('typeform_forms')
          .select('funnel_id')
          .eq('user_id', userId)
          .eq('form_id', formId)
          .single();

        const { data: logEntries } = await window.SupabaseClient
          .from('typeform_events_log')
          .select('lead_id')
          .eq('user_id', userId)
          .eq('form_id', formId);

        const formLeadIds = [...new Set((logEntries || []).map(e => e.lead_id).filter(Boolean))];

        // Step 2: Delete typeform_events_log for this form
        await window.SupabaseClient
          .from('typeform_events_log')
          .delete()
          .eq('user_id', userId)
          .eq('form_id', formId);

        if (formLeadIds.length > 0) {
          // Step 3: Delete events for this form's funnel only
          const eventsQuery = window.SupabaseClient
            .from('events')
            .delete()
            .in('lead_id', formLeadIds);
          if (formMapping?.funnel_id) {
            await eventsQuery.eq('funnel_id', formMapping.funnel_id);
          } else {
            await eventsQuery;
          }

          // Step 4: Only delete leads that have no remaining events
          const { data: remainingEvents } = await window.SupabaseClient
            .from('events')
            .select('lead_id')
            .in('lead_id', formLeadIds);

          const leadsWithEvents = new Set((remainingEvents || []).map(e => e.lead_id));
          const leadsToDelete = formLeadIds.filter(id => !leadsWithEvents.has(id));

          if (leadsToDelete.length > 0) {
            await window.SupabaseClient
              .from('leads')
              .delete()
              .in('id', leadsToDelete);
          }
        }

        // Step 6: Deactivate form
        const { error } = await window.SupabaseClient
          .from('typeform_forms')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('form_id', formId);

        if (error) throw error;

        window.Loading.hide();
        window.Toast.success('Formular-Verbindung und alle Daten gelöscht');
        
        await this.loadConnectedForms();
        this.renderConnectionUI();
      } catch (error) {
        console.error('Error deleting mapping:', error);
        window.Loading.hide();
        window.Toast.error('Fehler beim Löschen: ' + error.message);
      }
    },

    // ==================== UI RENDERING ====================
    renderConnectionUI() {
      const content = document.getElementById('typeform-content');
      if (!content) return;

      if (!this.connectionStatus) {
        // Not connected: Show connect button
        content.innerHTML = `
          <div style="text-align: center; padding: 2rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">📋</div>
            <h3>Typeform verbinden</h3>
            <p style="color: var(--gray-600); margin-bottom: 2rem;">
              Verbinde dein Typeform-Konto, um Leads automatisch zu erfassen.
            </p>
            <button class="btn btn-primary" onclick="window.TypeformAPI.initiateOAuth()">
              🔗 Mit Typeform verbinden
            </button>
          </div>
        `;
      } else {
        // Connected: Show forms and add button
        content.innerHTML = `
          <div class="typeform-connected">
            <div class="connection-status">
              <div>
                <strong>✓ Verbunden:</strong> ${this.connectionStatus.account_email || 'Typeform'}
              </div>
              <div>
                <button class="btn btn-secondary btn-sm" onclick="window.TypeformAPI.manualSync()" style="margin-right: 0.5rem;">
                  🔄 Responses synchronisieren
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window.TypeformAPI.manualSyncToTracking()" style="margin-right: 0.5rem;">
                  📊 Sync zu Tracking Sheets
                </button>
                <button class="btn btn-danger-outline btn-sm" onclick="window.TypeformAPI.disconnectTypeform()">
                  Trennen
                </button>
              </div>
            </div>
            
            <div style="margin: 2rem 0;">
              <button class="btn btn-primary" onclick="window.TypeformAPI.openFormSetupModal()">
                ➕ Formular hinzufügen
              </button>
            </div>

            <h4 style="margin-bottom: 1rem;">Verbundene Formulare (${this.availableForms.length})</h4>
            <div id="typeform-forms-list">
              ${this.renderFormsList()}
            </div>
          </div>
        `;
      }
    },

    renderFormsList() {
      if (this.availableForms.length === 0) {
        return '<p style="color: var(--gray-600);">Noch keine Formulare verbunden.</p>';
      }

      return this.availableForms.map(form => `
        <div class="typeform-form-item">
          <div>
            <strong>${form.form_title}</strong><br>
            <small style="color: var(--gray-600);">
              Funnel: ${form.funnel_id || 'Nicht zugewiesen'} | 
              Qualification: ${form.qualification_field_id ? 'Aktiviert' : 'Keine'}
            </small>
          </div>
          <button 
            class="btn btn-danger-outline btn-sm"
            onclick="window.TypeformAPI.deleteFormMapping('${form.form_id}')"
          >
            Löschen
          </button>
        </div>
      `).join('');
    },

    renderFormSetupModal(forms) {
      // Create modal dynamically
      const existingModal = document.getElementById('typeform-setup-modal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'typeform-setup-modal';
      modal.className = 'modal';
      modal.style.display = 'flex';
      
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h2>Typeform-Formular verbinden</h2>
            <button class="modal-close" onclick="window.TypeformAPI.closeFormSetupModal()">&times;</button>
          </div>
          <div class="modal-body">
            <form id="typeform-setup-form" onsubmit="event.preventDefault(); window.TypeformAPI.submitFormSetup();">
              
              <!-- Form Selection -->
              <div class="form-group">
                <label>Formular auswählen *</label>
                <select id="form-select" required onchange="window.TypeformAPI.onFormSelected()">
                  <option value="">-- Formular wählen --</option>
                  ${forms.map(f => `<option value="${f.id}">${f.title}</option>`).join('')}
                </select>
              </div>

              <!-- Funnel Selection -->
              <div class="form-group">
                <label>Ziel-Funnel *</label>
                <select id="funnel-select" required>
                  <option value="">-- Funnel wählen --</option>
                </select>
                <small style="color: var(--gray-600);">
                  Leads aus diesem Formular werden diesem Funnel zugeordnet.
                </small>
              </div>

              <!-- Qualification Field (Optional) -->
              <div class="form-group">
                <label>Qualifikations-Frage (optional)</label>
                <select id="qualification-field-select">
                  <option value="">-- Keine Qualifikation --</option>
                </select>
                <small style="color: var(--gray-600);">
                  Welche Frage entscheidet über qualifiziert/nicht qualifiziert?
                </small>
              </div>

              <!-- Qualifying Answers (conditional) -->
              <div class="form-group" id="qualifying-answers-group" style="display: none;">
                <label>Qualifizierende Antworten</label>
                <input type="text" id="qualifying-answers" placeholder="z.B. Ja, Sehr interessiert">
                <small style="color: var(--gray-600);">
                  Kommagetrennt. Leads mit diesen Antworten = qualifiziert.
                </small>
              </div>

              <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                <button type="submit" class="btn btn-primary" style="flex: 1;">
                  ✓ Formular verbinden
                </button>
                <button type="button" class="btn btn-secondary" onclick="window.TypeformAPI.closeFormSetupModal()">
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Store forms data for later use
      this.tempFormsData = forms;

      // Load funnel options
      this.loadFunnelOptionsForSetup();
    },

    closeFormSetupModal() {
      const modal = document.getElementById('typeform-setup-modal');
      if (modal) modal.remove();
    },

    async loadFunnelOptionsForSetup() {
      try {
        const funnels = window.FunnelAPI.loadFunnels();
        const select = document.getElementById('funnel-select');
        
        if (!select) return;

        select.innerHTML = '<option value="">-- Funnel wählen --</option>';
        
        funnels.forEach(funnel => {
          const option = document.createElement('option');
          option.value = funnel.id;
          option.textContent = funnel.name;
          select.appendChild(option);
        });
      } catch (error) {
        console.error('Error loading funnels:', error);
      }
    },

    onFormSelected() {
      const formSelect = document.getElementById('form-select');
      const qualFieldSelect = document.getElementById('qualification-field-select');
      
      if (!formSelect || !qualFieldSelect) return;

      const selectedFormId = formSelect.value;
      
      if (!selectedFormId) {
        qualFieldSelect.innerHTML = '<option value="">-- Keine Qualifikation --</option>';
        return;
      }

      // Find selected form
      const form = this.tempFormsData.find(f => f.id === selectedFormId);
      
      if (!form || !form.fields) {
        qualFieldSelect.innerHTML = '<option value="">-- Keine Fragen gefunden --</option>';
        return;
      }

      // Populate qualification field dropdown
      qualFieldSelect.innerHTML = '<option value="">-- Keine Qualifikation --</option>';
      
      form.fields.forEach(field => {
        const option = document.createElement('option');
        option.value = field.id;
        option.textContent = `${field.title} (${field.type})`;
        qualFieldSelect.appendChild(option);
      });

      // Show/hide qualifying answers based on selection
      qualFieldSelect.addEventListener('change', () => {
        const answersGroup = document.getElementById('qualifying-answers-group');
        if (answersGroup) {
          answersGroup.style.display = qualFieldSelect.value ? 'block' : 'none';
        }
      });
    },

    async submitFormSetup() {
      const formId = document.getElementById('form-select').value;
      const funnelId = document.getElementById('funnel-select').value;
      const qualFieldId = document.getElementById('qualification-field-select').value;
      const qualAnswersInput = document.getElementById('qualifying-answers').value;

      if (!formId || !funnelId) {
        window.Toast.error('Bitte Formular und Funnel auswählen');
        return;
      }

      // Parse qualifying answers (comma-separated)
      const qualAnswers = qualAnswersInput 
        ? qualAnswersInput.split(',').map(a => a.trim()).filter(a => a)
        : null;

      // Get form title
      const form = this.tempFormsData.find(f => f.id === formId);
      const formTitle = form ? form.title : formId;

      // Setup webhook
      await this.setupWebhook(
        formId,
        formTitle,
        funnelId,
        qualFieldId || null,
        qualAnswers
      );
    },

    // ==================== IMPORT MODAL ====================
    async fetchFormFields(formId) {
      const session = await window.SupabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(
        `${window.SupabaseClient.supabaseUrl}/functions/v1/typeform-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'get_form_fields',
            form_id: formId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Laden der Formular-Felder');
      }

      return await response.json();
    },

    showImportModal(formId, formTitle) {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'typeform-import-modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h2>📥 Lead-Daten importieren</h2>
            <button class="modal-close" onclick="document.getElementById('typeform-import-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 1rem;">Möchtest du vorhandene Antworten aus "<strong>${formTitle}</strong>" importieren?</p>
            
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Zeitraum</label>
            <select id="import-days-back" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 1rem;">
              <option value="7">Letzte 7 Tage</option>
              <option value="30" selected>Letzte 30 Tage</option>
              <option value="90">Letzte 90 Tage</option>
              <option value="180">Letzte 180 Tage</option>
              <option value="365">Letzte 365 Tage</option>
            </select>

            <div id="import-progress" style="display: none; margin-top: 1rem; padding: 1rem; background: #f0f9ff; border-radius: 4px;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <div class="spinner" style="width: 20px; height: 20px; border: 2px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <span id="import-status">Importiere Lead-Daten...</span>
              </div>
              <div id="import-result" style="font-size: 0.9rem; color: #666;"></div>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="btn btn-secondary" onclick="document.getElementById('typeform-import-modal').remove()">
              Überspringen
            </button>
            <button class="btn btn-primary" onclick="window.TypeformAPI.startImport('${formId}', '${formTitle}')">
              📥 Jetzt importieren
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.style.display = 'flex';
    },

    async startImport(formId, formTitle) {
      try {
        const daysBack = parseInt(document.getElementById('import-days-back').value);
        const progressDiv = document.getElementById('import-progress');
        const statusSpan = document.getElementById('import-status');
        const resultDiv = document.getElementById('import-result');
        const importButton = event.target;

        // Show progress
        progressDiv.style.display = 'block';
        importButton.disabled = true;
        statusSpan.textContent = 'Lade Formular-Felder...';
        resultDiv.textContent = '';

        // Step 1: Fetch form fields
        const fieldsData = await this.fetchFormFields(formId);
        console.log('Form fields:', fieldsData);

        // Step 2: Show survey question selection UI
        this.showSurveySelection(formId, formTitle, daysBack, fieldsData.fields);

      } catch (error) {
        console.error('Import error:', error);
        document.getElementById('import-status').textContent = '✗ Fehler beim Laden';
        document.getElementById('import-result').textContent = error.message;
        window.Toast.error(error.message);
      }
    },

    showSurveySelection(formId, formTitle, daysBack, fields) {
      const modal = document.getElementById('typeform-import-modal');
      if (!modal) return;

      // Replace modal content with survey selection
      const modalContent = modal.querySelector('.modal-content');
      modalContent.innerHTML = `
        <div class="modal-header">
          <h2>📋 Survey-Fragen auswählen</h2>
          <button class="modal-close" onclick="document.getElementById('typeform-import-modal').remove()">×</button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          <p style="margin-bottom: 1rem; color: #666;">Wähle Fragen aus "<strong>${formTitle}</strong>", die als Survey-Antworten gespeichert werden sollen:</p>
          <div id="typeform-survey-questions" class="survey-question-list"></div>
        </div>
        <div class="modal-footer" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="document.getElementById('typeform-import-modal').remove()">
            Abbrechen
          </button>
          <button class="btn btn-primary" id="confirm-import-btn">
            📥 Import starten
          </button>
        </div>
      `;

      // Render survey questions (similar to CSV import)
      this.renderTypeformSurveyQuestions(fields);

      // Add event listener to confirm button
      const confirmBtn = document.getElementById('confirm-import-btn');
      confirmBtn.addEventListener('click', () => {
        this.executeImport(formId, formTitle, daysBack);
      });
    },

    renderTypeformSurveyQuestions(fields) {
      const container = document.getElementById('typeform-survey-questions');
      if (!container || !fields || fields.length === 0) {
        container.innerHTML = '<p style="color: #999; font-style: italic;">Keine Fragen im Formular gefunden.</p>';
        return;
      }

      let html = '';
      fields.forEach((field, index) => {
        html += `
          <div class="survey-question-item" style="margin-bottom: 1rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 4px;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input 
                type="checkbox" 
                class="typeform-survey-checkbox" 
                data-field-id="${field.id}"
                data-field-title="${field.title}"
                checked
                style="margin-top: 0;"
              />
              <span style="font-weight: 500;">${field.title}</span>
            </label>
          </div>
        `;
      });

      container.innerHTML = html;
    },

    async executeImport(formId, formTitle, daysBack) {
      try {
        const container = document.getElementById('typeform-survey-questions');
        const checkboxes = container.querySelectorAll('.typeform-survey-checkbox:checked');
        
        // Build selected_questions object: { field_id: field_title }
        const selectedQuestions = {};
        checkboxes.forEach(cb => {
          const fieldId = cb.dataset.fieldId;
          const fieldTitle = cb.dataset.fieldTitle;
          selectedQuestions[fieldId] = fieldTitle; // Use original title
        });

        console.log('Selected questions:', selectedQuestions);

        // Update UI to show import progress
        const modal = document.getElementById('typeform-import-modal');
        const modalContent = modal.querySelector('.modal-content');
        modalContent.innerHTML = `
          <div class="modal-header">
            <h2>📥 Import läuft...</h2>
          </div>
          <div class="modal-body">
            <div style="padding: 2rem; text-align: center;">
              <div class="spinner" style="width: 40px; height: 40px; border: 4px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem;"></div>
              <div id="import-status">Importiere Lead-Daten...</div>
              <div id="import-result" style="margin-top: 0.5rem; color: #666;"></div>
            </div>
          </div>
        `;

        const session = await window.SupabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        // Call import API with selected questions
        const response = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/typeform-sync`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'import_responses',
              form_id: formId,
              days_back: daysBack,
              selected_questions: selectedQuestions,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Import fehlgeschlagen');
        }

        const data = await response.json();

        // Show result
        document.getElementById('import-status').textContent = '✓ Import abgeschlossen!';
        document.getElementById('import-result').innerHTML = `
          <strong>${data.imported}</strong> Leads importiert<br>
          ${data.skipped > 0 ? `${data.skipped} bereits vorhanden` : ''}
        `;

        window.Toast.success(`${data.imported} Leads erfolgreich importiert!`);

        // Refresh DataPool if we're on that view
        if (window.DataPool && typeof window.DataPool.loadTabData === 'function') {
          console.log('🔄 Refreshing DataPool after import...');
          await window.DataPool.loadTabData();
        }

        // Close modal after 2 seconds
        setTimeout(() => {
          document.getElementById('typeform-import-modal')?.remove();
        }, 2000);

      } catch (error) {
        console.error('Import error:', error);
        document.getElementById('import-status').textContent = '✗ Fehler beim Import';
        document.getElementById('import-result').textContent = error.message;
        window.Toast.error(error.message);
      }
    },

    // ==================== TRACKING SHEET SYNC ====================

    // Called on app load - imports fresh data if needed, then writes to tracking sheets
    startTypeformSync() {
      const lastImport = localStorage.getItem('typeform_last_import');
      const hoursSince = lastImport ? (Date.now() - parseInt(lastImport)) / 3600000 : 999;

      if (hoursSince > 1) {
        // Import new responses from Typeform API, then aggregate
        this._importAndSync(60);
      } else {
        // Just aggregate from existing events in DB
        this._syncFromDB(60);
      }
    },

    async _importAndSync(daysBack) {
      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session?.data?.session?.user?.id;
        if (!userId) return;

        const { data: forms } = await window.SupabaseClient
          .from('typeform_forms')
          .select('form_id, funnel_id')
          .eq('user_id', userId)
          .eq('is_active', true);

        if (!forms || forms.length === 0) return;

        for (const form of forms) {
          if (!form.funnel_id) continue;
          await window.SupabaseClient.functions.invoke('typeform-sync', {
            body: { action: 'import_responses', form_id: form.form_id, days_back: daysBack }
          });
        }

        localStorage.setItem('typeform_last_import', Date.now().toString());
        await this._syncFromDB(daysBack);
      } catch (err) {
        // Silent - background sync
      }
    },

    async _syncFromDB(daysBack) {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const { data: events, error } = await window.SupabaseClient
          .from('events')
          .select('funnel_id, event_date, event_type, lead_id')
          .in('event_type', ['survey', 'surveyQuali'])
          .not('funnel_id', 'is', null)
          .or('is_spam.is.null,is_spam.eq.false')
          .gte('event_date', startDate.toISOString().split('T')[0]);

        if (error || !events || events.length === 0) return;

        // Aggregate by funnel_id + date, deduplicate by lead_id per day
        // Same person submitting twice on the same day = 1 survey
        // Same person on different days = counted separately per day
        const agg = {};
        events.forEach(ev => {
          const dateKey = String(ev.event_date).substring(0, 10);
          const key = `${ev.funnel_id}__${dateKey}`;
          if (!agg[key]) agg[key] = { funnelId: ev.funnel_id, date: dateKey, surveyLeads: new Set(), surveyQualiLeads: new Set() };
          if (ev.lead_id) agg[key].surveyLeads.add(ev.lead_id);
          if (ev.event_type === 'surveyQuali' && ev.lead_id) agg[key].surveyQualiLeads.add(ev.lead_id);
        });

        // Write to tracking sheets
        const batchRecords = [];
        Object.values(agg).forEach(({ funnelId, date, surveyLeads, surveyQualiLeads }) => {
          const survey = surveyLeads.size;
          const surveyQuali = surveyQualiLeads.size;
          // Parse date safely - event_date can be 'YYYY-MM-DD' or 'YYYY-MM-DDT...' timestamp
          const dateStr = String(date).substring(0, 10);
          const [year, monthStr, dayStr] = dateStr.split('-');
          const yearNum = parseInt(year);
          const monthNum = parseInt(monthStr) - 1; // 0-based
          const dayNum = parseInt(dayStr);
          if (!yearNum || isNaN(monthNum) || isNaN(dayNum)) return;
          batchRecords.push(
            { funnelId, year: yearNum, month: monthNum, day: dayNum, fieldName: 'Survey', value: survey },
            { funnelId, year: yearNum, month: monthNum, day: dayNum, fieldName: 'SurveyQuali', value: surveyQuali }
          );
        });

        if (batchRecords.length > 0) {
          await window.StorageAPI.batchSaveFieldsToSupabase(batchRecords);
        }
      } catch (err) {
        // Silent - background sync
      }
    },

    // Public: full sync with UI feedback (for manual trigger button)
    async syncTypeformToTrackingSheets(daysBack = 30) {
      await this._importAndSync(daysBack);
      const count = daysBack;
      return { synced: count, message: `Survey-Daten der letzten ${daysBack} Tage synchronisiert` };
    },



    // Manual sync button (for UI)
    async manualSync() {
      try {
        if (window.Loading) {
          window.Loading.show('Synchronisiere Typeform-Daten...');
        }

        const session = await window.SupabaseClient.auth.getSession();
        const userId = session?.data?.session?.user?.id;

        if (!userId) {
          window.Toast.error('Bitte zuerst anmelden');
          return;
        }

        const { data: connection } = await window.SupabaseClient
          .from('typeform_connections')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();

        if (!connection) {
          window.Toast.error('Keine Typeform-Verbindung aktiv');
          return;
        }

        // Get all active forms
        const { data: forms } = await window.SupabaseClient
          .from('typeform_forms')
          .select('form_id, form_title')
          .eq('user_id', userId)
          .eq('is_active', true);

        if (!forms || forms.length === 0) {
          window.Toast.error('Keine Formulare konfiguriert');
          return;
        }

        // Get last sync time
        const { data: prefs } = await window.SupabaseClient
          .from('user_preferences')
          .select('typeform_last_sync')
          .eq('user_id', userId)
          .maybeSingle();

        const since = prefs?.typeform_last_sync ? new Date(prefs.typeform_last_sync) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const daysToSync = Math.ceil((new Date() - since) / (24 * 60 * 60 * 1000));

        let totalImported = 0;

        // Sync each form
        for (const form of forms) {
          const { data, error } = await window.SupabaseClient.functions.invoke('typeform-sync', {
            body: {
              action: 'import_responses',
              form_id: form.form_id,
              days_back: daysToSync
            }
          });

          if (error) {
            console.error(`Error syncing form ${form.form_title}:`, error);
            continue;
          }

          totalImported += data.imported_count || 0;
        }

        // Update last sync timestamp
        await window.SupabaseClient
          .from('user_preferences')
          .update({ typeform_last_sync: new Date().toISOString() })
          .eq('user_id', userId);

        window.Toast.success(`${totalImported} neue Antworten synchronisiert`);

        // Reload DataPool if currently viewing
        if (window.DataPool && window.DataPool.currentTab) {
          await window.DataPool.loadTabData();
        }

      } catch (error) {
        console.error('Manual sync error:', error);
        window.Toast.error('Fehler beim Synchronisieren: ' + error.message);
      } finally {
        if (window.Loading) {
          window.Loading.hide();
        }
      }
    },

    // Manual sync to tracking sheets
    async manualSyncToTracking() {
      try {
        if (window.Loading) {
          window.Loading.show('Synchronisiere Surveys zu Tracking Sheets...');
        }

        const result = await this.syncTypeformToTrackingSheets(30);
        
        window.Toast.success(result.message);

        // Reload current month view if viewing tracking sheets
        if (window.activeMonth !== undefined && window.activeYear !== undefined) {
          await window.switchToMonth(window.activeYear, window.activeMonth);
        }

      } catch (error) {
        console.error('Manual tracking sync error:', error);
        window.Toast.error('Fehler beim Synchronisieren: ' + error.message);
      } finally {
        if (window.Loading) {
          window.Loading.hide();
        }
      }
    },

  };

  // Expose API
  window.TypeformAPI = TypeformAPI;

})(window);
