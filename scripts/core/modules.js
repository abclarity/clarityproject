// scripts/modules.js
// Modulares Funnel-System v2.0 - Production Ready

(function(window) {

  // === 1.  TRAFFIC-MODULE ===
  const TRAFFIC_MODULES = {
    "paid-ads": {
      id: "paid-ads",
      name: "Paid Ads",
      columns: ["Adspend", "Impr", "Reach", "CPM-€", "Clicks", "CTR-%", "CPC-€"],
      inputs: ["Adspend", "Impr", "Reach", "Clicks"],
      inputKeys: ["Adspend", "Impr", "Reach", "Clicks"],  // 🔥 NEU
      provides: ["adspend", "impr", "reach", "clicks"]
    },
    "cold-email": {
      id: "cold-email",
      name: "Cold Email",
      columns: ["Emails Sent", "Opened", "Open-%", "Clicks", "CTR-%"],
      inputs: ["Emails Sent", "Opened", "Clicks"],
      inputKeys: ["Emails Sent", "Opened", "Clicks"],  // 🔥 Sheet-Namen verwenden
      provides: ["emailsSent", "opened", "clicks"]
    },
    "cold-calls": {
      id: "cold-calls",
      name: "Cold Calls",
      columns: ["Calls Dialed", "Reached", "Reach-%"],  // 🔥 Clicks & Int-% RAUS!  
      inputs: ["Calls Dialed", "Reached"],              // 🔥 Clicks RAUS!  
      inputKeys: ["Calls Dialed", "Reached"],           // 🔥 Clicks RAUS! 
      provides: ["callsDialed", "reached"]              // 🔥 clicks RAUS! 
    },
    "organic": {
      id: "organic",
      name: "Organic",
      columns: ["Clicks"],
      inputs: ["Clicks"],
      inputKeys: ["Clicks"],  // 🔥 NEU
      provides: ["clicks"]
    }
  };

  // === 2. FUNNEL-MODULE ===
  const FUNNEL_MODULES = {
    "classic-vsl": {
      id: "classic-vsl",
      name: "Classic VSL (Optin → VSL → Survey)",
      columns: ["Leads", "LP-%", "CPL-€", "Survey", "VideoCR-%", "Survey-€"],
      inputs: ["Leads", "Survey"],
      inputKeys: ["Leads", "Survey"],  // 🔥 NEU
      provides: ["leads", "survey"]
    },
    "classic-vsl-organic": {
      id: "classic-vsl-organic",
      name: "Classic VSL (ohne Adspend)",
      columns: ["Leads", "LP-%", "Survey", "VideoCR-%"],
      inputs: ["Leads", "Survey"],
      inputKeys: ["Leads", "Survey"],  // 🔥 NEU
      provides: ["leads", "survey"]
    },
    "direct-vsl": {
      id: "direct-vsl",
      name: "Direct VSL (ohne Optin)",
      columns: ["Survey", "VideoCR-%", "Survey-€"],
      inputs: ["Survey"],
      inputKeys: ["Survey"],  // 🔥 NEU
      provides: ["survey"]
    },
    "direct-vsl-organic": {
      id: "direct-vsl-organic",
      name: "Direct VSL (ohne Adspend)",
      columns: ["Survey", "VideoCR-%"],
      inputs: ["Survey"],
      inputKeys: ["Survey"],  // 🔥 NEU
      provides: ["survey"]
    },
    "classic-vsl-no-survey": {
      id: "classic-vsl-no-survey",
      name: "Classic VSL ohne Survey",
      columns: ["Leads", "LP-%", "CPL-€"],
      inputs: ["Leads"],
      inputKeys: ["Leads"],  // 🔥 NEU
      provides: ["leads"]
    },
    "classic-vsl-no-survey-organic": {
      id: "classic-vsl-no-survey-organic",
      name: "Classic VSL ohne Survey (ohne Adspend)",
      columns: ["Leads", "LP-%"],
      inputs: ["Leads"],
      inputKeys: ["Leads"],  // 🔥 NEU
      provides: ["leads"]
    },
    "direct-no-survey": {
      id: "direct-no-survey",
      name: "Direct (kein Optin, kein Survey)",
      columns: [],
      inputs: [],
      inputKeys: [],  // 🔥 NEU
      provides: []
    }
  };

  // === 3. QUALIFIKATION-MODULE ===
  const QUALIFICATION_MODULES = {
    "survey-qualified": {
      id: "survey-qualified",
      name: "Qualified Survey (SurveyQuali)",
      columns: ["SurveyQuali", "SurveyQuali-%", "SurveyQuali-€"],
      inputs: ["SurveyQuali"],
      inputKeys: ["SurveyQuali"],
      provides: ["surveyQuali"]
    },
    "survey-qualified-organic": {
      id: "survey-qualified-organic",
      name: "Qualified Survey (ohne Adspend)",
      columns: ["SurveyQuali", "SurveyQuali-%"],
      inputs: ["SurveyQuali"],
      inputKeys: ["SurveyQuali"],
      provides: ["surveyQuali"]
    },
    "survey-unqualified": {
      id: "survey-unqualified",
      name: "Survey (ohne Quali)",
      columns: [],
      inputs: [],
      inputKeys: [],  // 🔥 NEU
      provides: []
    },
    "no-survey": {
      id: "no-survey",
      name: "No Survey",
      columns: [],
      inputs: [],
      inputKeys: [],  // 🔥 NEU
      provides: []
    },
    "direct-call-booking": {
      id: "direct-call-booking",
      name: "Direct Call Booking (kein Optin, kein VSL)",
      columns: [],
      inputs: [],
      inputKeys: [],
      provides: []
    },
    "direct-call-booking-coldcalls": {
      id: "direct-call-booking-coldcalls",
      name: "Direct Call Booking (Cold Calls → Setting)",
      columns: [],
      inputs: [],
      inputKeys: [],
      provides: []
    },
    "direct-call-booking-coldcalls-withclicks": {
      id: "direct-call-booking-coldcalls-withclicks",
      name: "Direct Call Booking (Cold Calls mit Landingpage)",
      columns: ["Clicks", "Int-%"],
      inputs: ["Clicks"],
      inputKeys: ["Clicks"],
      provides: ["clicks"]
    }
  };

  // === 4. BOOKING & CLOSE MODULE ===
  const CLOSE_MODULES = {
    "1-call-close": {
      id: "1-call-close",
      name: "1-Call Close",
      columns: ["ClosingBooking", "Booking-%", "Booking-€", "ClosingTermin", "Quali-%", "Termin-€", "ClosingCall", "SUR-%", "SUR-€"],
      inputs: ["ClosingBooking", "ClosingTermin", "ClosingCall"],
      inputKeys: ["ClosingBooking", "ClosingTermin", "ClosingCall"],
      provides: ["closingBooking", "closingTermin", "closingCall"]
    },
    "1-call-close-organic": {
      id: "1-call-close-organic",
      name: "1-Call Close (ohne Adspend)",
      columns: ["ClosingBooking", "Booking-%", "ClosingTermin", "Quali-%", "ClosingCall", "SUR-%"],
      inputs: ["ClosingBooking", "ClosingTermin", "ClosingCall"],
      inputKeys: ["ClosingBooking", "ClosingTermin", "ClosingCall"],
      provides: ["closingBooking", "closingTermin", "closingCall"]
    },
    "2-call-close": {
      id: "2-call-close",
      name: "2-Call Close",
      columns: [
        "SettingBooking", "SB-%", "SB-€", "SettingTermin", "SQ-%", "ST-€", "SettingCall", "SS-%", "SS-€",
        "ClosingBooking", "CB-%", "CB-€", "ClosingTermin", "CQ-%", "CT-€", "ClosingCall", "CS-%", "CS-€"
      ],
      inputs: ["SettingBooking", "SettingTermin", "SettingCall", "ClosingBooking", "ClosingTermin", "ClosingCall"],
      inputKeys: ["SettingBooking", "SettingTermin", "SettingCall", "ClosingBooking", "ClosingTermin", "ClosingCall"],
      provides: ["settingBooking", "settingTermin", "settingCall", "closingBooking", "closingTermin", "closingCall"]
    },
    "2-call-close-organic": {
      id: "2-call-close-organic",
      name: "2-Call Close (ohne Adspend)",
      columns: [
        "SettingBooking", "SB-%", "SettingTermin", "SQ-%", "SettingCall", "SS-%",
        "ClosingBooking", "CB-%", "ClosingTermin", "CQ-%", "ClosingCall", "CS-%"
      ],
      inputs: ["SettingBooking", "SettingTermin", "SettingCall", "ClosingBooking", "ClosingTermin", "ClosingCall"],
      inputKeys: ["SettingBooking", "SettingTermin", "SettingCall", "ClosingBooking", "ClosingTermin", "ClosingCall"],
      provides: ["settingBooking", "settingTermin", "settingCall", "closingBooking", "closingTermin", "closingCall"]
    }
  };

  // === 5. REVENUE MODULE ===
  const REVENUE_MODULES = {
    "revenue-paid": {
      id: "revenue-paid",
      name: "Revenue & ROI (mit Adspend)",
      columns: ["Units", "CC%", "LC%", "Revenue", "Cash", "CC-Rate%", "CPA", "EPA-C", "R-P/L", "C-P/L", "R-ROI", "C-ROI"],
      inputs: ["Units", "Revenue", "Cash"],
      inputKeys: ["Units", "Revenue", "Cash"],  // 🔥 NEU
      provides: ["units", "revenue", "cash"]
    },
    "revenue-organic": {
      id: "revenue-organic",
      name: "Revenue (ohne Adspend)",
      columns: ["Units", "CC%", "LC%", "Revenue", "Cash", "CC-Rate%", "EPA-C"],
      inputs: ["Units", "Revenue", "Cash"],
      inputKeys: ["Units", "Revenue", "Cash"],  // 🔥 NEU
      provides: ["units", "revenue", "cash"]
    }
  };

  // === Module zusammenführen ===
  const ALL_MODULES = {
    traffic: TRAFFIC_MODULES,
    funnel: FUNNEL_MODULES,
    qualification: QUALIFICATION_MODULES,
    close: CLOSE_MODULES,
    revenue: REVENUE_MODULES
  };

  // === Funnel aus Modulen bauen ===
  function buildFunnelFromModules(moduleIds) {
    const allColumns = ["Tag", "Datum"];
    const allInputs = [];
    const kpiCols = [];

    Object.values(ALL_MODULES).forEach(category => {
      Object.entries(category).forEach(([id, module]) => {
        if (moduleIds.includes(id)) {
          allColumns.push(...module.columns);
          allInputs.push(...module.inputs);

          // KPIs = alle Spalten, die NICHT Inputs sind
          module.columns.forEach(col => {
            if (!module.inputs.includes(col)) {
              kpiCols.push(col);
            }
          });
        }
      });
    });

    return {
      columns: allColumns,
      inputs: allInputs,
      kpiCols: kpiCols,
      modules: moduleIds
    };
  }

  // === Export ===
  window.FunnelModules = {
    buildFunnelFromModules,
    traffic: TRAFFIC_MODULES,
    funnel: FUNNEL_MODULES,
    qualification: QUALIFICATION_MODULES,
    close: CLOSE_MODULES,
    revenue: REVENUE_MODULES,
    ALL_MODULES
  };

})(window);