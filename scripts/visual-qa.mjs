import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
const measureFps = (duration = 900) => page.evaluate((sampleDuration) => new Promise((resolve) => {
  let frames = 0
  const startedAt = performance.now()
  const tick = (now) => {
    frames += 1
    if (now - startedAt >= sampleDuration) {
      resolve(Math.round((frames * 1000) / (now - startedAt)))
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}), duration)
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(error.message))

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(5000)
const canvasBox = await page.locator('canvas').boundingBox()
if (canvasBox) {
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.56, canvasBox.y + canvasBox.height * 0.48)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.42, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(500)
}
await page.getByRole('button', { name: '播放下蹲动作' }).click()
await page.waitForTimeout(1800)
await page.getByRole('button', { name: '重置视角' }).click()
await page.locator('.motion-console').evaluate((element) => { element.style.visibility = 'hidden' })
await page.screenshot({ path: 'showcase-squat-qa.png', fullPage: true })
const squatFootLock = await page.locator('.viewer').evaluate((element) => ({
  footCount: element.dataset.footCount,
  baseline: element.dataset.footBaseline,
  current: element.dataset.footCurrent,
  error: element.dataset.footError,
  rootOffset: element.dataset.rootOffset,
}))
await page.locator('.motion-console').evaluate((element) => { element.style.visibility = '' })
await page.getByRole('button', { name: '播放招手动作' }).click()
await page.waitForTimeout(1800)
const idleFps = await measureFps()
await page.screenshot({ path: 'showcase-qa.png', fullPage: true })

const before = await page.locator('.model-caption strong').textContent()
await page.getByRole('button', { name: '探索结构' }).click()
await page.waitForTimeout(360)
await page.screenshot({ path: 'showcase-impact-qa.png', fullPage: true })
const explosionFps = await measureFps()
await page.waitForTimeout(540)
const after = await page.locator('.model-caption strong').textContent()
await page.screenshot({ path: 'showcase-exploded-qa.png', fullPage: true })
await page.getByRole('button', { name: '重新组装' }).click()
await page.waitForTimeout(1800)
const reassembled = await page.locator('.model-caption strong').textContent()
await page.screenshot({ path: 'showcase-reassembled-qa.png', fullPage: true })
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(200)
const cameraDistanceBeforeWheel = await page.locator('.viewer').getAttribute('data-camera-distance')
await page.locator('canvas').hover()
await page.mouse.wheel(0, 620)
await page.waitForTimeout(350)
const wheelScrollY = await page.evaluate(() => Math.round(window.scrollY))
const cameraDistanceAfterWheel = await page.locator('.viewer').getAttribute('data-camera-distance')
await page.evaluate(() => window.scrollTo(0, 0))

console.log(JSON.stringify({
  title: await page.title(),
  canvas: await page.locator('canvas').count(),
  loaderVisible: await page.locator('.loader').isVisible(),
  activeMotion: await page.locator('.motion-list button.is-active small').textContent(),
  squatFootLock,
  idleFps,
  explosionFps,
  before,
  after,
  reassembled,
  wheelScrollY,
  cameraDistanceBeforeWheel,
  cameraDistanceAfterWheel,
  errors,
}, null, 2))

await browser.close()
