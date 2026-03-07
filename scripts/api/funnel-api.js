// scripts/funnels.js
// Multi-Funnel Support mit Preset-System

(function(window) {

  // === Cache für Funnels ===
  let funnelCache = null;
  let isInitialized = false;

  const FUNNEL_PRESETS = {
    "classic-qualified-1call": {
      name: "Classic VSL | Qualified Survey | 1-Call Close",
      modules: ["classic-vsl", "survey-qualified", "1-call-close"]
    },
    "classic-qualified-2call": {
      name: "Classic VSL | Qualified Survey | 2-Call Close",
      modules: ["classic-vsl", "survey-qualified", "2-call-close"]
    },
    "classic-nosurvey-1call": {
      name: "Classic VSL | No Survey | 1-Call Close",
      modules: ["classic-vsl-no-survey", "no-survey", "1-call-close"]
    },
    "direct-survey-1call": {
      name: "Direct VSL | Survey | 1-Call Close",
      modules: ["direct-vsl", "survey-unqualified", "1-call-close"]
    },
    "direct-survey-2call": {
      name: "Direct VSL | Survey | 2-Call Close",
      modules: ["direct-vsl", "survey-unqualified", "2-call-close"]
    },
    "direct-call-booking-2call": {
      name: "Direct Call Booking | 2-Call Close",
      modules: ["direct-call-booking", "no-survey", "2-call-close"]
    }
  };

  // === Preset holen (mit Auto-Auswahl Organic-Variante) ===
  function getFunnelPreset(presetId) {
    return FUNNEL_PRESETS[presetId] || FUNNEL_PRESETS["classic-qualified-1call"];
  }

  // === Alle Presets listen ===
  function getAllPresets() {
    return FUNNEL_PRESETS;
  }

  // === Legacy Template (für alte Funnels) ===
  const LEGACY_TEMPLATE = {
    name: "Legacy Ads VSL Funnel",
    modules: ["paid-ads", "classic-vsl", "survey-qualified", "1-call-close", "revenue-paid"]
  };

  function getFunnelTemplate(type) {
    return LEGACY_TEMPLATE;
  }

  // === Funnel-Config aus Modulen generieren ===
  function getFunnelConfig(funnel) {
    if (funnel.modules && funnel.modules.length > 0) {
      // 🔥 Nutzt modulares System
      return FunnelModules.buildFunnelFromModules(funnel.modules);
    } else {
      // Fallback für alte Funnels ohne Module: Nutze Default-Module
      console.warn('⚠️ Funnel ohne Module gefunden, nutze Default-Module');
      const defaultModules = ["paid-ads", "classic-vsl", "survey-qualified", "1-call-close", "revenue-paid"];
      return FunnelModules.buildFunnelFromModules(defaultModules);
    }
  }

  // === Init Funnels (async, lädt von Supabase) ===
  async function initFunnels() {
    // Invalidiere Cache bei jedem Init (wichtig für User-Wechsel)
    funnelCache = null;
    isInitialized = false;

    try {
      const userId = window.AuthAPI?.getUserId();
      
      if (!userId || !window.SupabaseClient) {
        // Fallback zu localStorage wenn nicht eingeloggt
        const raw = localStorage.getItem("vsl_funnels");
        funnelCache = raw ? JSON.parse(raw) : getDefaultFunnels();
        isInitialized = true;
        return funnelCache;
      }

      // Lade von Supabase (RLS filtert automatisch nach user_id)
      const { data, error } = await window.SupabaseClient
        .from('funnels')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error loading funnels from Supabase:', error);
        // Bei Fehler: Default Funnels erstellen
        const defaults = getDefaultFunnels();
        funnelCache = defaults;
        isInitialized = true;
        return defaults;
      }

      // Wenn keine Funnels in Supabase → leeres Array zurückgeben
      if (!data || data.length === 0) {
        console.log('ℹ️ Keine Funnels gefunden - User muss erstes Funnel erstellen');
        funnelCache = [];
        isInitialized = true;
        return [];
      }

      // 🔥 NEU: Lade months Array aus tracking_data für jeden Funnel
      const funnelsWithMonths = await Promise.all(
        data.map(async (f) => {
          let months = [];
          
          if (window.StorageAPI?.getAvailableMonthsForFunnel) {
            try {
              months = await window.StorageAPI.getAvailableMonthsForFunnel(f.id);
            } catch (err) {
              console.error(`❌ Error loading months for ${f.id}:`, err);
              months = [];
            }
          }
          
          return {
            ...f,
            months: months
          };
        })
      );

      funnelCache = funnelsWithMonths;
      isInitialized = true;
      return funnelsWithMonths;
    } catch (err) {
      console.error("❌ Fehler beim Laden der Funnels:", err);
      // Bei Fehler: Default Funnels erstellen (kein localStorage wegen Multi-User)
      const defaults = getDefaultFunnels();
      funnelCache = defaults;
      isInitialized = true;
      return defaults;
    }
  }

  // === Funnels laden (synchron aus Cache) ===
  function loadFunnels() {
    if (!funnelCache) {
      console.warn('⚠️ loadFunnels() called before initFunnels() - returning empty array');
      return [];
    }
    return funnelCache;
  }

  // === Helper: Migriere localStorage Funnels zu Supabase ===
  async function migrateFunnelsToSupabase(funnels) {
    try {
      const userId = window.AuthAPI?.getUserId();
      if (!userId) return;

      const funnelsWithUserId = funnels.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        modules: f.modules,
        color: f.color,
        user_id: userId
      }));

      const { error } = await window.SupabaseClient
        .from('funnels')
        .insert(funnelsWithUserId);

      if (error) {
        console.error('❌ Error migrating funnels to Supabase:', error);
      } else {
        console.log('✅ Funnels migrated to Supabase:', funnels.length);
      }
    } catch (err) {
      console.error('❌ Error during funnel migration:', err);
    }
  }

  // === Funnels speichern (nur Supabase) ===
  async function saveFunnels(funnels) {
    try {
      const userId = window.AuthAPI?.getUserId();

      if (!userId || !window.SupabaseClient) {
        console.warn('⚠️ Cannot save funnels: User not authenticated');
        return;
      }

      // Lösche alte Funnels und füge neue ein (Upsert-Alternative)
      const { error: deleteError } = await window.SupabaseClient
        .from('funnels')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('❌ Error deleting old funnels:', deleteError);
        return;
      }

      const funnelsWithUserId = funnels.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        modules: f.modules,
        color: f.color,
        user_id: userId
      }));

      const { error } = await window.SupabaseClient
        .from('funnels')
        .insert(funnelsWithUserId);

      if (error) {
        console.error('❌ Error saving funnels:', error);
      } else {
        console.log('✅ Funnels saved to Supabase:', funnels.length);
        // Update Cache mit months Array
        funnelCache = funnels.map(f => ({ ...f, months: f.months || [] }));
      }
    } catch (err) {
      console.error("❌ Fehler beim Speichern der Funnels:", err);
    }
  }

  // === Default Funnels (mit Modulen!) ===
  function getDefaultFunnels() {
    return [
      {
        id: "fb-ads",
        name: "Facebook Ads",
        type: "classic-qualified-1call",
        modules: ["paid-ads", "classic-vsl", "survey-qualified", "1-call-close", "revenue-paid"],
        color: "#1877f2",
        months: []
      },
      {
        id: "yt-ads",
        name: "YouTube Ads",
        type: "classic-qualified-1call",
        modules: ["paid-ads", "classic-vsl", "survey-qualified", "1-call-close", "revenue-paid"],
        color: "#ff0000",
        months: []
      }
    ];
  }

  // === Aktiven Funnel holen ===
  function getActiveFunnel() {
    return localStorage.getItem("vsl_active_funnel") || "fb-ads";
  }

  // === Aktiven Funnel setzen ===
  function setActiveFunnel(funnelId) {
    localStorage.setItem("vsl_active_funnel", funnelId);
  }

  // === Aktive Funnel-Daten holen ===
  function getActiveFunnelData() {
    const funnels = loadFunnels();
    if (!funnels || funnels.length === 0) return null;
    const activeFunnelId = getActiveFunnel();
    const found = funnels.find(f => f.id === activeFunnelId);
    
    // Wenn aktiver Funnel nicht gefunden → setze ersten Funnel als aktiv
    if (!found && funnels.length > 0) {
      console.log(`ℹ️ Aktiver Funnel "${activeFunnelId}" nicht gefunden, wechsle zu "${funnels[0].id}"`);
      setActiveFunnel(funnels[0].id);
      return funnels[0];
    }
    
    return found || funnels[0];
  }

  // === Neuen Funnel erstellen ===
  function createFunnel(data) {
    const funnels = loadFunnels();

    const newFunnel = {
      id: data.id || `funnel-${Date.now()}`,
      name: data.name,
      type: data.type || "classic-qualified-1call",
      modules: data.modules || ["paid-ads", "classic-vsl", "survey-qualified", "1-call-close", "revenue-paid"],
      color: data.color || "#333",
      months: []
    };

    funnels.push(newFunnel);
    // Save async but don't wait (fire and forget)
    saveFunnels(funnels).catch(err => console.error('❌ Error saving funnel:', err));

    return newFunnel;
  }

  // === Migration: Bestehende Monate Facebook zuordnen ===
  function migrateExistingMonths() {
    const funnels = loadFunnels();
    const existingMonths = StorageAPI.loadMonthList();

    const fbFunnel = funnels.find(f => f.id === "fb-ads");
    if (fbFunnel && fbFunnel.months.length === 0 && existingMonths.length > 0) {
      fbFunnel.months = existingMonths;
      saveFunnels(funnels);

      existingMonths.forEach(({ y, m }) => {
        const oldData = StorageAPI.loadMonthData(y, m);

        if (oldData && Object.keys(oldData).length > 0) {
          const fbData = StorageAPI.loadMonthDataForFunnel("fb-ads", y, m);

          if (!fbData || Object.keys(fbData).length === 0) {
            StorageAPI.saveMonthDataForFunnel("fb-ads", y, m, oldData);
            console.log(`✅ Daten migriert: ${y}-${m + 1} → fb-ads (${Object.keys(oldData).length} Einträge)`);
          }
        }
      });

      console.log("✅ Bestehende Monate zu Facebook Ads migriert:", existingMonths.length);
    }
  }

  // === Export ===
  window.FunnelAPI = {
    initFunnels,
    loadFunnels,
    saveFunnels,
    getActiveFunnel,
    setActiveFunnel,
    getActiveFunnelData,
    getFunnelTemplate,
    getFunnelConfig,
    getFunnelPreset,
    getAllPresets,
    createFunnel,
    migrateExistingMonths,
    clearCache: () => { 
      funnelCache = null; 
      isInitialized = false; 
    }
  };

})(window);
