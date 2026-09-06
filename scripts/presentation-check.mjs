import {chromium} from 'playwright-core';
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
for(const width of [1440,390]){
const p=await b.newPage({viewport:{width,height:900}});
await p.goto('http://localhost:5173/'); await p.waitForTimeout(3500); await p.evaluate(()=>document.fonts.ready);
await p.screenshot({path:`presentation-${width}-qa.png`});
console.log(width,await p.locator('h1').evaluate(e=>({font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize,weight:getComputedStyle(e).fontWeight,spacing:getComputedStyle(e).letterSpacing,overflow:document.documentElement.scrollWidth-innerWidth})));
await p.locator('#actuators').scrollIntoViewIfNeeded(); await p.waitForTimeout(1200); await p.screenshot({path:`presentation-joints-${width}-qa.png`});
}
await b.close();
