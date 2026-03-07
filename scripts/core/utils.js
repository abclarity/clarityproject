// scripts/utils.js
// Zentrale Hilfsfunktionen: KPI-Berechnung, Formatierung, Datum

(function(window) {
  // === Formatter (einmalig definiert) ===
  const fmtEuro2 = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const fmtNum2 = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const fmtInt0 = new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 0
  });

  // === KPI-Berechnung (erweitert für alle Module) ===
  function calculateKPIs(data) {
    // Shorthand für sicheren Zugriff
    const get = (key) => parseFloat(data[key]) || 0;

    return {
      // Traffic: Paid Ads
      "CPM-€": get("impr") ? (get("adspend") / get("impr")) * 1000 : 0,
      "CTR-%": get("impr")
        ? (get("clicks") / get("impr")) * 100
        : get("opened")
          ? (get("clicks") / get("opened")) * 100  // 🔥 Cold Email: clicks / opened
          : 0,
      "CPC-€": get("clicks") ? get("adspend") / get("clicks") : 0,

      // Traffic: Cold Email
      "Open-%": get("emailsSent") ? (get("opened") / get("emailsSent")) * 100 : 0,

      // Traffic: Cold Calls
      "Reach-%": get("callsDialed") ?  (get("reached") / get("callsDialed")) * 100 : 0,
      "Int-%": get("reached") ? (get("clicks") / get("reached")) * 100 : 0,  // ✅ NEU: "clicks" statt "interested"

      // Funnel: Classic VSL
      "LP-%": get("clicks") ? (get("leads") / get("clicks")) * 100 : 0,
      "CPL-€": get("leads") ? get("adspend") / get("leads") : 0,
      "VideoCR-%": get("leads")
        ? (get("survey") / get("leads")) * 100
        : get("clicks")
          ? (get("survey") / get("clicks")) * 100  // 🔥 Direct VSL: Survey / Clicks
          : 0,
      "Survey-€": get("survey") ? get("adspend") / get("survey") : 0,

      // Qualification
      "SurveyQuali-%": get("survey") ? (get("surveyQuali") / get("survey")) * 100 : 0,
      "SurveyQuali-€": get("surveyQuali") ? get("adspend") / get("surveyQuali") : 0,

      // 1-Call Close
      "Booking-%": get("surveyQuali")
        ? (get("closingBooking") / get("surveyQuali")) * 100
        : get("survey")
          ? (get("closingBooking") / get("survey")) * 100
          : get("leads")
            ? (get("closingBooking") / get("leads")) * 100
            : get("clicks")
              ? (get("closingBooking") / get("clicks")) * 100  // 🔥 Direct Call Booking
              : 0,
      "Booking-€": get("closingBooking") ? get("adspend") / get("closingBooking") : 0,
      "Quali-%": get("closingBooking") ? (get("closingTermin") / get("closingBooking")) * 100 : 0,
      "Termin-€": get("closingTermin") ? get("adspend") / get("closingTermin") : 0,
      "SUR-%": get("closingTermin") ? (get("closingCall") / get("closingTermin")) * 100 : 0,
      "SUR-€": get("closingCall") ? get("adspend") / get("closingCall") : 0,

      // 2-Call Close: Setting
      "SB-%": get("surveyQuali")
        ? (get("settingBooking") / get("surveyQuali")) * 100
        : get("survey")
          ? (get("settingBooking") / get("survey")) * 100
          : get("leads")
            ? (get("settingBooking") / get("leads")) * 100
            : get("reached")
              ? (get("settingBooking") / get("reached")) * 100  // 🔥 Cold Calls: Reached → SettingBooking
              : get("clicks")
                ? (get("settingBooking") / get("clicks")) * 100  // 🔥 Paid Ads: Clicks → SettingBooking
                : 0,
      "SB-€": get("settingBooking") ? get("adspend") / get("settingBooking") : 0,
      "SQ-%": get("settingBooking") ? (get("settingTermin") / get("settingBooking")) * 100 : 0,
      "ST-€": get("settingTermin") ? get("adspend") / get("settingTermin") : 0,
      "SS-%": get("settingTermin") ? (get("settingCall") / get("settingTermin")) * 100 : 0,
      "SS-€": get("settingCall") ? get("adspend") / get("settingCall") : 0,

      // 2-Call Close: Closing
      "CB-%": get("settingCall") ? (get("closingBooking") / get("settingCall")) * 100 : 0,
      "CB-€": get("closingBooking") ? get("adspend") / get("closingBooking") : 0,
      "CQ-%": get("closingBooking") ? (get("closingTermin") / get("closingBooking")) * 100 : 0,
      "CT-€": get("closingTermin") ? get("adspend") / get("closingTermin") : 0,
      "CS-%": get("closingTermin") ? (get("closingCall") / get("closingTermin")) * 100 : 0,
      "CS-€": get("closingCall") ? get("adspend") / get("closingCall") : 0,

      // Revenue
      "CC%": get("sales")
        ? (get("units") / get("sales")) * 100
        : get("closingCall")
          ? (get("units") / get("closingCall")) * 100
          : 0,
      "LC%": get("leads")
        ? (get("units") / get("leads")) * 100
        : get("survey")
          ? (get("units") / get("survey")) * 100  // 🔥 Direct VSL: Units / Survey
          : get("clicks")
            ? (get("units") / get("clicks")) * 100  // 🔥 Fallback: Units / Clicks
            : 0,
      "CC-Rate%": get("revenue") ? (get("cash") / get("revenue")) * 100 : 0,
      "CPA": get("units") ? get("adspend") / get("units") : 0,
      "EPA-C": get("units") ? get("cash") / get("units") : 0,
      "R-P/L": get("revenue") - get("adspend"),
      "C-P/L": get("cash") - get("adspend"),
      "R-ROI": get("adspend") ? get("revenue") / get("adspend") : 0,
      "C-ROI": get("adspend") ? get("cash") / get("adspend") : 0
    };
  }

  // === Formatierung von Werten (zentral) ===
  function formatValue(val, key) {
    if (val == null || isNaN(val) || val === Infinity) return "–";

    // Euro-Felder
    if (["CPM-€", "CPC-€", "CPL-€", "Survey-€", "SurveyQuali-€", "Booking-€", "Termin-€", "SUR-€", "ST-€", "CT-€", "SB-€", "SS-€", "CB-€", "CS-€", "CPA", "EPA-C", "R-P/L", "C-P/L"].includes(key)) {
      return fmtEuro2.format(val);
    }

    // Prozent-Felder (CTR-% wird jetzt automatisch erkannt)
    if (key.includes("%")) {
      return fmtNum2.format(val) + " %";
    }

    // ROI-Felder (Multiplikator)
    if (["R-ROI", "C-ROI"].includes(key)) {
      return fmtNum2.format(val) + "×";
    }

    // Standard: 2 Dezimalstellen
    return fmtNum2.format(val);
  }

  // === Datumsformatierung ===
  function monthNameDe(y, mIdx) {
    return new Date(y, mIdx, 1).toLocaleDateString("de-DE", {
      month: "long",
      year: "numeric"
    });
  }

  function monthShort(y, mIdx) {
    return new Date(y, mIdx, 1).toLocaleDateString("de-DE", { month: "short" });
  }

  function weekdayLetter(date) {
    return ["S", "M", "D", "M", "D", "F", "S"][date.getDay()];
  }

  // === ISO-Wochennummer (KW) ===
  function isoWeekNumber(date) {
    const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - day + 3);
    const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
    return 1 + Math.round((tmp - firstThursday) / (7 * 24 * 3600 * 1000));
  }

  // === Zahlen parsen (aus Input-Feldern) ===
  function parseNumber(str) {
    if (!str) return NaN;
    const cleaned = String(str)
      .replace(/[^\d,.\-]/g, "")  // nur Zahlen, Komma, Punkt, Minus
      .replace(/\./g, "")          // deutsche Tausender entfernen
      .replace(",", ".");          // deutsches Komma → Punkt
    return parseFloat(cleaned);
  }

  // === Export ===
  window.ClarityUtils = {
    calculateKPIs,
    formatValue,
    monthNameDe,
    monthShort,
    weekdayLetter,
    isoWeekNumber,
    parseNumber
  };

  window.ClarityFormat = {
    euro: fmtEuro2,
    num2: fmtNum2,
    int0: fmtInt0
  };
})(window);