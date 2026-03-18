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
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 0.5rem;">
            <div>
              <strong>${et.name}</strong>
              <div style="font-size: 0.8rem; color: var(--gray-600);">${et.duration} Min · ${et.kind}</div>
            </div>
            <select data-uri="${et.uri}" data-name="${et.name.replace(/"/g, '&quot;')}" style="padding: 0.4rem 0.6rem; border: 1px solid #d1d5db; border-radius: 4px;">
              <option value="">– Nicht mappen –</option>
              <option value="settingBooking" ${selected === 'settingBooking' ? 'selected' : ''}>Setting Booking</option>
              <option value="closingBooking" ${selected === 'closingBooking' ? 'selected' : ''}>Closing Booking</option>
            </select>
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

          if (clarityType) {
            upserts.push({
              user_id: userId,
              calendly_event_type_uri: uri,
              calendly_event_type_name: name,
              clarity_event_type: clarityType,
              is_active: true,
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
              <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${utm.utm_campaign}</strong>
              ${utm.utm_source ? `<small style="color:var(--gray-600);">Quelle: ${utm.utm_source}</small>` : ''}
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
        <div class="modal-content" style="max-width: 640px;">
          <div class="modal-header">
            <h2>🔗 UTM → Funnel Zuordnung</h2>
            <button class="modal-close" onclick="document.getElementById('calendly-utm-modal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <p style="color:var(--gray-600); margin-bottom:1.5rem;">
              Ordne jeden <code>utm_campaign</code>-Wert dem passenden Clarity-Funnel zu.<br>
              Die Werte kommen aus deinen letzten 50 Buchungen.
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
          <div class="modal-footer" style="display:flex; gap:0.5rem; justify-content:flex-end;">
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
          <div style="display:flex; gap:1rem; margin-bottom:2rem;">
            <button class="btn btn-primary" onclick="window.CalendlyAPI.openEventTypeMappingModal()">
              ⚙️ Event-Typen zuordnen
            </button>
            <button class="btn btn-secondary" onclick="window.CalendlyAPI.openUtmMappingModal()">
              🔗 UTM → Funnel zuordnen
            </button>
          </div>

          <!-- Event Type Mappings -->
          <div style="margin-bottom:1.5rem;">
            <h4 style="margin-bottom:0.75rem;">Event-Typ Zuordnungen</h4>
            ${etList}
          </div>

          <!-- UTM Mappings -->
          <div>
            <h4 style="margin-bottom:0.75rem;">UTM-Mappings (utm_campaign → Funnel)</h4>
            ${utmList}
          </div>
        </div>
      `;
    },

    // ==================== TRACKING SHEET SYNC ====================
    // Aggregates settingBooking/closingBooking events into tracking sheets
    async syncCalendlyToTrackingSheets(daysBack = 60) {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const { data: events, error } = await window.SupabaseClient
          .from('events')
          .select('funnel_id, event_date, event_type, lead_id')
          .in('event_type', ['settingBooking', 'closingBooking'])
          .eq('event_source', 'calendly')
          .not('funnel_id', 'is', null)
          .or('is_spam.is.null,is_spam.eq.false')
          .gte('event_date', startDate.toISOString().split('T')[0]);

        if (error || !events || events.length === 0) return;

        const agg = {};
        events.forEach(ev => {
          const dateKey = String(ev.event_date).substring(0, 10);
          const key = `${ev.funnel_id}__${dateKey}__${ev.event_type}`;
          if (!agg[key]) agg[key] = { funnelId: ev.funnel_id, date: dateKey, eventType: ev.event_type, leads: new Set() };
          if (ev.lead_id) agg[key].leads.add(ev.lead_id);
        });

        // Map event types to tracking sheet field names
        const fieldNameMap = {
          settingBooking: 'SettingBooking',
          closingBooking: 'ClosingBooking',
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
