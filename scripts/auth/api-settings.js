(function(window) {

  const APISettings = {
    async openModal() {
      const existingModal = document.getElementById('apiSettingsModal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'apiSettingsModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content api-settings-modal">
          <div class="settings-header">
            <h2>⚙️ API Integrationen</h2>
            <button class="close-btn" onclick="document.getElementById('apiSettingsModal').remove()">×</button>
          </div>

          <div class="settings-content">
            <p class="settings-intro">
              Verbinde deine Marketing- und Sales-Tools, um automatisch Events in den Datenpool zu synchronisieren.
            </p>

            <div id="apiConnectionsList" class="api-connections-list">
              <div class="loading-spinner">Lade Verbindungen...</div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      await this.loadConnections();
    },

    async loadConnections() {
      const listEl = document.getElementById('apiConnectionsList');

      try {
        const { data: connections, error } = await window.SupabaseClient
          .from('api_connections')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('❌ Error loading connections:', error);
          listEl.innerHTML = '<div class="error-message">Fehler beim Laden der Verbindungen</div>';
          return;
        }

        const providers = [
          { id: 'clickfunnels', name: 'ClickFunnels', icon: '��', description: 'Lead- und Survey-Events' },
          { id: 'typeform', name: 'Typeform', icon: '📋', description: 'Formular-Antworten' },
          { id: 'calendly', name: 'Calendly', icon: '📅', description: 'Termin-Buchungen' },
          { id: 'facebook', name: 'Facebook Ads', icon: '📘', description: 'Werbe-Metriken' },
          { id: 'google', name: 'Google Ads', icon: '🔍', description: 'Werbe-Metriken' }
        ];

        listEl.innerHTML = providers.map(provider => {
          const connection = connections.find(c => c.provider === provider.id);
          const isConnected = connection && connection.status === 'active';

          return `
            <div class="api-provider-card">
              <div class="provider-icon">${provider.icon}</div>
              <div class="provider-info">
                <div class="provider-name">${provider.name}</div>
                <div class="provider-description">${provider.description}</div>
                ${connection && connection.last_sync ? `
                  <div class="provider-sync">
                    Letzte Sync: ${new Date(connection.last_sync).toLocaleString('de-DE')}
                  </div>
                ` : ''}
              </div>
              <div class="provider-actions">
                ${isConnected ? `
                  <span class="status-badge connected">✓ Verbunden</span>
                  <button class="btn-secondary btn-small" onclick="window.APISettings.disconnect('${provider.id}')">
                    Trennen
                  </button>
                ` : `
                  <span class="status-badge disconnected">Nicht verbunden</span>
                  <button class="btn-primary btn-small" onclick="window.APISettings.connect('${provider.id}')">
                    Verbinden
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('');

      } catch (err) {
        console.error('❌ Error loading connections:', err);
        listEl.innerHTML = '<div class="error-message">Fehler beim Laden der Verbindungen</div>';
      }
    },

    async connect(providerId) {
      console.log('🔗 Connecting to:', providerId);

      // Facebook uses OAuth, others use API keys
      if (providerId === 'facebook') {
        await this.connectFacebook();
      } else {
        if (window.Toast) {
          window.Toast.info(`Integration mit ${providerId} wird geladen...`);
        }
        this.showConnectionModal(providerId);
      }
    },

    async connectFacebook() {
      try {
        if (window.Toast) {
          window.Toast.info('Facebook OAuth wird gestartet...');
        }

        // Get current user ID
        const { data: { user } } = await window.SupabaseClient.auth.getUser();
        if (!user) {
          throw new Error('Not logged in');
        }

        // Build Facebook OAuth URL directly
        const FB_APP_ID = '733222496183561';
        const REDIRECT_URI = `${window.SupabaseClient.supabaseUrl}/functions/v1/facebook-oauth`;
        const SCOPES = 'ads_read,ads_management,business_management';
        const STATE = `clarity_oauth_${Date.now()}_${user.id}`;
        
        const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
          `client_id=${FB_APP_ID}` +
          `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
          `&scope=${encodeURIComponent(SCOPES)}` +
          `&response_type=code` +
          `&state=${STATE}`;

        // Listen for postMessage from popup
        const messageHandler = async (event) => {
          if (event.data && event.data.type === 'facebook_oauth_complete') {
            window.removeEventListener('message', messageHandler);
            clearInterval(checkPopup);
            
            // Close API Settings Modal
            document.getElementById('apiSettingsModal')?.remove();
            
            // Sync ad accounts and show selection modal
            await this.syncFacebookAccountsAndShowModal();
          } else if (event.data && event.data.type === 'facebook_oauth_success') {
            // Fallback for old implementation
            window.removeEventListener('message', messageHandler);
            clearInterval(checkPopup);
            
            const tempToken = localStorage.getItem('fb_temp_token');
            const fbUserId = localStorage.getItem('fb_user_id');
            const expiresAt = localStorage.getItem('fb_expires_at');
            
            if (tempToken && fbUserId) {
              const { error } = await window.SupabaseClient
                .from('facebook_connections')
                .upsert({
                  user_id: user.id,
                  fb_user_id: fbUserId,
                  access_token: tempToken,
                  token_type: 'long_lived',
                  expires_at: expiresAt,
                  scopes: 'ads_read,ads_management,business_management',
                  status: 'active',
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'user_id,fb_user_id'
                });
              
              localStorage.removeItem('fb_temp_token');
              localStorage.removeItem('fb_user_id');
              localStorage.removeItem('fb_expires_at');
              
              if (!error) {
                if (window.Toast) {
                  window.Toast.success('Facebook erfolgreich verbunden!');
                }
                await this.syncFacebookAccounts();
              }
            }
          }
        };
        
        window.addEventListener('message', messageHandler);

        // Open OAuth popup
        const width = 600;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        const popup = window.open(
          authUrl,
          'Facebook OAuth',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Fallback: Poll for popup close
        const checkPopup = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(checkPopup);
            window.removeEventListener('message', messageHandler);
          }
        }, 500);

      } catch (error) {
        console.error('❌ Facebook OAuth error:', error);
        if (window.Toast) {
          window.Toast.error('Facebook-Verbindung fehlgeschlagen');
        }
      }
    },

    async checkFacebookConnection() {
      try {
        // Check if we have a Facebook connection now
        const { data: connection, error } = await window.SupabaseClient
          .from('facebook_connections')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (connection && !error) {
          if (window.Toast) {
            window.Toast.success('Facebook erfolgreich verbunden!');
          }
          
          // Sync ad accounts
          await this.syncFacebookAccounts();
          
          // Reload connections list
          await this.loadConnections();
        }
      } catch (error) {
        console.error('❌ Error checking Facebook connection:', error);
      }
    },

    async syncFacebookAccountsAndShowModal() {
      try {
        console.log('🔄 Starting syncFacebookAccountsAndShowModal...');
        
        if (window.Loading) {
          window.Loading.show('Ad Accounts werden geladen...');
        }

        const response = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/facebook-sync-accounts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${(await window.SupabaseClient.auth.getSession()).data.session?.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to sync ad accounts');
        }

        const result = await response.json();
        console.log('✅ Synced ad accounts:', result);

        if (window.Loading) {
          window.Loading.hide();
        }

        if (result.accounts_synced > 0) {
          console.log('📍 Navigating to datapool...');
          
          // Navigate to Datenpool first
          if (window.location.hash !== '#datapool') {
            window.location.hash = 'datapool';
          }

          console.log('⏳ Waiting for view to initialize...');
          // Wait a bit for view to initialize
          await new Promise(resolve => setTimeout(resolve, 1000));

          console.log('🔍 Checking for FacebookTraffic module...');
          console.log('FacebookTraffic exists:', !!window.FacebookTraffic);
          console.log('showAccountSelectionModal exists:', !!(window.FacebookTraffic && window.FacebookTraffic.showAccountSelectionModal));

          // Show account selection modal
          if (window.FacebookTraffic && window.FacebookTraffic.showAccountSelectionModal) {
            console.log('✅ Opening account selection modal...');
            await window.FacebookTraffic.showAccountSelectionModal();
          } else {
            console.warn('⚠️ FacebookTraffic module not ready, showing fallback toast');
            // Fallback: Show simple success message
            if (window.Toast) {
              window.Toast.success(`${result.accounts_synced} Ad Accounts gefunden. Klicke auf "Jetzt synchronisieren" um fortzufahren.`);
            }
          }
        } else {
          console.warn('⚠️ No accounts synced');
          if (window.Toast) {
            window.Toast.warning('Keine Ad Accounts gefunden');
          }
        }

      } catch (error) {
        console.error('❌ Error syncing ad accounts:', error);
        if (window.Loading) {
          window.Loading.hide();
        }
        if (window.Toast) {
          window.Toast.error('Fehler beim Laden der Ad Accounts');
        }
      }
    },

    async syncFacebookAccounts() {
      try {
        if (window.Loading) {
          window.Loading.show('Ad Accounts werden geladen...');
        }

        const response = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/facebook-sync-accounts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${(await window.SupabaseClient.auth.getSession()).data.session?.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to sync ad accounts');
        }

        const result = await response.json();
        console.log('✅ Synced ad accounts:', result);

        if (window.Loading) {
          window.Loading.hide();
        }

        if (result.count > 0 && window.Toast) {
          window.Toast.success(`${result.count} Ad Account(s) gefunden`);
          
          // Show initial sync modal
          this.showInitialSyncModal(result.accounts);
        }

      } catch (error) {
        console.error('❌ Error syncing ad accounts:', error);
        if (window.Loading) {
          window.Loading.hide();
        }
        if (window.Toast) {
          window.Toast.error('Fehler beim Laden der Ad Accounts');
        }
      }
    },

    showInitialSyncModal(accounts) {
      const existingModal = document.getElementById('initialSyncModal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'initialSyncModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>📊 Erster Daten-Sync</h2>
            <button class="close-btn" onclick="document.getElementById('initialSyncModal').remove()">×</button>
          </div>
          <div class="modal-body">
            <p>Wähle den Zeitraum für den ersten Daten-Import:</p>
            
            <div class="form-group">
              <label>Zeitraum:</label>
              <select id="syncDaysBack">
                <option value="7">Letzte 7 Tage</option>
                <option value="30">Letzte 30 Tage</option>
                <option value="90" selected>Letzte 90 Tage (empfohlen)</option>
                <option value="180">Letzte 180 Tage</option>
                <option value="365">Letzte 365 Tage</option>
              </select>
            </div>

            <div class="form-group">
              <label>Ad Accounts (${accounts.length} gefunden):</label>
              <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
                ${accounts.map(acc => `
                  <div style="padding: 5px 0;">
                    ✅ ${acc.name} (${acc.currency})
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="document.getElementById('initialSyncModal').remove()">
              Später
            </button>
            <button class="btn-primary" onclick="window.APISettings.startInitialSync()">
              Jetzt synchronisieren
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    },

    async startInitialSync() {
      try {
        const daysBack = parseInt(document.getElementById('syncDaysBack')?.value || '90');
        
        document.getElementById('initialSyncModal')?.remove();

        if (window.Loading) {
          window.Loading.show(`Synchronisiere ${daysBack} Tage Daten...`);
        }

        const response = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/facebook-sync-insights`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${(await window.SupabaseClient.auth.getSession()).data.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ days_back: daysBack })
          }
        );

        if (!response.ok) {
          throw new Error('Sync failed');
        }

        const result = await response.json();
        console.log('✅ Initial sync complete:', result);

        if (window.Loading) {
          window.Loading.hide();
        }

        if (window.Toast) {
          window.Toast.success(`${result.total_inserted} Kampagnen-Daten importiert!`);
        }

      } catch (error) {
        console.error('❌ Initial sync error:', error);
        if (window.Loading) {
          window.Loading.hide();
        }
        if (window.Toast) {
          window.Toast.error('Fehler beim Synchronisieren');
        }
      }
    },

    showConnectionModal(providerId) {
      const existingModal = document.getElementById('connectionModal');
      if (existingModal) existingModal.remove();

      const providerNames = {
        clickfunnels: 'ClickFunnels',
        typeform: 'Typeform',
        calendly: 'Calendly',
        facebook: 'Facebook Ads',
        google: 'Google Ads'
      };

      const modal = document.createElement('div');
      modal.id = 'connectionModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content connection-modal">
          <div class="connection-header">
            <h2>🔗 ${providerNames[providerId]} verbinden</h2>
            <button class="close-btn" onclick="document.getElementById('connectionModal').remove()">×</button>
          </div>

          <div class="connection-content">
            <p>Gib deine API-Credentials ein, um ${providerNames[providerId]} zu verbinden:</p>

            <div class="connection-form">
              <div class="form-field">
                <label>API Key / Access Token:</label>
                <input type="password" id="apiKey" placeholder="Dein API Key..." />
              </div>

              ${providerId === 'clickfunnels' ? `
                <div class="form-field">
                  <label>Funnel ID (optional):</label>
                  <input type="text" id="funnelId" placeholder="z.B. 123456" />
                </div>
              ` : ''}

              <div class="form-actions">
                <button class="btn-secondary" onclick="document.getElementById('connectionModal').remove()">
                  Abbrechen
                </button>
                <button class="btn-primary" onclick="window.APISettings.saveConnection('${providerId}')">
                  Verbinden
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    },

    async saveConnection(providerId) {
      const apiKey = document.getElementById('apiKey')?.value.trim();

      if (!apiKey) {
        if (window.Toast) {
          window.Toast.error('Bitte gib einen API Key ein');
        }
        return;
      }

      const credentials = { apiKey };

      if (providerId === 'clickfunnels') {
        const funnelId = document.getElementById('funnelId')?.value.trim();
        if (funnelId) {
          credentials.funnelId = funnelId;
        }
      }

      try {
        const { data, error } = await window.SupabaseClient
          .from('api_connections')
          .insert({
            provider: providerId,
            credentials: credentials,
            status: 'active'
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error saving connection:', error);
          if (window.Toast) {
            window.Toast.error('Fehler beim Speichern der Verbindung');
          }
          return;
        }

        if (window.Toast) {
          window.Toast.success('Verbindung erfolgreich hergestellt!');
        }

        document.getElementById('connectionModal')?.remove();
        await this.loadConnections();

      } catch (err) {
        console.error('❌ Error saving connection:', err);
        if (window.Toast) {
          window.Toast.error('Fehler beim Speichern der Verbindung');
        }
      }
    },

    async disconnect(providerId) {
      if (!confirm('Möchtest du die Verbindung wirklich trennen?')) {
        return;
      }

      try {
        const { error } = await window.SupabaseClient
          .from('api_connections')
          .delete()
          .eq('provider', providerId);

        if (error) {
          console.error('❌ Error disconnecting:', error);
          if (window.Toast) {
            window.Toast.error('Fehler beim Trennen der Verbindung');
          }
          return;
        }

        if (window.Toast) {
          window.Toast.success('Verbindung getrennt');
        }

        await this.loadConnections();

      } catch (err) {
        console.error('❌ Error disconnecting:', err);
        if (window.Toast) {
          window.Toast.error('Fehler beim Trennen der Verbindung');
        }
      }
    }
  };

  window.APISettings = APISettings;

})(window);
