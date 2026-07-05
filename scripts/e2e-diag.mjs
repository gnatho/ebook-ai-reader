import { chromium } from "playwright";

const SAMPLE = "C:/Users/gnatho/Documents/CODING/JSNODE/BOOKER/ebook-ai-reader/sample.epub";
const errors = [];
const consoleErrors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.setInputFiles('input[type="file"]', SAMPLE);

// Watch for the iframe continuously and report intermediate state
for (let t = 0; t < 40; t += 5) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => ({
    hasIframe: !!document.querySelector('iframe'),
    bodyHead: document.body.innerText.slice(0, 120).replace(/\n/g, " | "),
    buttons: [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')).filter(Boolean),
  }));
  console.log(`t=${t+5}s`, JSON.stringify(s));
  if (s.hasIframe) break;
}
console.log("pageerrors:", JSON.stringify(errors.slice(0,5)));
console.log("consoleErrors:", JSON.stringify(consoleErrors.slice(0,10)));
await page.screenshot({ path: "scripts/e2e-shot.png", fullPage: true }).catch(() => {});
await browser.close();
