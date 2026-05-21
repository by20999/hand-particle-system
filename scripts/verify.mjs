import { chromium } from "playwright";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const url = "http://localhost:5173";

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
  ],
});

const cases = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
];

for (const testCase of cases) {
  const page = await browser.newPage({ viewport: testCase.viewport });
  const messages = [];
  const missing = [];
  page.on("console", (message) => {
    if (message.type() === "error") messages.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() === 404) missing.push(response.url());
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("#scene").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(3500);
  await page.screenshot({
    path: `verification-${testCase.name}.png`,
    fullPage: false,
  });
  const canvasBox = await page.locator("#scene").boundingBox();
  console.log(`${testCase.name}: canvas=${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}`);
  if (messages.length) {
    console.log(`${testCase.name}: console errors: ${messages.join(" | ")}`);
  }
  if (missing.length) {
    console.log(`${testCase.name}: 404: ${missing.join(" | ")}`);
  }
  await page.close();
}

await browser.close();
