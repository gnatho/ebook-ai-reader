import { firefox } from "playwright";

const EPUB = "C:/Users/gnatho/Documents/CODING/JSNODE/BOOKER/ebook-ai-reader/scripts/valid.epub";
const errors = [];
const consoleErrors = [];
const browser = await firefox.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

try {
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', EPUB);

  let iframeFound = false;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(2000);
    const s = await page.evaluate(() => ({
      hasIframe: !!document.querySelector("iframe"),
      body: document.body.innerText.slice(0, 160).replace(/\n/g, " | "),
    }));
    console.log(`t=${(i + 1) * 2}s iframe=${s.hasIframe} body="${s.body}"`);
    if (s.hasIframe) { iframeFound = true; break; }
  }

  if (iframeFound) {
    // Check the epub iframe actually has rendered text
    await page.waitForTimeout(2000);
    const content = await page.evaluate(() => {
      const f = document.querySelector("iframe");
      try {
        const doc = f.contentDocument;
        return { text: (doc?.body?.innerText || "").slice(0, 120), htmlLen: doc?.body?.innerHTML?.length || 0 };
      } catch (e) { return { text: "ACCESS_ERR: " + (e && e.message), htmlLen: 0 }; }
    });
    console.log("iframe content:", JSON.stringify(content));
  }
} catch (e) {
  console.log("SCRIPT ERROR:", String(e).split("\n")[0]);
} finally {
  console.log("pageerrors:", JSON.stringify(errors.slice(0, 8), null, 2));
  console.log("consoleErrors:", JSON.stringify(consoleErrors.slice(0, 12), null, 2));
  await browser.close();
}
