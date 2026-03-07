// scripts/facebook-traffic.js
// Facebook Ads Traffic Source Module for Datapool

(function(window) {
  'use strict';

  const FacebookTraffic = {
    currentView: 'overview', // 'overview', 'campaigns', 'mappings'
    selectedAccount: null,
    campaigns: [],
    mappings: [],
    initialized: false,
    dateRangeType: 'thisMonth', // 'last7days', 'last14days', 'last30days', 'thisMonth', 'lastMonth', 'custom'
    customStartDate: null, // For custom date range
    customEndDate: null, // For custom date range

    async init() {
      try {
        // Show loading indicator
        if (window.Loading) {
          window.Loading.show('Facebook Ads Daten werden geladen...');
        }
        
        // Don't reset view if already initialized - respect current tab
        if (!this.initialized) {
          this.currentView = 'overview';
        }
        
        await this.loadData();
        await this.render();
        this.initialized = true;
        
      } catch (error) {
        console.error('❌ Error initializing Facebook Traffic:', error);
        if (window.Toast) {
          window.Toast.error('Fehler beim Laden der Facebook Ads Daten');
        }
      } finally {
        // Always hide loading indicator
        if (window.Loading) {
          window.Loading.hide();
        }
      }
    },

    async loadData() {
      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        if (!userId) {
          this.accounts = [];
          this.campaigns = [];
          this.mappings = [];
          this.hasConnection = false;
          return;
        }

        // Check if user has an active Facebook connection
        const { data: connection, error: connError } = await window.SupabaseClient
          .from('facebook_connections')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        this.hasConnection = !!connection && !connError;

        // Load ad accounts - only show enabled ones in overview
        const { data: accounts, error: accountsError } = await window.SupabaseClient
          .from('facebook_ad_accounts')
          .select('*')
          .eq('user_id', userId)
          .eq('sync_enabled', true)  // Only show enabled accounts
          .order('name', { ascending: true });

        if (accountsError) throw accountsError;

        this.accounts = accounts || [];

        // Load campaign mappings
        const { data: mappings, error: mappingsError } = await window.SupabaseClient
          .from('campaign_funnel_mapping')
          .select('*')
          .eq('is_active', true)
          .order('priority', { ascending: true });

        if (mappingsError) throw mappingsError;

        this.mappings = mappings || [];

        // Load recent campaigns from traffic_metrics
        const { data: campaigns, error: campaignsError } = await window.SupabaseClient
          .from('traffic_metrics')
          .select('campaign_id, campaign_name, funnel_id, source')
          .eq('source', 'facebook-ads')
          .order('date', { ascending: false })
          .limit(100);

        if (campaignsError) throw campaignsError;

        // Deduplicate campaigns
        const uniqueCampaigns = [];
        const seen = new Set();
        
        (campaigns || []).forEach(c => {
          if (!seen.has(c.campaign_id)) {
            seen.add(c.campaign_id);
            uniqueCampaigns.push(c);
          }
        });

        this.campaigns = uniqueCampaigns;

      } catch (error) {
        console.error('❌ Error loading Facebook data:', error);
        if (window.Toast) {
          window.Toast.error('Fehler beim Laden der Facebook-Daten');
        }
      }
    },

    async render() {
      // Determine which container to use based on current view
      let container;
      if (this.currentView === 'campaigns') {
        container = document.getElementById('facebookTrafficCampaignsContainer');
        if (!container) {
          // Fallback to main container
          container = document.getElementById('facebookTrafficContainer');
        }
      } else {
        container = document.getElementById('facebookTrafficContainer');
      }
      
      if (!container) {
        console.error('❌ Facebook traffic container not found');
        return;
      }

      // Render directly based on current view - no intermediate states
      if (this.currentView === 'overview') {
        const contentHtml = await this.renderOverview();
        container.innerHTML = `<div class="facebook-traffic">${contentHtml}</div>`;
      } else if (this.currentView === 'campaigns') {
        const contentHtml = await this.renderCampaigns();
        container.innerHTML = `<div class="facebook-traffic">${contentHtml}</div>`;
      }
    },

    async renderOverview() {
      // If no connection at all, show connect button
      if (!this.hasConnection) {
        return `
          <div class="empty-state">
            <p>Keine Facebook Verbindung</p>
            <button class="btn-primary" onclick="window.APISettings.openModal()">
              Facebook Ads verbinden
            </button>
          </div>
        `;
      }

      // If connection exists but no accounts enabled
      const enabledAccounts = this.accounts.filter(a => a.sync_enabled);
      if (enabledAccounts.length === 0) {
        return `
          <div class="empty-state">
            <p>Keine Ad Accounts aktiviert</p>
            <p style="font-size: 14px; color: #666; margin-top: 10px;">
              Gehe zu "Kampagnen" um Ad Accounts zu aktivieren.
            </p>
          </div>
        `;
      }

      // Load traffic metrics for selected date range
      const { startDate, endDate } = this.getDateRangeFromType();
      
      // Format dates as YYYY-MM-DD strings for database query
      const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      
      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);
      
      const { data: metrics, error } = await window.SupabaseClient
        .from('traffic_metrics')
        .select('*')
        .eq('source', 'facebook-ads')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error loading metrics:', error);
        return `<div class="empty-state"><p>Fehler beim Laden der Daten</p></div>`;
      }

      if (!metrics || metrics.length === 0) {
        const { data: latest } = await window.SupabaseClient
          .from('traffic_metrics')
          .select('date')
          .eq('source', 'facebook-ads')
          .order('date', { ascending: false })
          .limit(1);

        if (latest && latest.length > 0) {
          const latestDate = new Date(latest[0].date);
          const latestMonth = latestDate.getMonth();
          const latestYear = latestDate.getFullYear();
          
          // Auto-jump to latest month
          window.activeYear = latestYear;
          window.activeMonth = latestMonth;
          
          // Re-render with correct month
          return await this.renderOverview();
        }

        return `
          <div class="empty-state">
            <p>Keine Facebook Daten vorhanden</p>
            <p style="font-size: 14px; color: #666;">Synchronisiere deine Ad Accounts um Daten zu laden.</p>
          </div>
        `;
      }

      // Aggregate metrics by day (sum unique campaigns only)
      const dailyData = {};
      
      // Helper to format date as YYYY-MM-DD without timezone conversion
      const formatDateKey = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      
      // Create entry for each day in the date range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = formatDateKey(currentDate);
        dailyData[dateKey] = {
          dateKey: dateKey, // Store as string to avoid timezone issues
          adspend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          campaigns: new Set() // Track unique campaigns
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Deduplicate by campaign_id + date (keep only latest entry per campaign per day)
      const uniqueMetrics = {};
      (metrics || []).forEach(m => {
        const key = `${m.date}_${m.campaign_id}`;
        if (!uniqueMetrics[key] || new Date(m.created_at) > new Date(uniqueMetrics[key].created_at)) {
          uniqueMetrics[key] = m;
        }
      });

      

      // Sum up unique metrics by day
      Object.values(uniqueMetrics).forEach((m) => {
        const dateKey = m.date; // Use full date string as key
        if (dailyData[dateKey]) {
          dailyData[dateKey].adspend += parseFloat(m.adspend || 0);
          dailyData[dateKey].impressions += parseInt(m.impressions || 0);
          dailyData[dateKey].reach += parseInt(m.reach || 0);
          dailyData[dateKey].clicks += parseInt(m.clicks || 0);
          dailyData[dateKey].campaigns.add(m.campaign_id);
        }
      });

      // Calculate totals
      const totals = {
        adspend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0
      };

      Object.values(dailyData).forEach(day => {
        totals.adspend += day.adspend;
        totals.impressions += day.impressions;
        totals.reach += day.reach;
        totals.clicks += day.clicks;
      });

      // Calculate KPIs
      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
      const cpc = totals.clicks > 0 ? totals.adspend / totals.clicks : 0;

      return `
        <div class="datapool-table-container fb-ads-overview">
          <table class="datapool-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Datum</th>
                <th>Ad Spend</th>
                <th>Impressions</th>
                <th>Reach</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>CPC</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(dailyData).sort((a, b) => a[0].localeCompare(b[0])).map(([dateKey, data]) => {
                // Parse date string as UTC to avoid timezone offset
                const [year, month, day] = dateKey.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                const dayName = date.toLocaleDateString('de-DE', { weekday: 'short' });
                const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                
                const dayCtr = data.impressions > 0 ? (data.clicks / data.impressions * 100) : 0;
                const dayCpc = data.clicks > 0 ? data.adspend / data.clicks : 0;

                return `
                  <tr>
                    <td class="weekday">${dayName}</td>
                    <td>${dateStr}</td>
                    <td class="calc">${data.adspend.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                    <td class="calc">${data.impressions.toLocaleString('de-DE')}</td>
                    <td class="calc">${data.reach.toLocaleString('de-DE')}</td>
                    <td class="calc">${data.clicks.toLocaleString('de-DE')}</td>
                    <td class="calc">${dayCtr.toFixed(2)}%</td>
                    <td class="calc">${dayCpc.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" class="total-merged"><strong>TOTAL</strong></td>
                <td class="calc"><strong>${totals.adspend.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong></td>
                <td class="calc"><strong>${totals.impressions.toLocaleString('de-DE')}</strong></td>
                <td class="calc"><strong>${totals.reach.toLocaleString('de-DE')}</strong></td>
                <td class="calc"><strong>${totals.clicks.toLocaleString('de-DE')}</strong></td>
                <td class="calc"><strong>${ctr.toFixed(2)}%</strong></td>
                <td class="calc"><strong>${cpc.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="accounts-list" style="margin-top: 30px;">
          <h3>Verbundene Ad Accounts (${enabledAccounts.length})</h3>
          ${enabledAccounts.map(account => `
            <div class="account-card" style="padding: 12px; margin-bottom: 8px;">
              <div class="account-info">
                <div class="account-name" style="font-size: 14px;">${account.name}</div>
                <div class="account-details" style="font-size: 12px;">
                  ${account.business_name ? `📁 ${account.business_name} • ` : ''}
                  Letzte Sync: ${account.last_sync ? new Date(account.last_sync).toLocaleString('de-DE') : 'Noch nie'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    },

    async renderCampaigns() {
      // Use the same date range as overview
      const { startDate, endDate } = this.getDateRangeFromType();
      
      // Helper to format date as YYYY-MM-DD without timezone conversion
      const formatDateKey = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      
      const { data: metrics, error } = await window.SupabaseClient
        .from('traffic_metrics')
        .select('*')
        .eq('source', 'facebook-ads')
        .gte('date', formatDateKey(startDate))
        .lte('date', formatDateKey(endDate))
        .order('campaign_name', { ascending: true });

      if (error) {
        console.error('Error loading campaign metrics:', error);
        return `<div class="empty-state"><p>Fehler beim Laden der Kampagnen</p></div>`;
      }

      if (!metrics || metrics.length === 0) {
        return `
          <div class="empty-state">
            <p>Keine Kampagnen-Daten für den gewählten Zeitraum</p>
            <p style="font-size: 14px; color: #666; margin-top: 8px;">
              Versuche es mit "Jetzt synchronisieren" oder wähle einen anderen Zeitraum
            </p>
          </div>
        `;
      }

      // Aggregate by campaign_id and date first to eliminate duplicates
      const dailyCampaignData = {};
      metrics.forEach(m => {
        const key = `${m.campaign_id}_${m.date}`;
        if (!dailyCampaignData[key]) {
          // First entry for this campaign on this date
          dailyCampaignData[key] = {
            campaign_id: m.campaign_id,
            campaign_name: m.campaign_name,
            funnel_id: m.funnel_id,
            date: m.date,
            adspend: parseFloat(m.adspend || 0),
            impressions: parseInt(m.impressions || 0),
            reach: parseInt(m.reach || 0),
            clicks: parseInt(m.clicks || 0)
          };
        } else {
          // Duplicate found - take max values (not sum)
          const existing = dailyCampaignData[key];
          existing.adspend = Math.max(existing.adspend, parseFloat(m.adspend || 0));
          existing.impressions = Math.max(existing.impressions, parseInt(m.impressions || 0));
          existing.reach = Math.max(existing.reach, parseInt(m.reach || 0));
          existing.clicks = Math.max(existing.clicks, parseInt(m.clicks || 0));
          // Update funnel_id if set
          if (m.funnel_id) {
            existing.funnel_id = m.funnel_id;
          }
        }
      });

      // Now aggregate across dates for each campaign
      const campaignData = {};
      Object.values(dailyCampaignData).forEach(daily => {
        if (!campaignData[daily.campaign_id]) {
          campaignData[daily.campaign_id] = {
            campaign_id: daily.campaign_id,
            campaign_name: daily.campaign_name,
            funnel_id: daily.funnel_id,
            adspend: 0,
            impressions: 0,
            reach: 0,
            clicks: 0
          };
        }
        campaignData[daily.campaign_id].adspend += daily.adspend;
        campaignData[daily.campaign_id].impressions += daily.impressions;
        campaignData[daily.campaign_id].reach += daily.reach;
        campaignData[daily.campaign_id].clicks += daily.clicks;
        // Update funnel_id if set (take latest)
        if (daily.funnel_id) {
          campaignData[daily.campaign_id].funnel_id = daily.funnel_id;
        }
      });

      const campaigns = Object.values(campaignData);
      const assigned = campaigns.filter(c => c.funnel_id);
      const unassigned = campaigns.filter(c => !c.funnel_id);

      const funnels = window.FunnelAPI?.loadFunnels() || [];

      return `
        <div class="campaigns-section" style="padding: 0;">
          
          <!-- Automatische Zuordnungsregeln (oben) -->
          <div style="margin-bottom: 30px; background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 style="margin: 0; font-size: 16px; color: #2c3e50;">
                🔧 Automatische Zuordnungsregeln
              </h3>
              <button class="btn-primary" onclick="window.FacebookTraffic.showAddRuleForm()" style="font-size: 13px; padding: 6px 12px;">
                + Neue Regel
              </button>
            </div>
            
            ${this.mappings && this.mappings.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${this.mappings.map(mapping => {
                  const funnel = funnels.find(f => f.id === mapping.funnel_id);
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px 16px; border-radius: 6px; border: 1px solid #dee2e6;">
                      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                        <span style="font-size: 13px; color: #495057;">Name enthält:</span>
                        <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 13px;">"${mapping.pattern_value}"</code>
                        <span style="font-size: 13px; color: #6c757d;">→</span>
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${funnel?.color || '#ccc'}; color: white;">
                          ${funnel?.name || mapping.funnel_id}
                        </span>
                      </div>
                      <button class="btn-small btn-danger" onclick="window.FacebookTraffic.deleteMapping('${mapping.id}')" style="font-size: 12px; padding: 4px 10px;">
                        Löschen
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <p style="text-align: center; color: #6c757d; margin: 10px 0; font-size: 14px;">
                Noch keine Regeln erstellt. Erstelle Regeln, um Kampagnen automatisch zuzuordnen.
              </p>
            `}
          </div>

          <!-- Nicht zugeordnete Kampagnen -->
          ${unassigned.length > 0 ? `
            <div style="margin-bottom: 30px;">
              <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #e67e22;">
                ⚠️ Nicht zugeordnete Kampagnen (${unassigned.length})
              </h3>
              <p style="font-size: 13px; color: #666; margin-bottom: 12px;">
                Diese Kampagnen wurden noch keinem Funnel zugeordnet. Weise sie manuell zu oder erstelle eine Regel.
              </p>
              <table class="campaigns-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <thead style="background: #f8f9fa;">
                  <tr>
                    <th style="padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Kampagne</th>
                    <th style="padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Aktion</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Ad Spend</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Impressions</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Reach</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Clicks</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">CTR</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">CPC</th>
                  </tr>
                </thead>
                <tbody>
                  ${unassigned.map(c => {
                    const ctr = c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0;
                    const cpc = c.clicks > 0 ? c.adspend / c.clicks : 0;
                    return `
                      <tr style="border-bottom: 1px solid #ecf0f1;">
                        <td style="padding: 12px; font-size: 13px;">${c.campaign_name}</td>
                        <td style="padding: 12px;">
                          <div style="display: flex; gap: 6px;">
                            <select onchange="window.FacebookTraffic.assignCampaign('${c.campaign_id}', this.value)" style="font-size: 12px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; background: white;">
                              <option value="">Funnel wählen...</option>
                              ${funnels.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
                            </select>
                            <button class="btn-secondary" onclick="window.FacebookTraffic.createRuleFromCampaign('${c.campaign_name}')" style="font-size: 11px; padding: 4px 8px; white-space: nowrap;">
                              📝 Regel
                            </button>
                          </div>
                        </td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${c.adspend.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${c.impressions.toLocaleString('de-DE')}</td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${c.reach.toLocaleString('de-DE')}</td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${c.clicks.toLocaleString('de-DE')}</td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${ctr.toFixed(2)}%</td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${cpc.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Zugeordnete Kampagnen -->
          ${assigned.length > 0 ? `
            <div>
              <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #27ae60;">
                ✅ Zugeordnete Kampagnen (${assigned.length})
              </h3>
              <table class="campaigns-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <thead style="background: #f8f9fa;">
                  <tr>
                    <th style="padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Kampagne</th>
                    <th style="padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Funnel</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Ad Spend</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Impressions</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Reach</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">Clicks</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">CTR</th>
                    <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ecf0f1;">CPC</th>
                  </tr>
                </thead>
                <tbody>
                  ${assigned.map(c => {
                    const funnel = funnels.find(f => f.id === c.funnel_id);
                    const ctr = c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0;
                    const cpc = c.clicks > 0 ? c.adspend / c.clicks : 0;
                    return `
                      <tr style="border-bottom: 1px solid #ecf0f1;">
                        <td style="padding: 12px; font-size: 13px;">${c.campaign_name}</td>
                        <td style="padding: 12px;">
                          <span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${funnel?.color || '#ccc'}; color: white;">
                            ${funnel?.name || c.funnel_id}
                          </span>
                        </td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${c.adspend.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${c.impressions.toLocaleString('de-DE')}</td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${c.reach.toLocaleString('de-DE')}</td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${c.clicks.toLocaleString('de-DE')}</td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${ctr.toFixed(2)}%</td>
                        <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${cpc.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      `;
    },

    async switchView(view) {
      this.currentView = view;
      await this.render();
    },

    jumpToMonth(year, monthIndex) {
      window.activeYear = year;
      window.activeMonth = monthIndex;
      this.render();
    },

    async syncNow() {
      try {
        if (window.Loading) {
          window.Loading.show('Synchronisiere verbundene Ad Accounts...');
        }

        const session = await window.SupabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        if (!token) {
          throw new Error('Not authenticated');
        }

        // Get all enabled accounts
        const { data: enabledAccounts, error: enabledError } = await window.SupabaseClient
          .from('facebook_ad_accounts')
          .select('*')
          .eq('sync_enabled', true);

        if (enabledError) {
          throw enabledError;
        }

        if (!enabledAccounts || enabledAccounts.length === 0) {
          if (window.Loading) {
            window.Loading.hide();
          }
          if (window.Toast) {
            window.Toast.warning('Keine Ad Accounts aktiviert. Bitte erst einen Account verbinden.');
          }
          return;
        }

        // Sync insights for all enabled accounts
        // Fetch from start of current month (minimum), so no day is missing
        const today = new Date();
        const daysBackForSync = Math.max(today.getDate() + 1, 7); // at least 7 days, or enough to cover month start
        const insightsResponse = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/facebook-sync-insights`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ days_back: daysBackForSync })
          }
        );

        if (!insightsResponse.ok) {
          const errorText = await insightsResponse.text();
          console.error('❌ Insights sync failed:', errorText);
          throw new Error('Insights sync failed');
        }

        const insightsResult = await insightsResponse.json();

        if (window.Loading) {
          window.Loading.hide();
        }

        if (window.Toast) {
          window.Toast.success(`✅ ${enabledAccounts.length} Ad Account${enabledAccounts.length > 1 ? 's' : ''} erfolgreich synchronisiert!`);
        }

        // Also push fetched data into tracking sheets
        const monthsBack = Math.ceil(daysBackForSync / 30) + 1;
        await this.syncToTrackingSheets(monthsBack, true);

        // Refresh view
        await this.render();

      } catch (error) {
        console.error('❌ Sync error:', error);
        if (window.Loading) {
          window.Loading.hide();
        }
        if (window.Toast) {
          window.Toast.error(`Synchronisierung fehlgeschlagen: ${error.message}`);
        }
      }
    },

    async manageAccounts() {
      // Open modal to enable/disable accounts and configure filters
      try {
        if (window.Loading) {
          window.Loading.show('Lade Ad Accounts...');
        }

        const session = await window.SupabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        if (!token) {
          throw new Error('Not authenticated');
        }

        // First fetch accounts from Facebook to ensure we have the latest
        const accountsResponse = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/facebook-sync-accounts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!accountsResponse.ok) {
          const errorText = await accountsResponse.text();
          console.error('❌ Accounts sync failed:', errorText);
          throw new Error('Ad Accounts sync failed');
        }

        if (window.Loading) {
          window.Loading.hide();
        }

        // Show modal to select accounts
        await this.showAccountSelectionModal();

      } catch (error) {
        console.error('❌ Error loading accounts:', error);
        if (window.Loading) {
          window.Loading.hide();
        }
        if (window.Toast) {
          window.Toast.error(`Fehler beim Laden der Ad Accounts: ${error.message}`);
        }
      }
    },

    async showAccountSelectionModal() {
      
      
      // Load all accounts (including disabled ones)
      const { data: allAccounts, error } = await window.SupabaseClient
        .from('facebook_ad_accounts')
        .select('*')
        .order('name', { ascending: true });

      

      if (error || !allAccounts || allAccounts.length === 0) {
        console.error('Error loading accounts:', error);
        if (window.Toast) {
          window.Toast.warning('Keine Ad Accounts gefunden');
        }
        return;
      }

      

      // Create modal HTML
      const modalHtml = `
        <div class="modal-overlay" id="accountSelectionModal">
          <div class="modal-container" style="max-width: 800px;">
            <div class="modal-header">
              <h2>✅ Facebook erfolgreich verbunden!</h2>
              <button class="modal-close" onclick="document.getElementById('accountSelectionModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <p style="margin-bottom: 20px;">Wähle die Ad Accounts und Kampagnen-Filter aus:</p>
              
              <label style="display: block; margin-bottom: 8px; font-weight: 600;">Zeitraum für initialen Sync:</label>
              <select id="syncDaysBack" style="width: 100%; padding: 8px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="7">Letzte 7 Tage</option>
                <option value="30">Letzte 30 Tage</option>
                <option value="60">Letzte 60 Tage</option>
                <option value="90" selected>Letzte 90 Tage (empfohlen)</option>
              </select>

              <div style="max-height: 500px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 12px;">
                ${allAccounts.map(account => {
                  const filter = account.campaign_filter || { enabled: false, rules: [] };
                  return `
                  <div style="margin-bottom: 20px; padding: 12px; border-left: 3px solid #4285f4; background: #f8f9fa; border-radius: 4px;">
                    <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                      <input type="checkbox" 
                             class="account-checkbox" 
                             data-account-id="${account.ad_account_id}"
                             ${account.sync_enabled ? 'checked' : ''}
                             onchange="document.getElementById('filter-${account.ad_account_id}').style.display = this.checked ? 'block' : 'none'"
                             style="margin-right: 12px; margin-top: 4px; cursor: pointer;">
                      <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">${account.name}</div>
                        <div style="font-size: 12px; color: #666;">
                          ${account.business_name ? `<span style="color: #4285f4;">📁 ${account.business_name}</span> • ` : ''}
                          ${account.currency} • ${account.account_status === 1 ? '✅ Aktiv' : '⚠️ Inaktiv'}
                        </div>
                      </div>
                    </div>
                    
                    <div id="filter-${account.ad_account_id}" 
                         style="display: ${account.sync_enabled ? 'block' : 'none'}; padding-top: 12px; border-top: 1px solid #ddd;">
                      <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <input type="checkbox" 
                               class="filter-enabled" 
                               data-account-id="${account.ad_account_id}"
                               ${filter.enabled ? 'checked' : ''}
                               onchange="document.getElementById('rules-${account.ad_account_id}').style.display = this.checked ? 'block' : 'none'"
                               style="margin-right: 8px; cursor: pointer;">
                        <span style="font-weight: 500; font-size: 13px;">Kampagnen filtern</span>
                      </div>
                      
                      <div id="rules-${account.ad_account_id}" style="display: ${filter.enabled ? 'block' : 'none'}; margin-left: 24px;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                          Nur Kampagnen synchronisieren, deren Name:
                        </div>
                        <div class="filter-rules" data-account-id="${account.ad_account_id}">
                          ${filter.rules && filter.rules.length > 0 ? filter.rules.map((rule, idx) => `
                            <div class="filter-rule" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                              <select class="rule-type" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; cursor: pointer;">
                                <option value="contains" ${rule.type === 'contains' ? 'selected' : ''}>enthält</option>
                                <option value="starts_with" ${rule.type === 'starts_with' ? 'selected' : ''}>beginnt mit</option>
                                <option value="ends_with" ${rule.type === 'ends_with' ? 'selected' : ''}>endet mit</option>
                                <option value="excludes" ${rule.type === 'excludes' ? 'selected' : ''}>enthält NICHT</option>
                              </select>
                              <input type="text" 
                                     class="rule-value" 
                                     placeholder="z.B. SZM" 
                                     value="${rule.value || ''}"
                                     style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; cursor: text; pointer-events: auto; z-index: 1; position: relative;">
                              <button onclick="this.parentElement.remove(); return false;" 
                                      type="button"
                                      style="padding: 6px 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">×</button>
                            </div>
                          `).join('') : `
                            <div class="filter-rule" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                              <select class="rule-type" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; cursor: pointer;">
                                <option value="contains">enthält</option>
                                <option value="starts_with">beginnt mit</option>
                                <option value="ends_with">endet mit</option>
                                <option value="excludes">enthält NICHT</option>
                              </select>
                              <input type="text" 
                                     class="rule-value" 
                                     placeholder="z.B. SZM" 
                                     style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; cursor: text; pointer-events: auto; z-index: 1; position: relative;">
                              <button onclick="this.parentElement.remove(); return false;" 
                                      type="button"
                                      style="padding: 6px 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">×</button>
                            </div>
                          `}
                        </div>
                        <button onclick="window.FacebookTraffic.addFilterRule('${account.ad_account_id}'); return false;" 
                                type="button"
                                style="padding: 4px 10px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-top: 4px;">+ Regel hinzufügen</button>
                        <div style="font-size: 11px; color: #95a5a6; margin-top: 8px; font-style: italic;">
                          💡 Mehrere Regeln werden mit ODER verknüpft
                        </div>
                      </div>
                    </div>
                  </div>
                `;
                }).join('')}
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onclick="document.getElementById('accountSelectionModal').remove()">Später</button>
              <button class="btn-primary" onclick="window.FacebookTraffic.confirmAccountSelection()">Jetzt synchronisieren</button>
            </div>
          </div>
        </div>
      `;

      // Add modal to DOM
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    addFilterRule(accountId) {
      const rulesContainer = document.querySelector(`.filter-rules[data-account-id="${accountId}"]`);
      if (!rulesContainer) return;

      const ruleHtml = `
        <div class="filter-rule" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
          <select class="rule-type" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; cursor: pointer;">
            <option value="contains">enthält</option>
            <option value="starts_with">beginnt mit</option>
            <option value="ends_with">endet mit</option>
            <option value="excludes">enthält NICHT</option>
          </select>
          <input type="text" 
                 class="rule-value" 
                 placeholder="z.B. SZM" 
                 style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; cursor: text; pointer-events: auto; z-index: 1; position: relative;">
          <button onclick="this.parentElement.remove(); return false;" 
                  type="button"
                  style="padding: 6px 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">×</button>
        </div>
      `;
      rulesContainer.insertAdjacentHTML('beforeend', ruleHtml);
    },

    async confirmAccountSelection() {
      try {
        const checkboxes = document.querySelectorAll('.account-checkbox');
        const selectedAccountIds = Array.from(checkboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.dataset.accountId);

        if (selectedAccountIds.length === 0) {
          if (window.Toast) {
            window.Toast.warning('Bitte wähle mindestens einen Ad Account aus');
          }
          return;
        }

        const daysBack = parseInt(document.getElementById('syncDaysBack')?.value || '90');

        // Collect filter rules for each account
        const accountFilters = {};
        selectedAccountIds.forEach(accountId => {
          const filterEnabled = document.querySelector(`.filter-enabled[data-account-id="${accountId}"]`)?.checked || false;
          const rulesContainer = document.querySelector(`.filter-rules[data-account-id="${accountId}"]`);
          
          const rules = [];
          if (filterEnabled && rulesContainer) {
            const ruleElements = rulesContainer.querySelectorAll('.filter-rule');
            ruleElements.forEach(ruleEl => {
              const type = ruleEl.querySelector('.rule-type')?.value;
              const value = ruleEl.querySelector('.rule-value')?.value.trim();
              if (value) {
                rules.push({ type, value });
              }
            });
          }

          accountFilters[accountId] = {
            enabled: filterEnabled && rules.length > 0,
            rules: rules
          };
        });

        

        // Close modal
        document.getElementById('accountSelectionModal')?.remove();

        if (window.Loading) {
          window.Loading.show(`Synchronisiere ${selectedAccountIds.length} Ad Accounts...`);
        }

        // Update sync_enabled status and filters for all accounts
        const { error: disableError } = await window.SupabaseClient
          .from('facebook_ad_accounts')
          .update({ sync_enabled: false })
          .neq('ad_account_id', 'dummy');

        if (disableError) throw disableError;

        // Enable selected accounts and save filters
        for (const accountId of selectedAccountIds) {
          const { error: enableError } = await window.SupabaseClient
            .from('facebook_ad_accounts')
            .update({ 
              sync_enabled: true,
              campaign_filter: accountFilters[accountId]
            })
            .eq('ad_account_id', accountId);

          if (enableError) {
            console.error('Error updating account:', accountId, enableError);
            throw enableError;
          }
        }

        // Now sync insights for selected accounts
        const session = await window.SupabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        const insightsResponse = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/facebook-sync-insights`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              days_back: daysBack
              // No ad_account_id needed - already set sync_enabled: true above
            })
          }
        );

        if (!insightsResponse.ok) {
          const errorText = await insightsResponse.text();
          throw new Error('Insights sync failed: ' + errorText);
        }

        const insightsResult = await insightsResponse.json();
        

        const syncErrors = (insightsResult.results || [])
          .flatMap(result => result.errors || [])
          .filter(Boolean);

        if (syncErrors.length > 0) {
          console.error('❌ Insights sync errors:', syncErrors, insightsResult.results);
          if (window.Toast) {
            window.Toast.error(`Sync-Fehler: ${syncErrors[0]}`);
          }
        }

        if (window.Loading) {
          window.Loading.hide();
        }

        if (window.Toast) {
          window.Toast.success(`${selectedAccountIds.length} Ad Accounts und ${insightsResult.total_inserted || 0} Datensätze synchronisiert`);
        }

        // Reload data and render
        await this.loadData();
        this.render();
        
        // Navigate to Datenpool if not already there
        if (window.location.hash !== '#datapool') {
          window.location.hash = 'datapool';
        }

      } catch (error) {
        console.error('❌ Confirmation error:', error);
        if (window.Loading) {
          window.Loading.hide();
        }
        if (window.Toast) {
          window.Toast.error(`Fehler: ${error.message}`);
        }
      }
    },

    async syncAccount(adAccountId) {
      try {
        if (window.Loading) {
          window.Loading.show('Synchronisiere Ad Account...');
        }

        const response = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/facebook-sync-insights`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${(await window.SupabaseClient.auth.getSession()).data.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ad_account_id: adAccountId, days_back: 3 })
          }
        );

        if (!response.ok) {
          throw new Error('Sync failed');
        }

        const result = await response.json();

        const accountErrors = (result.results || [])
          .flatMap(r => r.errors || [])
          .filter(Boolean);

        if (accountErrors.length > 0) {
          console.error('❌ Account sync errors:', accountErrors, result.results);
          if (window.Toast) {
            window.Toast.error(`Sync-Fehler: ${accountErrors[0]}`);
          }
        }

        if (window.Loading) {
          window.Loading.hide();
        }

        if (window.Toast) {
          window.Toast.success('Ad Account synchronisiert');
        }

        await this.loadData();
        this.render();

      } catch (error) {
        console.error('❌ Sync error:', error);
        if (window.Loading) {
          window.Loading.hide();
        }
        if (window.Toast) {
          window.Toast.error('Synchronisierung fehlgeschlagen');
        }
      }
    },

    async assignCampaign(campaignId, funnelId) {
      if (!funnelId) return; // User cancelled dropdown

      try {
        // Update traffic_metrics directly for manual assignment
        const { error } = await window.SupabaseClient
          .from('traffic_metrics')
          .update({ funnel_id: funnelId })
          .eq('campaign_id', campaignId)
          .eq('source', 'facebook-ads');

        if (error) throw error;

        if (window.Toast) {
          window.Toast.success('Kampagne zugeordnet');
        }

        await this.loadData();
        this.render();

      } catch (error) {
        console.error('❌ Error assigning campaign:', error);
        if (window.Toast) {
          window.Toast.error('Fehler beim Zuordnen');
        }
      }
    },

    async createRuleFromCampaign(campaignName) {
      // Extract common pattern from campaign name (first word or phrase before /)
      const pattern = campaignName.split(/[/|-]/).map(s => s.trim()).find(s => s.length > 2) || campaignName.substring(0, 20);
      
      // Show inline form with pre-filled pattern
      this.showAddRuleForm(pattern);
    },

    showAddRuleForm(prefillPattern = '') {
      const funnels = window.FunnelAPI?.loadFunnels() || [];
      
      // Create modal for rule creation
      const existingModal = document.getElementById('addRuleModal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'addRuleModal';
      modal.className = 'modal-overlay';
      modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
      
      const modalContent = document.createElement('div');
      modalContent.style.cssText = 'background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15);';
      
      modalContent.innerHTML = `
        <h3 style="margin: 0 0 20px 0; font-size: 18px; color: #2c3e50;">📝 Neue Zuordnungsregel erstellen</h3>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: #555;">Kampagnenname enthält:</label>
          <input type="text" id="rulePattern" value="${prefillPattern}" placeholder="z.B. SZM" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;" />
          <div style="font-size: 11px; color: #6c757d; margin-top: 4px;">💡 Alle Kampagnen mit diesem Text im Namen werden zugeordnet</div>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: #555;">Zuordnen zu Funnel:</label>
          <select id="ruleFunnel" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
            <option value="">Funnel wählen...</option>
            ${funnels.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
          </select>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button onclick="document.getElementById('addRuleModal').remove()" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-size: 14px;">
            Abbrechen
          </button>
          <button onclick="window.FacebookTraffic.saveRule()" style="padding: 10px 20px; border: none; background: #3498db; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
            Regel erstellen
          </button>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // Close on overlay click
      modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
      };

      // Focus pattern input
      setTimeout(() => document.getElementById('rulePattern')?.focus(), 100);
    },

    async saveRule() {
      try {
        const pattern = document.getElementById('rulePattern')?.value.trim();
        const funnelId = document.getElementById('ruleFunnel')?.value;

        if (!pattern || !funnelId) {
          if (window.Toast) {
            window.Toast.error('Bitte alle Felder ausfüllen');
          }
          return;
        }

        // Get current user
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        if (!userId) {
          throw new Error('Not authenticated');
        }

        const { error } = await window.SupabaseClient
          .from('campaign_funnel_mapping')
          .insert({
            user_id: userId,
            pattern_type: 'name',
            pattern_value: pattern,
            funnel_id: funnelId,
            priority: 1,
            is_active: true
          });

        if (error) throw error;

        // Close modal
        document.getElementById('addRuleModal')?.remove();

        if (window.Toast) {
          window.Toast.success('Regel erstellt - Kampagnen werden zugeordnet...');
        }

        // Reload data and trigger sync to apply new mapping
        await this.loadData();
        
        // Trigger sync to apply the new mapping rule
        if (window.Loading) {
          window.Loading.show('Wende neue Regel an...');
        }

        const token = session.data.session?.access_token;
        const syncResponse = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/facebook-sync-insights`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              days_back: 90
            })
          }
        );

        if (window.Loading) {
          window.Loading.hide();
        }

        if (!syncResponse.ok) {
          console.warn('⚠️ Sync after rule creation failed');
        }

        // Reload data to show updated assignments
        await this.loadData();
        this.render();

      } catch (error) {
        console.error('❌ Error saving rule:', error);
        if (window.Toast) {
          window.Toast.error('Fehler beim Erstellen der Regel');
        }
      }
    },

    async deleteMapping(mappingId) {
      try {
        // First, find the mapping to get the pattern and funnel
        const mapping = this.mappings.find(m => m.id === mappingId);
        if (!mapping) {
          if (window.Toast) {
            window.Toast.error('Regel nicht gefunden');
          }
          return;
        }

        // Find campaigns that match this pattern
        const { data: affectedCampaigns, error: campaignsError } = await window.SupabaseClient
          .from('traffic_metrics')
          .select('campaign_id, campaign_name')
          .eq('source', 'facebook-ads')
          .eq('funnel_id', mapping.funnel_id)
          .ilike('campaign_name', `%${mapping.pattern_value}%`);

        if (campaignsError) {
          console.error('Error checking affected campaigns:', campaignsError);
        }

        // Get unique campaigns
        const uniqueCampaigns = [];
        const seen = new Set();
        (affectedCampaigns || []).forEach(c => {
          if (!seen.has(c.campaign_id)) {
            seen.add(c.campaign_id);
            uniqueCampaigns.push(c);
          }
        });

        // Show custom confirmation modal
        await this.showDeleteConfirmation(mapping, uniqueCampaigns, mappingId);

      } catch (error) {
        console.error('❌ Error deleting mapping:', error);
        if (window.Toast) {
          window.Toast.error('Fehler beim Löschen');
        }
      }
    },

    showDeleteConfirmation(mapping, affectedCampaigns, mappingId) {
      return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = 'background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15);';
        
        const funnels = window.FunnelAPI?.loadFunnels() || [];
        const funnel = funnels.find(f => f.id === mapping.funnel_id);
        
        modalContent.innerHTML = `
          <h3 style="margin: 0 0 20px 0; font-size: 18px; color: #e74c3c;">⚠️ Regel wirklich löschen?</h3>
          
          <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Regel:</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 13px;">"${mapping.pattern_value}"</code>
              <span style="font-size: 12px; color: #6c757d;">→</span>
              <span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${funnel?.color || '#ccc'}; color: white;">
                ${funnel?.name || mapping.funnel_id}
              </span>
            </div>
          </div>
          
          ${affectedCampaigns.length > 0 ? `
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
              <div style="font-weight: 600; color: #856404; margin-bottom: 8px;">
                ${affectedCampaigns.length} Kampagne(n) werden vom Funnel getrennt:
              </div>
              <div style="max-height: 150px; overflow-y: auto;">
                ${affectedCampaigns.slice(0, 10).map(c => `
                  <div style="font-size: 13px; color: #666; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
                    • ${c.campaign_name}
                  </div>
                `).join('')}
                ${affectedCampaigns.length > 10 ? `
                  <div style="font-size: 13px; color: #999; padding: 4px 0; font-style: italic;">
                    ... und ${affectedCampaigns.length - 10} weitere
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="cancelDelete" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-size: 14px;">
              Abbrechen
            </button>
            <button id="confirmDelete" style="padding: 10px 20px; border: none; background: #e74c3c; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
              Regel löschen
            </button>
          </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Handle cancel
        document.getElementById('cancelDelete').onclick = () => {
          modal.remove();
          resolve(false);
        };

        // Handle confirm
        document.getElementById('confirmDelete').onclick = async () => {
          modal.remove();
          
          try {
            // Delete the mapping
            const { error } = await window.SupabaseClient
              .from('campaign_funnel_mapping')
              .delete()
              .eq('id', mappingId);

            if (error) throw error;

            // Remove funnel_id from affected campaigns
            if (affectedCampaigns.length > 0) {
              const campaignIds = affectedCampaigns.map(c => c.campaign_id);
              
              const { error: updateError } = await window.SupabaseClient
                .from('traffic_metrics')
                .update({ funnel_id: null })
                .in('campaign_id', campaignIds)
                .eq('source', 'facebook-ads')
                .ilike('campaign_name', `%${mapping.pattern_value}%`);

              if (updateError) {
                console.error('Error disconnecting campaigns:', updateError);
              }
            }

            if (window.Toast) {
              window.Toast.success(`Regel gelöscht${affectedCampaigns.length > 0 ? ` und ${affectedCampaigns.length} Kampagne(n) getrennt` : ''}`);
            }

            await this.loadData();
            this.render();
            resolve(true);
            
          } catch (error) {
            console.error('❌ Error deleting mapping:', error);
            if (window.Toast) {
              window.Toast.error('Fehler beim Löschen');
            }
            resolve(false);
          }
        };

        // Close on overlay click
        modal.onclick = (e) => {
          if (e.target === modal) {
            modal.remove();
            resolve(false);
          }
        };
      });
    },

    async toggleAccount(adAccountId, enabled) {
      try {
        const { error } = await window.SupabaseClient
          .from('facebook_ad_accounts')
          .update({ sync_enabled: enabled })
          .eq('ad_account_id', adAccountId);

        if (error) throw error;

        if (window.Toast) {
          window.Toast.success(enabled ? 'Ad Account aktiviert' : 'Ad Account deaktiviert');
        }

        await this.loadData();
        this.render();

      } catch (error) {
        console.error('❌ Toggle error:', error);
        if (window.Toast) {
          window.Toast.error('Fehler beim Aktualisieren');
        }
      }
    },

    async disconnect() {
      if (!confirm('Möchtest du die Facebook Ads Verbindung wirklich trennen? Alle Ad Accounts, Kampagnen und Metriken werden gelöscht.')) {
        return;
      }

      try {
        if (window.Loading) {
          window.Loading.show('Trenne Verbindung und lösche Daten...');
        }

        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        if (!userId) {
          throw new Error('Not authenticated');
        }

        // Delete traffic metrics
        const { error: metricsError } = await window.SupabaseClient
          .from('traffic_metrics')
          .delete()
          .eq('user_id', userId)
          .eq('source', 'facebook-ads');

        if (metricsError) console.warn('Error deleting metrics:', metricsError);

        // Delete ad accounts
        const { error: accountsError } = await window.SupabaseClient
          .from('facebook_ad_accounts')
          .delete()
          .eq('user_id', userId);

        if (accountsError) console.warn('Error deleting accounts:', accountsError);

        // Delete campaign mappings
        const { error: mappingsError } = await window.SupabaseClient
          .from('campaign_funnel_mapping')
          .delete()
          .eq('user_id', userId);

        if (mappingsError) console.warn('Error deleting mappings:', mappingsError);

        // Delete the Facebook connection
        const { error: connectionError } = await window.SupabaseClient
          .from('facebook_connections')
          .delete()
          .eq('user_id', userId);

        if (connectionError) throw connectionError;

        if (window.Loading) {
          window.Loading.hide();
        }

        if (window.Toast) {
          window.Toast.success('Facebook Verbindung getrennt und alle Daten gelöscht');
        }

        // Reload to show connection button again
        await this.loadData();
        this.render();

      } catch (error) {
        console.error('❌ Disconnect error:', error);
        if (window.Loading) {
          window.Loading.hide();
        }
        if (window.Toast) {
          window.Toast.error('Fehler beim Trennen der Verbindung');
        }
      }
    },

    toggleDateRangeDropdown(event) {
      event.stopPropagation();
      
      // Remove existing dropdown if any
      const existingDropdown = document.getElementById('dateRangeDropdown');
      if (existingDropdown) {
        existingDropdown.remove();
        return;
      }

      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();

      const dropdown = document.createElement('div');
      dropdown.id = 'dateRangeDropdown';
      dropdown.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 5}px;
        left: ${rect.left}px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        min-width: 200px;
      `;

      const options = [
        { value: 'today', label: '📅 Heute' },
        { value: 'yesterday', label: '⏪ Gestern' },
        { value: 'last7days', label: 'Letzte 7 Tage' },
        { value: 'last14days', label: 'Letzte 14 Tage' },
        { value: 'last30days', label: 'Letzte 30 Tage' },
        { value: 'thisMonth', label: 'Dieser Monat' },
        { value: 'lastMonth', label: 'Letzter Monat' },
        { value: 'custom', label: '📅 Benutzerdefiniert...' }
      ];

      dropdown.innerHTML = options.map(opt => `
        <div class="date-range-option ${this.dateRangeType === opt.value ? 'active' : ''}"
             onclick="window.FacebookTraffic.${opt.value === 'custom' ? 'openCustomDateModal()' : `setDateRange('${opt.value}')`}"
             style="
               padding: 10px 15px;
               cursor: pointer;
               border-bottom: 1px solid #f0f0f0;
               ${this.dateRangeType === opt.value ? 'background: #e8f4f8; font-weight: bold;' : ''}
             "
             onmouseover="this.style.background='#f5f5f5'"
             onmouseout="this.style.background='${this.dateRangeType === opt.value ? '#e8f4f8' : 'white'}'">
          ${opt.label}
        </div>
      `).join('');

      document.body.appendChild(dropdown);

      // Close dropdown when clicking outside
      setTimeout(() => {
        document.addEventListener('click', function closeDropdown() {
          dropdown.remove();
          document.removeEventListener('click', closeDropdown);
        });
      }, 0);
    },

    async setDateRange(rangeType) {
      this.dateRangeType = rangeType;
      document.getElementById('dateRangeDropdown')?.remove();
      await this.render();
    },

    getDateRangeFromType() {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth(); // 0-based (0 = January, 1 = February)
      const day = today.getDate();

      let startDate, endDate;

      switch (this.dateRangeType) {
        case 'today':
          startDate = new Date(year, month, day);
          endDate = new Date(year, month, day);
          break;

        case 'yesterday':
          startDate = new Date(year, month, day - 1);
          endDate = new Date(year, month, day - 1);
          break;

        case 'last7days':
          // Letzte 7 Tage = gestern zurück bis vor 7 Tagen (ohne heute)
          startDate = new Date(year, month, day - 7);
          endDate = new Date(year, month, day - 1);
          break;

        case 'last14days':
          startDate = new Date(year, month, day - 14);
          endDate = new Date(year, month, day - 1);
          break;

        case 'last30days':
          startDate = new Date(year, month, day - 30);
          endDate = new Date(year, month, day - 1);
          break;

        case 'thisMonth':
          // First day of current month
          startDate = new Date(year, month, 1);
          // Today (not last day of month, but current day)
          endDate = new Date(year, month, day);
          break;

        case 'lastMonth':
          // First day of previous month
          startDate = new Date(year, month - 1, 1);
          // Last day of previous month
          endDate = new Date(year, month, 0);
          break;

        case 'custom':
          // Use custom dates if set, otherwise fallback to this month
          if (this.customStartDate && this.customEndDate) {
            startDate = this.customStartDate;
            endDate = this.customEndDate;
          } else {
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month, day);
          }
          break;

        default:
          startDate = new Date(year, month, 1);
          endDate = new Date(year, month, day);
      }

      return { startDate, endDate };
    },

    openCustomDateModal() {
      // Close dropdown first
      document.getElementById('dateRangeDropdown')?.remove();

      // Create modal overlay
      const modal = document.createElement('div');
      modal.id = 'customDateModal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      // Create modal content
      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 8px;
        min-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;

      // Stop propagation on content to prevent closing when clicking inside
      modalContent.onclick = (e) => e.stopPropagation();

      // Title
      const title = document.createElement('h3');
      title.textContent = 'Benutzerdefinierter Zeitraum';
      title.style.cssText = 'margin: 0 0 20px 0;';
      modalContent.appendChild(title);

      // Von field
      const vonDiv = document.createElement('div');
      vonDiv.style.cssText = 'margin-bottom: 15px;';
      
      const vonLabel = document.createElement('label');
      vonLabel.textContent = 'Von:';
      vonLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
      vonDiv.appendChild(vonLabel);

      // Helper to format date as YYYY-MM-DD without timezone issues
      const formatDateForInput = (date) => {
        if (!date) return new Date().toISOString().split('T')[0];
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      const defaultStart = formatDateForInput(this.customStartDate);

      const startInput = document.createElement('input');
      startInput.type = 'date';
      startInput.id = 'customStartInput';
      startInput.value = defaultStart;
      startInput.style.cssText = 'width: 100%; padding: 8px; font-size: 14px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;';
      vonDiv.appendChild(startInput);
      modalContent.appendChild(vonDiv);

      // Bis field
      const bisDiv = document.createElement('div');
      bisDiv.style.cssText = 'margin-bottom: 25px;';
      
      const bisLabel = document.createElement('label');
      bisLabel.textContent = 'Bis:';
      bisLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
      bisDiv.appendChild(bisLabel);

      const defaultEnd = formatDateForInput(this.customEndDate);

      const endInput = document.createElement('input');
      endInput.type = 'date';
      endInput.id = 'customEndInput';
      endInput.value = defaultEnd;
      endInput.style.cssText = 'width: 100%; padding: 8px; font-size: 14px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;';
      bisDiv.appendChild(endInput);
      modalContent.appendChild(bisDiv);

      // Buttons
      const buttonsDiv = document.createElement('div');
      buttonsDiv.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Abbrechen';
      cancelBtn.className = 'btn-secondary';
      cancelBtn.style.cssText = 'padding: 10px 20px;';
      cancelBtn.onclick = () => modal.remove();
      buttonsDiv.appendChild(cancelBtn);

      const applyBtn = document.createElement('button');
      applyBtn.textContent = 'Anwenden';
      applyBtn.className = 'btn-primary';
      applyBtn.style.cssText = 'padding: 10px 20px;';
      applyBtn.onclick = () => {
        const startValue = startInput.value;
        const endValue = endInput.value;

        if (!startValue || !endValue) {
          if (window.Toast) {
            window.Toast.error('Bitte beide Daten auswählen');
          }
          return;
        }

        const start = new Date(startValue + 'T00:00:00');
        const end = new Date(endValue + 'T00:00:00');

        if (start > end) {
          if (window.Toast) {
            window.Toast.error('Startdatum muss vor Enddatum liegen');
          }
          return;
        }

        this.customStartDate = start;
        this.customEndDate = end;
        this.dateRangeType = 'custom';
        
        modal.remove();
        this.render();
      };
      buttonsDiv.appendChild(applyBtn);
      modalContent.appendChild(buttonsDiv);

      // Assemble modal
      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // Close on background click
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      };

      // Focus first input after render
      setTimeout(() => startInput.focus(), 50);
    },

    // ============================================
    // 🔥 SYNC TO TRACKING SHEETS
    // ============================================

    async openSyncModal() {
      const modal = document.getElementById('facebookSyncModal');
      if (!modal) {
        console.error('❌ Sync modal not found');
        return;
      }

      // Load current auto-sync preference
      try {
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session.data.session?.user?.id;

        if (userId) {
          const { data: prefs, error } = await window.SupabaseClient
            .from('user_preferences')
            .select('facebook_auto_sync_enabled, facebook_auto_sync_months_back')
            .eq('user_id', userId)
            .single();

          if (!error && prefs) {
            const autoSyncCheckbox = document.getElementById('syncAutoDaily');
            const monthsSelect = document.getElementById('syncMonthsBack');
            
            if (autoSyncCheckbox) {
              autoSyncCheckbox.checked = prefs.facebook_auto_sync_enabled || false;
            }
            if (monthsSelect && prefs.facebook_auto_sync_months_back) {
              monthsSelect.value = prefs.facebook_auto_sync_months_back;
            }
          }
        }
      } catch (err) {
        console.error('Error loading auto-sync preference:', err);
      }

      // Setup event listeners
      const cancelBtn = document.getElementById('cancelSyncModal');
      const confirmBtn = document.getElementById('confirmSync');
      const monthsSelect = document.getElementById('syncMonthsBack');

      cancelBtn.onclick = () => {
        modal.classList.add('hidden');
      };

      confirmBtn.onclick = async () => {
        const monthsBack = parseInt(monthsSelect.value);
        const autoSync = document.getElementById('syncAutoDaily').checked;

        modal.classList.add('hidden');

        // Save auto-sync preference to Supabase
        try {
          const session = await window.SupabaseClient.auth.getSession();
          const userId = session.data.session?.user?.id;

          if (!userId) {
            console.warn('No user ID available for saving auto-sync preference');
          } else {
            const { error } = await window.SupabaseClient
              .from('user_preferences')
              .upsert({
                user_id: userId,
                facebook_auto_sync_enabled: autoSync,
                facebook_auto_sync_months_back: monthsBack,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'user_id'
              });

            if (error) {
              console.error('Failed to save auto-sync preference:', error);
              window.Toast.error('Fehler beim Speichern der Auto-Sync Einstellung');
            } else {
              console.log('✅ Auto-sync preference saved:', autoSync ? 'ENABLED' : 'DISABLED');
              if (autoSync) {
                window.Toast.info('Auto-Sync aktiviert: Täglich um 3 Uhr');
              }
            }
          }
        } catch (err) {
          console.error('Error saving auto-sync preference:', err);
        }

        if (window.Loading) {
          window.Loading.show('Synchronisiere Facebook Ads Daten...');
        }

        try {
          await this.syncToTrackingSheets(monthsBack, autoSync);
          
          // Set global flag to force reload on next view switch
          window._facebookSyncJustCompleted = true;
          
          if (window.Toast) {
            window.Toast.success(`Facebook Ads erfolgreich zu Tracking Sheets synchronisiert!`);
          }

          // Force reload if in Month View
          if (window.location.hash === '' || window.location.hash === '#month') {
            if (window.activeMonth && window.switchToMonth) {
              console.log('🔄 Force-reloading Month View after Facebook sync...');
              await window.switchToMonth(window.activeMonth.y, window.activeMonth.m);
              window._facebookSyncJustCompleted = false; // Reset flag
            }
          }
        } catch (error) {
          console.error('❌ Sync error:', error);
          if (window.Toast) {
            window.Toast.error('Fehler beim Synchronisieren: ' + error.message);
          }
        } finally {
          if (window.Loading) {
            window.Loading.hide();
          }
        }
      };

      // Generate preview
      monthsSelect.onchange = () => this.generateSyncPreview();
      this.generateSyncPreview();

      modal.classList.remove('hidden');
    },

    async generateSyncPreview() {
      const monthsBack = parseInt(document.getElementById('syncMonthsBack').value);
      const preview = document.getElementById('syncPreview');
      const previewContent = document.getElementById('syncPreviewContent');

      if (!preview || !previewContent) return;

      // Calculate date range - Full months only
      const endDate = new Date(); // Today
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack + 1); // Go back (monthsBack - 1) months
      startDate.setDate(1); // Start at 1st of month

      // Count assigned campaigns
      const assignedCampaigns = this.campaigns.filter(c => c.funnel_id);
      const funnels = window.FunnelAPI?.loadFunnels() || [];
      const affectedFunnels = [...new Set(assignedCampaigns.map(c => c.funnel_id))];

      previewContent.innerHTML = `
        <p style="margin: 4px 0;"><strong>📅 Zeitraum:</strong> ${startDate.toLocaleDateString('de-DE')} - ${endDate.toLocaleDateString('de-DE')}</p>
        <p style="margin: 4px 0;"><strong>📊 Kampagnen:</strong> ${assignedCampaigns.length} zugeordnete Kampagnen</p>
        <p style="margin: 4px 0;"><strong>🎯 Betroffene Funnels:</strong> ${affectedFunnels.length > 0 ? affectedFunnels.map(id => {
          const funnel = funnels.find(f => f.id === id);
          return funnel ? funnel.name : id;
        }).join(', ') : 'Keine'}</p>
        <p style="margin: 4px 0;"><strong>🔢 Felder pro Tag:</strong> Adspend, Impressions, Reach, Clicks</p>
      `;

      preview.style.display = 'block';
    },

    async syncToTrackingSheets(monthsBack, enableAutoSync) {
      try {
        // 1. Get assigned campaigns only
        const assignedCampaigns = this.campaigns.filter(c => c.funnel_id);

        if (assignedCampaigns.length === 0) {
          throw new Error('Keine Kampagnen zugeordnet. Weise zuerst Kampagnen zu Funnels zu.');
        }

        // Create campaign_id → funnel_id mapping from current assignments
        const campaignToFunnel = {};
        assignedCampaigns.forEach(c => {
          campaignToFunnel[c.campaign_id] = c.funnel_id;
        });

        // 2. Calculate date range - Full months only
        const endDate = new Date(); // Today
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack + 1); // Go back (monthsBack - 1) months
        startDate.setDate(1); // Start at 1st of month

        const formatDate = (date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };

        // 3. Load traffic metrics for date range
        const { data: metrics, error } = await window.SupabaseClient
          .from('traffic_metrics')
          .select('*')
          .eq('source', 'facebook-ads')
          .gte('date', formatDate(startDate))
          .lte('date', formatDate(endDate))
          .in('campaign_id', assignedCampaigns.map(c => c.campaign_id));

        if (error) throw error;

        if (!metrics || metrics.length === 0) {
          console.log('⏸️ No Facebook Ads data found for date range (this is OK for auto-sync)');
          return { synced: 0, message: 'Keine Daten im gewählten Zeitraum gefunden' };
        }

        // 4. Deduplicate first: campaign_id × date (take max values, not sum)
        const dailyCampaignData = {};
        metrics.forEach(m => {
          // Use current funnel assignment (from JavaScript), not database funnel_id
          const funnelId = campaignToFunnel[m.campaign_id];
          if (!funnelId) return; // Skip if campaign not assigned

          const key = `${m.campaign_id}_${m.date}`;
          if (!dailyCampaignData[key]) {
            // First entry for this campaign on this date
            dailyCampaignData[key] = {
              campaign_id: m.campaign_id,
              funnel_id: funnelId, // Use current assignment, not database value
              date: m.date,
              adspend: parseFloat(m.adspend || 0),
              impressions: parseInt(m.impressions || 0),
              reach: parseInt(m.reach || 0),
              clicks: parseInt(m.clicks || 0)
            };
          } else {
            // Duplicate found - take max values (not sum) to eliminate sync duplicates
            const existing = dailyCampaignData[key];
            existing.adspend = Math.max(existing.adspend, parseFloat(m.adspend || 0));
            existing.impressions = Math.max(existing.impressions, parseInt(m.impressions || 0));
            existing.reach = Math.max(existing.reach, parseInt(m.reach || 0));
            existing.clicks = Math.max(existing.clicks, parseInt(m.clicks || 0));
          }
        });

        // 5. Now aggregate by funnel_id × date (sum across campaigns in same funnel)
        const aggregated = {};
        Object.values(dailyCampaignData).forEach(daily => {
          const key = `${daily.funnel_id}_${daily.date}`;

          if (!aggregated[key]) {
            aggregated[key] = {
              funnelId: daily.funnel_id,
              date: daily.date,
              adspend: 0,
              impressions: 0,
              reach: 0,
              clicks: 0
            };
          }

          // Sum up values (multiple campaigns can belong to same funnel)
          aggregated[key].adspend += daily.adspend;
          aggregated[key].impressions += daily.impressions;
          aggregated[key].reach += daily.reach;
          aggregated[key].clicks += daily.clicks;
        });

        // 6. Convert to batch records for tracking_sheet_data
        const batchRecords = [];

        Object.values(aggregated).forEach(agg => {
          const dateObj = new Date(agg.date + 'T00:00:00');
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth(); // 0-11
          const day = dateObj.getDate();

          // Add 4 fields per day
          batchRecords.push(
            { funnelId: agg.funnelId, year, month, day, fieldName: 'Adspend', value: agg.adspend },
            { funnelId: agg.funnelId, year, month, day, fieldName: 'Impr', value: agg.impressions },
            { funnelId: agg.funnelId, year, month, day, fieldName: 'Reach', value: agg.reach },
            { funnelId: agg.funnelId, year, month, day, fieldName: 'Clicks', value: agg.clicks }
          );
        });

        // 7. Batch insert to Supabase
        if (batchRecords.length > 0) {
          await window.StorageAPI.batchSaveFieldsToSupabase(batchRecords);
        }

        // 8. Save auto-sync setting
        if (enableAutoSync !== undefined) {
          localStorage.setItem('facebook_auto_sync_enabled', enableAutoSync ? 'true' : 'false');
        }

        console.log(`✅ Synced ${batchRecords.length} records to tracking sheets`);

        return {
          success: true,
          recordsCount: batchRecords.length,
          daysCount: Object.keys(aggregated).length
        };

      } catch (error) {
        console.error('❌ Sync to tracking sheets error:', error);
        throw error;
      }
    },

    // Auto-Sync Scheduler
    startAutoSyncScheduler() {
      console.log('🔄 Starting Facebook Ads Auto-Sync Scheduler...');

      // Check immediately on app load
      this.checkAndRunAutoSync();

      // Then check every hour
      setInterval(() => {
        this.checkAndRunAutoSync();
      }, 60 * 60 * 1000); // 1 hour
    },

    async checkAndRunAutoSync() {
      try {
        // Get user session
        const session = await window.SupabaseClient.auth.getSession();
        const userId = session?.data?.session?.user?.id;
        
        if (!userId) {
          console.log('⏸️ No user session, skipping auto-sync');
          return;
        }

        // Check if user has connected Facebook account with sync enabled
        const { data: account } = await window.SupabaseClient
          .from('facebook_ad_accounts')
          .select('*')
          .eq('user_id', userId)
          .eq('sync_enabled', true)
          .maybeSingle();

        if (!account) {
          console.log('⏸️ No active Facebook Ad Account connected');
          return;
        }

        // Get or create user preferences
        let { data: prefs } = await window.SupabaseClient
          .from('user_preferences')
          .select('facebook_last_sync')
          .eq('user_id', userId)
          .maybeSingle();

        // If no preferences exist, create them
        if (!prefs) {
          await window.SupabaseClient
            .from('user_preferences')
            .insert({ user_id: userId });
          prefs = { facebook_last_sync: null };
        }

        const lastSync = prefs.facebook_last_sync ? new Date(prefs.facebook_last_sync) : null;
        const now = new Date();

        // Calculate how many days to sync
        let daysToSync = 3; // Default: last 3 days
        
        if (!lastSync) {
          // Never synced before → get last 30 days
          daysToSync = 30;
          console.log('🆕 First sync: fetching last 30 days');
        } else {
          // Calculate days since last sync
          const daysSinceLastSync = Math.ceil((now - lastSync) / (24 * 60 * 60 * 1000));
          
          if (daysSinceLastSync > 2) {
            // More than 2 days → sync all missing days + 1 buffer day
            daysToSync = Math.min(daysSinceLastSync + 1, 90); // Max 90 days
            console.log(`📅 Last sync was ${daysSinceLastSync} days ago, fetching ${daysToSync} days`);
          } else {
            // Recent sync → refresh today + yesterday + day before (3 days total)
            daysToSync = 3;
            console.log('🔄 Recent sync, refreshing last 3 days (today + 2 previous)');
          }
        }

        console.log('🚀 Running Facebook Auto-Sync...');
        
        // Load campaign mappings first (if not already loaded)
        if (!this.campaigns || this.campaigns.length === 0) {
          console.log('📥 Loading campaign mappings for auto-sync...');
          await this.loadData();
        }
        
        // Step 1: Fetch missing days from Facebook API via Edge Function
        console.log(`📡 Fetching ${daysToSync} days from Facebook API...`);
        const syncSession = await window.SupabaseClient.auth.getSession();
        const accessToken = syncSession?.data?.session?.access_token;
        const syncResponse = await fetch(
          `${window.SupabaseClient.supabaseUrl}/functions/v1/facebook-sync-insights`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ days_back: daysToSync })
          }
        );
        if (!syncResponse.ok) {
          const errText = await syncResponse.text();
          console.error('❌ Auto-Sync Edge Function error:', errText);
          throw new Error('Facebook API Sync fehlgeschlagen');
        }
        const syncResult = await syncResponse.json();
        console.log(`✅ Edge Function: ${syncResult.total_inserted} Einträge geholt`);

        // Step 2: Write fetched data into tracking sheets
        const monthsBack = Math.ceil(daysToSync / 30);
        await this.syncToTrackingSheets(monthsBack, true);

        // Update last sync timestamp
        await window.SupabaseClient
          .from('user_preferences')
          .update({ facebook_last_sync: now.toISOString() })
          .eq('user_id', userId);

        console.log('✅ Facebook Auto-Sync completed successfully');
        
        // Only show toast if it's a catch-up sync (more than 2 days)
        if (daysToSync > 2) {
          window.Toast?.success(`Facebook Ads synchronisiert (${daysToSync} Tage)`);
        }

      } catch (error) {
        console.error('❌ Auto-Sync error:', error);
        // Don't show error toast for background sync failures
        // But ensure loading indicator is hidden
        if (window.Loading) {
          window.Loading.hide();
        }
      }
    }
  };

  window.FacebookTrafficAPI = FacebookTraffic;
  window.FacebookTraffic = FacebookTraffic; // Keep backward compatibility

})(window);
