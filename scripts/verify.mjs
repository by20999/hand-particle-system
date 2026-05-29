import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { inflateSync } from "node:zlib";
import { chromium } from "playwright";

const defaultUrl = "http://localhost:5173";
const url = process.env.VERIFY_URL ?? defaultUrl;
const browserArgs = [
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
];

let server = null;
let browser = null;

try {
  if (!process.env.VERIFY_URL && !(await isReachable(url))) {
    server = await startDevServer(url);
  }

  browser = await chromium.launch({
    ...browserLaunchOptions(),
    headless: true,
    args: browserArgs,
  });

  const cases = [
    { name: "desktop", viewport: { width: 1440, height: 900 } },
    { name: "mobile", viewport: { width: 390, height: 844 } },
  ];

  for (const testCase of cases) {
    await verifyCase(browser, testCase);
  }

  await verifyInteractions(browser);
} finally {
  if (browser) {
    await browser.close();
  }
  if (server) {
    stopServer(server);
  }
}

async function verifyCase(activeBrowser, testCase) {
  const page = await activeBrowser.newPage({ viewport: testCase.viewport });
  const issues = watchPageIssues(page);

  let canvasBox = null;
  let sample = null;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    const canvas = page.locator("#scene");
    await canvas.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3500);

    canvasBox = await canvas.boundingBox();
    await page.screenshot({
      path: `verification-${testCase.name}.png`,
      fullPage: false,
    });
    const canvasScreenshot = await canvas.screenshot();
    sample = sampleScreenshotPixels(canvasScreenshot);
  } catch (error) {
    await page.close();
    throw error;
  }

  const finalIssues = [...issues];
  await page.close();

  console.log(
    `${testCase.name}: canvas=${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}, lit=${(
      sample.litRatio * 100
    ).toFixed(2)}%, range=${sample.range}`,
  );

  if (finalIssues.length) {
    throw new Error(`${testCase.name}: browser issues: ${finalIssues.join(" | ")}`);
  }
  if (!sample.ok) {
    throw new Error(`${testCase.name}: canvas appears blank`);
  }
}

async function verifyInteractions(activeBrowser) {
  const page = await activeBrowser.newPage({ viewport: { width: 1366, height: 768 } });
  const issues = watchPageIssues(page);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.locator("#scene").waitFor({ state: "visible", timeout: 15000 });
    await page.evaluate(() => {
      document.querySelectorAll("details").forEach((details) => {
        details.open = true;
      });
    });
    await page.waitForTimeout(1800);

    for (const selector of [
      '[data-model="flower"]',
      '[data-model="saturn"]',
      '[data-model="fireworks"]',
      '[data-model="ring"]',
      '[data-model="cake"]',
      '[data-model="balloons"]',
      '[data-model="text"]',
      '[data-model="heart"]',
    ]) {
      await page.click(selector);
      await page.waitForTimeout(180);
    }

    await page.fill("#textInput", "测试LOVE");
    await page.click("#textApplyBtn");
    await page.waitForTimeout(300);

    for (const selector of [
      '[data-background="stage"]',
      '[data-background="minimal"]',
      '[data-background="fireworks"]',
      '[data-background="nebula"]',
    ]) {
      await page.click(selector);
      await page.waitForTimeout(140);
    }

    await page.selectOption("#themeSelect", "laser");
    await page.selectOption("#showPresetSelect", "club");
    await page.click("#showPresetToggleBtn");
    await page.waitForTimeout(450);
    await page.click("#showPresetToggleBtn");
    await page.waitForTimeout(120);
    await page.selectOption("#showPresetSelect", "stellarHeartLive");
    await page.click("#showPresetToggleBtn");
    await page.waitForTimeout(450);
    await page.click("#showPresetToggleBtn");
    await page.waitForTimeout(120);
    await page.selectOption("#showPresetSelect", "confessionGrandShow");
    await page.click("#showPresetToggleBtn");
    await page.waitForTimeout(450);
    await page.click("#showPresetToggleBtn");
    await page.waitForTimeout(120);
    await page.selectOption("#showPresetSelect", "birthdayGrandShow");
    await page.click("#showPresetToggleBtn");
    await page.waitForTimeout(450);
    await page.click("#showPresetToggleBtn");
    await page.waitForTimeout(120);
    await page.selectOption("#showPresetSelect", "custom");
    await page.click('[data-show-step="0"]');
    await page.fill("#showStepLabel", "验证片段");
    await page.selectOption("#showStepCamera", "close");
    await page.evaluate(() => {
      const modelBrightness = document.querySelector("#showStepModelBrightness");
      const backgroundBrightness = document.querySelector("#showStepBackgroundBrightness");
      if (modelBrightness) {
        modelBrightness.value = "115";
        modelBrightness.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (backgroundBrightness) {
        backgroundBrightness.value = "120";
        backgroundBrightness.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await page.click("#showStepApplyBtn");
    await page.waitForTimeout(240);
    await page.click("#showStepExportBtn");
    await page.click("#showStepImportBtn");
    await page.waitForTimeout(160);
    await page.setInputFiles("#showPresetFileInput", {
      name: "verify-show.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          label: "文件导入验证",
          steps: [
            {
              label: "文件开场",
              duration: 3000,
              theme: "neon",
              background: "lattice",
              model: "heart",
              camera: "front",
              modelBrightness: 1.1,
              backgroundBrightness: 1.15,
              burst: true,
            },
          ],
        }),
        "utf8",
      ),
    });
    await page.waitForFunction(
      () =>
        document.querySelector("#showPresetSelect")?.value === "custom" &&
        document.querySelector("#showStepLabel")?.value === "文件开场",
      null,
      { timeout: 8000 },
    );
    await page.click("#gestureToggleBtn");
    await page.waitForTimeout(120);
    await page.click("#freezeToggleBtn");
    await page.waitForTimeout(120);
    await page.click("#freezeToggleBtn");
    await page.click("#gestureToggleBtn");
    await page.waitForTimeout(120);

    await page.setInputFiles("#imageFileInput", {
      name: "verify.bmp",
      mimeType: "image/bmp",
      buffer: createTestBmp(96, 96),
    });
    await page.waitForFunction(
      () => {
        const model = document.querySelector("#shapeSelect")?.value;
        const diagnostic = document.querySelector("#diagnosticText")?.textContent ?? "";
        return model === "image" || diagnostic.includes("图片导入失败");
      },
      null,
      { timeout: 45000 },
    );

    const state = await page.evaluate(() => ({
      model: document.querySelector("#shapeSelect")?.value,
      diagnostic: document.querySelector("#diagnosticText")?.textContent ?? "",
      background: document.documentElement.dataset.background,
      theme: document.documentElement.dataset.themeMood,
    }));

    if (state.model !== "image") {
      throw new Error(`interaction: image import did not activate image model: ${state.diagnostic}`);
    }
    if (state.diagnostic.includes("失败")) {
      throw new Error(`interaction: image import failed: ${state.diagnostic}`);
    }

    const sampleVideoPath = "scripts/fixtures/verify-pose-sample.webm";
    if (existsSync(sampleVideoPath)) {
      await page.setInputFiles("#poseVideoInput", {
        name: "verify-pose-sample.webm",
        mimeType: "video/webm",
        buffer: readFileSync(sampleVideoPath),
      });
      await page.waitForFunction(
        () => {
          const model = document.querySelector("#shapeSelect")?.value;
          const diagnostic = document.querySelector("#diagnosticText")?.textContent ?? "";
          return model === "pose" || diagnostic.includes("姿态视频加载失败");
        },
        null,
        { timeout: 30000 },
      );
      const poseState = await page.evaluate(() => ({
        model: document.querySelector("#shapeSelect")?.value,
        diagnostic: document.querySelector("#diagnosticText")?.textContent ?? "",
      }));
      if (poseState.model !== "pose") {
        throw new Error(`interaction: pose video did not activate pose model: ${poseState.diagnostic}`);
      }
      const expectedFallback =
        poseState.diagnostic.includes("已回退成原粒子骨架") || poseState.diagnostic.includes("已回退为粒子骨架");
      if (poseState.diagnostic.includes("失败") && !expectedFallback) {
        throw new Error(`interaction: pose video import failed: ${poseState.diagnostic}`);
      }
    }
    if (issues.length) {
      throw new Error(`interaction: browser issues: ${issues.join(" | ")}`);
    }

    console.log(`interaction: model=${state.model}, background=${state.background}, theme=${state.theme}`);
  } finally {
    await page.close();
  }
}

async function startDevServer(targetUrl) {
  const serverProcess = spawn(npmCommand(), npmArgs(), {
    stdio: "ignore",
    windowsHide: true,
  });

  for (let attempt = 0; attempt < 45; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error("dev server exited before verification could start");
    }
    if (await isReachable(targetUrl)) {
      return serverProcess;
    }
    await delay(500);
  }

  serverProcess.kill();
  throw new Error(`dev server did not become ready at ${targetUrl}`);
}

async function isReachable(targetUrl) {
  try {
    const response = await fetch(targetUrl, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

function browserLaunchOptions() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  const executablePath = candidates.find((candidate) => existsSync(candidate));
  return executablePath ? { executablePath } : {};
}

function npmCommand() {
  return process.platform === "win32" ? "cmd.exe" : "npm";
}

function npmArgs() {
  if (process.platform === "win32") {
    return ["/d", "/s", "/c", "npm run dev -- --host 127.0.0.1 --port 5173"];
  }
  return ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"];
}

function stopServer(serverProcess) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(serverProcess.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  serverProcess.kill();
}

function sampleScreenshotPixels(buffer) {
  const png = decodePng(buffer);
  const minX = Math.floor(png.width * 0.28);
  const maxX = Math.floor(png.width * 0.86);
  const minY = Math.floor(png.height * 0.18);
  const maxY = Math.floor(png.height * 0.78);
  let lit = 0;
  let total = 0;
  let min = 255;
  let max = 0;
  let mean = 0;

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const i = (y * png.width + x) * 4;
      const brightness = Math.round((png.pixels[i] + png.pixels[i + 1] + png.pixels[i + 2]) / 3);
      if (brightness > 9) {
        lit += 1;
      }
      min = Math.min(min, brightness);
      max = Math.max(max, brightness);
      mean += brightness;
      total += 1;
    }
  }

  const litRatio = lit / total;
  const range = max - min;
  mean /= total;
  return { ok: litRatio > 0.002 && range > 8 && mean > 1, litRatio, range, mean };
}

function watchPageIssues(page) {
  const issues = [];
  page.on("console", (message) => {
    if (message.type() === "error") issues.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() === 404) issues.push(`404: ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "";
    if (errorText === "net::ERR_ABORTED") {
      return;
    }
    issues.push(`request failed: ${request.url()} ${errorText}`.trim());
  });
  return issues;
}

function createTestBmp(width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const fileSize = 54 + pixelSize;
  const buffer = Buffer.alloc(fileSize);
  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(pixelSize, 34);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const topY = height - 1 - y;
      const dx = x - width / 2;
      const dy = topY - height / 2;
      const circle = Math.hypot(dx, dy) < width * 0.28;
      const cross = Math.abs(dx) < 5 || Math.abs(dy) < 5;
      const offset = 54 + y * rowSize + x * 3;
      const r = circle ? 230 : cross ? 50 : 255;
      const g = circle ? 30 : cross ? 180 : 255;
      const b = circle ? 90 : cross ? 250 : 255;
      buffer[offset] = b;
      buffer[offset + 1] = g;
      buffer[offset + 2] = r;
    }
  }

  return buffer;
}

function decodePng(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("screenshot is not a PNG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowBytes = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height * 4);
  let rawOffset = 0;
  let previous = new Uint8Array(rowBytes);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const row = new Uint8Array(rowBytes);

    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[rawOffset];
      rawOffset += 1;
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      row[x] = unfilter(value, filter, left, up, upLeft);
    }

    for (let x = 0; x < width; x += 1) {
      const source = x * bytesPerPixel;
      const target = (y * width + x) * 4;
      pixels[target] = row[source];
      pixels[target + 1] = row[source + 1];
      pixels[target + 2] = row[source + 2];
      pixels[target + 3] = bytesPerPixel === 4 ? row[source + 3] : 255;
    }

    previous = row;
  }

  return { width, height, pixels };
}

function unfilter(value, filter, left, up, upLeft) {
  if (filter === 0) return value;
  if (filter === 1) return (value + left) & 255;
  if (filter === 2) return (value + up) & 255;
  if (filter === 3) return (value + Math.floor((left + up) / 2)) & 255;
  if (filter === 4) return (value + paeth(left, up, upLeft)) & 255;
  throw new Error(`unsupported PNG filter: ${filter}`);
}

function paeth(left, up, upLeft) {
  const predictor = left + up - upLeft;
  const leftDistance = Math.abs(predictor - left);
  const upDistance = Math.abs(predictor - up);
  const upLeftDistance = Math.abs(predictor - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}
