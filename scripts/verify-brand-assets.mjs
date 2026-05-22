import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const LIGHT_BG = [247, 247, 245];
const DARK_BG = [29, 29, 27];

const failures = [];

function fail(message) {
  failures.push(message);
}

function readFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing ${relativePath}`);
    return null;
  }
  return fs.readFileSync(absolutePath);
}

function readPngRgba(buffer, width, height) {
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }

  const inflated = zlib.inflateSync(Buffer.concat(chunks));
  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const output = Buffer.alloc(rowLength * height);
  let inputOffset = 0;
  let previous = Buffer.alloc(rowLength);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const row = Buffer.alloc(rowLength);
    for (let x = 0; x < rowLength; x += 1) {
      const raw = inflated[inputOffset + x];
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) {
        fail(`Unsupported PNG filter ${filter}`);
      }
      row[x] = (raw + predictor) & 0xff;
    }
    row.copy(output, y * rowLength);
    previous = row;
    inputOffset += rowLength;
  }

  return output;
}

function checkPng(relativePath, width, height, cornerExpectation) {
  const buffer = readFile(relativePath);
  if (!buffer) return;

  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    fail(`${relativePath} is not a PNG`);
    return;
  }

  const actualWidth = buffer.readUInt32BE(16);
  const actualHeight = buffer.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) {
    fail(`${relativePath} expected ${width}x${height}, got ${actualWidth}x${actualHeight}`);
  }

  if (!cornerExpectation) return;
  const colorType = buffer[25];
  const bitDepth = buffer[24];
  if (colorType !== 6 || bitDepth !== 8) {
    return;
  }

  const pixels = readPngRgba(buffer, actualWidth, actualHeight);
  const firstPixel = pixels.subarray(0, 4);
  const expected =
    Array.isArray(cornerExpectation) ? { rgb: cornerExpectation } : cornerExpectation;
  if (expected.rgb && !expected.rgb.every((value, index) => firstPixel[index] === value)) {
    fail(`${relativePath} corner expected rgb(${expected.rgb.join(', ')}), got rgb(${[...firstPixel.subarray(0, 3)].join(', ')})`);
  }
  if (typeof expected.alpha === 'number' && firstPixel[3] !== expected.alpha) {
    fail(`${relativePath} corner expected alpha ${expected.alpha}, got ${firstPixel[3]}`);
  }
  if (typeof expected.minAlphaCoverage === 'number' || typeof expected.maxAlphaCoverage === 'number') {
    const alphaThreshold = expected.alphaThreshold ?? 16;
    let minX = actualWidth;
    let minY = actualHeight;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < actualHeight; y += 1) {
      for (let x = 0; x < actualWidth; x += 1) {
        if (pixels[(y * actualWidth + x) * 4 + 3] <= alphaThreshold) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < 0 || maxY < 0) {
      fail(`${relativePath} has no visible alpha bounds`);
    } else {
      const coverage = Math.max((maxX - minX + 1) / actualWidth, (maxY - minY + 1) / actualHeight);
      if (typeof expected.minAlphaCoverage === 'number' && coverage < expected.minAlphaCoverage) {
        fail(`${relativePath} alpha coverage ${coverage.toFixed(3)} is below ${expected.minAlphaCoverage}`);
      }
      if (typeof expected.maxAlphaCoverage === 'number' && coverage > expected.maxAlphaCoverage) {
        fail(`${relativePath} alpha coverage ${coverage.toFixed(3)} is above ${expected.maxAlphaCoverage}`);
      }
    }
  }
}

function checkIco(relativePath) {
  const buffer = readFile(relativePath);
  if (!buffer) return;
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1 || buffer.readUInt16LE(4) < 1) {
    fail(`${relativePath} is not a valid ICO file`);
  }
}

function checkIcns(relativePath) {
  const buffer = readFile(relativePath);
  if (!buffer) return;
  if (buffer.toString('ascii', 0, 4) !== 'icns') {
    fail(`${relativePath} is not a valid ICNS file`);
  }
}

checkPng('logo_assets/web/favicon-32.png', 32, 32, LIGHT_BG);
checkPng('logo_assets/web/apple-touch-icon.png', 180, 180, LIGHT_BG);
const DESKTOP_ICON = { alpha: 0, alphaThreshold: 16, minAlphaCoverage: 0.78, maxAlphaCoverage: 0.9 };
const WINDOWS_TILES = {
  'Square30x30Logo.png': 30,
  'Square44x44Logo.png': 44,
  'StoreLogo.png': 50,
  'Square71x71Logo.png': 71,
  'Square89x89Logo.png': 89,
  'Square107x107Logo.png': 107,
  'Square142x142Logo.png': 142,
  'Square150x150Logo.png': 150,
  'Square284x284Logo.png': 284,
  'Square310x310Logo.png': 310,
};

checkPng('logo_assets/linux/icon.png', 512, 512, DESKTOP_ICON);
checkPng('logo_assets/macos/icon.png', 1024, 1024, DESKTOP_ICON);
checkPng('logo_assets/dark/web/favicon-32.png', 32, 32, DARK_BG);
checkPng('logo_assets/dark/linux/icon.png', 512, 512, DESKTOP_ICON);
checkPng('logo_assets/dark/macos/icon.png', 1024, 1024, DESKTOP_ICON);
checkIco('logo_assets/windows/icon.ico');
checkIcns('logo_assets/macos/icon.icns');

checkPng('packages/core/public/logo_transparent.png', 2048, 2048);
checkPng('packages/core/public/logo_white.png', 2048, 2048, DARK_BG);
checkPng('packages/desktop/src-tauri/icons/32x32.png', 32, 32, DESKTOP_ICON);
checkPng('packages/desktop/src-tauri/icons/128x128.png', 128, 128, DESKTOP_ICON);
checkPng('packages/desktop/src-tauri/icons/128x128@2x.png', 256, 256, DESKTOP_ICON);
checkPng('packages/desktop/src-tauri/icons/256x256.png', 256, 256, DESKTOP_ICON);
checkPng('packages/desktop/src-tauri/icons/icon.png', 512, 512, DESKTOP_ICON);
for (const [filename, size] of Object.entries(WINDOWS_TILES)) {
  checkPng(`packages/desktop/src-tauri/icons/${filename}`, size, size, DESKTOP_ICON);
}
checkIco('packages/desktop/src-tauri/icons/icon.ico');
checkIcns('packages/desktop/src-tauri/icons/icon.icns');

const rootLogo = readFile('logo.svg')?.toString('utf8') ?? '';
const publicLogo = readFile('packages/core/public/logo.svg')?.toString('utf8') ?? '';
if (!rootLogo.includes('#f7f7f5') || !rootLogo.includes('Tada')) {
  fail('logo.svg must use the new light background and Tada wordmark');
}
if (rootLogo !== publicLogo) {
  fail('root logo.svg and packages/core/public/logo.svg must match');
}

const tauriSource = readFile('packages/desktop/src-tauri/src/lib.rs')?.toString('utf8') ?? '';
const tauriConfig = readFile('packages/desktop/src-tauri/tauri.conf.json')?.toString('utf8') ?? '';
for (const token of ['TrayIconBuilder', 'TrayIconEvent', 'MenuItem', 'prevent_close', 'window.hide()', 'icon_as_template']) {
  if (tauriSource.includes(token)) fail(`Tada desktop source still contains tray/menu token: ${token}`);
}
if (tauriConfig.includes('core:tray')) {
  fail('Tauri config still grants tray permissions');
}

if (failures.length) {
  console.error(failures.map((message) => `- ${message}`).join('\n'));
  process.exit(1);
}

console.log('Brand assets and Tada tray removal checks passed.');
