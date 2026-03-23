// scripts/storage.js
// 🔥 Tracking Data Storage mit Supabase + localStorage Cache

(function(window) {
  const MONTH_LIST_KEY = "vsl_months"; // Legacy
  const LEGACY_KEY = "vsl_nov2025";

  // === Cache für Tracking Data ===
  let trackingCache = {}; // { "funnel-id_2025_11": {...data...} }

  // === Storage-Key für einen Monat (Legacy) ===
  function keyOf(y, mIndex) {
    const mm = String(mIndex + 1).padStart(2, "0");
    return `vsl_${y}_${mm}`;
  }

  // === Storage-Key für einen Monat MIT Funnel ===
  function keyOfFunnel(funnelId, y, mIndex) {
    const mm = String(mIndex + 1).padStart(2, "0");
    return `vsl_${funnelId}_${y}_${mm}`;
  }

  // === Cache Key ===
  function cacheKey(funnelId, y, mIndex) {
    return `${funnelId}_${y}_${mIndex}`;
  }

  // ============================================
  // 🔥 SUPABASE FUNCTIONS (Primär)
  // ============================================

  /**
   * Lade Monatsdaten aus Supabase (mit localStorage Fallback)
   */
  async function loadMonthDataForFunnel(funnelId, y, mIndex) {
    const cKey = cacheKey(funnelId, y, mIndex);
    
    // Prüfe Cache
    if (trackingCache[cKey]) {
      return trackingCache[cKey];
    }

    try {
      const userId = window.AuthAPI?.getUserId();

      if (!userId || !window.SupabaseClient) {
        // Fallback zu localStorage wenn nicht eingeloggt
        return loadMonthDataFromLocalStorage(funnelId, y, mIndex);
      }

      // Lade von Supabase
      const { data, error } = await window.SupabaseClient
        .from('tracking_data')
        .select('id, data')
        .eq('user_id', userId)
        .eq('funnel_id', funnelId)
        .eq('year', y)
        .eq('month', mIndex)
        .maybeSingle();

      if (error) {
        console.error(`❌ Error loading tracking data for ${cKey}:`, error);
        // Fallback zu localStorage
        return loadMonthDataFromLocalStorage(funnelId, y, mIndex);
      }

      // Daten gefunden
      if (data && data.data) {
        trackingCache[cKey] = data.data;
        return data.data;
      }

      // Keine Daten → leeres Objekt
      trackingCache[cKey] = {};
      return {};

    } catch (err) {
      console.error(`❌ Error loading month data:`, err);
      return loadMonthDataFromLocalStorage(funnelId, y, mIndex);
    }
  }

  /**
   * Speichere Monatsdaten in Supabase (mit localStorage Backup)
   */
  async function saveMonthDataForFunnel(funnelId, y, mIndex, obj) {
    const cKey = cacheKey(funnelId, y, mIndex);
    
    // Update Cache
    trackingCache[cKey] = obj || {};

    try {
      const userId = window.AuthAPI?.getUserId();

      if (!userId || !window.SupabaseClient) {
        // Fallback zu localStorage
        saveMonthDataToLocalStorage(funnelId, y, mIndex, obj);
        return;
      }

      // Upsert in Supabase
      const { data: result, error } = await window.SupabaseClient
        .from('tracking_data')
        .upsert({
          user_id: userId,
          funnel_id: funnelId,
          year: y,
          month: mIndex,
          data: obj || {}
        }, {
          onConflict: 'user_id,funnel_id,year,month'
        })
        .select();

      if (error) {
        console.error(`❌ Error saving ${cKey} to Supabase:`, error);
        saveMonthDataToLocalStorage(funnelId, y, mIndex, obj);
        if (window.Toast) {
          window.Toast.error('Fehler beim Speichern - nutze lokalen Speicher');
        }
        return;
      }

      // Auch lokal als Backup speichern
      saveMonthDataToLocalStorage(funnelId, y, mIndex, obj);

    } catch (err) {
      console.error(`❌ Error saving month data:`, err);
      saveMonthDataToLocalStorage(funnelId, y, mIndex, obj);
      if (window.Toast) {
        if (err.name === 'QuotaExceededError') {
          window.Toast.error('Speicher voll!');
        } else {
          window.Toast.error('Fehler beim Speichern');
        }
      }
    }
  }

  /**
   * Lösche Monatsdaten aus Supabase und localStorage
   */
  async function deleteMonthDataForFunnel(funnelId, y, mIndex) {
    const cKey = cacheKey(funnelId, y, mIndex);
    
    // Lösche aus Cache
    delete trackingCache[cKey];

    try {
      const userId = window.AuthAPI?.getUserId();

      if (userId && window.SupabaseClient) {
        const { error } = await window.SupabaseClient
          .from('tracking_sheet_data')
          .delete()
          .eq('user_id', userId)
          .eq('funnel_id', funnelId)
          .eq('year', y)
          .eq('month', mIndex);

        if (error) {
          console.error(`❌ Error deleting from Supabase:`, error);
        }
      }

      deleteMonthDataFromLocalStorage(funnelId, y, mIndex);

    } catch (err) {
      console.error(`❌ Error deleting month data:`, err);
    }
  }

  /**
   * Hole alle verfügbaren Monate für einen Funnel
   * Kombiniert tracking_data (manuell eingetragene Daten) und
   * tracking_sheet_data (auto-sync Daten wie Typeform, Facebook)
   */
  async function getAvailableMonthsForFunnel(funnelId) {
    try {
      const userId = window.AuthAPI?.getUserId();

      if (!userId || !window.SupabaseClient) {
        return getAvailableMonthsFromLocalStorage(funnelId);
      }

      // Beide Tabellen parallel abfragen
      const [legacyResult, cellResult] = await Promise.all([
        window.SupabaseClient
          .from('tracking_data')
          .select('year, month')
          .eq('user_id', userId)
          .eq('funnel_id', funnelId),
        window.SupabaseClient
          .from('tracking_sheet_data')
          .select('year, month')
          .eq('user_id', userId)
          .eq('funnel_id', funnelId)
      ]);

      // Monate aus beiden Quellen mergen und deduplizieren
      const seen = new Set();
      const months = [];
      const addMonths = (rows) => {
        if (!rows) return;
        rows.forEach(row => {
          const key = `${row.year}_${row.month}`;
          if (!seen.has(key)) {
            seen.add(key);
            months.push({ y: row.year, m: row.month });
          }
        });
      };
      addMonths(legacyResult.data);
      addMonths(cellResult.data);

      // Sortiere absteigend (neueste zuerst)
      months.sort((a, b) => b.y !== a.y ? b.y - a.y : b.m - a.m);
      return months;

    } catch (err) {
      console.error(`❌ Error getting months for ${funnelId}:`, err);
      return getAvailableMonthsFromLocalStorage(funnelId);
    }
  }

  // ============================================
  // LOCALSTORAGE FALLBACK
  // ============================================

  function loadMonthDataFromLocalStorage(funnelId, y, mIndex) {
    try {
      const key = keyOfFunnel(funnelId, y, mIndex);
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function saveMonthDataToLocalStorage(funnelId, y, mIndex, obj) {
    try {
      const key = keyOfFunnel(funnelId, y, mIndex);
      localStorage.setItem(key, JSON.stringify(obj || {}));
    } catch (err) {
      console.error(`❌ localStorage error:`, err);
    }
  }

  function deleteMonthDataFromLocalStorage(funnelId, y, mIndex) {
    try {
      const key = keyOfFunnel(funnelId, y, mIndex);
      localStorage.removeItem(key);
    } catch (err) {
      console.error(`❌ Error deleting:`, err);
    }
  }

  function getAvailableMonthsFromLocalStorage(funnelId) {
    try {
      const months = [];
      const prefix = `vsl_${funnelId}_`;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const parts = key.split('_');
          if (parts.length >= 4) {
            const year = parseInt(parts[parts.length - 2], 10);
            const month = parseInt(parts[parts.length - 1], 10) - 1;
            if (!isNaN(year) && !isNaN(month)) {
              months.push({ y: year, m: month });
            }
          }
        }
      }
      
      return months;
    } catch (err) {
      return [];
    }
  }

  // ============================================
  // MIGRATION
  // ============================================

  async function migrateAllTrackingDataToSupabase() {
    try {
      const userId = window.AuthAPI?.getUserId();
      if (!userId || !window.SupabaseClient) {
        return { success: false, message: 'Nicht eingeloggt' };
      }

      console.log('🚀 Migriere Tracking Data zu Supabase...');

      const funnels = window.FunnelAPI?.loadFunnels() || [];
      let migratedCount = 0;

      for (const funnel of funnels) {
        const months = getAvailableMonthsFromLocalStorage(funnel.id);

        for (const { y, m } of months) {
          const data = loadMonthDataFromLocalStorage(funnel.id, y, m);

          if (!data || Object.keys(data).length === 0) continue;

          const { error } = await window.SupabaseClient
            .from('tracking_data')
            .upsert({
              user_id: userId,
              funnel_id: funnel.id,
              year: y,
              month: m,
              data: data
            }, {
              onConflict: 'user_id,funnel_id,year,month'
            });

          if (!error) {
            migratedCount++;
            console.log(`✅ Migrated ${funnel.id} ${y}-${m}`);
          }
        }
      }

      const message = `${migratedCount} Monate migriert`;
      console.log(`🎉 ${message}`);
      if (window.Toast) {
        window.Toast.success(message);
      }

      return { success: true, migratedCount, message };

    } catch (err) {
      console.error('❌ Migration failed:', err);
      return { success: false, message: err.message };
    }
  }

  // ============================================
  // LEGACY FUNCTIONS
  // ============================================

  function loadMonthData(y, mIndex) {
    try {
      const key = keyOf(y, mIndex);
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function saveMonthData(y, mIndex, obj) {
    try {
      const key = keyOf(y, mIndex);
      localStorage.setItem(key, JSON.stringify(obj || {}));
    } catch (err) {
      console.error("❌ Fehler:", err);
    }
  }

  function deleteMonthData(y, mIndex) {
    try {
      localStorage.removeItem(keyOf(y, mIndex));
    } catch (err) {
      console.error("❌ Fehler:", err);
    }
  }

  function loadMonthList() {
    try {
      const raw = localStorage.getItem(MONTH_LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function saveMonthList(list) {
    try {
      localStorage.setItem(MONTH_LIST_KEY, JSON.stringify(list));
    } catch (err) {
      console.error("❌ Fehler:", err);
    }
  }

  function migrateLegacyIfNeeded() {
    const list = loadMonthList();
    if (list && list.length) return;

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try {
        saveMonthData(2025, 10, JSON.parse(legacy));
        saveMonthList([{ y: 2025, m: 10 }]);
        localStorage.removeItem(LEGACY_KEY);
        console.log("✅ Legacy migriert");
      } catch (err) {
        console.error("❌ Migration error:", err);
      }
    }
  }

  // ============================================
  // 🔥 NEW: Granular Tracking Sheet Data (Cell-Level)
  // ============================================

  /**
   * Speichere einzelnes Feld in Supabase
   * @param {string} funnelId - z.B. "facebook-ads-direct-survey-1cc"
   * @param {number} year - z.B. 2026
   * @param {number} month - 0-11 (0=Januar)
   * @param {number} day - 1-31
   * @param {string} fieldName - z.B. "Adspend", "Leads", "Impressions"
   * @param {number} value - Numeric value
   */
  async function saveFieldToSupabase(funnelId, year, month, day, fieldName, value) {
    try {
      const session = await window.SupabaseClient.auth.getSession();
      const userId = session.data.session?.user?.id;

      if (!userId) {
        throw new Error('Not authenticated');
      }

      // Upsert: Insert oder Update wenn schon vorhanden
      const { error } = await window.SupabaseClient
        .from('tracking_sheet_data')
        .upsert({
          user_id: userId,
          funnel_id: funnelId,
          year: year,
          month: month,
          day: day,
          field_name: fieldName,
          value: value
        }, {
          onConflict: 'user_id,funnel_id,year,month,day,field_name'
        });

      if (error) {
        console.error(`❌ Error saving field ${fieldName} to Supabase:`, error);
        throw error;
      }

      return true;

    } catch (err) {
      console.error(`❌ Error in saveFieldToSupabase:`, err);
      if (window.Toast) {
        window.Toast.error(`Fehler beim Speichern von ${fieldName}`);
      }
      return false;
    }
  }

  /**
   * Lade komplette Monatsdaten aus Supabase (alle Felder/Tage)
   * @returns {Object} - z.B. { Adspend_1: 100, Adspend_2: 150, Leads_5: 23, ... }
   */
  async function loadMonthDataFromSupabase(funnelId, year, month) {
    try {
      const session = await window.SupabaseClient.auth.getSession();
      const userId = session.data.session?.user?.id;

      if (!userId) {
        return {}; // Nicht eingeloggt → leeres Objekt
      }

      const { data, error } = await window.SupabaseClient
        .from('tracking_sheet_data')
        .select('day, field_name, value')
        .eq('user_id', userId)
        .eq('funnel_id', funnelId)
        .eq('year', year)
        .eq('month', month);

      if (error) {
        console.error(`❌ Error loading month data from Supabase:`, error);
        throw error;
      }

      if (!data || data.length === 0) {
        return {}; // Keine Daten
      }

      // Konvertiere Array zu Objekt: { Adspend_1: 100, Leads_5: 23, ... }
      const monthData = {};
      data.forEach(row => {
        const parsed = parseFloat(row.value);
        if (!isNaN(parsed)) {
          const key = `${row.field_name}_${row.day}`;
          monthData[key] = parsed;
        }
      });

      return monthData;

    } catch (err) {
      console.error(`❌ Error in loadMonthDataFromSupabase:`, err);
      return {};
    }
  }

  /**
   * Lösche komplette Monatsdaten aus Supabase
   */
  async function deleteMonthDataFromSupabase(funnelId, year, month) {
    try {
      const session = await window.SupabaseClient.auth.getSession();
      const userId = session.data.session?.user?.id;

      if (!userId) {
        return false;
      }

      const { error } = await window.SupabaseClient
        .from('tracking_sheet_data')
        .delete()
        .eq('user_id', userId)
        .eq('funnel_id', funnelId)
        .eq('year', year)
        .eq('month', month);

      if (error) {
        console.error(`❌ Error deleting month from Supabase:`, error);
        throw error;
      }

      return true;

    } catch (err) {
      console.error(`❌ Error in deleteMonthDataFromSupabase:`, err);
      return false;
    }
  }

  /**
   * Batch-Save: Speichere mehrere Felder auf einmal (Performance)
   * @param {Array} records - Array von {funnelId, year, month, day, fieldName, value}
   */
  async function batchSaveFieldsToSupabase(records) {
    try {
      const session = await window.SupabaseClient.auth.getSession();
      const userId = session.data.session?.user?.id;

      if (!userId) {
        throw new Error('Not authenticated');
      }

      // Füge user_id zu allen Records hinzu
      const recordsWithUser = records.map(r => ({
        user_id: userId,
        funnel_id: r.funnelId,
        year: r.year,
        month: r.month,
        day: r.day,
        field_name: r.fieldName,
        value: r.value
      }));

      const { error } = await window.SupabaseClient
        .from('tracking_sheet_data')
        .upsert(recordsWithUser, {
          onConflict: 'user_id,funnel_id,year,month,day,field_name'
        });

      if (error) {
        console.error(`❌ Error batch saving to Supabase:`, error);
        throw error;
      }

      return true;

    } catch (err) {
      console.error(`❌ Error in batchSaveFieldsToSupabase:`, err);
      if (window.Toast) {
        window.Toast.error('Fehler beim Batch-Speichern');
      }
      return false;
    }
  }

  // === Export ===
  window.StorageAPI = {
    // Primary Supabase functions (async)
    loadMonthDataForFunnel,
    saveMonthDataForFunnel,
    deleteMonthDataForFunnel,
    getAvailableMonthsForFunnel,
    
    // NEW: Granular Cell-Level Functions
    saveFieldToSupabase,
    loadMonthDataFromSupabase,
    deleteMonthDataFromSupabase,
    batchSaveFieldsToSupabase,
    
    // Migration
    migrateAllTrackingDataToSupabase,
    
    // Legacy (sync)
    keyOf,
    keyOfFunnel,
    loadMonthData,
    saveMonthData,
    deleteMonthData,
    loadMonthList,
    saveMonthList,
    migrateLegacyIfNeeded,
    
    // Cache
    clearCache: () => { trackingCache = {}; }
  };
})(window);