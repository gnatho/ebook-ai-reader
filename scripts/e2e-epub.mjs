import { chromium } from "playwright";

const SAMPLE = "C:/Users/gnatho/Documents/CODING/JSNODE/BOOKER/ebook-ai-reader/scripts/valid.epub";

const errors = [];
const consoleErrors = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

let result = "UNKNOWN";
try {
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });

  await page.setInputFiles('input[type="file"]', SAMPLE);

  // Wait for the epub iframe to appear (reader opened + rendered)
  await page.waitForSelector('iframe', { timeout: 30000 });
  console.log("iframe appeared: yes");

  // Wait for "Opening book…" to disappear (onReady fired)
  await page.waitForFunction(
    () => !document.body.innerText.includes("Opening book…"),
    { timeout: 30000 }
  );
  console.log("loading done: yes");

  const before = await readProgress(page);
  console.log("progress before next:", before);

  await clickNav(page, "Next page");
  await page.waitForTimeout(1000);
  console.log("progress after next:", await readProgress(page));

  await clickNav(page, "Previous page");
  await page.waitForTimeout(600);
  console.log("progress after prev:", await readProgress(page));

  for (let i = 0; i < 3; i++) {
    await clickNav(page, "Next page");
    await page.waitForTimeout(400);
  }
  console.log("progress after +3 next:", await readProgress(page));

  const crashed = errors.some((e) => /manager|next|undefined/i.test(e));
  result = crashed ? "CRASH" : "OK";
} catch (e) {
  result = "ERROR";
  console.log("SCRIPT ERROR:", String(e).split("\n")[0]);
} finally {
  await page.screenshot({ path: "scripts/e2e-shot.png", fullPage: true }).catch(() => {});
  console.log("pageerrors:", JSON.stringify(errors, null, 2));
  console.log("consoleErrors:", JSON.stringify(consoleErrors.slice(0, 15), null, 2));
  console.log("RESULT:", result);
  await browser.close();
}

async function readProgress(page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll("span")].find((s) => /%/.test(s.textContent || ""));
    return el?.textContent?.trim() || "";
  });
}

async function clickNav(page, label) {
  try {
    await page.locator(`button[aria-label="${label}"]`).click({ timeout: 5000 });
  } catch {
    try {
      await page.locator(`button[aria-label="${label}"]`).click({ force: true, timeout: 5000 });
    } catch (e) {
      console.log(`click ${label} failed: ${String(e).split("\n")[0]}`);
    }
  }
}

if (result !== "OK") process.exit(1);
