// فحص شامل قبل كل إصدار:  node tools/preflight.js [ملف.html]
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const file = path.resolve(process.argv[2] || 'prayer_times.html'), dir = path.dirname(file);
const MT = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u === '/' ? file : path.join(dir, u.replace(/^\//, '')); if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MT[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const CFG = [['phone-ar-sepia', 390, 844, 'sepia', 'ar', false], ['phone-ar-dark-adv', 390, 844, 'dark', 'ar', false], ['phone-en-light', 390, 844, 'light', 'en', false], ['simple', 390, 844, 'sepia', 'ar', true], ['tablet', 1100, 900, 'sepia', 'ar', false]];
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port; const b = await chromium.launch(); let bad = 0; const out = [];
  const html = fs.readFileSync(file, 'utf8'); const ver = (html.match(/APP_VER = '([^']+)'/) || [])[1];
  const ar = (html.match(/\n {4}[A-Za-z0-9_]+:'/g) || []).length; out.push('الإصدار ' + ver);
  for (const [name, w, h, theme, lang, simple] of CFG) {
    const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.addInitScript(([th, lg, sm, v]) => { localStorage.setItem('pt-hints', '{"off":1}'); localStorage.setItem('pt-ohhint', '"1"'); localStorage.setItem('pt-thmig', '1'); localStorage.setItem('pt-appver', JSON.stringify(v)); localStorage.setItem('pt-settings', JSON.stringify({ onboarded: true, simple: sm, theme: th, lang: lg })); }, [theme, lang, simple, ver]);
    await p.goto('http://localhost:' + port + '/'); await p.waitForTimeout(1500);
    const res = await p.evaluate(async () => {
      const r = { dup: [], unnamed: 0, overflow: [], tabs: [] };
      const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; }); r.dup = Object.keys(ids).filter(k => ids[k] > 1);
      const tabs = [...document.querySelectorAll('.nav-btn[data-tab]')].map(b => b.dataset.tab);
      for (const t of tabs) { const bt = document.querySelector('.nav-btn[data-tab="' + t + '"]'); bt.click(); await new Promise(x => setTimeout(x, 350));
        r.tabs.push(t); if (document.documentElement.scrollWidth > innerWidth + 2) r.overflow.push(t);
        document.querySelectorAll('button').forEach(b => { if (b.offsetParent && !(b.textContent.trim() || b.getAttribute('aria-label') || b.title)) r.unnamed++; }); }
      return r; });
    const sub = await p.evaluate(async () => { const o = []; const sec = [...document.querySelectorAll('[data-sec]')].map(x => x.dataset.sec); document.querySelector('.nav-btn[data-tab=settings]').click(); await new Promise(x => setTimeout(x, 300));
      for (const s of sec) { const bt = document.querySelector('[data-sec="' + s + '"]'); if (bt) { bt.click(); await new Promise(x => setTimeout(x, 250)); if (document.documentElement.scrollWidth > innerWidth + 2) o.push('settings/' + s); } } return o; });
    const issues = [...errs, ...res.dup.map(d => 'معرّف مكرر: ' + d), ...(res.unnamed ? ['أزرار بلا اسم: ' + res.unnamed] : []), ...res.overflow.map(t => 'تجاوز أفقي: ' + t), ...sub.map(t => 'تجاوز أفقي: ' + t)];
    out.push((issues.length ? 'خلل ' : 'سليم ') + name + ' [' + res.tabs.length + ' تبويبات]'); issues.forEach(i => out.push('   - ' + i)); bad += issues.length; await c.close(); }
  await b.close(); srv.close(); console.log(out.join('\n')); process.exit(bad ? 1 : 0);
})();
