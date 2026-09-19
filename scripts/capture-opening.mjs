/**
 * Captures the opening frame of the live experience as the images the startup
 * cover shows while the 3D scene loads (`#startup-cover` in `index.html`).
 *
 * The image has to BE the first live frame, not a picture of the room: the
 * cover crossfades from it straight into the canvas, so any difference in
 * pose, framing, exposure or asset quality is exactly what the visitor sees
 * change. So it is taken from the running build, at the moment the scene is
 * first revealed — progress 0, the boot-quality textures and 512px sky it is
 * revealed with, the same post-processing — and before `deferredAssets.js`
 * starts upgrading anything (1.2s after the reveal). The script refuses to
 * write an image if an upgrade has already begun.
 *
 * Only the canvas: the wordmark, side navigation, captions, grain and every
 * other DOM overlay are hidden for the capture, because they stay live
 * elements over the image and would otherwise appear twice.
 *
 * The camera's field of view is a fixed 45 degrees VERTICAL, so a frame
 * captured at a wide aspect, shown with `object-fit: cover`, is exactly what
 * the live camera renders at any NARROWER aspect — the same projection,
 * cropped at the sides. A frame is never valid for a WIDER screen than it was
 * captured at (cover would zoom it instead of widening it), which is why the
 * compositions below each serve downward from their own aspect.
 *
 * Run against a production build being served locally:
 *
 *     npm run build && npx vite preview --port 4173 &
 *     npm i --no-save puppeteer-core sharp
 *     CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *       node scripts/capture-opening.mjs http://localhost:4173/
 */
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/assets/startup')
const URL_ = process.argv[2] || 'http://localhost:4173/'
const CHROME = process.env.CHROME_PATH
if (!CHROME) throw new Error('Set CHROME_PATH to a Chrome or Chromium executable.')

/**
 * Captured at a device-pixel ratio of 1.75 — the renderer's own cap, and so the
 * ratio every high-density screen is actually drawn at. Depth of field, GTAO
 * and the dust are sized in device pixels, so a frame captured at DPR 1 and
 * scaled up does not just look softer than the live one, it has a different
 * blur; the first capture here did exactly that and read as a focus pull
 * through the crossfade. The CSS heights are the class of screen each image is
 * for (a 900px-tall desktop, an 844px-tall phone), so on those the image maps
 * onto the canvas nearly pixel for pixel.
 *
 * Three compositions because the camera's field of view is fixed vertically:
 * each covers every aspect from its own down to the next one's.
 */
const DPR = 1.75
const COMPOSITIONS = [
  { name: 'ultrawide', width: 3200, height: 900 },  // 32:9 — serves above 2:1
  { name: 'landscape', width: 1800, height: 900 },  // 2:1  — serves 3:4 to 2:1
  { name: 'portrait', width: 633, height: 844 },    // 3:4  — serves below 3:4
]
const ONLY = process.argv[3]?.split(',')

/**
 * WebP only. AVIF was measured at the same visual quality and came out 2-4%
 * smaller (73.4kB against 76.5kB for landscape, 45.6kB against 45.8kB for
 * portrait) — not enough to justify a second format per composition, a
 * slower decode, and twice the `<source>` elements in the page's markup.
 */
const WEBP = { quality: 72, effort: 6, smartSubsample: true }

mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--hide-scrollbars'],
})

for (const { name, width, height } of COMPOSITIONS) {
  if (ONLY && !ONLY.includes(name)) continue
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: DPR })
  await page.evaluateOnNewDocument(() => {
    const observer = new MutationObserver(() => {
      const cover = document.getElementById('startup-cover')
      if (cover?.classList.contains('startup-cover--revealing') && !window.__revealedAt) window.__revealedAt = performance.now()
      if (window.__revealedAt && !cover && !window.__coverGoneAt) window.__coverGoneAt = performance.now()
    })
    document.addEventListener('DOMContentLoaded', () => observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true }))
  })
  await page.goto(URL_, { waitUntil: 'domcontentloaded' })
  // The cover has finished fading and been removed: what is on screen is the
  // first live frame and nothing else.
  await page.waitForFunction(() => window.__coverGoneAt, { timeout: 120000 })
  await page.evaluate(() => {
    const root = document.getElementById('root')
    for (const child of root.children) if (!child.classList.contains('app-shell')) child.style.visibility = 'hidden'
  })
  await new Promise((resolve) => setTimeout(resolve, 150))
  const upgradeStarted = await page.evaluate(() => performance.getEntriesByName('prop:camera:start').length > 0 || performance.getEntriesByName('sky:start').length > 0)
  if (upgradeStarted) throw new Error(`${name}: a deferred upgrade had already started; the frame would not match the reveal.`)
  const png = await page.screenshot({ type: 'png' })
  await page.close()

  const file = join(OUT, `opening-${name}.webp`)
  writeFileSync(file, await sharp(png).webp(WEBP).toBuffer())
  console.log(`${name.padEnd(10)} ${Math.round(width * DPR)}x${Math.round(height * DPR)}  ${statSync(file).size} B`)
}
await browser.close()
