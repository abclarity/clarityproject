// scripts/year.js
// Jahresdashboard: 12 Monate + 4 Quartale + TOTAL (Modular)

(function(window) {
  const { calculateKPIs, formatValue, monthShort } = ClarityUtils;
  const { euro, int0 } = ClarityFormat;

  // === Monat-Totals aus Storage laden (ASYNC) ===
  async function monthTotalsFromStorage(y, mIdx, INPUT_KEYS, activeFunnelId) {
    const data = await StorageAPI.loadMonthDataFromSupabase(activeFunnelId, y, mIdx) || {};
    const dim = new Date(y, mIdx + 1, 0).getDate();

    const totals = {};
    INPUT_KEYS.forEach(k => (totals[k] = 0));

    let hasAny = false;

    for (let d = 1; d <= dim; d++) {
      INPUT_KEYS.forEach(k => {
        const v = data[`${k}_${d}`];
        if (typeof v === "number" && !isNaN(v)) {
          totals[k] += v;
          hasAny = true;
        }
      });
    }

    return { totals, hasAny };
  }

  async function loadYear(y) {
    const app = document.getElementById("app");
    app.innerHTML = "";

    // 🔥 Aktiven Funnel holen
    const activeFunnelId = FunnelAPI.getActiveFunnel();
    const activeFunnel = FunnelAPI.getActiveFunnelData();

    // 🔥 Funnel-Config mit dynamischen Spalten
    const config = FunnelAPI.getFunnelConfig(activeFunnel);
    const YEAR_COLUMNS = ["Monat", ...config.columns.slice(2)]; // Ohne "Tag", "Datum"
    const INPUT_KEYS = config.inputs;
    const KPI_COLS = config.kpiCols;

    console.log("📊 Lade Jahr:", { funnel: activeFunnel.name, columns: YEAR_COLUMNS.length });

    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    wrap.innerHTML = `
      <div id="zoomArea">
        <table id="year-table">
          <thead>
            <tr>${YEAR_COLUMNS.map(c => `<th>${c}</th>`).join("")}</tr>
          </thead>
          <tbody id="year-body"></tbody>
          <tfoot id="year-foot">
            <tr id="year-head">
              <td rowspan="2" class="total-merged"><strong>TOTAL</strong></td>
              ${YEAR_COLUMNS.slice(1).map(c => `<td class="repeat-head">${c}</td>`).join("")}
            </tr>
            <tr id="year-summary">
              ${YEAR_COLUMNS.slice(1).map(c => `<td class="calc" data-key="${c}">–</td>`).join("")}
            </tr>
          </tfoot>
        </table>
      </div>
    `;
    app.appendChild(wrap);

    await fillYearAndQuarter(y, YEAR_COLUMNS, INPUT_KEYS, KPI_COLS, activeFunnelId);

    // 🔥 Setup Cell Selection for all remaining cells (thead, tfoot)
    setupRemainingCells();

    if (typeof window.globalZoomInit === "function") {
      window.globalZoomInit();
    }

    function setupRemainingCells() {
      if (!window.CellSelection) return;

      // Header cells (thead)
      const headerCells = document.querySelectorAll('#year-table thead th');
      headerCells.forEach(th => {
        if (window.CellSelection.isSelectableCell(th)) {
          window.CellSelection.setupCell(th, null);
        }
      });

      // Total row cells (tfoot)
      const totalCells = document.querySelectorAll('#year-table tfoot td');
      totalCells.forEach(td => {
        if (window.CellSelection.isSelectableCell(td)) {
          window.CellSelection.setupCell(td, null);
        }
      });
    }
  }

  async function fillYearAndQuarter(y, YEAR_COLUMNS, INPUT_KEYS, KPI_COLS, activeFunnelId) {
    const tbody = document.getElementById("year-body");
    const tfoot = document.getElementById("year-foot");
    tbody.innerHTML = "";

    const spacerRow = tfoot.querySelector(".spacer-row");
    const repeatQuarter = tfoot.querySelectorAll(".repeat-header");
    repeatQuarter.forEach(el => el.remove());
    if (spacerRow) spacerRow.remove();

    for (let m = 0; m < 12; m++) {
      const tr = document.createElement("tr");
      tr.classList.add("month-row");

      const tdMon = document.createElement("td");
      tdMon.textContent = monthShort(y, m).replace(".", "");
      tdMon.style.textAlign = "center";
      tr.appendChild(tdMon);

      // 🔥 Setup Cell Selection for month name
      if (window.CellSelection) {
        window.CellSelection.setupCell(tdMon, null);
      }

      const { totals, hasAny } = await monthTotalsFromStorage(y, m, INPUT_KEYS, activeFunnelId);

      const calc = hasAny
        ? calculateKPIs({
          adspend: totals["Adspend"] || 0,
          impr: totals["Impr"] || 0,
          clicks: totals["Clicks"] || 0,
          leads: totals["Leads"] || 0,
          survey: totals["Survey"] || 0,
          surveyQuali: totals["SurveyQuali"] || 0,
          units: totals["Units"] || 0,
          revenue: totals["Revenue"] || 0,
          cash: totals["Cash"] || 0,
          emailsSent: totals["Emails Sent"] || 0,
          opened: totals["Opened"] || 0,
          callsDialed: totals["Calls Dialed"] || 0,
          reached: totals["Reached"] || 0,
          closingBooking: totals["ClosingBooking"] || 0,
          closingTermin: totals["ClosingTermin"] || 0,
          closingCall: totals["ClosingCall"] || 0,
          settingBooking: totals["SettingBooking"] || 0,
          settingTermin: totals["SettingTermin"] || 0,
          settingCall: totals["SettingCall"] || 0
        })
        : {};

      YEAR_COLUMNS.slice(1).forEach(col => {
        const td = document.createElement("td");

        if (INPUT_KEYS.includes(col)) {
          const v = totals[col];
          td.textContent =
            hasAny && v
              ? ["Adspend", "Revenue", "Cash"].includes(col)
                ? euro.format(v)
                : int0.format(v)
              : "";
        } else if (KPI_COLS.includes(col)) {
          td.textContent = hasAny ? formatValue(calc[col], col) : "";
          td.classList.add("calc");
        }

        // 🔥 Setup Cell Selection for all cells
        if (window.CellSelection) {
          window.CellSelection.setupCell(td, null);
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }

    const totalCells = document.querySelectorAll("#year-summary td[data-key]");
    const totalAgg = {};
    INPUT_KEYS.forEach(k => (totalAgg[k] = 0));

    // 🔥 Async: Lade alle Monate parallel
    const monthPromises = [];
    for (let m = 0; m < 12; m++) {
      monthPromises.push(monthTotalsFromStorage(y, m, INPUT_KEYS, activeFunnelId));
    }
    const allMonthTotals = await Promise.all(monthPromises);
    
    allMonthTotals.forEach(({ totals }) => {
      INPUT_KEYS.forEach(k => (totalAgg[k] += totals[k] || 0));
    });

    const totalKPI = calculateKPIs({
      adspend: totalAgg["Adspend"] || 0,
      impr: totalAgg["Impr"] || 0,
      clicks: totalAgg["Clicks"] || 0,
      leads: totalAgg["Leads"] || 0,
      survey: totalAgg["Survey"] || 0,
      surveyQuali: totalAgg["SurveyQuali"] || 0,
      units: totalAgg["Units"] || 0,
      revenue: totalAgg["Revenue"] || 0,
      cash: totalAgg["Cash"] || 0,
      emailsSent: totalAgg["Emails Sent"] || 0,
      opened: totalAgg["Opened"] || 0,
      callsDialed: totalAgg["Calls Dialed"] || 0,
      reached: totalAgg["Reached"] || 0,
      closingBooking: totalAgg["ClosingBooking"] || 0,
      closingTermin: totalAgg["ClosingTermin"] || 0,
      closingCall: totalAgg["ClosingCall"] || 0,
      settingBooking: totalAgg["SettingBooking"] || 0,
      settingTermin: totalAgg["SettingTermin"] || 0,
      settingCall: totalAgg["SettingCall"] || 0
    });

    totalCells.forEach(td => {
      const key = td.dataset.key;

      if (INPUT_KEYS.includes(key)) {
        const v = totalAgg[key];
        td.textContent = v
          ? ["Adspend", "Revenue", "Cash"].includes(key)
            ? euro.format(v)
            : int0.format(v)
          : "";
      } else if (KPI_COLS.includes(key)) {
        td.textContent = formatValue(totalKPI[key], key);
      }
    });

    const spacer = document.createElement("tr");
    spacer.className = "spacer-row";
    spacer.innerHTML = `<td colspan="${YEAR_COLUMNS.length}"></td>`;
    tfoot.appendChild(spacer);

    const repeatHeaderQuarter = document.createElement("tr");
    repeatHeaderQuarter.className = "repeat-header";
    repeatHeaderQuarter.innerHTML = YEAR_COLUMNS.map((c, i) =>
      `<td>${i === 0 ? "Quartal" : c}</td>`
    ).join("");
    tfoot.appendChild(repeatHeaderQuarter);

    const quarters = {
      Q1: [0, 1, 2],
      Q2: [3, 4, 5],
      Q3: [6, 7, 8],
      Q4: [9, 10, 11]
    };

    // 🔥 Async: Quartale sequenziell verarbeiten
    for (const [label, months] of Object.entries(quarters)) {
      const tr = document.createElement("tr");
      tr.classList.add("quarter-row");
      tr.setAttribute("data-quarter", label);

      const tdQ = document.createElement("td");
      tdQ.textContent = label;
      tdQ.style.textAlign = "center";
      tr.appendChild(tdQ);

      // 🔥 Setup Cell Selection for quarter label
      if (window.CellSelection) {
        window.CellSelection.setupCell(tdQ, null);
      }

      const qAgg = {};
      INPUT_KEYS.forEach(k => (qAgg[k] = 0));
      let hasAny = false;

      // 🔥 Async: Lade alle Monate des Quartals parallel
      const quarterPromises = months.map(m => monthTotalsFromStorage(y, m, INPUT_KEYS, activeFunnelId));
      const quarterTotals = await Promise.all(quarterPromises);
      
      quarterTotals.forEach(({ totals, hasAny: monthHas }) => {
        if (monthHas) {
          INPUT_KEYS.forEach(k => (qAgg[k] += totals[k] || 0));
          hasAny = true;
        }
      });

      const calc = hasAny
        ? calculateKPIs({
          adspend: qAgg["Adspend"] || 0,
          impr: qAgg["Impr"] || 0,
          clicks: qAgg["Clicks"] || 0,
          leads: qAgg["Leads"] || 0,
          survey: qAgg["Survey"] || 0,
          surveyQuali: qAgg["SurveyQuali"] || 0,
          units: qAgg["Units"] || 0,
          revenue: qAgg["Revenue"] || 0,
          cash: qAgg["Cash"] || 0,
          emailsSent: qAgg["Emails Sent"] || 0,
          opened: qAgg["Opened"] || 0,
          callsDialed: qAgg["Calls Dialed"] || 0,
          reached: qAgg["Reached"] || 0,
          closingBooking: qAgg["ClosingBooking"] || 0,
          closingTermin: qAgg["ClosingTermin"] || 0,
          closingCall: qAgg["ClosingCall"] || 0,
          settingBooking: qAgg["SettingBooking"] || 0,
          settingTermin: qAgg["SettingTermin"] || 0,
          settingCall: qAgg["SettingCall"] || 0
        })
        : {};

      YEAR_COLUMNS.slice(1).forEach(col => {
        const td = document.createElement("td");

        if (INPUT_KEYS.includes(col)) {
          const v = qAgg[col];
          td.textContent =
            hasAny && v
              ? ["Adspend", "Revenue", "Cash"].includes(col)
                ? euro.format(v)
                : int0.format(v)
              : "";
        } else if (KPI_COLS.includes(col)) {
          td.textContent = hasAny ? formatValue(calc[col], col) : "";
          td.classList.add("calc");
        }

        // 🔥 Setup Cell Selection for all quarterly cells
        if (window.CellSelection) {
          window.CellSelection.setupCell(td, null);
        }

        tr.appendChild(td);
      });

      tfoot.appendChild(tr);
    }
  }

  window.YearView = { loadYear };
})(window);