(() => {
    const apiValue = document.querySelector('meta[name="analytics-api-url"]')?.content.trim();
    const consentPanel = document.getElementById("analyticsConsent");
    const preferencesButton = document.getElementById("analyticsPreferences");
    const status = document.getElementById("analyticsConsentStatus");

    if (!apiValue || !consentPanel || !preferencesButton) return;

    let apiBase;
    try {
        const apiUrl = new URL(apiValue);
        if (apiUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(apiUrl.hostname)) {
            throw new Error("La API de analítica debe usar HTTPS.");
        }
        apiBase = apiUrl.href.replace(/\/+$/, "");
    } catch (error) {
        console.error("La URL de la API de analítica no es válida.", error);
        return;
    }

    if (navigator.globalPrivacyControl === true || ["1", "yes"].includes(navigator.doNotTrack)) {
        return;
    }

    const consentKey = "magosys-analytics-consent-v1";
    let savedConsent;
    try {
        savedConsent = localStorage.getItem(consentKey);
    } catch (error) {
        console.error("No se pudo consultar la preferencia de privacidad.", error);
        return;
    }

    preferencesButton.hidden = false;

    function getDeviceCategory() {
        if (window.matchMedia("(max-width: 767px)").matches) return "mobile";
        if (window.matchMedia("(max-width: 1023px)").matches) return "tablet";
        return "desktop";
    }

    function getReferrerOrigin() {
        if (!document.referrer) return null;

        try {
            const referrer = new URL(document.referrer);
            return referrer.origin === window.location.origin ? null : referrer.origin;
        } catch (error) {
            console.error("No se pudo interpretar el origen de referencia.", error);
            return null;
        }
    }

    async function recordVisit() {
        try {
            const response = await fetch(`${apiBase}/v1/visits`, {
                method: "POST",
                mode: "cors",
                credentials: "omit",
                keepalive: true,
                referrerPolicy: "no-referrer",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: window.location.pathname,
                    referrerOrigin: getReferrerOrigin(),
                    device: getDeviceCategory()
                })
            });

            if (!response.ok) {
                console.error(`La API de analítica respondió con HTTP ${response.status}.`);
            }
        } catch (error) {
            console.error("No se pudo registrar la visita anónima.", error);
        }
    }

    function saveChoice(choice) {
        try {
            localStorage.setItem(consentKey, choice);
        } catch (error) {
            status.textContent = "No se pudo guardar tu preferencia. La analítica permanecerá desactivada.";
            console.error("No se pudo guardar la preferencia de privacidad.", error);
            return false;
        }

        consentPanel.hidden = true;
        status.textContent = "";
        if (choice === "accepted") recordVisit();
        return true;
    }

    document.getElementById("acceptAnalytics")?.addEventListener("click", () => {
        saveChoice("accepted");
    });

    document.getElementById("rejectAnalytics")?.addEventListener("click", () => {
        saveChoice("rejected");
    });

    preferencesButton.addEventListener("click", () => {
        status.textContent = "";
        consentPanel.hidden = false;
    });

    if (savedConsent === "accepted") {
        consentPanel.hidden = true;
        recordVisit();
    } else if (savedConsent === "rejected") {
        consentPanel.hidden = true;
    } else {
        consentPanel.hidden = false;
    }
})();
