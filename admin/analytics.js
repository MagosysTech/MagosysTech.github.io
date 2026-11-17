const form = document.getElementById("analyticsConnection");
const statusMessage = document.getElementById("dashboardStatus");
const submitButton = form.querySelector('button[type="submit"]');
const totalVisits = document.getElementById("totalVisits");
const deviceTotals = document.getElementById("deviceTotals");
const dailyTotals = document.getElementById("dailyTotals");
const visitRows = document.getElementById("visitRows");
const apiValue = document.querySelector('meta[name="analytics-api-url"]').content.trim();
document.getElementById("apiUrlDisplay").textContent = apiValue || "Sin configurar";

const deviceNames = {
    mobile: "Móvil",
    tablet: "Tableta",
    desktop: "Escritorio"
};

function setStatus(message, state) {
    statusMessage.textContent = message;
    statusMessage.dataset.state = state;
}

function setList(target, values, labelFor, emptyMessage) {
    target.replaceChildren();

    if (!values.length) {
        const item = document.createElement("li");
        item.textContent = emptyMessage;
        target.append(item);
        return;
    }

    values.forEach((value) => {
        const item = document.createElement("li");
        const label = document.createElement("span");
        const count = document.createElement("strong");
        label.textContent = labelFor(value);
        count.textContent = new Intl.NumberFormat("es-AR").format(value.visits);
        item.append(label, count);
        target.append(item);
    });
}

function renderVisits(visits) {
    visitRows.replaceChildren();

    if (!visits.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.className = "empty-state";
        cell.textContent = "Todavía no hay visitas registradas.";
        row.append(cell);
        visitRows.append(row);
        return;
    }

    visits.forEach((visit) => {
        const row = document.createElement("tr");
        const dateCell = document.createElement("td");
        const pathCell = document.createElement("td");
        const deviceCell = document.createElement("td");
        const referrerCell = document.createElement("td");
        const eventCell = document.createElement("td");
        const eventCode = document.createElement("code");
        const date = new Date(Number(visit.created_at) * 1000);

        dateCell.textContent = Number.isNaN(date.getTime())
            ? "Fecha no disponible"
            : new Intl.DateTimeFormat("es-AR", {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(date);
        pathCell.textContent = visit.page_path;
        deviceCell.textContent = deviceNames[visit.device_category] || "Otro";
        referrerCell.textContent = visit.referrer_origin || "Directo";
        eventCode.textContent = visit.event_id;
        eventCell.append(eventCode);
        row.append(dateCell, pathCell, deviceCell, referrerCell, eventCell);
        visitRows.append(row);
    });
}

async function getJson(apiBase, path, token) {
    const response = await fetch(`${apiBase}${path}`, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { Authorization: `Bearer ${token}` }
    });

    let data;
    try {
        data = await response.json();
    } catch (error) {
        throw new Error("La API devolvió una respuesta que no es JSON.");
    }

    if (!response.ok) {
        throw new Error(data.error || `La API respondió con HTTP ${response.status}.`);
    }

    return data;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = document.getElementById("adminToken").value.trim();
    const days = document.getElementById("periodDays").value;
    let apiBase;

    try {
        if (!apiValue) {
            throw new Error("La URL de la API aún no está configurada en esta página.");
        }
        const apiUrl = new URL(apiValue);
        if (
            (apiUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(apiUrl.hostname)) ||
            apiUrl.username ||
            apiUrl.password ||
            apiUrl.search ||
            apiUrl.hash
        ) {
            throw new Error("Usa una URL HTTPS válida para la API.");
        }
        apiBase = apiUrl.href.replace(/\/+$/, "");
    } catch (error) {
        setStatus(error.message || "La URL de la API no es válida.", "error");
        return;
    }

    submitButton.disabled = true;
    setStatus("Consultando la API…", "pending");

    try {
        const [summary, recent] = await Promise.all([
            getJson(apiBase, `/v1/admin/summary?days=${encodeURIComponent(days)}`, token),
            getJson(apiBase, "/v1/admin/visits?limit=100", token)
        ]);

        totalVisits.textContent = new Intl.NumberFormat("es-AR").format(summary.totalVisits);
        setList(
            deviceTotals,
            summary.devices,
            (device) => deviceNames[device.device] || "Otro",
            "Sin visitas en este período."
        );
        setList(
            dailyTotals,
            summary.dailyVisits,
            (day) => day.day,
            "Sin visitas en este período."
        );
        renderVisits(recent.visits);
        setStatus("Datos actualizados correctamente.", "success");
    } catch (error) {
        console.error("No se pudieron consultar las métricas.", error);
        setStatus(error.message || "No se pudieron consultar las métricas.", "error");
    } finally {
        submitButton.disabled = false;
    }
});
