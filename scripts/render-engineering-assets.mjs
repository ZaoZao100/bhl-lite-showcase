import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
})

await mkdir('public/renders', { recursive: true })

const prepareRenderPage = async ({ exploded = false, drag = null } = {}) => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 })
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 20000 })
  await page.getByRole('button', { name: '重置视角' }).click()
  if (exploded) {
    await page.getByRole('button', { name: '探索结构' }).click()
    await page.waitForTimeout(1450)
  }
  await page.addStyleTag({ content: `
    html, body, #root, .app { width: 100%; height: 100%; overflow: hidden !important; background: #03080c !important; }
    .app > * { display: none !important; }
    .app > .hero { display: block !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; min-height: 0 !important; }
    .hero > * { display: none !important; }
    .hero > .stage { display: block !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; }
    .stage > * { display: none !important; }
    .stage > .viewer { display: block !important; position: absolute !important; inset: 0 !important; }
    .viewer canvas { display: block !important; }
    .hero::before { display: none !important; }
  ` })
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await page.waitForTimeout(900)
  if (drag) {
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width * .5, box.y + box.height * .48)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * (.5 + drag.x), box.y + box.height * (.48 + drag.y), { steps: 22 })
      await page.mouse.up()
      await page.waitForTimeout(550)
    }
  }
  return page
}

const hero = await prepareRenderPage()
await hero.screenshot({ path: 'public/renders/bhl-engineering-hero.png' })
await hero.close()

const side = await prepareRenderPage({ drag: { x: .18, y: 0 } })
await side.screenshot({ path: 'public/renders/bhl-engineering-side.png' })
await side.close()

const exploded = await prepareRenderPage({ exploded: true, drag: { x: -.08, y: -.02 } })
await exploded.screenshot({ path: 'public/renders/bhl-engineering-exploded.png' })
await exploded.close()

await browser.close()
