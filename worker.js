// celtic Worker: serves ./site and proxies a small set of API-Football endpoints under /api/*.
// Forked from the manutd.wiki Worker (SITE1); the cache design is the same:
//  - Every upstream answer is stored in KV for TTL seconds and kept 7 days beyond that. A stale copy is served at once while
//    one background refresh runs, so a visitor never waits on the API and never sees its errors.
//  - A cron warms the core endpoints hourly. Error answers are never cached.
// The key lives in the API_FOOTBALL_KEY secret. Never put it in the repo or in chat.

const TEAM = 247;         // Celtic in API-Football (checked 5 Nov 2026)
const LEAGUES = { prem: 179 };   // Scottish Premiership (checked 5 Nov 2026)
const API = "https://v3.football.api-sports.io";
const KEEP = 7 * 24 * 3600;

function season(now = new Date()) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  return m >= 7 ? y : y - 1;   // API-Football labels 2026/27 as 2026
}
function num(u, k) { return String(parseInt(u.searchParams.get(k) || "0", 10) || 0); }

const ROUTES = {
  "/api/status":    { ttl: 300,   path: () => `/status` },
  "/api/fixtures":  { ttl: 1800,  path: () => `/fixtures?team=${TEAM}&season=${season()}` },
  "/api/standings": { ttl: 1800,  path: () => `/standings?league=${LEAGUES.prem}&season=${season()}` },
  "/api/prem":      { ttl: 1200,  path: () => `/fixtures?league=${LEAGUES.prem}&season=${season()}`, slim: (j) => slimFixtures("prem", j) },
  "/api/leaders":   { ttl: 10800, path: (u) => `/players/top${u.searchParams.get("k") === "assists" ? "assists" : "scorers"}?league=${LEAGUES.prem}&season=${season()}`, slim: slimLeaders },
  "/api/squad":     { ttl: 21600, path: () => `/players/squads?team=${TEAM}` },
  "/api/injuries":  { ttl: 3600,  path: () => `/injuries?team=${TEAM}&season=${season()}` },
  "/api/players":   { ttl: 10800, path: (u) => `/players?team=${TEAM}&season=${season()}&page=${u.searchParams.get("page") || 1}` },
  "/api/player":    { ttl: 86400, path: (u) => `/players?id=${num(u, "id")}&season=${u.searchParams.get("season") || season()}` },
  "/api/match":     { ttl: 21600, live: true, path: (u) => `/fixtures?id=${num(u, "fixture")}` },
  "/api/lineups":   { ttl: 86400, path: (u) => `/fixtures/lineups?fixture=${num(u, "fixture")}` },
  "/api/events":    { ttl: 86400, path: (u) => `/fixtures/events?fixture=${num(u, "fixture")}` },
  "/api/fixture-stats": { ttl: 86400, path: (u) => `/fixtures/statistics?fixture=${num(u, "fixture")}` },
  "/api/season-fixtures": { ttl: 30 * 86400, path: (u) => `/fixtures?team=${TEAM}&season=${num(u, "season")}` },   // past seasons, for the archive builders
  "/api/season-standings": { ttl: 30 * 86400, path: (u) => `/standings?league=${LEAGUES.prem}&season=${num(u, "season")}` },
};
function slimFixtures(tag, j) { return { get: tag, season: season(), results: (j.response || []).length, response: (j.response || []).map((m) => ({ id: m.fixture.id, date: m.fixture.date, ts: m.fixture.timestamp, st: m.fixture.status.short, min: m.fixture.status.elapsed, venue: m.fixture.venue && m.fixture.venue.name || "", round: m.league.round, home: { id: m.teams.home.id, name: m.teams.home.name, logo: m.teams.home.logo }, away: { id: m.teams.away.id, name: m.teams.away.name, logo: m.teams.away.logo }, goals: m.goals, ht: m.score && m.score.halftime || null, pen: m.score && m.score.penalty && m.score.penalty.home != null ? m.score.penalty : null })) }; }
function slimLeaders(j) { return { results: (j.response || []).length, response: (j.response || []).slice(0, 20).map((p) => { const s = (p.statistics || [])[0] || {}, g = s.goals || {}, gm = s.games || {}; return { id: p.player.id, name: p.player.name, first: p.player.firstname, last: p.player.lastname, team: s.team ? { id: s.team.id, name: s.team.name, logo: s.team.logo } : null, g: g.total || 0, a: g.assists || 0, apps: gm.appearences || 0, min: gm.minutes || 0, pen: (s.penalty || {}).scored || 0 }; }) }; }
const WARM = ["/api/fixtures", "/api/standings", "/api/squad"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/img/player/")) return portrait(url, ctx);
    if (url.pathname === "/wiki") return wiki(url, env, ctx);
    if (url.pathname === "/wiki-raw") return wikiRaw(url, env, ctx);
    if (url.pathname === "/wiki-rev") return wikiRev(url, env, ctx);
    if (url.pathname === "/wiki-page") return wikiPage(url, env, ctx);
    if (!url.pathname.startsWith("/api/")) {
      const res = await env.ASSETS.fetch(request), h = new Headers(res.headers);
      h.set("x-robots-tag", "noindex");   // until Richard launches the site
      return new Response(res.body, { status: res.status, headers: h });
    }
    const route = ROUTES[url.pathname];
    if (!route) return json({ error: "unknown route" }, 404);
    if (!env.API_FOOTBALL_KEY) return json({ error: "API_FOOTBALL_KEY secret not set on the Worker" }, 500);

    const key = "api:v1:" + url.pathname + url.search;
    const { body, fresh, age } = await load(env, key);
    if (route.live && body) {
      // Live window: from 90 minutes before kick-off until the match is finished, anything older than 60s is stale.
      try { const j = JSON.parse(body), f = j.response && j.response[0]; if (f) { const ko = f.fixture.timestamp * 1000, st = f.fixture.status.short, now = Date.now();
        const inWindow = (now > ko - 90 * 60000 && !/FT|AET|PEN|CANC|PST|ABD|AWD|WO/.test(st)) || /1H|HT|2H|ET|BT|P|LIVE|INT|SUSP/.test(st);
        const ours = f.teams.home.id === TEAM || f.teams.away.id === TEAM, staleAfter = ours ? 60 : 900;
        if (inWindow && age > staleAfter) { ctx.waitUntil(refresh(env, key, route, url)); return answer(body, "kv-live-stale", age); } if (inWindow) return answer(body, "kv-live", age); } } catch (e) {}
    }
    if (body && fresh) return answer(body, "kv-hit", age);
    if (body) { ctx.waitUntil(refresh(env, key, route, url)); return answer(body, "kv-stale", age); }
    const r = await refresh(env, key, route, url);
    return r.ok ? answer(r.body, "upstream", 0) : new Response(r.body, { status: 200, headers: headers("upstream-error") });
  },

  async scheduled(event, env, ctx) {
    if (!env.API_FOOTBALL_KEY) return;
    ctx.waitUntil((async () => {
      for (const p of WARM) {
        const url = new URL("https://celtic.local" + p), route = ROUTES[url.pathname], key = "api:v1:" + url.pathname + url.search;
        const { body, age } = await load(env, key);
        if (body && age < route.ttl * 0.8) continue;
        await refresh(env, key, route, url);
        await sleep(1200);
      }
    })());
  },
};

async function load(env, key) {
  const raw = await env.MU_CACHE.get(key);
  if (!raw) return { body: null };
  const nl = raw.indexOf("\n"), nl2 = raw.indexOf("\n", nl + 1);
  const stamp = parseInt(raw.slice(0, nl), 10), ttl = parseInt(raw.slice(nl + 1, nl2), 10);
  const age = Math.floor(Date.now() / 1000) - stamp;
  return { body: raw.slice(nl2 + 1), fresh: age < ttl, age };
}

// Fetch with a few retries on the per-minute cap; store only clean answers.
async function refresh(env, key, route, url) {
  let upstream, body = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      upstream = await fetch(API + route.path(url), { headers: { "x-apisports-key": env.API_FOOTBALL_KEY }, cf: { cacheTtl: 0 } });
      body = await upstream.text();
    } catch (e) { body = JSON.stringify({ errors: { network: String(e) } }); }
    if (!/"rateLimit"/.test(body)) break;
    await sleep(1500 + attempt * 1500);
  }
  let clean = false;
  try { const j = JSON.parse(body); clean = !!upstream && upstream.ok && j && (Array.isArray(j.errors) ? j.errors.length === 0 : Object.keys(j.errors || {}).length === 0) && !j.message; } catch (e) {}
  if (clean && route.slim) { try { body = JSON.stringify(route.slim(JSON.parse(body))); } catch (e) {} }
  if (clean) await env.MU_CACHE.put(key, Math.floor(Date.now() / 1000) + "\n" + route.ttl + "\n" + body, { expirationTtl: route.ttl + KEEP });
  return { ok: clean, body };
}

function headers(src, age) {
  return { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=120", "access-control-allow-origin": "*", "x-source": src, "x-age": String(age || 0) };
}
function answer(body, src, age) { return new Response(body, { status: 200, headers: headers(src, age) }); }
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: headers("worker") }); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }


// Player portraits from API-Football's media host, cached at the edge for a day and sent with CORS
// so the team-picker's PNG export can draw them. No API quota is used for these.
async function portrait(url, ctx) {
  const m = url.pathname.match(/^\/img\/player\/(\d+)\.png$/);
  if (!m) return new Response("not found", { status: 404 });
  const cache = caches.default, key = new Request(url.origin + "/__img/v1/" + m[1]);
  const hit = await cache.match(key);
  if (hit) return hit;
  const up = await fetch("https://media.api-sports.io/football/players/" + m[1] + ".png", { cf: { cacheTtl: 86400 } });
  if (!up.ok) return new Response("not found", { status: 404 });
  const res = new Response(up.body, { status: 200, headers: { "content-type": "image/png", "cache-control": "public, max-age=86400", "access-control-allow-origin": "*" } });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

// RSS/Atom → JSON for the Links page. Only the feeds listed here can be requested (no open proxy).
// Cached in KV for 30 minutes.

// ---- Wikipedia player profile → JSON (summary + parsed football-biography infobox), cached 7 days.
async function wiki(url, env, ctx) {
  let title = (url.searchParams.get("title") || "").trim(), q = (url.searchParams.get("q") || "").trim();
  if (!title && !q) return json({ error: "title or q required" }, 400);
  const UA = { "user-agent": "celtic-club-site/1.0 (richardmcallister@gmail.com)", "accept": "application/json" };
  if (!title) {
    // Resolve an abbreviated name ("K. Mainoo") to an article title via search.
    const qkey = "wiki:q:v4:" + q.toLowerCase();
    let hit = await env.MU_CACHE.get(qkey);
    if (!hit) {
      const surname = q.replace(/^[A-Z]\. ?/, "").split(" ").pop();
      const r = await fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=" + encodeURIComponent('hastemplate:"Infobox football biography" ' + q.replace(/^[A-Z]\. ?/, "") + " Celtic"), { headers: UA });
      const j = r.ok ? await r.json() : null;
      const list = j && j.query ? j.query.search : [];
      // Surname must be a whole word of the title (so "O. Martin" cannot land on "Martin Dúbravka"), and when the query
      // carries an initial the title's first name must start with it; fall back to the plain surname match, then nothing.
      const ini = (q.match(/^([A-Z])\. ?/) || [])[1], sn = surname.toLowerCase(), base = (t) => t.replace(/\s*\(.*\)$/, "");
      const word = (t) => base(t).toLowerCase().split(/[\s-]+/).indexOf(sn) >= 0 && base(t).toLowerCase().split(/[\s-]+/).indexOf(sn) > 0;
      const pick = list.filter((x) => word(x.title) && (!ini || base(x.title)[0].toUpperCase() === ini))[0] || (!ini ? (list.filter((x) => word(x.title))[0] || list.filter((x) => x.title.toLowerCase().indexOf(sn) >= 0)[0]) : null);
      hit = pick ? pick.title : "";
      if (hit) ctx.waitUntil(env.MU_CACHE.put(qkey, hit, { expirationTtl: 30 * 86400 }));
    }
    if (!hit) return json({ error: "not found", q }, 404);
    title = hit;
  }
  const key = "wiki:p:v10:" + title;
  const cached = url.searchParams.get("debug") ? null : await env.MU_CACHE.get(key);
  if (cached) return new Response(cached, { headers: headers("kv-hit") });
  const enc = encodeURIComponent(title.replace(/ /g, "_"));
  const [sr, wr, ir] = await Promise.all([
    fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + enc, { headers: UA }),
    fetch("https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&redirects=1&page=" + enc, { headers: UA }),
    fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&generator=images&gimlimit=30&prop=imageinfo&iiprop=url|mime&iiurlwidth=640&titles=" + enc, { headers: UA }),
  ]);
  let sum = sr.ok ? await sr.json() : {};
  let wj = wr.ok ? await wr.json() : {};
  let ij = ir.ok ? await ir.json() : {};
  let wt = wj.parse && wj.parse.wikitext ? wj.parse.wikitext["*"] : "";
  let box = parseInfobox(wt);
  if ((sum.type === "disambiguation" || !box) && !url.searchParams.get("noretry")) {
    // Wrong article (a disambiguation page, or no football infobox): try the "(footballer)" title, then a biography search.
    const tries = [title + " (footballer)", title + " (Irish footballer)", title + " (Scottish footballer)", title + " (English footballer)"];
    let found = null;
    for (const t of tries) {
      const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(t.replace(/ /g, "_")), { headers: UA });
      if (r.ok) { const j = await r.json(); if (j.type !== "disambiguation" && /footballer|football manager|football player|soccer/i.test(j.description || "")) { found = j.title; break; } }
    }
    if (!found) {
      const r = await fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=" + encodeURIComponent('hastemplate:"Infobox football biography" "' + title.replace(/ \(.*\)$/, "") + '" Celtic'), { headers: UA });
      const j = r.ok ? await r.json() : null; const hit = j && j.query && j.query.search[0];
      if (hit) found = hit.title;
    }
    if (found && found !== title) { const u2 = new URL(url.toString()); u2.searchParams.set("title", found); u2.searchParams.set("noretry", "1"); return wiki(u2, env, ctx); }
  }
  if (url.searchParams.get("debug")) { const i0 = wt.search(/\{\{\s*Infobox football biography/i); return json({ keys: box && box._keys, raw: wt.slice(i0, i0 + 6000) }); }
  // Photos from the article: real photographs only (no SVG icons, flags, crests, maps).
  const images = Object.values((ij.query && ij.query.pages) || {}).filter((pg) => pg.imageinfo && pg.imageinfo[0] && /image\/(jpeg|png)/.test(pg.imageinfo[0].mime) && !/flag|logo|crest|badge|icon|map|kit|shirt|signature|wikimedia|commons-logo|stadium/i.test(pg.title))
    .map((pg) => ({ title: pg.title.replace(/^File:/, ""), thumb: pg.imageinfo[0].thumburl || pg.imageinfo[0].url, url: pg.imageinfo[0].descriptionurl || pg.imageinfo[0].url })).slice(0, 12);
  const out = { title: sum.title || title, description: sum.description || "", extract: sum.extract || "", thumbnail: sum.thumbnail ? sum.thumbnail.source : "", thumb: sum.thumbnail ? { w: sum.thumbnail.width, h: sum.thumbnail.height, ow: sum.originalimage && sum.originalimage.width || 0 } : null, original: sum.originalimage ? sum.originalimage.source : "", url: sum.content_urls ? sum.content_urls.desktop.page : "https://en.wikipedia.org/wiki/" + enc, infobox: box, images };
  const body = JSON.stringify(out);
  if (sum.title) ctx.waitUntil(env.MU_CACHE.put(key, body, { expirationTtl: 7 * 86400 }));
  return new Response(body, { headers: headers(sum.title ? "upstream" : "upstream-empty") });
}
function boxFields(wt, re) {
  const i = wt.search(re);
  if (i < 0) return null;
  let depth = 0, j = i;
  for (; j < wt.length; j++) { if (wt.startsWith("{{", j)) { depth++; j++; } else if (wt.startsWith("}}", j)) { depth--; j++; if (depth === 0) break; } }
  const body = wt.slice(i + 2, j - 1);
  const parts = []; let cur = "", d = 0, b = 0;
  for (let k = 0; k < body.length; k++) {
    const c2 = body.substr(k, 2);
    if (c2 === "{{") { d++; cur += c2; k++; continue; } if (c2 === "}}") { d--; cur += c2; k++; continue; }
    if (c2 === "[[") { b++; cur += c2; k++; continue; } if (c2 === "]]") { b--; cur += c2; k++; continue; }
    if (body[k] === "|" && d === 0 && b === 0) { parts.push(cur); cur = ""; continue; }
    cur += body[k];
  }
  parts.push(cur);
  const f = {};
  parts.slice(1).forEach((p) => { const m = p.match(/^\s*([\w\- ]+?)\s*=\s*([\s\S]*)$/); if (m) f[m[1].toLowerCase().replace(/[_\s]/g, "")] = wtClean(m[2]); });
  return f;
}
function parseInfobox(wt) {
  const f = boxFields(wt, /\{\{\s*Infobox football biography/i);
  if (!f) return null;
  if (f.embed) {
    // Football box embedded in a general biography box (actors, pundits…): personal details live in the outer box.
    const outer = boxFields(wt, /\{\{\s*Infobox (?:person|sportsperson|football official)/i) || {};
    ["name", "fullname", "birthname", "birthdate", "birthplace", "deathdate", "height"].forEach((k) => { if (!f[k] && outer[k]) f[k] = outer[k]; });
    if (!f.fullname && outer.birthname) f.fullname = outer.birthname;
  }
  const rows = (pre, keys) => { const out = []; for (let n = 1; n < 40; n++) { const r = {}; let any = false; keys.forEach((k) => { const v = f[pre + k + n]; if (v !== undefined && v !== "") any = true; r[k] = v || ""; }); if (!any) { if (n > 3) break; else continue; } if (r.clubs || r.team) out.push(r); } return out; };
  return {
    _keys: Object.keys(f),
    name: f.name || "", fullname: f.fullname || "", birth_date: f.birthdate || "", birth_place: f.birthplace || "", death_date: f.deathdate || "", height: f.height || "", position: f.position || "", currentclub: f.currentclub || "", clubnumber: f.clubnumber || "",
    youth: rows("youth", ["years", "clubs"]), clubs: rows("", ["years", "clubs", "caps", "goals"]), national: rows("national", ["years", "team", "caps", "goals"]), manager: rows("manager", ["years", "clubs"]),
    totalcaps: f.totalcaps || "", totalgoals: f.totalgoals || "",
  };
}
// Reduce wikitext to plain text: refs out, links to their label, common templates to their value.
function wtClean(v) {
  let s = String(v);
  s = s.replace(/<ref[^>]*\/>/g, "").replace(/<ref[\s\S]*?<\/ref>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<br\s*\/?>/gi, " ");
  for (let n = 0; n < 4; n++) {
    s = s.replace(/\{\{\s*(?:birth date and age|birth date|death date and age|death date|bda|dda|birth-date and age|birth-date)\s*\|([^}]*)\}\}/gi, (m, args) => { const n = args.split("|").map((x) => x.trim()).filter((x) => /^\d+$/.test(x)); return n.length >= 3 ? n[0] + "-" + n[1].padStart(2, "0") + "-" + n[2].padStart(2, "0") : (n[0] || ""); });
    s = s.replace(/\{\{\s*(?:birth year and age|death year and age)\s*\|\s*(\d{4})[^}]*\}\}/gi, "$1");
    s = s.replace(/\{\{\s*(?:convert|cvt)\s*\|\s*(\d+)\s*\|\s*ft\s*\|\s*([\d.]+)\s*\|\s*in[^}]*\}\}/gi, (m, ft, inch) => ((parseInt(ft, 10) * 12 + parseFloat(inch)) * 0.0254).toFixed(2) + " m");
    s = s.replace(/\{\{\s*height\s*\|[^}]*ft\s*=\s*(\d+)[^}]*in\s*=\s*([\d.]+)[^}]*\}\}/gi, (m, ft, inch) => ((parseInt(ft, 10) * 12 + parseFloat(inch)) * 0.0254).toFixed(2) + " m");
    s = s.replace(/\{\{\s*(?:height|convert|cvt)\s*\|\s*(?:m\s*=\s*)?([\d.]+)\s*(?:\|\s*m)?[^}]*\}\}/gi, (m, x) => (parseFloat(x) < 3 ? x + " m" : x));
    s = s.replace(/\{\{\s*(?:nowrap|nobr|nobold|nbsp|small|lang|flagicon|flagu|flag|fb|fbu|fbw|plainlist|hlist|ubl|unbulleted list|dts|date|start date|end date)\s*\|([^{}]*)\}\}/gi, (m, x) => x.split("|").filter((p) => !/=/.test(p)).join(" · "));
    s = s.replace(/\{\{\s*0\s*\|[^{}]*\}\}/g, "");          // {{0|0000}} spacing pad
    s = s.replace(/\{\{\s*[^{}|]*\s*\}\}/g, "");
  }
  for (let n = 0; n < 5 && /\{\{/.test(s); n++) s = s.replace(/\{\{[^{}]*\}\}/g, "");   // anything else left over, innermost first
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/\[https?:[^\s\]]*\s?([^\]]*)\]/g, "$1");
  s = s.replace(/'{2,}/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return s;
}


// ---- Academy & loan watch: one composite report, cached in KV, rebuilt by the cron and on demand when stale.

// ---- raw wikitext of one article (cached a day) — used by the build scripts that compile squad numbers.
async function wikiRaw(url, env, ctx) {
  const title = (url.searchParams.get("title") || "").trim(); if (!title) return json({ error: "title required" }, 400);
  const rev = (url.searchParams.get("rev") || "").replace(/\D/g, "");   // build scripts pass the revision they expect, so a changed article is never served from cache
  const key = "wiki:raw:v1:" + title + (rev ? "@" + rev : ""), cached = await env.MU_CACHE.get(key);
  if (cached) return new Response(cached, { headers: { "content-type": "text/plain; charset=utf-8", "x-source": "kv-hit" } });
  const UA = { "user-agent": "celtic-club-site/1.0 (richardmcallister@gmail.com)", "accept": "application/json" };
  const r = await fetch("https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&redirects=1&page=" + encodeURIComponent(title.replace(/ /g, "_")), { headers: UA });
  const j = r.ok ? await r.json() : {};
  const wt = j.parse && j.parse.wikitext ? j.parse.wikitext["*"] : "";
  if (!wt) return json({ error: "no article", title }, 404);
  ctx.waitUntil(env.MU_CACHE.put(key, wt, { expirationTtl: 86400 }));
  return new Response(wt, { headers: { "content-type": "text/plain; charset=utf-8", "x-source": "upstream" } });
}


// Plain article summary (lead paragraph, thumbnail, link) for any title — rivalry articles and the like; a week in KV.
async function wikiPage(url, env, ctx) {
  const title = (url.searchParams.get("title") || "").trim(); if (!title) return json({ error: "title required" }, 400);
  const key = "wiki:pg:v1:" + title, cached = await env.MU_CACHE.get(key);
  if (cached) return new Response(cached, { headers: headers("kv-hit") });
  const UA = { "user-agent": "celtic-club-site/1.0 (richardmcallister@gmail.com)", "accept": "application/json" };
  const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_")), { headers: UA });
  if (!r.ok) return json({ error: "no article", title }, 404);
  const j = await r.json(), out = { title: j.title, description: j.description || "", extract: j.extract || "", thumbnail: j.thumbnail ? j.thumbnail.source : "", original: j.originalimage ? j.originalimage.source : "", url: j.content_urls ? j.content_urls.desktop.page : "" };
  const body = JSON.stringify(out); ctx.waitUntil(env.MU_CACHE.put(key, body, { expirationTtl: 7 * 86400 }));
  return new Response(body, { headers: headers("upstream") });
}

// Latest revision id for up to 50 titles ("|"-separated), so the build scripts only re-parse articles that have changed.
async function wikiRev(url, env, ctx) {
  const titles = (url.searchParams.get("titles") || "").split("|").map((t) => t.trim()).filter(Boolean).slice(0, 50);
  if (!titles.length) return json({ error: "titles required" }, 400);
  const UA = { "user-agent": "celtic-club-site/1.0 (richardmcallister@gmail.com)", "accept": "application/json" };
  const r = await fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&prop=revisions&rvprop=ids&redirects=1&titles=" + encodeURIComponent(titles.join("|")), { headers: UA });
  const j = r.ok ? await r.json() : {}, out = {}, back = {};
  for (const x of (j.query && j.query.redirects) || []) back[x.to] = x.from;
  for (const x of (j.query && j.query.normalized) || []) back[x.to] = back[x.to] || x.from;
  for (const p of Object.values((j.query && j.query.pages) || {})) { const rev = p.revisions && p.revisions[0] ? p.revisions[0].revid : null; out[p.title] = rev; if (back[p.title]) out[back[p.title]] = rev; }
  return json(out);
}
