// Renders a motion source in this folder to a hero video.
//
//   node motion/render.js websites                 → assets/video/websites-hero.{mp4,webm,jpg}
//   node motion/render.js websites --frames 0 6 13 → tmp_websites_<t>.png stills to review timing
//   node motion/render.js websites --poster        → only assets/video/websites-hero.jpg, from POSTER_T
//
// The scene is stepped one exact frame at a time (window.render(t)) rather
// than screen-recorded, so the output never stutters or drops frames, and each
// PNG is piped straight into ffmpeg without touching the disk.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const name = process.argv[2];
if (!name) { console.error('usage: node motion/render.js <scene> [--frames t1 t2 …] [--poster]'); process.exit(1); }
const FPS = 30, SCALE = 1.5;
// x264 quality; VP9 runs 12 higher on its own scale. A scene that moves the
// camera every frame costs far more bits than one that doesn't — 27 keeps flat
// colour clean at roughly a third of the size of 23. Override: --crf N.
const ci = process.argv.indexOf('--crf');
const CRF = ci > -1 ? Number(process.argv[ci + 1]) : 27;          // a 720×720 scene renders at 1080×1080, 1280×720 at 1920×1080
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets', 'video');

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SCALE });
  await ctx.addInitScript(() => { window.__RENDER__ = true; });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.join(__dirname, name + '.html')).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });
  if (!(await page.evaluate(() => document.fonts.check('600 16px Inter')))) throw new Error('Inter did not load — refusing to render with a fallback font');
  // A scene declares its own size (window.SIZE, default 1280×720) and the time
  // of its poster frame (window.POSTER_T, default 0).
  const cfg = await page.evaluate(() => ({ dur: window.DURATION, size: window.SIZE || [1280, 720], poster: window.POSTER_T || 0 }));
  await page.setViewportSize({ width: cfg.size[0], height: cfg.size[1] });
  const dur = cfg.dur;
  const shot = async (t, opts) => { await page.evaluate(t => window.render(t), t); return page.screenshot(opts || { type: 'png' }); };

  const fi = process.argv.indexOf('--frames');
  if (fi > -1) {
    for (const t of process.argv.slice(fi + 1).map(Number)) {
      fs.writeFileSync(path.join(root, `tmp_${name}_${t}.png`), await shot(t));
      console.log('still ' + t + 's');
    }
    await br.close();
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  // The poster doubles as the reduced-motion still, and the page starts
  // playback at the same moment so nothing jumps when the video takes over.
  // --poster re-cuts just this still when POSTER_T moves; the video is unchanged.
  fs.writeFileSync(path.join(outDir, `${name}-hero.jpg`), await shot(cfg.poster, { type: 'jpeg', quality: 84 }));
  if (process.argv.includes('--poster')) {
    console.log(`poster ${name}-hero.jpg (t=${cfg.poster}s)`);
    await br.close();
    return;
  }

  // One pass, two files. H.264 is decoded in hardware almost everywhere, so it
  // is listed first; level 4.0 is all 1080p30 needs and keeps older phone
  // decoders happy (libx264 otherwise picks 5.0). VP9 WebM is the fallback for
  // browsers built without H.264 — open-source Chromium, including the one
  // Playwright ships.
  const mp4 = path.join(outDir, `${name}-hero.mp4`);
  const webm = path.join(outDir, `${name}-hero.webm`);
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-map', '0', '-c:v', 'libx264', '-preset', 'slower', '-tune', 'animation', '-crf', String(CRF),
    '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4,
    '-map', '0', '-c:v', 'libvpx-vp9', '-crf', String(CRF + 12), '-b:v', '0', '-row-mt', '1',
    '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', webm
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))));

  const frames = Math.round(dur * FPS);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const buf = await shot(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log('frame ' + i + '/' + frames);
  }
  ff.stdin.end();
  await done;
  await br.close();
  const kb = f => Math.round(fs.statSync(f).size / 1024);
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s — ${cfg.size[0] * SCALE}×${cfg.size[1] * SCALE}, mp4 ${kb(mp4)} KB, webm ${kb(webm)} KB, poster ${kb(mp4.replace('.mp4', '.jpg'))} KB (t=${cfg.poster}s)`);
})().catch(e => { console.error(e); process.exit(1); });
