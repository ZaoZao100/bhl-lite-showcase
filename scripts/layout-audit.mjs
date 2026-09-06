import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'})
try {
  for (const width of [1440,768,390,320]) {
    const page = await browser.newPage({viewport:{width,height:900}})
    const errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)})
    await page.goto(process.env.QA_BASE_URL ?? 'http://localhost:5173/')
    await page.evaluate(()=>document.fonts.ready)
    const result=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-innerWidth,
      clipped:[...document.querySelectorAll('h1,h2,h3,p,.joint-feature-list,.service-node,.motion-list')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>e.textContent.slice(0,50)),
      chineseFont:document.fonts.check('500 16px "Noto Sans SC"','感知世界'),
      englishFont:document.fonts.check('500 16px Inter','Robot'),
      title:{size:parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),weight:getComputedStyle(document.querySelector('h1')).fontWeight,spacing:getComputedStyle(document.querySelector('h1')).letterSpacing}
    }))
    assert.equal(result.overflow,0); assert.deepEqual(result.clipped,[])
    assert.ok(result.chineseFont&&result.englishFont); assert.equal(result.title.weight,'500');assert.equal(result.title.spacing,'normal');assert.ok(result.title.size>=40)
    for(const button of await page.locator('.motion-list button').all())assert.ok((await button.boundingBox()).width>=40)
    await page.emulateMedia({reducedMotion:'reduce'})
    assert.equal(await page.locator('.ambient-blue').evaluate(e=>getComputedStyle(e).display),'none')
    assert.deepEqual(errors,[])
    console.log(JSON.stringify({width,...result,errors}))
    await page.close()
  }
} finally {await browser.close()}
