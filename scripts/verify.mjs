import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

  const canvasBox = await page.locator("#scene").boundingBox();
  const screenshot = await page.screenshot({
    path: `verification-${testCase.name}.png`,
    fullPage: false,
  });
  const sample = sampleScreenshotPixels(screenshot);

  await page.close();

  console.log(
    `${testCase.name}: canvas=${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}, lit=${(
      sample.litRatio * 100
    ).toFixed(2)}%`,
  );

  if (messages.length) {
    throw new Error(`${testCase.name}: console errors: ${messages.join(" | ")}`);
  }
  if (missing.length) {
    throw new Error(`${testCase.name}: 404: ${missing.join(" | ")}`);
  }
  if (!sample.ok) {
    throw new Error(`${testCase.name}: canvas appears blank`);
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

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const i = (y * png.width + x) * 4;
      if (png.pixels[i] + png.pixels[i + 1] + png.pixels[i + 2] > 28) {
        lit += 1;
      }
      total += 1;
    }
  }

  const litRatio = lit / total;
  return { ok: litRatio > 0.002, litRatio };
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
