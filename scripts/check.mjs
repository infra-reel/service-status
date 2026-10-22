import fs from 'node:fs';
const sites = JSON.parse(fs.readFileSync('sites.json', 'utf8'));
const MAX = 2000; // 5分間隔で約7日分
let data = { sites: {} };
try { data = JSON.parse(fs.readFileSync('status.json', 'utf8')); } catch {}
data.sites ??= {};
const now = new Date().toISOString();

async function probe(url) {
  const t = Date.now();
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
      headers: { 'user-agent': 'github-pages-status-checker' },
    });
    return { ok: r.status < 400, code: r.status, ms: Date.now() - t };
  } catch {
    return { ok: false, code: 0, ms: Date.now() - t };
  }
}

await Promise.all(sites.map(async (s) => {
  let r = await probe(s.url);
  if (!r.ok) r = await probe(s.url); // 一時的な失敗は1回だけ再試行
  const e = (data.sites[s.url] ??= { name: s.name, checks: [] });
  e.name = s.name;
  e.checks.push({ t: now, ...r });
  e.checks = e.checks.slice(-MAX);
}));

const urls = new Set(sites.map((s) => s.url));
for (const u of Object.keys(data.sites)) if (!urls.has(u)) delete data.sites[u];

data.updated = now;
fs.writeFileSync('status.json', JSON.stringify(data));
