
var STORAGE_KEY = "minKorjournal_v1";

let trips = [];

try {
  trips = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!Array.isArray(trips)) trips = [];
} catch (error) {
  trips = [];
}

const $ = id => document.getElementById(id);

// Behåll din befintliga Geoapify-nyckel här
const GEOAPIFY_KEY = "4030ad7ecdff489fa599a25ec91c2a37";

// Datum
function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

// Sortera resor
function sortedTrips() {
  return [...trips].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.id.localeCompare(b.id)
  );
}

// Senaste mätarställning
function latestOdometer() {
  const sorted = sortedTrips();
  return sorted.length ? sorted[sorted.length - 1].kmEnd : "";
}

function setDefaultStartKm() {
  const latest = latestOdometer();
  $("kmStart").value = latest;
  $("currentOdometer").textContent =
    latest === "" ? "Ej registrerad" : latest + " km";
}

function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch (error) {
    alert("Kunde inte spara körjournalen i webbläsaren.");
  }
}

function makeText(tag, text, parent) {
  const el = document.createElement(tag);
  el.textContent = text;
  parent.appendChild(el);
  return el;
}

// Starta formuläret
$("date").value = today();
setDefaultStartKm();

// Spara resa
$("tripForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const start = Number($("kmStart").value);
  const end = Number($("kmEnd").value);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    alert("Ange giltiga mätarställningar.");
    return;
  }

  if (end < start) {
    alert("Km slut kan inte vara lägre än km start.");
    return;
  }

  const editId = $("editId").value;

  const trip = {
    id: editId || String(Date.now()),
    date: $("date").value,
    from: $("from").value.trim(),
    to: $("to").value.trim(),
    purpose: $("purpose").value.trim(),
    kmStart: start,
    kmEnd: end,
    km: Number((end - start).toFixed(1)),
    type: $("type").value
  };

  const index = trips.findIndex(t => t.id === trip.id);

  if (index >= 0) {
    trips[index] = trip;
  } else {
    trips.push(trip);
  }

  saveStorage();

  this.reset();
  $("editId").value = "";
  $("date").value = today();
  $("saveBtn").textContent = "Spara resa";
  $("cancelBtn").hidden = true;

  setDefaultStartKm();
  render();
});

// GPS och adressökning
async function getGPS(fieldId) {
  if (!navigator.geolocation) {
    alert("Din webbläsare stöder inte GPS.");
    return;
  }

  if (!GEOAPIFY_KEY || GEOAPIFY_KEY ===
      "KLISTRA_IN_DIN_BEFINTLIGA_NYCKEL") {
    alert("Kontrollera Geoapify API-nyckeln.");
    return;
  }

  const field = $(fieldId);
  const oldValue = field.value;

  field.value = "Hämtar position...";

  navigator.geolocation.getCurrentPosition(
    async function(position) {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {
        const url =
          "https://api.geoapify.com/v1/geocode/reverse" +
          "?lat=" + lat +
          "&lon=" + lon +
          "&format=json" +
          "&apiKey=" + GEOAPIFY_KEY;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Geoapify svarade med fel " +
            response.status);
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
          field.value = data.results[0].formatted;
        } else {
          field.value = lat.toFixed(6) + ", " +
            lon.toFixed(6);
          alert("Ingen adress hittades. Koordinaterna visas istället.");
        }

      } catch (error) {
        field.value = lat.toFixed(6) + ", " +
          lon.toFixed(6);
        alert("Adressökningen misslyckades: " + error.message);
      }
    },

    function(error) {
      field.value = oldValue;

      let message = "Kunde inte hämta GPS.";

      if (error.code === 1) {
        message = "Platsbehörighet nekad. Tillåt platsåtkomst i webbläsaren.";
      } else if (error.code === 2) {
        message = "GPS-positionen kunde inte fastställas.";
      } else if (error.code === 3) {
        message = "GPS tog för lång tid. Försök igen.";
      }

      alert(message);
    },

    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
}

// GPS-knappar
$("gpsStart").addEventListener("click", function() {
  getGPS("from");
});

$("gpsEnd").addEventListener("click", function() {
  getGPS("to");
});

// Visa statistik och resor
function render() {
  const list = $("tripList");
  list.innerHTML = "";

  const sorted = sortedTrips();

  $("totalTrips").textContent = sorted.length;

  const totalKm = sorted.reduce(
    (sum, t) => sum + Number(t.km || 0), 0
  );

  const serviceKm = sorted
    .filter(t => t.type === "Tjänst")
    .reduce((sum, t) => sum + Number(t.km || 0), 0);

  $("totalKm").textContent = totalKm.toFixed(1);
  $("serviceKm").textContent = serviceKm.toFixed(1);

  sorted.forEach(trip => {
    const item = document.createElement("div");
    item.className = "trip-item";

    makeText("strong", trip.date, item);
    makeText("p", trip.from + " → " + trip.to, item);
    makeText("p", trip.km + " km – " + trip.type, item);

    if (trip.purpose) {
      makeText("p", "Syfte: " + trip.purpose, item);
    }

    const editButton = makeText("button", "Redigera", item);
    editButton.type = "button";
    editButton.addEventListener("click", () => editTrip(trip.id));

    const deleteButton = makeText("button", "Ta bort", item);
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteTrip(trip.id));

    list.appendChild(item);
  });
}

// Redigera resa
function editTrip(id) {
  const trip = trips.find(t => t.id === id);
  if (!trip) return;

  $("editId").value = trip.id;
  $("date").value = trip.date;
  $("from").value = trip.from;
  $("to").value = trip.to;
  $("purpose").value = trip.purpose;
  $("kmStart").value = trip.kmStart;
  $("kmEnd").value = trip.kmEnd;
  $("type").value = trip.type;

  $("saveBtn").textContent = "Uppdatera resa";
  $("cancelBtn").hidden = false;
}

// Ta bort resa
function deleteTrip(id) {
  if (!confirm("Vill du ta bort resan?")) return;

  trips = trips.filter(t => t.id !== id);

  saveStorage();
  setDefaultStartKm();
  render();
}

// Avbryt redigering
$("cancelBtn").addEventListener("click", function() {
  $("tripForm").reset();
  $("editId").value = "";
  $("date").value = today();
  $("saveBtn").textContent = "Spara resa";
  this.hidden = true;

  setDefaultStartKm();
});

// Excel-export
$("exportBtn").addEventListener("click", function() {
  if (!trips.length) {
    alert("Det finns inga resor att exportera.");
    return;
  }

  if (typeof XLSX === "undefined") {
    alert("Excel-funktionen kunde inte laddas.");
    return;
  }

  let savedCompany = {};

try {
  savedCompany = JSON.parse(
    localStorage.getItem("minKorjournal_company_v1") || "{}"
  );
} catch (error) {
  savedCompany = {};
}

const rows = sortedTrips().map(t => ({
  "Företag": savedCompany.name || "",
  "Förare": savedCompany.driver || "",
  "Registreringsnummer": savedCompany.reg || "",
  "Datum": t.date,
  "Från": t.from,
  "Till": t.to,
  "Syfte": t.purpose,
  "Mätarställning start": t.kmStart,
  "Mätarställning slut": t.kmEnd,
  "Körda km": t.km,
  "Typ av resa": t.type
}));
  
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook, worksheet, "Körjournal"
  );

  XLSX.writeFile(workbook, "Min_Korjournal.xlsx");
});

// Visa sparade resor
render();

console.log("Körjournalen är igång.");

/* =========================================
   TILLÄGG TILL KÖRJOURNALEN
   Månadsrapport, sökning, PDF och backup
========================================= */

(function() {
  if (document.getElementById("kj-tools")) return;

  const list = $("tripList");

  // Skapa verktygspanel
  const tools = document.createElement("div");
  tools.id = "kj-tools";

  tools.innerHTML = `
    <h2>Körjournal – rapport och verktyg</h2>

    <h3>Månadsrapport</h3>
    <label>Välj månad:</label>
    <input type="month" id="kjMonth">

    <div id="kjReport" class="kj-report"></div>

    <hr>

    <h3>Sök och filtrera resor</h3>

    <label>Sök resmål eller syfte:</label>
    <input type="text" id="kjSearch"
      placeholder="Sök efter adress eller syfte">

    <div class="kj-filters">
      <div>
        <label>Från datum</label>
        <input type="date" id="kjFrom">
      </div>
      <div>
        <label>Till datum</label>
        <input type="date" id="kjTo">
      </div>
      <div>
        <label>Typ av resa</label>
        <select id="kjType">
          <option value="">Alla resor</option>
          <option value="Tjänst">Tjänst</option>
          <option value="Privat">Privat</option>
        </select>
      </div>
    </div>

    <button type="button" id="kjReset">
      Rensa filter
    </button>

    <hr>

    <h3>Säkerhetskopiering och utskrift</h3>

    <button type="button" id="kjBackup">
      Säkerhetskopiera körjournal
    </button>

    <button type="button" id="kjRestore">
      Återställ säkerhetskopia
    </button>

    <input type="file" id="kjFile"
      accept=".json,application/json" hidden>

    <button type="button" id="kjPrint">
      Skriv ut / Spara som PDF
    </button>

    <p id="kjStatus"></p>
  `;

  list.parentNode.insertBefore(tools, list);

  // Grundläggande utseende
  const style = document.createElement("style");

  style.textContent = `
    #kj-tools {
      margin: 20px 0;
      padding: 18px;
      border: 1px solid #ccc;
      border-radius: 10px;
      background: #f7f8fa;
    }

    #kj-tools h2 {
      margin-top: 0;
    }

    #kj-tools input,
    #kj-tools select {
      box-sizing: border-box;
      padding: 9px;
      margin: 5px 0 12px;
      max-width: 100%;
      width: 100%;
    }

    #kj-tools button {
      padding: 10px 14px;
      margin: 5px 5px 8px 0;
      cursor: pointer;
    }

    .kj-filters {
      display: grid;
      grid-template-columns: repeat(
        auto-fit, minmax(130px, 1fr)
      );
      gap: 10px;
    }

    .kj-report {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 14px;
      margin: 12px 0;
    }

    .kj-report p {
      margin: 8px 0;
    }

    @media print {
      #kj-tools {
        display: none !important;
      }

      button {
        display: none !important;
      }

      body {
        background: white !important;
        color: black !important;
      }

      .trip-item {
        break-inside: avoid;
      }
    }
  `;

  document.head.appendChild(style);

  // Standardmånad
  $("kjMonth").value = today().slice(0, 7);

  // Månadsrapport
  function updateReport() {
    const month = $("kjMonth").value;

    const monthly = trips.filter(t =>
      t.date.startsWith(month)
    );

    const service = monthly
      .filter(t => t.type === "Tjänst")
      .reduce((sum, t) => sum + Number(t.km || 0), 0);

    const privateKm = monthly
      .filter(t => t.type !== "Tjänst")
      .reduce((sum, t) => sum + Number(t.km || 0), 0);

    const total = service + privateKm;

    $("kjReport").innerHTML = `
      <p><strong>Antal resor:</strong>
        ${monthly.length}</p>
      <p><strong>Tjänsteresor:</strong>
        ${service.toFixed(1)} km</p>
      <p><strong>Privatresor:</strong>
        ${privateKm.toFixed(1)} km</p>
      <p><strong>Totalt:</strong>
        ${total.toFixed(1)} km</p>
    `;
  }

  // Sök och filtrera
  function applyFilters() {
    const search = $("kjSearch").value.toLowerCase();
    const from = $("kjFrom").value;
    const to = $("kjTo").value;
    const type = $("kjType").value;

    const items = Array.from(list.children);

    items.forEach(item => {
      const trip = trips.find(
        t => t.id === item.dataset.tripId
      );

      if (!trip) {
        item.hidden = true;
        return;
      }

      const text = [
        trip.from,
        trip.to,
        trip.purpose,
        trip.date
      ].join(" ").toLowerCase();

      const matches =
        text.includes(search) &&
        (!from || trip.date >= from) &&
        (!to || trip.date <= to) &&
        (!type || trip.type === type);

      item.hidden = !matches;
    });
  }

  // Koppla resor till listans element
  const originalRender = render;

  render = function() {
    originalRender();

    const items = Array.from(list.children);
    const sorted = sortedTrips();

    items.forEach((item, index) => {
      if (sorted[index]) {
        item.dataset.tripId = sorted[index].id;
      }
    });

    updateReport();
    applyFilters();
  };

  // Händelser
  ["kjSearch", "kjFrom", "kjTo", "kjType"].forEach(id => {
    $(id).addEventListener("input", applyFilters);
    $(id).addEventListener("change", applyFilters);
  });

  $("kjMonth").addEventListener("change", updateReport);

  $("kjReset").addEventListener("click", function() {
    $("kjSearch").value = "";
    $("kjFrom").value = "";
    $("kjTo").value = "";
    $("kjType").value = "";
    applyFilters();
  });

  // Säkerhetskopiera
  $("kjBackup").addEventListener("click", function() {
    const backup = {
      version: 1,
      created: new Date().toISOString(),
      trips: trips
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "Korjournal_backup_" + today() + ".json";
    a.click();

    URL.revokeObjectURL(url);

    $("kjStatus").textContent =
      "Säkerhetskopian har skapats.";
  });

  // Återställ säkerhetskopia
  $("kjRestore").addEventListener("click", function() {
    $("kjFile").click();
  });

  $("kjFile").addEventListener("change", function() {
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function() {
      try {
        const data = JSON.parse(reader.result);
        const restored = Array.isArray(data)
          ? data
          : data.trips;

        if (!Array.isArray(restored)) {
          throw new Error("Felaktigt filformat.");
        }

        const valid = restored.every(t =>
          t &&
          typeof t.id === "string" &&
          typeof t.date === "string" &&
          typeof t.kmStart === "number" &&
          typeof t.kmEnd === "number" &&
          typeof t.km === "number" &&
          typeof t.from === "string" &&
          typeof t.to === "string"
        );

        if (!valid) {
          throw new Error("Säkerhetskopian innehåller ogiltiga resor.");
        }

        if (!confirm(
          "Vill du ersätta alla nuvarande resor med säkerhetskopian?"
        )) return;

        trips = restored;
        saveStorage();
        setDefaultStartKm();
        render();

        $("kjStatus").textContent =
          "Körjournalen har återställts.";

      } catch (error) {
        alert("Kunde inte återställa: " + error.message);
      }

      $("kjFile").value = "";
    };

    reader.readAsText(file);
  });

  // PDF och utskrift
  $("kjPrint").addEventListener("click", function() {
    updateReport();
    window.print();
  });

  // Uppdatera gränssnittet
  render();

  console.log("Nya körjournalsfunktioner aktiverade.");

})();


/* =========================================
   KÖRJOURNAL PRO – ÅRSRAPPORT OCH FÖRETAG
========================================= */

(function() {
  if (document.getElementById("kj-pro")) return;

  const COMPANY_KEY = "minKorjournal_company_v1";

  let company = {};
  try {
    company = JSON.parse(
      localStorage.getItem(COMPANY_KEY) || "{}"
    );
  } catch (e) {
    company = {};
  }

  const panel = document.createElement("section");
  panel.id = "kj-pro";

  panel.innerHTML = `
    <h2>Företagsuppgifter</h2>

    <label>Företagsnamn</label>
    <input id="kjCompany" placeholder="Företagsnamn">

    <label>Bilens registreringsnummer</label>
    <input id="kjReg" placeholder="ABC123">
    <label>Förare</label>
    <input id="kjDriver" placeholder="Förarens namn">
    <button type="button" id="kjSaveCompany">
      Spara företagsuppgifter
    </button>

    <p id="kjCompanyStatus"></p>

    <hr>

    <h2>Årsrapport</h2>

    <label>Välj år</label>
    <select id="kjYear"></select>

    <div id="kjYearReport"></div>

    <button type="button" id="kjYearPDF">
      Skapa årsrapport PDF
    </button>

    <hr>

    <h2>Kontroll av mätarställning</h2>
    <p>
      Körjournalen kontrollerar att startmätarställningen
      överensstämmer med föregående registrerade resa.
    </p>

    <p id="kjOdometerStatus"></p>
  `;

  const tools = document.getElementById("kj-tools");

  if (tools) {
    tools.appendChild(panel);
  } else {
    document.body.appendChild(panel);
  }

  // Företagsuppgifter
  $("kjCompany").value = company.name || "";
  $("kjReg").value = company.reg || "";
$("kjDriver").value = company.driver || "";
  $("kjSaveCompany").addEventListener("click", function() {
    company = {
      name: $("kjCompany").value.trim(),
     reg: $("kjReg").value.trim(),
     driver: $("kjDriver").value.trim()
    };

    localStorage.setItem(
      COMPANY_KEY,
      JSON.stringify(company)
    );

    $("kjCompanyStatus").textContent =
      "Företagsuppgifterna är sparade.";
  });

  // Årsval
  const yearSelect = $("kjYear");
  const currentYear = new Date().getFullYear();

  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;

    if (y === currentYear) option.selected = true;

    yearSelect.appendChild(option);
  }

  // Säker HTML-text i PDF
  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getYearData() {
    const year = String(yearSelect.value);

    const yearly = sortedTrips().filter(t =>
      t.date.startsWith(year)
    );

    const service = yearly
      .filter(t => t.type === "Tjänst")
      .reduce((sum, t) => sum + Number(t.km || 0), 0);

    const privateKm = yearly
      .filter(t => t.type !== "Tjänst")
      .reduce((sum, t) => sum + Number(t.km || 0), 0);

    return {
      year,
      yearly,
      service,
      privateKm,
      total: service + privateKm
    };
  }

  // Visa årsrapport
  function updateYearReport() {
    const data = getYearData();
    const report = $("kjYearReport");

    report.innerHTML = `
      <div class="kj-pro-card">
        <h3>Sammanställning ${escapeHTML(data.year)}</h3>

        <p><strong>Antal resor:</strong>
          ${data.yearly.length}</p>

        <p><strong>Tjänsteresor:</strong>
          ${data.service.toFixed(1)} km</p>

        <p><strong>Privatresor:</strong>
          ${data.privateKm.toFixed(1)} km</p>

        <p class="kj-total">
          Totalt: ${data.total.toFixed(1)} km
        </p>
      </div>
    `;

    const allYears = sortedTrips()
      .map(t => Number(t.date.slice(0, 4)))
      .filter(Number.isFinite);

    if (allYears.length) {
      $("kjOdometerStatus").textContent =
        "Registrerade resor: " +
        Math.min(...allYears) + "–" +
        Math.max(...allYears);
    } else {
      $("kjOdometerStatus").textContent =
        "Inga resor registrerade ännu.";
    }
  }

  yearSelect.addEventListener("change", updateYearReport);

  // Professionell PDF-rapport
  
$("kjYearPDF").addEventListener("click", function() {
  const data = getYearData();

  if (!data.yearly.length) {
    alert("Det finns inga resor för valt år.");
    return;
  }

  const rows = data.yearly.map(t => `
    <tr>
      <td>${escapeHTML(t.date)}</td>
      <td>${escapeHTML(t.from)}</td>
      <td>${escapeHTML(t.to)}</td>
      <td>${escapeHTML(t.purpose)}</td>
      <td>${escapeHTML(t.type)}</td>
      <td>${t.kmStart}</td>
      <td>${t.kmEnd}</td>
      <td>${Number(t.km).toFixed(1)}</td>
    </tr>
  `).join("");

  const iframe = document.createElement("iframe");

  iframe.style.position = "fixed";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8">
      <title>Körjournal ${escapeHTML(data.year)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 15mm;
          font-size: 11px;
          color: #222;
        }

        h1 { font-size: 24px; }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        th, td {
          border: 1px solid #ccc;
          padding: 6px;
          text-align: left;
        }

        th { background: #eee; }

        .summary {
          margin: 20px 0;
          line-height: 2;
        }

        tr { break-inside: avoid; }

        @media print {
          body { margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <h1>KÖRJOURNAL</h1>
      <h2>Årsrapport ${escapeHTML(data.year)}</h2>

      <p>
       Företag: ${escapeHTML(JSON.parse(localStorage.getItem("minKorjournal_company_v1") || "{}").name || "Ej angivet")}<br>
       Förare: ${escapeHTML(JSON.parse(localStorage.getItem("minKorjournal_company_v1") || "{}").driver || "Ej angivet")}<br>
       Registreringsnummer: ${escapeHTML(JSON.parse(localStorage.getItem("minKorjournal_company_v1") || "{}").reg || "Ej angivet")}<br>
       Utskriftsdatum: ${new Date().toLocaleDateString("sv-SE")}<br>
      </p>

      <h3>Årssammanställning</h3>

      <div class="summary">
        Tjänsteresor: ${data.service.toFixed(1)} km<br>
        Privata resor: ${data.privateKm.toFixed(1)} km<br>
        <strong>Totalt: ${data.total.toFixed(1)} km</strong>
      </div>

      <h3>Samtliga resor</h3>

      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Från</th>
            <th>Till</th>
            <th>Syfte</th>
            <th>Typ</th>
            <th>Km start</th>
            <th>Km slut</th>
            <th>Km</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `);
  doc.close();

  iframe.onload = function() {
    setTimeout(function() {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      iframe.contentWindow.onafterprint = function() {
        iframe.remove();
      };
    }, 500);
  };
});


  // Kontrollera mätarställning före befintlig sparfunktion
  $("tripForm").addEventListener("submit", function(e) {
    const editId = $("editId").value;

    const previous = sortedTrips()
      .filter(t =>
        t.id !== editId &&
        t.date <= $("date").value
      );

    if (!previous.length) return;

    const last = previous[previous.length - 1];
    const start = Number($("kmStart").value);

    if (start !== Number(last.kmEnd)) {
      const proceed = confirm(
        "VARNING: Startmätarställningen (" + start +
        " km) stämmer inte med föregående resa (" +
        last.kmEnd + " km).\n\nVill du spara resan ändå?"
      );

      if (!proceed) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
  }, true);

  // Mobilanpassning
  const mobileStyle = document.createElement("style");

  mobileStyle.textContent = `
    #kj-pro {
      margin: 22px 0;
      padding: 18px;
      border: 1px solid #ccc;
      border-radius: 10px;
      background: #f7f8fa;
    }

    #kj-pro input,
    #kj-pro select {
      box-sizing: border-box;
      display: block;
      width: 100%;
      max-width: 100%;
      padding: 12px;
      margin: 7px 0 15px;
      border-radius: 6px;
      border: 1px solid #aaa;
    }

    #kj-pro button {
      padding: 12px 18px;
      margin: 7px 5px 12px 0;
      border-radius: 6px;
      cursor: pointer;
    }

    .kj-pro-card {
      background: white;
      padding: 15px;
      margin: 15px 0;
      border: 1px solid #ddd;
      border-radius: 8px;
    }

    .kj-total {
      font-size: 19px;
      font-weight: bold;
    }

    @media(max-width: 600px) {
      #kj-tools, #kj-pro {
        padding: 12px;
      }

      #kj-tools button,
      #kj-pro button {
        width: 100%;
        min-height: 46px;
        margin: 6px 0;
      }

      .trip-item {
        padding: 12px;
        margin-bottom: 12px;
      }
    }
  `;

  document.head.appendChild(mobileStyle);

  updateYearReport();

  console.log("Körjournal PRO är aktiverad.");

})();
