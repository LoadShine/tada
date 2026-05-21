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

  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const rowLength = 1 + width * 4;
  const firstPixel = raw.subarray(1, 5);
  const expected =
    Array.isArray(cornerExpectation) ? { rgb: cornerExpectation } : cornerExpectation;
  if (expected.rgb && !expected.rgb.every((value, index) => firstPixel[index] === value)) {
    fail(`${relativePath} corner expected rgb(${expected.rgb.join(', ')}), got rgb(${[...firstPixel.subarray(0, 3)].join(', ')})`);
  }
  if (typeof expected.alpha === 'number' && firstPixel[3] !== expected.alpha) {
    fail(`${relativePath} corner expected alpha ${expected.alpha}, got ${firstPixel[3]}`);
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
checkPng('logo_assets/linux/icon.png', 512, 512, LIGHT_BG);
checkPng('logo_assets/macos/icon.png', 1024, 1024, { alpha: 0 });
checkPng('logo_assets/dark/web/favicon-32.png', 32, 32, DARK_BG);
checkIco('logo_assets/windows/icon.ico');
checkIcns('logo_assets/macos/icon.icns');

checkPng('packages/core/public/logo_transparent.png', 2048, 2048);
checkPng('packages/core/public/logo_white.png', 2048, 2048, DARK_BG);
checkPng('packages/desktop/src-tauri/icons/32x32.png', 32, 32, LIGHT_BG);
checkPng('packages/desktop/src-tauri/icons/128x128.png', 128, 128, LIGHT_BG);
checkPng('packages/desktop/src-tauri/icons/128x128@2x.png', 256, 256, LIGHT_BG);
checkPng('packages/desktop/src-tauri/icons/256x256.png', 256, 256, LIGHT_BG);
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
