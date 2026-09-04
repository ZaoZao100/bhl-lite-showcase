import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const outDir = 'public/renders'
const sourceThumb = `${outDir}/onshape-actuator-thumb.png`
const outPath = `${outDir}/actuator-6512-engineering.png`

await mkdir(outDir, { recursive: true })

const thumb = await readFile(sourceThumb)
const thumbData = `data:image/png;base64,${thumb.toString('base64')}`

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
})

const page = await browser.newPage({ viewport: { width: 1600, height: 940 }, deviceScaleFactor: 1 })

await page.setContent(`
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        width: 1600px;
        height: 940px;
        overflow: hidden;
        background: #02070b;
        font-family: "Space Grotesk", "Manrope", "Noto Sans SC", "Microsoft YaHei UI", sans-serif;
        color: #edf6ff;
      }
      .plate {
        position: relative;
        width: 1600px;
        height: 940px;
        overflow: hidden;
        background:
          radial-gradient(circle at 67% 49%, rgba(95, 186, 255, .19), transparent 31%),
          radial-gradient(circle at 34% 72%, rgba(231, 155, 50, .12), transparent 28%),
          linear-gradient(130deg, #04101a 0%, #02070b 52%, #081019 100%);
      }
      .plate::before {
        content: '';
        position: absolute;
        inset: 0;
        opacity: .18;
        background-image:
          linear-gradient(rgba(95, 173, 232, .22) 1px, transparent 1px),
          linear-gradient(90deg, rgba(95, 173, 232, .22) 1px, transparent 1px);
        background-size: 58px 58px;
        mask: linear-gradient(90deg, rgba(0,0,0,.15), #000 28%, #000 74%, rgba(0,0,0,.08));
      }
      .plate::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(to bottom, rgba(177, 225, 255, .04), transparent 14%, transparent 78%, rgba(0, 0, 0, .42)),
          radial-gradient(ellipse at center, transparent 40%, rgba(1, 6, 10, .62));
      }
      .title {
        position: absolute;
        z-index: 4;
        left: 74px;
        top: 68px;
        width: 520px;
      }
      .eyebrow {
        display: flex;
        gap: 14px;
        align-items: center;
        color: #7db8dd;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .28em;
      }
      .eyebrow i {
        width: 46px;
        height: 1px;
        background: linear-gradient(90deg, #52b9ff, #f0ad45);
        box-shadow: 0 0 14px #59bbff;
      }
      h1 {
        margin: 34px 0 0;
        font-size: 92px;
        line-height: .92;
        font-weight: 700;
        letter-spacing: -.065em;
        color: #f3f8fb;
        text-shadow: 0 0 45px rgba(75, 170, 244, .18);
      }
      h1 span {
        display: block;
        color: transparent;
        -webkit-text-stroke: 1px rgba(177, 205, 224, .52);
      }
      .subtitle {
        width: 455px;
        margin-top: 28px;
        color: #8fa3b3;
        font-size: 22px;
        line-height: 1.65;
        font-weight: 500;
      }
      .model-zone {
        position: absolute;
        z-index: 3;
        right: 34px;
        top: 42px;
        width: 1000px;
        height: 790px;
      }
      .ring {
        position: absolute;
        left: 50%;
        top: 51%;
        border-radius: 50%;
        transform: translate(-50%, -50%) rotateX(64deg) rotateZ(-16deg);
        border: 1px solid rgba(87, 187, 255, .35);
        box-shadow: 0 0 44px rgba(67, 171, 244, .18), inset 0 0 44px rgba(67, 171, 244, .12);
      }
      .ring-a { width: 760px; height: 760px; }
      .ring-b { width: 600px; height: 600px; border-color: rgba(237, 167, 62, .35); }
      .ring-c { width: 432px; height: 432px; opacity: .7; }
      .actuator {
        position: absolute;
        z-index: 3;
        left: 230px;
        top: 150px;
        width: 720px;
        height: auto;
        filter:
          drop-shadow(0 44px 48px rgba(0, 0, 0, .54))
          drop-shadow(0 0 38px rgba(100, 192, 255, .24));
      }
      .floor {
        position: absolute;
        z-index: 1;
        left: 238px;
        top: 498px;
        width: 655px;
        height: 246px;
        transform: skewX(-14deg);
        background: radial-gradient(ellipse at center, rgba(62, 166, 239, .21), rgba(11, 30, 44, .04) 54%, transparent 71%);
        border-top: 1px solid rgba(107, 198, 255, .3);
      }
      .scan {
        position: absolute;
        z-index: 5;
        left: 215px;
        right: 35px;
        top: 406px;
        height: 2px;
        background: linear-gradient(90deg, transparent, #74ceff 24%, #ffd072 60%, transparent);
        box-shadow: 0 0 18px rgba(117, 207, 255, .85), 0 0 46px rgba(242, 169, 67, .38);
      }
      .callout {
        position: absolute;
        z-index: 6;
        min-width: 205px;
        color: #cfe8f6;
        font-size: 15px;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .callout b {
        display: block;
        margin-top: 8px;
        color: #fff;
        font-size: 24px;
        letter-spacing: -.02em;
      }
      .callout small {
        display: block;
        margin-top: 6px;
        color: #8196a7;
        font-size: 11px;
        letter-spacing: .12em;
      }
      .callout::before {
        content: '';
        position: absolute;
        top: 19px;
        width: 168px;
        height: 1px;
        background: linear-gradient(90deg, #62c5ff, rgba(98, 197, 255, 0));
        box-shadow: 0 0 12px rgba(98, 197, 255, .65);
      }
      .callout::after {
        content: '';
        position: absolute;
        top: 15px;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #dff7ff;
        box-shadow: 0 0 15px #67c9ff;
      }
      .c1 { left: 112px; top: 168px; }
      .c1::before { left: 210px; width: 286px; }
      .c1::after { left: 493px; }
      .c2 { right: 6px; top: 210px; }
      .c2::before { right: 214px; width: 300px; transform: rotate(180deg); }
      .c2::after { right: 510px; }
      .c3 { right: 42px; bottom: 185px; }
      .c3::before { right: 208px; width: 315px; transform: rotate(180deg); }
      .c3::after { right: 520px; }
      .c4 { left: 114px; bottom: 152px; }
      .c4::before { left: 215px; width: 235px; }
      .c4::after { left: 446px; }
      .data-strip {
        position: absolute;
        z-index: 5;
        left: 74px;
        right: 74px;
        bottom: 64px;
        display: grid;
        grid-template-columns: 1.2fr 1fr 1fr 1.1fr;
        border: 1px solid rgba(98, 177, 232, .18);
        background: rgba(4, 13, 20, .76);
        box-shadow: inset 0 0 60px rgba(56, 148, 222, .06);
      }
      .data-strip div {
        min-height: 96px;
        padding: 22px 26px;
        border-right: 1px solid rgba(98, 177, 232, .13);
      }
      .data-strip div:last-child { border-right: 0; }
      .data-strip small {
        color: #5d8fad;
        font-size: 11px;
        letter-spacing: .24em;
        font-weight: 700;
      }
      .data-strip b {
        display: block;
        margin-top: 13px;
        color: #edf7ff;
        font-size: 24px;
        letter-spacing: -.02em;
      }
      .tag {
        position: absolute;
        right: 68px;
        top: 60px;
        z-index: 7;
        color: #6acb93;
        font-size: 11px;
        letter-spacing: .22em;
        font-weight: 700;
      }
      .corner {
        position: absolute;
        width: 120px;
        height: 120px;
        z-index: 6;
        border-color: rgba(104, 194, 255, .48);
      }
      .corner-a { left: 38px; top: 38px; border-left: 1px solid; border-top: 1px solid; }
      .corner-b { right: 38px; bottom: 38px; border-right: 1px solid; border-bottom: 1px solid; }
    </style>
  </head>
  <body>
    <div class="plate">
      <i class="corner corner-a"></i>
      <i class="corner corner-b"></i>
      <div class="tag">ONSHAPE PUBLIC CAD / VERIFIED</div>
      <section class="title">
        <div class="eyebrow"><i></i> ACTUATOR-6512 JOINT MODEL</div>
        <h1>关节模型<span>工程剖面</span></h1>
        <p class="subtitle">来自 Onshape 公共 CAD 文档的 6512 执行器：摆线盘、输出环、外壳与电机腔体被重新组织成适合网页展示的技术主视觉。</p>
      </section>
      <section class="model-zone">
        <div class="floor"></div>
        <i class="ring ring-a"></i>
        <i class="ring ring-b"></i>
        <i class="ring ring-c"></i>
        <img class="actuator" src="${thumbData}" alt="Actuator-6512 Onshape CAD thumbnail" />
        <div class="scan"></div>
        <div class="callout c1">Top Output Plate<b>输出端环</b><small>bolt pattern / bearing seat</small></div>
        <div class="callout c2">Cycloidal Disk<b>摆线传动盘</b><small>compact reduction stage</small></div>
        <div class="callout c3">Printed Housing<b>3D 打印外壳</b><small>windowed service access</small></div>
        <div class="callout c4">Motor Shell<b>6512 电机腔</b><small>BLDC actuator core</small></div>
      </section>
      <section class="data-strip">
        <div><small>DOCUMENT</small><b>Actuator-6512</b></div>
        <div><small>STRUCTURE</small><b>Housing / Output / Shaft</b></div>
        <div><small>DRIVE</small><b>Cycloidal Gearbox</b></div>
        <div><small>SOURCE</small><b>Onshape CAD Element 087203...</b></div>
      </section>
    </div>
  </body>
</html>`, { waitUntil: 'load' })

await page.locator('.plate').screenshot({ path: outPath })
await browser.close()

console.log(outPath)
