const MAX_BODY_BYTES = 2048;
const MAX_RETENTION_DAYS = 90;
const ALLOWED_DEVICES = new Set(["mobile", "tablet", "desktop"]);
const encoder = new TextEncoder();

function jsonResponse(body, status, origin, allowedOrigins) {
    const headers = {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Vary": "Origin"
    };

    if (origin && allowedOrigins.has(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
    }

    return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

function getAllowedOrigins(env) {
    return new Set(
        (env.ALLOWED_ORIGINS || "")
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean)
    );
}

async function readJson(request) {
    const contentLength = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        return { error: "El cuerpo supera el tamaño permitido.", status: 413 };
    }

    if (!request.body) {
        return { error: "Se requiere un cuerpo JSON.", status: 400 };
    }

    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        size += value.byteLength;
        if (size > MAX_BODY_BYTES) {
            await reader.cancel();
            return { error: "El cuerpo supera el tamaño permitido.", status: 413 };
        }

        chunks.push(value);
    }

    const payload = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        payload.set(chunk, offset);
        offset += chunk.byteLength;
    }

    try {
        return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload)) };
    } catch {
        return { error: "El cuerpo debe contener JSON válido.", status: 400 };
    }
}

function validateVisit(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return "El evento de visita no tiene un formato válido.";
    }

    const allowedKeys = new Set(["path", "referrerOrigin", "device"]);
    if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
        return "El evento contiene campos no permitidos.";
    }

    if (
        typeof value.path !== "string" ||
        value.path.length > 255 ||
        !value.path.startsWith("/") ||
        value.path.startsWith("//") ||
        value.path.includes("?") ||
        value.path.includes("#") ||
        value.path.includes("\\") ||
        /[\u0000-\u001f]/.test(value.path)
    ) {
        return "La ruta de la página no es válida.";
    }

    if (!ALLOWED_DEVICES.has(value.device)) {
        return "La categoría del dispositivo no es válida.";
    }

    if (value.referrerOrigin !== null) {
        if (typeof value.referrerOrigin !== "string" || value.referrerOrigin.length > 255) {
            return "El origen de referencia no es válido.";
        }

        try {
            const referrer = new URL(value.referrerOrigin);
            if (
                !["http:", "https:"].includes(referrer.protocol) ||
                referrer.origin !== value.referrerOrigin
            ) {
                return "El origen de referencia no es válido.";
            }
        } catch {
            return "El origen de referencia no es válido.";
        }
    }

    return null;
}

async function allowRequest(request, env, scope) {
    const address = request.headers.get("CF-Connecting-IP");
    if (!address || !env.VISIT_RATE_LIMITER) {
        return { allowed: false, available: false };
    }

    try {
        const { success } = await env.VISIT_RATE_LIMITER.limit({ key: `${scope}:${address}` });
        return { allowed: success, available: true };
    } catch (error) {
        console.error("No se pudo comprobar el límite de solicitudes.", error);
        return { allowed: false, available: false };
    }
}

async function tokenMatches(provided, expected) {
    const [providedDigest, expectedDigest] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(provided)),
        crypto.subtle.digest("SHA-256", encoder.encode(expected))
    ]);
    const left = new Uint8Array(providedDigest);
    const right = new Uint8Array(expectedDigest);
    let difference = 0;

    for (let index = 0; index < left.length; index += 1) {
        difference |= left[index] ^ right[index];
    }

    return difference === 0;
}

async function handleVisit(request, env, origin, allowedOrigins) {
    const contentType = request.headers.get("Content-Type")?.split(";")[0].trim();
    if (contentType !== "application/json") {
        return jsonResponse({ error: "Se requiere Content-Type application/json." }, 415, origin, allowedOrigins);
    }

    const parsed = await readJson(request);
    if (parsed.error) {
        return jsonResponse({ error: parsed.error }, parsed.status, origin, allowedOrigins);
    }

    const validationError = validateVisit(parsed.value);
    if (validationError) {
        return jsonResponse({ error: validationError }, 400, origin, allowedOrigins);
    }

    try {
        await env.DB.prepare(
            "INSERT INTO visit_events (event_id, page_path, referrer_origin, device_category) VALUES (?, ?, ?, ?)"
        ).bind(
            crypto.randomUUID(),
            parsed.value.path,
            parsed.value.referrerOrigin,
            parsed.value.device
        ).run();
    } catch (error) {
        console.error("No se pudo guardar el evento de visita.", error);
        return jsonResponse({ error: "No se pudo registrar la visita." }, 503, origin, allowedOrigins);
    }

    return jsonResponse({ recorded: true }, 201, origin, allowedOrigins);
}

async function authorizeAdmin(request, env) {
    const expected = env.ADMIN_API_TOKEN;
    const authorization = request.headers.get("Authorization") || "";
    const provided = authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length)
        : "";

    if (!expected || expected.length < 32 || !provided) {
        return false;
    }

    return tokenMatches(provided, expected);
}

async function handleAdmin(request, env, url, origin, allowedOrigins) {
    const rateLimit = await allowRequest(request, env, "admin");
    if (!rateLimit.available) {
        return jsonResponse({ error: "El control de solicitudes no está disponible." }, 503, origin, allowedOrigins);
    }
    if (!rateLimit.allowed) {
        return jsonResponse({ error: "Límite de solicitudes alcanzado." }, 429, origin, allowedOrigins);
    }

    if (!env.ADMIN_API_TOKEN || env.ADMIN_API_TOKEN.length < 32) {
        return jsonResponse({ error: "La API administrativa no está configurada." }, 503, origin, allowedOrigins);
    }

    if (!await authorizeAdmin(request, env)) {
        return jsonResponse({ error: "Credenciales inválidas." }, 401, origin, allowedOrigins);
    }

    try {
        if (url.pathname === "/v1/admin/summary") {
            const days = Number(url.searchParams.get("days") || 30);
            if (!Number.isInteger(days) || days < 1 || days > MAX_RETENTION_DAYS) {
                return jsonResponse({ error: "El período debe estar entre 1 y 90 días." }, 400, origin, allowedOrigins);
            }

            const cutoff = `-${days} days`;
            const [totals, daily, devices] = await Promise.all([
                env.DB.prepare(
                    "SELECT COUNT(*) AS visits FROM visit_events WHERE created_at >= CAST(strftime('%s', 'now', ?) AS INTEGER)"
                ).bind(cutoff).first(),
                env.DB.prepare(
                    "SELECT strftime('%Y-%m-%d', created_at, 'unixepoch') AS day, COUNT(*) AS visits FROM visit_events WHERE created_at >= CAST(strftime('%s', 'now', ?) AS INTEGER) GROUP BY day ORDER BY day DESC"
                ).bind(cutoff).all(),
                env.DB.prepare(
                    "SELECT device_category AS device, COUNT(*) AS visits FROM visit_events WHERE created_at >= CAST(strftime('%s', 'now', ?) AS INTEGER) GROUP BY device_category ORDER BY visits DESC"
                ).bind(cutoff).all()
            ]);

            return jsonResponse({
                days,
                totalVisits: totals?.visits || 0,
                dailyVisits: daily.results || [],
                devices: devices.results || []
            }, 200, origin, allowedOrigins);
        }

        const limit = Number(url.searchParams.get("limit") || 100);
        if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
            return jsonResponse({ error: "El límite debe estar entre 1 y 200." }, 400, origin, allowedOrigins);
        }

        const { results } = await env.DB.prepare(
            "SELECT event_id, created_at, page_path, referrer_origin, device_category FROM visit_events ORDER BY created_at DESC LIMIT ?"
        ).bind(limit).all();

        return jsonResponse({ visits: results || [] }, 200, origin, allowedOrigins);
    } catch (error) {
        console.error("No se pudieron consultar las visitas.", error);
        return jsonResponse({ error: "No se pudieron consultar las visitas." }, 503, origin, allowedOrigins);
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get("Origin");
        const allowedOrigins = getAllowedOrigins(env);

        if (request.method === "OPTIONS") {
            if (!origin || !allowedOrigins.has(origin)) {
                return jsonResponse({ error: "Origen no permitido." }, 403, origin, allowedOrigins);
            }

            const response = jsonResponse(null, 204, origin, allowedOrigins);
            response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
            response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.headers.set("Access-Control-Max-Age", "86400");
            return response;
        }

        if (origin && !allowedOrigins.has(origin)) {
            return jsonResponse({ error: "Origen no permitido." }, 403, origin, allowedOrigins);
        }

        if (url.pathname === "/health" && request.method === "GET") {
            try {
                await env.DB.prepare("SELECT 1 AS ok").first();
                return jsonResponse({ status: "ok" }, 200, origin, allowedOrigins);
            } catch (error) {
                console.error("La base de datos no está disponible.", error);
                return jsonResponse({ error: "La base de datos no está disponible." }, 503, origin, allowedOrigins);
            }
        }

        if (!origin || !allowedOrigins.has(origin)) {
            return jsonResponse({ error: "Se requiere un origen autorizado." }, 403, origin, allowedOrigins);
        }

        if (!env.DB || !env.VISIT_RATE_LIMITER) {
            return jsonResponse({ error: "La API no está configurada completamente." }, 503, origin, allowedOrigins);
        }

        if (url.pathname === "/v1/visits" && request.method === "POST") {
            const rateLimit = await allowRequest(request, env, "visits");
            if (!rateLimit.available) {
                return jsonResponse({ error: "El control de solicitudes no está disponible." }, 503, origin, allowedOrigins);
            }
            if (!rateLimit.allowed) {
                return jsonResponse({ error: "Límite de solicitudes alcanzado." }, 429, origin, allowedOrigins);
            }

            return handleVisit(request, env, origin, allowedOrigins);
        }

        if (
            (url.pathname === "/v1/admin/summary" || url.pathname === "/v1/admin/visits") &&
            request.method === "GET"
        ) {
            return handleAdmin(request, env, url, origin, allowedOrigins);
        }

        return jsonResponse({ error: "Ruta no encontrada." }, 404, origin, allowedOrigins);
    },

    scheduled(_controller, env, context) {
        context.waitUntil(
            env.DB.prepare(
                "DELETE FROM visit_events WHERE created_at < CAST(strftime('%s', 'now', '-90 days') AS INTEGER)"
            ).run()
        );
    }
};
