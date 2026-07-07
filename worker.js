// 한국에서 살아남기 — ranking API (Cloudflare D1)
// GET  /api/rank?mode=student|worker  → top 20
// POST /api/rank {name, score, mode, ending} → insert

const MAX_SCORE = 450; // 100*3 stats + 30 days * 5

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (url.pathname === "/api/rank") {
      if (req.method === "GET") {
        const mode = url.searchParams.get("mode") === "worker" ? "worker" : "student";

        // Edge cache 60s to save D1 reads
        const cache = caches.default;
        const cacheKey = new Request(url.origin + "/api/rank?mode=" + mode);
        const hit = await cache.match(cacheKey);
        if (hit) return hit;

        try {
          const { results } = await env.DB.prepare(
            "SELECT name, score, ending FROM ranks WHERE mode = ?1 ORDER BY score DESC, id ASC LIMIT 20"
          ).bind(mode).all();
          const res = json({ ok: true, ranks: results }, 200, {
            "cache-control": "public, max-age=60",
          });
          ctx.waitUntil(cache.put(cacheKey, res.clone()));
          return res;
        } catch (e) {
          return json({ ok: false, error: "db" }, 500);
        }
      }

      if (req.method === "POST") {
        let body;
        try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }

        const name = String(body.name || "").trim().slice(0, 8);
        const score = Number(body.score);
        const mode = body.mode === "worker" ? "worker" : "student";
        const ending = String(body.ending || "").slice(0, 24);

        if (!name) return json({ ok: false, error: "name" }, 400);
        if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE)
          return json({ ok: false, error: "score" }, 400);

        try {
          await env.DB.prepare(
            "INSERT INTO ranks (name, score, mode, ending, created_at) VALUES (?1, ?2, ?3, ?4, datetime('now'))"
          ).bind(name, score, mode, ending).run();

          const better = await env.DB.prepare(
            "SELECT COUNT(*) AS c FROM ranks WHERE mode = ?1 AND score > ?2"
          ).bind(mode, score).first();

          return json({ ok: true, rank: (better?.c ?? 0) + 1 });
        } catch (e) {
          return json({ ok: false, error: "db" }, 500);
        }
      }

      return json({ ok: false, error: "method" }, 405);
    }

    return env.ASSETS.fetch(req);
  },
};
