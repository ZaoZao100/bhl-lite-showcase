import { chromium } from 'playwright-core'

const baseUrl = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5173/'

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
})

const errors = []
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
desktop.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
desktop.on('pageerror', (error) => errors.push(error.message))
await desktop.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
await desktop.waitForTimeout(1200)
await desktop.locator('#details').scrollIntoViewIfNeeded()
await desktop.waitForTimeout(1300)
await desktop.locator('#details').screenshot({ path: 'engineering-section-qa.png' })
await desktop.evaluate(() => window.scrollTo(0, 0))

const sectionData = await desktop.evaluate(() => ({
  height: document.documentElement.scrollHeight,
  width: document.documentElement.scrollWidth,
  viewport: document.documentElement.clientWidth,
  sections: [...document.querySelectorAll('main > section')].map((section) => ({
    id: section.id,
    top: Math.round(section.getBoundingClientRect().top + window.scrollY),
    height: Math.round(section.getBoundingClientRect().height),
  })),
}))
const modelEnvelope = await desktop.locator('.viewer').evaluate((element) => ({
  width: element.dataset.modelWidth,
  depth: element.dataset.modelDepth,
  height: element.dataset.modelHeight,
}))

for (const selector of ['#hardware', '#software', '#real-builds']) {
  await desktop.locator(selector).scrollIntoViewIfNeeded()
  await desktop.waitForTimeout(1050)
  if (selector === '#hardware') await desktop.locator(selector).screenshot({ path: 'hardware-section-qa.png' })
  if (selector === '#software') await desktop.locator(selector).screenshot({ path: 'software-section-qa.png' })
  if (selector === '#real-builds') await desktop.locator(selector).screenshot({ path: 'real-builds-qa.png' })
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
mobile.on('pageerror', (error) => errors.push(`mobile: ${error.message}`))
await mobile.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
await mobile.waitForTimeout(800)
await mobile.locator('#real-builds').scrollIntoViewIfNeeded()
await mobile.waitForTimeout(700)
await mobile.locator('#real-builds').screenshot({ path: 'real-builds-mobile-qa.png' })
const mobileData = await mobile.evaluate(() => ({
  height: document.documentElement.scrollHeight,
  width: document.documentElement.scrollWidth,
  viewport: document.documentElement.clientWidth,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))

console.log(JSON.stringify({ sectionData, modelEnvelope, mobileData, errors }, null, 2))
await browser.close()
