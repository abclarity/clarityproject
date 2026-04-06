// Calendly Integration API
// OAuth-Flow, Event-Type-Mapping, UTM-Mapping, Disconnect

(function(window) {
  'use strict';

  const CALENDLY_AUTH_URL = 'https://auth.calendly.com/oauth/authorize';
  // TODO: Calendly OAuth App erstellen unter https://developer.calendly.com/
  // und Client-ID hier eintragen (wie Typeform Client-ID in typeform-api.js)
  const CALENDLY_CLIENT_ID = '5QagJc8V4Muaxujy6asvovHn7gH2YAtDCkBbmdTIJGg';

  const CalendlyAPI = {
    connectionStatus: null,
    eventTypeMappings: [],
    utmMappings: [],

    // ==================== MAIN MODAL ====================
    async openConnectionModal() {
      const modal = document.getElementById('calendly-modal');
      if (!modal) { console.error('Calendly modal not found'); return; }

      await this.checkConnectionStatus();
      this.renderConnectionUI();
      modal.style.display = 'flex';
    },

    closeConnectionModal() {
      const modal = document.getElementById('calendly-modal');
      if (modal) modal.style.display = 'none';
    },

    // ==================== CONNECTION STATUS ====================
    async checkConnectionStatus() {
      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;
        if (!userId) { this.connectionStatus = null; return; }

        const { data, error } = await window.SupabaseClient
          .from('calendly_connections')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking Calendly connection:', error);
          this.connectionStatus = null;
          return;
        }

        this.connectionStatus = data || null;

        if (this.connectionStatus) {
          await Promise.all([
            this.loadEventTypeMappings(userId),
            this.loadUtmMappings(userId),
          ]);
        }
      } catch (error) {
        console.error('Error checking Calendly connection status:', error);
        this.connectionStatus = null;
      }
    },

    // ==================== OAUTH FLOW ====================
    async initiateOAuth() {
      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;
        if (!userId) { window.Toast.error('Bitte zuerst anmelden'); return; }

        if (!CALENDLY_CLIENT_ID || CALENDLY_CLIENT_ID === 'DEINE_CALENDLY_CLIENT_ID_HIER') {
          window.Toast.error('Calendly Client-ID nicht konfiguriert – bitte in calendly-api.js eintragen');
          return;
        }

        const redirectUri = `${window.SupabaseClient.supabaseUrl}/functions/v1/calendly-oauth`;
        const authUrl = new URL(CALENDLY_AUTH_URL);
        authUrl.searchParams.set('client_id', CALENDLY_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', userId);

        const popup = window.open(
          authUrl.toString(),
          'Calendly OAuth',
          'width=600,height=700,left=100,top=100'
        );

        if (!popup) {
          window.Toast.error('Popup wurde blockiert. Bitte Popup-Blocker deaktivieren.');
          return;
        }

        const handler = async (event) => {
          if (event.data?.type === 'CALENDLY_OAUTH_SUCCESS') {
            window.removeEventListener('message', handler);
            popup.close();
            window.Toast.success(`Calendly verbunden: ${event.data.email}`);
            await this.checkConnectionStatus();
            this.renderConnectionUI();
          } else if (event.data?.type === 'CALENDLY_OAUTH_ERROR') {
            window.removeEventListener('message', handler);
            popup.close();
            window.Toast.error(`Verbindung fehlgeschlagen: ${event.data.error}`);
          }
        };

        window.addEventListener('message', handler);
      } catch (error) {
        console.error('OAuth error:', error);
        window.Toast.error('Fehler beim OAuth-Flow');
      }
    },

    async disconnectCalendly() {
      if (!confirm('Calendly-Verbindung wirklich trennen?\n\nAlle Mappings und zukünftige Webhook-Verarbeitung werden gestoppt.')) return;

      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        await window.SupabaseClient
          .from('calendly_connections')
          .update({ is_active: false })
          .eq('user_id', userId);

        window.Toast.success('Calendly-Verbindung getrennt');
        this.connectionStatus = null;
        this.eventTypeMappings = [];
        this.utmMappings = [];
        this.renderConnectionUI();
      } catch (error) {
        console.error('Error disconnecting Calendly:', error);
        window.Toast.error('Fehler beim Trennen der Verbindung');
      }
    },

    // ==================== EVENT TYPE MAPPINGS ====================
    async loadEventTypeMappings(userId) {
      const { data } = await window.SupabaseClient
        .from('calendly_event_type_mappings')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at');
      this.eventTypeMappings = data || [];
    },

    async openEventTypeMappingModal() {
      if (window.Loading) window.Loading.show('Calendly Event-Typen werden geladen...');

      try {
        const session = await window.SupabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        const res = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/calendly-sync`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'fetch_event_types' }),
          }
        );

        if (!res.ok) throw new Error((await res.json()).error || 'Fehler beim Laden');
        const data = await res.json();

        if (window.Loading) window.Loading.hide();
        this.renderEventTypeMappingModal(data.event_types || []);
      } catch (error) {
        if (window.Loading) window.Loading.hide();
        window.Toast.error(error.message);
      }
    },

    renderEventTypeMappingModal(eventTypes) {
      const existing = document.getElementById('calendly-event-type-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'calendly-event-type-modal';
      modal.className = 'modal';
      modal.style.display = 'flex';

      const rows = eventTypes.map(et => {
        const currentMapping = this.eventTypeMappings.find(m => m.calendly_event_type_uri === et.uri);
        const selected = currentMapping?.clarity_event_type || '';
        const isReschedule = currentMapping?.is_reschedule_calendar || false;
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:0.5rem;gap:12px;">
            <div style="flex:1;min-width:0;">
              <strong>${et.name}</strong>
              <div style="font-size:0.8rem;color:var(--gray-600);">${et.duration} Min · ${et.kind}</div>
            </div>
            <select data-uri="${et.uri}" data-name="${et.name.replace(/"/g, '&quot;')}" style="padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:4px;">
              <option value="">– Nicht mappen –</option>
              <option value="settingBooking" ${selected === 'settingBooking' ? 'selected' : ''}>Setting Booking</option>
              <option value="closingBooking" ${selected === 'closingBooking' ? 'selected' : ''}>Closing Booking</option>
            </select>
            <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#666;white-space:nowrap;cursor:pointer;">
              <input type="checkbox" data-reschedule-uri="${et.uri}" ${isReschedule ? 'checked' : ''} style="cursor:pointer;">
              Reschedule-Kalender
            </label>
          </div>
        `;
      }).join('');

      modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h2>📅 Event-Typen zuordnen</h2>
            <button class="modal-close" onclick="document.getElementById('calendly-event-type-modal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <p style="color: var(--gray-600); margin-bottom: 1.5rem;">
              Ordne jeden Calendly Event-Typ einem Clarity-Event-Typ zu.
            </p>
            <div id="event-type-rows">${rows || '<p style="color:#999;">Keine aktiven Event-Typen gefunden.</p>'}</div>
          </div>
          <div class="modal-footer" style="display:flex; gap:0.5rem; justify-content:flex-end;">
            <button class="btn btn-secondary" onclick="document.getElementById('calendly-event-type-modal').remove()">Abbrechen</button>
            <button class="btn btn-primary" onclick="window.CalendlyAPI.saveEventTypeMappings()">✓ Speichern</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    },

    async saveEventTypeMappings() {
      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        const selects = document.querySelectorAll('#event-type-rows select');
        const upserts = [];
        const toDelete = [];

        selects.forEach(sel => {
          const uri = sel.dataset.uri;
          const name = sel.dataset.name;
          const clarityType = sel.value;
          const rescheduleCheckbox = document.querySelector(`[data-reschedule-uri="${uri}"]`);
          const isReschedule = rescheduleCheckbox?.checked || false;

          if (clarityType) {
            upserts.push({
              user_id: userId,
              calendly_event_type_uri: uri,
              calendly_event_type_name: name,
              clarity_event_type: clarityType,
              is_active: true,
              is_reschedule_calendar: isReschedule,
            });
          } else {
            toDelete.push(uri);
          }
        });

        if (upserts.length > 0) {
          const { error } = await window.SupabaseClient
            .from('calendly_event_type_mappings')
            .upsert(upserts, { onConflict: 'user_id,calendly_event_type_uri' });
          if (error) throw error;
        }

        if (toDelete.length > 0) {
          await window.SupabaseClient
            .from('calendly_event_type_mappings')
            .update({ is_active: false })
            .eq('user_id', userId)
            .in('calendly_event_type_uri', toDelete);
        }

        window.Toast.success('Event-Typ-Mappings gespeichert');
        await this.loadEventTypeMappings(userId);
        this.renderConnectionUI();
        document.getElementById('calendly-event-type-modal')?.remove();
      } catch (error) {
        console.error('Error saving event type mappings:', error);
        window.Toast.error('Fehler beim Speichern: ' + error.message);
      }
    },

    // ==================== UTM MAPPINGS ====================
    async loadUtmMappings(userId) {
      const { data } = await window.SupabaseClient
        .from('calendly_utm_mappings')
        .select('*')
        .eq('user_id', userId)
        .order('utm_campaign');
      this.utmMappings = data || [];
    },

    async openUtmMappingModal() {
      if (window.Loading) window.Loading.show('Letzte Buchungs-UTMs werden geladen...');

      try {
        const session = await window.SupabaseClient.auth.getSession();
        const token = session.data.session?.access_token;
        const userId = session.data.session?.user?.id;

        const res = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/calendly-sync`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'fetch_recent_utms' }),
          }
        );

        if (!res.ok) throw new Error((await res.json()).error || 'Fehler beim Laden');
        const data = await res.json();

        if (window.Loading) window.Loading.hide();

        const funnels = window.FunnelAPI.loadFunnels();
        this.renderUtmMappingModal(data.utms || [], funnels);
      } catch (error) {
        if (window.Loading) window.Loading.hide();
        window.Toast.error(error.message);
      }
    },

    renderUtmMappingModal(recentUtms, funnels) {
      const existing = document.getElementById('calendly-utm-modal');
      if (existing) existing.remove();

      const funnelOptions = funnels.map(f =>
        `<option value="${f.id}">${f.name}</option>`
      ).join('');

      // Merge recent UTMs with existing mappings (show all, pre-select existing)
      const allUtms = [...recentUtms];
      this.utmMappings.forEach(m => {
        if (!allUtms.find(u => u.utm_campaign === m.utm_campaign)) {
          allUtms.push({ utm_campaign: m.utm_campaign, utm_source: m.utm_source || null, count: 0 });
        }
      });

      const rows = allUtms.map(utm => {
        const existing = this.utmMappings.find(m => m.utm_campaign === utm.utm_campaign);
        const selectedFunnel = existing?.funnel_id || '';
        return `
          <div style="display:flex; align-items:center; gap:1rem; padding:0.75rem; border:1px solid #e5e7eb; border-radius:6px; margin-bottom:0.5rem;">
            <div style="flex:1; min-width:0;">
              <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${utm.utm_source || utm.utm_campaign}
              </strong>
              <small style="color:var(--gray-500); font-family:monospace;">${utm.utm_campaign}</small>
              ${utm.count ? `<small style="color:var(--gray-500);"> · ${utm.count}× gebucht</small>` : ''}
            </div>
            <select data-campaign="${utm.utm_campaign.replace(/"/g, '&quot;')}" data-source="${(utm.utm_source || '').replace(/"/g, '&quot;')}" style="width:200px; padding:0.4rem 0.6rem; border:1px solid #d1d5db; border-radius:4px;">
              <option value="">– Kein Funnel –</option>
              ${funnels.map(f => `<option value="${f.id}" ${selectedFunnel === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
            </select>
          </div>
        `;
      }).join('');

      const modal = document.createElement('div');
      modal.id = 'calendly-utm-modal';
      modal.className = 'modal';
      modal.style.display = 'flex';

      modal.innerHTML = `
        <div class="modal-content" style="max-width: 640px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
          <div class="modal-header" style="flex-shrink: 0; padding: 20px 28px 16px;">
            <h2>🔗 UTM → Funnel Zuordnung</h2>
            <button class="modal-close" onclick="document.getElementById('calendly-utm-modal').remove()">&times;</button>
          </div>
          <div class="modal-body" style="overflow-y: auto; flex: 1; min-height: 0; padding: 0 28px 16px;">
            <p style="color:var(--gray-600); margin-bottom:1.5rem;">
              Ordne jeden <code>utm_campaign</code>-Wert dem passenden Clarity-Funnel zu.
            </p>
            <div id="utm-rows">
              ${allUtms.length > 0 ? rows : `
                <div style="text-align:center; padding:2rem; color:var(--gray-500);">
                  <p>Noch keine Buchungs-UTMs gefunden.</p>
                  <p style="font-size:0.85rem; margin-top:0.5rem;">UTMs erscheinen hier sobald Leads über einen Calendly-Link mit UTM-Parametern buchen.</p>
                </div>
              `}
            </div>
          </div>
          <div class="modal-footer" style="display:flex; gap:0.5rem; justify-content:flex-end; flex-shrink: 0; padding: 12px 28px 20px; border-top: 1px solid #e5e7eb;">
            <button class="btn btn-secondary" onclick="document.getElementById('calendly-utm-modal').remove()">Abbrechen</button>
            <button class="btn btn-primary" onclick="window.CalendlyAPI.saveUtmMappings()">✓ Speichern</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    },

    async saveUtmMappings() {
      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        const selects = document.querySelectorAll('#utm-rows select');
        const upserts = [];
        const toDelete = [];

        selects.forEach(sel => {
          const campaign = sel.dataset.campaign;
          const source = sel.dataset.source || null;
          const funnelId = sel.value;

          if (funnelId) {
            upserts.push({
              user_id: userId,
              utm_campaign: campaign,
              utm_source: source || null,
              funnel_id: funnelId,
            });
          } else {
            toDelete.push(campaign);
          }
        });

        if (upserts.length > 0) {
          const { error } = await window.SupabaseClient
            .from('calendly_utm_mappings')
            .upsert(upserts, { onConflict: 'user_id,utm_campaign' });
          if (error) throw error;
        }

        if (toDelete.length > 0) {
          await window.SupabaseClient
            .from('calendly_utm_mappings')
            .delete()
            .eq('user_id', userId)
            .in('utm_campaign', toDelete);
        }

        window.Toast.success('UTM-Mappings gespeichert');
        await this.loadUtmMappings(userId);
        this.renderConnectionUI();
        document.getElementById('calendly-utm-modal')?.remove();
      } catch (error) {
        console.error('Error saving UTM mappings:', error);
        window.Toast.error('Fehler beim Speichern: ' + error.message);
      }
    },

    // ==================== UI RENDERING ====================
    renderConnectionUI() {
      const content = document.getElementById('calendly-content');
      if (!content) return;

      if (!this.connectionStatus) {
        content.innerHTML = `
          <div style="text-align: center; padding: 2rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">📅</div>
            <h3>Calendly verbinden</h3>
            <p style="color: var(--gray-600); margin-bottom: 2rem;">
              Verbinde dein Calendly-Konto, um Bookings automatisch als Setting- oder Closing-Termine zu tracken.
            </p>
            <button class="btn btn-primary" onclick="window.CalendlyAPI.initiateOAuth()">
              🔗 Mit Calendly verbinden
            </button>
          </div>
        `;
        return;
      }

      const conn = this.connectionStatus;
      const etCount = this.eventTypeMappings.length;
      const utmCount = this.utmMappings.length;

      const etWarning = etCount === 0
        ? '<span style="color:#f59e0b;">⚠ Noch keine Event-Typen gemappt</span>'
        : `<span style="color:#10b981;">✓ ${etCount} Event-Typ${etCount !== 1 ? 'en' : ''} zugeordnet</span>`;

      const utmWarning = utmCount === 0
        ? '<span style="color:#f59e0b;">⚠ Noch keine UTM-Mappings</span>'
        : `<span style="color:#10b981;">✓ ${utmCount} UTM-Mapping${utmCount !== 1 ? 's' : ''}</span>`;

      const etList = this.eventTypeMappings.length > 0
        ? this.eventTypeMappings.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid #f3f4f6;">
              <span style="color:var(--gray-700);">${m.calendly_event_type_name}</span>
              <span class="badge" style="background:${m.clarity_event_type === 'settingBooking' ? '#dbeafe' : '#fce7f3'}; color:${m.clarity_event_type === 'settingBooking' ? '#1d4ed8' : '#be185d'}; padding:2px 8px; border-radius:4px; font-size:0.8rem;">
                ${m.clarity_event_type === 'settingBooking' ? 'Setting Booking' : 'Closing Booking'}
              </span>
            </div>
          `).join('')
        : '<p style="color:var(--gray-500); font-size:0.9rem;">Noch keine Zuordnungen.</p>';

      const utmList = this.utmMappings.length > 0
        ? this.utmMappings.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid #f3f4f6;">
              <code style="font-size:0.85rem; color:var(--gray-700);">${m.utm_campaign}</code>
              <span style="color:var(--gray-600); font-size:0.85rem;">→ Funnel ${m.funnel_id.substring(0, 8)}...</span>
            </div>
          `).join('')
        : '<p style="color:var(--gray-500); font-size:0.9rem;">Noch keine UTM-Mappings.</p>';

      content.innerHTML = `
        <div class="calendly-connected">
          <!-- Connection Header -->
          <div class="connection-status" style="display:flex; justify-content:space-between; align-items:center; padding:1rem; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; margin-bottom:1.5rem;">
            <div>
              <strong>✓ Verbunden:</strong> ${conn.account_email || conn.account_name || 'Calendly'}
              ${conn.account_name ? `<span style="color:var(--gray-600);"> · ${conn.account_name}</span>` : ''}
            </div>
            <button class="btn btn-danger-outline btn-sm" onclick="window.CalendlyAPI.disconnectCalendly()">
              Trennen
            </button>
          </div>

          <!-- Setup Status -->
          <div style="display:flex; gap:1rem; margin-bottom:1.5rem;">
            <div style="flex:1; padding:0.75rem 1rem; background:#f9fafb; border-radius:6px; border:1px solid #e5e7eb;">
              ${etWarning}
            </div>
            <div style="flex:1; padding:0.75rem 1rem; background:#f9fafb; border-radius:6px; border:1px solid #e5e7eb;">
              ${utmWarning}
            </div>
          </div>

          <!-- Configuration Buttons -->
          <div style="display:flex; gap:1rem; margin-bottom:2rem; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="window.CalendlyAPI.openEventTypeMappingModal()">
              ⚙️ Event-Typen zuordnen
            </button>
            <button class="btn btn-secondary" onclick="window.CalendlyAPI.openUtmMappingModal()">
              🔗 UTM → Funnel zuordnen
            </button>
            <button class="btn btn-secondary" onclick="window.CalendlyAPI.importPastBookings()">
              ⬇️ Vergangene Bookings importieren
            </button>
            <button class="btn btn-secondary" onclick="window.CalendlyAPI.manualSyncToTracking()">
              📊 Sync zu Tracking Sheets
            </button>
          </div>

          <!-- Event Type Mappings -->
          <div style="margin-bottom:1.5rem;">
            <h4 style="margin-bottom:0.75rem;">Event-Typ Zuordnungen</h4>
            ${etList}
          </div>

          <!-- UTM Mappings -->
          <div style="margin-bottom:1.5rem;">
            <h4 style="margin-bottom:0.75rem;">UTM-Mappings (utm_campaign → Funnel)</h4>
            ${utmList}
          </div>

          <!-- Webhook Status -->
          <div style="padding:1rem; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <h4 style="margin:0;">🔔 Live Webhook</h4>
              <button class="btn btn-secondary btn-sm" onclick="window.CalendlyAPI.loadWebhookStatus()">↻ Status prüfen</button>
            </div>
            <div id="webhookStatusArea" style="font-size:0.9rem; color:var(--gray-600);">Lädt...</div>
          </div>
        </div>
      `;

      // Load webhook status after rendering
      setTimeout(() => this.loadWebhookStatus(), 0);
    },

    // ==================== WEBHOOK MANAGEMENT ====================
    async loadWebhookStatus() {
      const area = document.getElementById('webhookStatusArea');
      if (!area) return;
      area.innerHTML = 'Prüfe Webhook-Status...';

      try {
        const session = await window.SupabaseClient.auth.getSession();
        const token = session?.data?.session?.access_token;
        const res = await fetch(`${window.SupabaseClient.supabaseUrl}/functions/v1/calendly-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'list_webhooks' }),
        });
        const data = await res.json();
        const webhooks = data.webhooks || [];
        // Match any webhook pointing to our calendly-webhook function
        const ours = webhooks.find(w =>
          (w.callback_url || w.url || '').includes('calendly-webhook')
        );
        const active = ours && ours.state === 'active' ? ours : null;
        const disabled = ours && ours.state !== 'active' ? ours : null;

        if (active) {
          const url = active.callback_url || active.url || '';
          area.innerHTML = `
            <div style="color:#16a34a; margin-bottom:0.5rem;">✓ Aktiv – neue Buchungen werden automatisch übertragen</div>
            <div style="font-size:0.8rem; color:var(--gray-500);">URL: ${url}</div>
            <button class="btn btn-danger-outline btn-sm" style="margin-top:0.5rem;" onclick="window.CalendlyAPI.deleteWebhook('${active.uri}')">Webhook entfernen</button>
          `;
        } else if (disabled) {
          area.innerHTML = `
            <div style="color:#d97706; margin-bottom:0.5rem;">⚠ Webhook deaktiviert – Calendly hat den Webhook nach Lieferungsfehlern pausiert</div>
            <div style="font-size:0.8rem; color:var(--gray-500); margin-bottom:0.75rem;">Zuletzt aktualisiert: ${new Date(disabled.updated_at).toLocaleDateString('de-DE')}</div>
            <button class="btn btn-primary btn-sm" onclick="window.CalendlyAPI.registerWebhook()">🔄 Webhook neu aktivieren</button>
          `;
        } else {
          area.innerHTML = `
            <div style="color:#dc2626; margin-bottom:0.75rem;">✗ Kein aktiver Webhook – neue Buchungen werden NICHT automatisch übertragen</div>
            <button class="btn btn-primary btn-sm" onclick="window.CalendlyAPI.registerWebhook()">🔔 Webhook jetzt registrieren</button>
          `;
        }
      } catch (err) {
        area.innerHTML = '<span style="color:#dc2626;">Fehler beim Laden des Webhook-Status</span>';
        console.error('❌ loadWebhookStatus:', err);
      }
    },

    async registerWebhook() {
      const area = document.getElementById('webhookStatusArea');
      if (area) area.innerHTML = 'Registriere Webhook...';

      try {
        const session = await window.SupabaseClient.auth.getSession();
        const token = session?.data?.session?.access_token;
        const res = await fetch(`${window.SupabaseClient.supabaseUrl}/functions/v1/calendly-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'register_webhook' }),
        });
        const data = await res.json();
        if (data.success) {
          window.Toast?.success(data.already_exists ? 'Webhook war bereits registriert' : 'Webhook erfolgreich registriert');
        } else {
          window.Toast?.error(`Fehler: ${data.error || 'Unbekannt'}`);
        }
        await this.loadWebhookStatus();
      } catch (err) {
        console.error('❌ registerWebhook:', err);
        window.Toast?.error('Fehler beim Registrieren des Webhooks');
        await this.loadWebhookStatus();
      }
    },

    async deleteWebhook(webhookUri) {
      if (!confirm('Webhook wirklich entfernen? Neue Buchungen werden dann nicht mehr automatisch übertragen.')) return;

      try {
        const session = await window.SupabaseClient.auth.getSession();
        const token = session?.data?.session?.access_token;
        await fetch(`${window.SupabaseClient.supabaseUrl}/functions/v1/calendly-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'delete_webhook', webhook_uri: webhookUri }),
        });
        window.Toast?.success('Webhook entfernt');
        await this.loadWebhookStatus();
      } catch (err) {
        console.error('❌ deleteWebhook:', err);
        window.Toast?.error('Fehler beim Entfernen des Webhooks');
      }
    },

    // ==================== IMPORT PAST BOOKINGS ====================
    async importPastBookings() {
      const existing = document.getElementById('calendly-import-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'calendly-import-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-container" style="max-width:420px;">
          <div class="modal-header">
            <h2>Bookings importieren</h2>
            <button class="modal-close" id="calendly-import-close" onclick="document.getElementById('calendly-import-modal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <div id="calendly-import-picker">
              <p style="color:var(--gray-600); margin-bottom:1.25rem; font-size:0.9rem;">
                Wähle den Zeitraum für den Import. Bereits importierte Bookings werden automatisch übersprungen.
              </p>
              <div style="display:flex; flex-direction:column; gap:0.75rem;">
                ${[
                  { days: 30,  label: 'Letzte 30 Tage' },
                  { days: 90,  label: 'Letzte 90 Tage' },
                  { days: 180, label: 'Letzte 6 Monate' },
                  { days: 365, label: 'Letztes Jahr' },
                  { days: 730, label: 'Letzte 2 Jahre (alles)' },
                ].map(opt => `
                  <button class="btn btn-secondary" style="text-align:left; justify-content:flex-start;"
                    onclick="window.CalendlyAPI._runImport(${opt.days})">
                    ${opt.label}
                  </button>
                `).join('')}
              </div>
            </div>

            <div id="calendly-import-progress" style="display:none;">
              <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem;">
                <div style="width:22px; height:22px; border:3px solid var(--primary-color,#6366f1); border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; flex-shrink:0;"></div>
                <span id="calendly-import-status" style="font-weight:500;">Bookings werden importiert...</span>
              </div>
              <p style="color:var(--gray-500); font-size:0.85rem; margin:0;">
                Das kann je nach Datenmenge 30–60 Sekunden dauern. Bitte warte kurz.
              </p>
            </div>

            <div id="calendly-import-result" style="display:none;">
              <div id="calendly-import-result-content"></div>
              <button class="btn btn-primary" style="margin-top:1.25rem; width:100%;"
                onclick="document.getElementById('calendly-import-modal').remove()">
                Schließen
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    async _runImport(daysBack) {
      // Switch modal to loading state
      const picker = document.getElementById('calendly-import-picker');
      const progress = document.getElementById('calendly-import-progress');
      const closeBtn = document.getElementById('calendly-import-close');
      if (picker) picker.style.display = 'none';
      if (progress) progress.style.display = 'block';
      if (closeBtn) closeBtn.style.display = 'none';

      const labels = { 30: '30 Tagen', 90: '90 Tagen', 180: '6 Monaten', 365: '1 Jahr', 730: '2 Jahren' };
      const statusEl = document.getElementById('calendly-import-status');
      if (statusEl) statusEl.textContent = `Bookings der letzten ${labels[daysBack] || daysBack + ' Tagen'} werden importiert...`;

      try {
        const session = await window.SupabaseClient.auth.getSession();
        const token = session?.data?.session?.access_token;
        if (!token) throw new Error('Nicht eingeloggt');

        let totalImported = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        let pageNum = 1;
        let nextPageUrl = null;
        let nextMappingIndex = 0;
        let done = false;

        while (!done) {
          if (statusEl) {
            const soFar = totalImported + totalSkipped;
            statusEl.textContent = pageNum === 1
              ? `Bookings der letzten ${labels[daysBack] || daysBack + ' Tagen'} werden importiert...`
              : `Seite ${pageNum} wird verarbeitet... (bisher ${soFar} Bookings verarbeitet)`;
          }

          const body = { action: 'import_past_bookings', days_back: daysBack };
          if (nextPageUrl) body.page_url = nextPageUrl;
          if (nextMappingIndex) body.mapping_index = nextMappingIndex;

          const res = await fetch(`${window.SupabaseClient.supabaseUrl}/functions/v1/calendly-sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          const rawText = await res.text();
          if (!rawText) throw new Error(`Leere Antwort vom Server (Status ${res.status})`);
          let data;
          try { data = JSON.parse(rawText); } catch { throw new Error(`Ungültige Antwort: ${rawText.slice(0, 200)}`); }
          if (!res.ok) throw new Error(data.error || 'Import fehlgeschlagen');

          if (data.debug) console.log(`📋 Calendly Import Debug (Seite ${pageNum}):\n` + data.debug.join('\n'));

          totalImported += data.imported || 0;
          totalSkipped += data.skipped || 0;
          totalErrors += data.errors || 0;
          done = data.done;
          nextPageUrl = data.next_page_url || null;
          nextMappingIndex = data.next_mapping_index || 0;
          pageNum++;

          // Safety: if not done but no next_page_url, something went wrong — stop
          if (!done && !nextPageUrl && !nextMappingIndex) {
            done = true;
            if (data.error) totalErrors++;
          }
        }

        // Show result in modal
        if (progress) progress.style.display = 'none';
        if (closeBtn) closeBtn.style.display = '';
        const resultEl = document.getElementById('calendly-import-result');
        const resultContent = document.getElementById('calendly-import-result-content');
        if (resultEl) resultEl.style.display = 'block';
        if (resultContent) resultContent.innerHTML = `
          <div style="padding:1rem; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
            <div style="font-weight:600; margin-bottom:0.5rem;">✅ Import abgeschlossen</div>
            <div style="font-size:0.9rem; color:var(--gray-700);">
              <div>📥 <strong>${totalImported}</strong> neue Bookings importiert</div>
              <div>⏭ <strong>${totalSkipped}</strong> bereits vorhanden (übersprungen)</div>
              ${totalErrors > 0 ? `<div style="color:#ef4444;">⚠️ <strong>${totalErrors}</strong> Fehler</div>` : ''}
            </div>
          </div>
          ${totalImported > 0 ? `
          <div style="margin-top:1rem; padding:0.75rem 1rem; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;">
            <div style="font-size:0.875rem; color:#1e40af; margin-bottom:0.5rem;">
              💡 UTM-Parameter wurden mitgeladen. Ordne sie jetzt den richtigen Funnels zu:
            </div>
            <button class="btn btn-secondary" style="width:100%;" id="calendly-post-import-utm-btn">
              UTM-Mappings konfigurieren →
            </button>
          </div>` : ''}
        `;

        // Wire up the post-import UTM button
        const utmBtn = document.getElementById('calendly-post-import-utm-btn');
        if (utmBtn) {
          utmBtn.addEventListener('click', () => {
            document.getElementById('calendly-import-modal')?.remove();
            this.openUtmMappingModal();
          });
        }

        await this.checkConnectionStatus();
        this.renderConnectionUI();
      } catch (err) {
        console.error('❌ Calendly import fehlgeschlagen:', err);
        if (progress) progress.style.display = 'none';
        if (closeBtn) closeBtn.style.display = '';
        const resultEl = document.getElementById('calendly-import-result');
        const resultContent = document.getElementById('calendly-import-result-content');
        if (resultEl) resultEl.style.display = 'block';
        if (resultContent) resultContent.innerHTML = `
          <div style="padding:1rem; background:#fef2f2; border:1px solid #fecaca; border-radius:8px;">
            <div style="font-weight:600; color:#ef4444; margin-bottom:0.25rem;">❌ Import fehlgeschlagen</div>
            <div style="font-size:0.85rem; color:var(--gray-600);">${err.message}</div>
          </div>
        `;
      }
    },

    // ==================== TRACKING SHEET SYNC ====================

    async manualSyncToTracking() {
      try {
        window.Loading.show('Synchronisiere Calendly-Buchungen zu Tracking Sheets...');
        await this.syncCalendlyToTrackingSheets(90);
        window.Loading.hide();
        window.Toast.success('Calendly-Buchungen erfolgreich zu Tracking Sheets synchronisiert!');
        if (window.MonthView?.render) window.MonthView.render();
      } catch (err) {
        window.Loading.hide();
        console.error('❌ Manual Calendly tracking sync error:', err);
        window.Toast.error('Sync zu Tracking Sheets fehlgeschlagen.');
      }
    },

    // Aggregates booking events into tracking sheets (all sources, not just calendly)
    async syncCalendlyToTrackingSheets(daysBack = 60) {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const { data: events, error } = await window.SupabaseClient
          .from('events')
          .select('funnel_id, event_date, event_type, lead_id')
          .in('event_type', ['settingBooking', 'settingTermin', 'settingCall', 'closingBooking', 'closingTermin', 'closingCall'])
          .not('funnel_id', 'is', null)
          .or('is_spam.is.null,is_spam.eq.false')
          .gte('event_date', startDate.toISOString().split('T')[0]);

        if (error || !events || events.length === 0) return;

        const toGermanDateKey = (dateStr) => {
          const d = new Date(dateStr);
          return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }); // "YYYY-MM-DD" in German local time
        };

        const agg = {};
        events.forEach(ev => {
          if (!ev.funnel_id) return;
          const dateKey = toGermanDateKey(ev.event_date);
          const key = `${ev.funnel_id}__${dateKey}__${ev.event_type}`;
          if (!agg[key]) agg[key] = { funnelId: ev.funnel_id, date: dateKey, eventType: ev.event_type, leads: new Set() };
          if (ev.lead_id) agg[key].leads.add(ev.lead_id);
        });

        // Map event types to tracking sheet field names
        const fieldNameMap = {
          settingBooking: 'SettingBooking',
          settingTermin: 'SettingTermin',
          settingCall: 'SettingCall',
          closingBooking: 'ClosingBooking',
          closingTermin: 'ClosingTermin',
          closingCall: 'ClosingCall',
        };

        const batchRecords = [];
        Object.values(agg).forEach(({ funnelId, date, eventType, leads }) => {
          const dateStr = String(date).substring(0, 10);
          const [year, monthStr, dayStr] = dateStr.split('-');
          const yearNum = parseInt(year);
          const monthNum = parseInt(monthStr) - 1;
          const dayNum = parseInt(dayStr);
          if (!yearNum || isNaN(monthNum) || isNaN(dayNum)) return;
          const fieldName = fieldNameMap[eventType];
          if (!fieldName) return;
          batchRecords.push({ funnelId, year: yearNum, month: monthNum, day: dayNum, fieldName, value: leads.size });
        });

        if (batchRecords.length > 0) {
          await window.StorageAPI.batchSaveFieldsToSupabase(batchRecords);
        }
      } catch (err) {
        console.error('Calendly sync to tracking sheets error:', err);
      }
    },
  };

  window.CalendlyAPI = CalendlyAPI;

})(window);
