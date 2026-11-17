import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

const TOKEN = "test-admin-token-with-at-least-32-characters";
const SITE_ORIGIN = "https://magosystech.github.io";

function createEnvironment() {
    const events = [];
    const database = {
        prepare(query) {
            return {
                bind(...values) {
                    return {
                        async run() {
                            if (query.startsWith("INSERT INTO visit_events")) {
                                events.push({
                                    event_id: values[0],
                                    page_path: values[1],
                                    referrer_origin: values[2],
                                    device_category: values[3]
                                });
                            }
                            return { success: true };
                        },
                        async first() {
                            if (query.includes("SELECT 1 AS ok")) return { ok: 1 };
                            if (query.includes("COUNT(*) AS visits")) return { visits: events.length };
                            return null;
                        },
                        async all() {
                            if (query.includes("GROUP BY day")) {
                                return { results: [{ day: "2026-11-16", visits: events.length }] };
                            }
                            if (query.includes("GROUP BY device_category")) {
                                return { results: [{ device: "desktop", visits: events.length }] };
                            }
                            if (query.includes("SELECT event_id")) {
                                return {
                                    results: events.map((event) => ({
                                        ...event,
                                        created_at: 1_794_829_440
                                    })).slice(0, values[0])
                                };
                            }
                            return { results: [] };
                        }
                    };
                }
            };
        }
    };

    return {
        events,
        env: {
            DB: database,
            VISIT_RATE_LIMITER: { limit: async () => ({ success: true }) },
            ADMIN_API_TOKEN: TOKEN,
            ALLOWED_ORIGINS: `${SITE_ORIGIN},http://localhost:8000`
        }
    };
}

function request(path, { method = "GET", headers = {}, body } = {}) {
    return new Request(`https://api.example.test${path}`, {
        method,
        headers: {
            Origin: SITE_ORIGIN,
            "CF-Connecting-IP": "203.0.113.10",
            ...headers
        },
        body
    });
}

describe("analytics worker", () => {
    let env;
    let events;

    beforeEach(() => {
        ({ env, events } = createEnvironment());
    });

    it("allows preflight only from a configured origin", async () => {
        const response = await worker.fetch(request("/v1/visits", { method: "OPTIONS" }), env);
        assert.equal(response.status, 204);
        assert.equal(response.headers.get("Access-Control-Allow-Origin"), SITE_ORIGIN);

        const blocked = await worker.fetch(new Request("https://api.example.test/v1/visits", {
            method: "OPTIONS",
            headers: { Origin: "https://attacker.example" }
        }), env);
        assert.equal(blocked.status, 403);
    });

    it("stores an opted-in anonymous visit without an IP or identity", async () => {
        const response = await worker.fetch(request("/v1/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                path: "/servicios",
                referrerOrigin: "https://search.example",
                device: "mobile"
            })
        }), env);

        assert.equal(response.status, 201);
        assert.equal(events.length, 1);
        assert.equal(events[0].page_path, "/servicios");
        assert.equal(events[0].referrer_origin, "https://search.example");
        assert.equal(events[0].device_category, "mobile");
        assert.equal(JSON.stringify(events[0]).includes("203.0.113.10"), false);
    });

    it("rejects identity fields and query strings instead of storing them", async () => {
        const response = await worker.fetch(request("/v1/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                path: "/servicios?email=persona@example.com",
                referrerOrigin: null,
                device: "desktop"
            })
        }), env);

        assert.equal(response.status, 400);
        assert.equal(events.length, 0);

        const extraField = await worker.fetch(request("/v1/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                path: "/",
                referrerOrigin: null,
                device: "desktop",
                email: "persona@example.com"
            })
        }), env);

        assert.equal(extraField.status, 400);
        assert.equal(events.length, 0);
    });

    it("requires the admin token and returns aggregate and bounded visit data", async () => {
        const unauthorized = await worker.fetch(request("/v1/admin/summary"), env);
        assert.equal(unauthorized.status, 401);

        await worker.fetch(request("/v1/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: "/", referrerOrigin: null, device: "desktop" })
        }), env);

        const headers = { Authorization: `Bearer ${TOKEN}` };
        const summary = await worker.fetch(request("/v1/admin/summary?days=30", { headers }), env);
        assert.equal(summary.status, 200);
        assert.equal((await summary.json()).totalVisits, 1);

        const visits = await worker.fetch(request("/v1/admin/visits?limit=10", { headers }), env);
        assert.equal(visits.status, 200);
        assert.equal((await visits.json()).visits.length, 1);
    });

    it("rejects invalid limits and applies the configured rate limiter", async () => {
        const invalidPeriod = await worker.fetch(request("/v1/admin/summary?days=365", {
            headers: { Authorization: `Bearer ${TOKEN}` }
        }), env);
        assert.equal(invalidPeriod.status, 400);

        env.VISIT_RATE_LIMITER.limit = async () => ({ success: false });
        const limited = await worker.fetch(request("/v1/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: "/", referrerOrigin: null, device: "desktop" })
        }), env);
        assert.equal(limited.status, 429);
        assert.equal(events.length, 0);
    });

    it("rate-limits admin requests before checking credentials", async () => {
        env.VISIT_RATE_LIMITER.limit = async ({ key }) => {
            assert.equal(key, "admin:203.0.113.10");
            return { success: false };
        };

        const response = await worker.fetch(request("/v1/admin/summary"), env);
        assert.equal(response.status, 429);
    });

    it("reports rate limiter failures as service unavailable", async () => {
        env.VISIT_RATE_LIMITER.limit = async () => {
            throw new Error("rate limiter unavailable");
        };

        const response = await worker.fetch(request("/v1/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: "/", referrerOrigin: null, device: "desktop" })
        }), env);

        assert.equal(response.status, 503);
        assert.equal(events.length, 0);
    });

    it("reports database health without exposing configuration", async () => {
        const response = await worker.fetch(request("/health"), env);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: "ok" });
    });
});
