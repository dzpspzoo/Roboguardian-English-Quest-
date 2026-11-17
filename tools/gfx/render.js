// Podgląd: node tools/gfx/render.js plik.svg wynik.png [szerokość] [tło]
const { chromium } = require('playwright');
(async () => {
  const [,, inp, out, w = '0', bg = '#8899aa'] = process.argv;
  const fs = require('fs');
  const src = fs.readFileSync(inp, 'utf8');
  const m = src.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const vw = +m[1], vh = +m[2];
  const W = +w || vw, H = Math.round(W * vh / vw);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.setContent(`<html><body style="margin:0;background:${bg}">${src.replace('<svg ', `<svg style="width:${W}px;height:${H}px;display:block" `)}</body></html>`);
  await p.screenshot({ path: out });
  await b.close();
})();
