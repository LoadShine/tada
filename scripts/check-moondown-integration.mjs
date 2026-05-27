import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');

const readText = (relativePath) =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const readJson = (relativePath) => JSON.parse(readText(relativePath));

const rootPackage = readJson('package.json');
const corePackage = readJson('packages/core/package.json');
const webPackage = readJson('packages/web/package.json');
const desktopPackage = readJson('packages/desktop/package.json');
const editorSource = readText('packages/core/src/components/ui/Editor.tsx');
const aiServiceSource = readText('packages/core/src/services/aiService.ts');
const mainPageSource = readText('packages/core/src/pages/MainPage.tsx');
const mainLayoutSource = readText('packages/core/src/components/features/layout/MainLayout.tsx');
const appSource = readText('packages/core/src/App.tsx');
const scheduledReportSource = readText('packages/core/src/components/global/ScheduledReportGenerator.tsx');
const desktopConfig = readText('packages/desktop/src-tauri/tauri.conf.json');
const desktopCargo = readText('packages/desktop/src-tauri/Cargo.toml');
const lockfile = readText('pnpm-lock.yaml');
const webViteConfig = readText('packages/web/vite.config.ts');
const desktopViteConfig = readText('packages/desktop/vite.config.ts');
const workflowSources = [
  ['.github/workflows/ci.yml', readText('.github/workflows/ci.yml')],
  ['.github/workflows/deploy.yml', readText('.github/workflows/deploy.yml')],
  ['.github/workflows/release.yml', readText('.github/workflows/release.yml')]
];

const failures = [];
const minimumMoondownVersion = [1, 0, 6];
const browserDataOverrides = {
  'baseline-browser-mapping': '2.10.32',
  'browserslist': '4.28.2',
  'caniuse-lite': '1.0.30001793',
  'update-browserslist-db': '1.2.3'
};

const parseSemverRange = (range) => {
  const match = range?.match(/\d+\.\d+\.\d+/);
  return match ? match[0].split('.').map(Number) : null;
};

const isAtLeast = (version, minimum) => {
  if (!version) return false;
  for (let index = 0; index < minimum.length; index += 1) {
    if (version[index] > minimum[index]) return true;
    if (version[index] < minimum[index]) return false;
  }
  return true;
};

if (!corePackage.dependencies?.moondown) {
  failures.push('@tada/core must depend on the published moondown package.');
}

for (const workspacePackage of [corePackage, webPackage, desktopPackage]) {
  if (workspacePackage.version !== rootPackage.version) {
    failures.push(`${workspacePackage.name} version must match root package.json.`);
  }
}

if (!desktopConfig.includes(`"version": "${rootPackage.version}"`)) {
  failures.push('Tada Tauri config version must match root package.json.');
}

if (!desktopCargo.includes(`version = "${rootPackage.version}"`)) {
  failures.push('Tada Cargo.toml package version must match root package.json.');
}

for (const [dependencyName, dependencyVersion] of Object.entries(browserDataOverrides)) {
  if (rootPackage.pnpm?.overrides?.[dependencyName] !== dependencyVersion) {
    failures.push(`Root package.json must pin ${dependencyName} ${dependencyVersion} through pnpm.overrides to keep build browser data fresh.`);
  }
  if (!lockfile.includes(`${dependencyName}@${dependencyVersion}`)) {
    failures.push(`pnpm-lock.yaml must resolve ${dependencyName} ${dependencyVersion}.`);
  }
}

if (
  corePackage.dependencies?.moondown &&
  !isAtLeast(parseSemverRange(corePackage.dependencies.moondown), minimumMoondownVersion)
) {
  failures.push('@tada/core must use moondown 1.0.6 or newer for horizontal-rule hit testing, table focus, fenced-code, syntax hiding, table, slash, search, and replace fixes.');
}

if (!editorSource.includes("from 'moondown'") && !editorSource.includes('from "moondown"')) {
  failures.push('Editor.tsx must import the editor API from moondown.');
}

if (!editorSource.includes("moondown/style.css") && !editorSource.includes('moondown/style.css')) {
  failures.push('Editor.tsx must import moondown/style.css for package-owned widgets.');
}

if (editorSource.includes('@/lib/moondown') || aiServiceSource.includes('@/lib/moondown')) {
  failures.push('Tada source must not import the embedded @/lib/moondown copy.');
}

if (fs.existsSync(path.join(rootDir, 'packages/core/src/lib/moondown'))) {
  failures.push('The embedded packages/core/src/lib/moondown directory must be removed.');
}

if (!editorSource.includes('instance.getValue() !== value') || !editorSource.includes('instance.setValue(value)')) {
  failures.push('Editor.tsx must sync external value prop changes into the Moondown instance.');
}

if (!editorSource.includes('installMoondownInteractionFixes')) {
  failures.push('Editor.tsx must install interaction fixes for Moondown table cell focus and controls.');
}

if (!editorSource.includes('openSearch') || !editorSource.includes('openReplace')) {
  failures.push('Editor.tsx must expose Moondown search and replace commands for global shortcuts.');
}

if (!editorSource.includes("key !== 'f' && key !== 'r'")) {
  failures.push('Editor.tsx must handle Cmd/Ctrl+F and Cmd/Ctrl+R at the window level.');
}

if (!mainPageSource.includes('selectedTaskId ? <TaskDetail key={selectedTaskId}/> : <TaskDetailPlaceholder/>')) {
  failures.push('MainPage.tsx must render the desktop task detail panel directly instead of leaving it in a drawer transform.');
}

if (!mainPageSource.includes('min-w-0 overflow-hidden')) {
  failures.push('MainPage.tsx must constrain the desktop detail column so it cannot overflow offscreen.');
}

if (!mainLayoutSource.includes("useMediaQuery('(min-width: 768px)'")) {
  failures.push('MainLayout.tsx must detect compact screens so the desktop sidebar cannot squeeze mobile content.');
}

if (!mainLayoutSource.includes('showSecondarySidebar')) {
  failures.push('MainLayout.tsx must centralize secondary sidebar visibility for route and compact-screen handling.');
}

if (!appSource.includes('useMacFullscreenClose')) {
  failures.push('Tada must intercept macOS fullscreen close requests in the core app shell.');
}

if (appSource.includes('setFullscreen(false)') || appSource.includes('isFullscreen()')) {
  failures.push('Tada Cmd+W must hide the window directly instead of exiting fullscreen first.');
}

if (!appSource.includes('.hide()')) {
  failures.push('Tada Cmd+W must hide the window instead of quitting the app.');
}

if (!desktopConfig.includes('core:window:allow-hide')) {
  failures.push('Tada desktop capabilities must allow close-to-hide behavior.');
}

if (desktopConfig.includes('core:window:allow-is-fullscreen')) {
  failures.push('Tada desktop capabilities must not allow unused fullscreen state checks.');
}

if (desktopConfig.includes('core:window:allow-set-fullscreen')) {
  failures.push('Tada desktop capabilities must not allow unused fullscreen mutations.');
}

for (const [workflowPath, workflowSource] of workflowSources) {
  if (workflowSource.includes('actions/checkout@v4')) {
    failures.push(`${workflowPath} must not use checkout@v4 because it runs on the deprecated Node 20 runtime.`);
  }
  if (!workflowSource.includes('actions/checkout@v6')) {
    failures.push(`${workflowPath} must use checkout@v6.`);
  }
  if (workflowSource.includes('actions/setup-node@v4')) {
    failures.push(`${workflowPath} must not use setup-node@v4 because it runs on the deprecated Node 20 runtime.`);
  }
  if (!workflowSource.includes('actions/setup-node@v6')) {
    failures.push(`${workflowPath} must use setup-node@v6.`);
  }
  if (!workflowSource.includes('node-version: 24')) {
    failures.push(`${workflowPath} must run Node.js 24.`);
  }
  if (workflowSource.includes('pnpm/action-setup@v4')) {
    failures.push(`${workflowPath} must not use pnpm/action-setup@v4 because it runs on the deprecated Node 20 runtime.`);
  }
  if (!workflowSource.includes('pnpm/action-setup@v6')) {
    failures.push(`${workflowPath} must use pnpm/action-setup@v6.`);
  }
  if (!workflowSource.includes('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true')) {
    failures.push(`${workflowPath} must force JavaScript actions onto Node.js 24 to avoid deprecated Node 20 action runtime warnings.`);
  }
}

const releaseWorkflow = workflowSources.find(([workflowPath]) => workflowPath.endsWith('release.yml'))?.[1] ?? '';
if (releaseWorkflow.includes('softprops/action-gh-release@v1')) {
  failures.push('Tada release workflow must not use action-gh-release@v1 because it runs on the deprecated Node 20 runtime.');
}
if (releaseWorkflow.includes('softprops/action-gh-release')) {
  failures.push('Tada release workflow must not use softprops/action-gh-release because it still emits Node.js 20 deprecation warnings.');
}
if (!releaseWorkflow.includes('gh release create')) {
  failures.push('Tada release workflow must create releases through GitHub CLI instead of a deprecated JavaScript action runtime.');
}
if (!releaseWorkflow.includes('gh release upload')) {
  failures.push('Tada release workflow must upload release assets through GitHub CLI instead of a deprecated JavaScript action runtime.');
}
if (!releaseWorkflow.includes('--repo "${GITHUB_REPOSITORY}"')) {
  failures.push('Tada release workflow must pass --repo to gh release commands so release creation does not depend on checkout state.');
}
if (releaseWorkflow.includes('globstar')) {
  failures.push('Tada release workflow must not rely on bash globstar because macOS runners use /bin/bash without globstar support.');
}

const deployWorkflow = workflowSources.find(([workflowPath]) => workflowPath.endsWith('deploy.yml'))?.[1] ?? '';
if (deployWorkflow.includes('actions/upload-pages-artifact@v3')) {
  failures.push('Tada Pages workflow must not use upload-pages-artifact@v3 because it depends on Node 20-era artifact actions.');
}
for (const deprecatedPagesAction of [
  'actions/configure-pages@v5',
  'actions/upload-pages-artifact@v4',
  'actions/deploy-pages@v4'
]) {
  if (deployWorkflow.includes(deprecatedPagesAction)) {
    failures.push(`Tada Pages workflow must not use ${deprecatedPagesAction} because it still emits Node.js 20 deprecation warnings.`);
  }
}
if (!deployWorkflow.includes('actions/configure-pages@v6')) {
  failures.push('Tada Pages workflow must use configure-pages@v6.');
}
if (!deployWorkflow.includes('actions/upload-pages-artifact@v5')) {
  failures.push('Tada Pages workflow must use upload-pages-artifact@v5.');
}
if (!deployWorkflow.includes('actions/deploy-pages@v5')) {
  failures.push('Tada Pages workflow must use deploy-pages@v5.');
}

if (scheduledReportSource.includes("import('@tauri-apps/api/core')")) {
  failures.push('ScheduledReportGenerator must not dynamically import @tauri-apps/api/core because it creates an ineffective Vite chunk split.');
}

if (scheduledReportSource.includes("import('@tauri-apps/api/event')")) {
  failures.push('ScheduledReportGenerator must not dynamically import @tauri-apps/api/event because it creates an ineffective Vite chunk split.');
}

if (!scheduledReportSource.includes("from '@tauri-apps/api/core'")) {
  failures.push('ScheduledReportGenerator must statically import Tauri invoke.');
}

if (!scheduledReportSource.includes("from '@tauri-apps/api/event'")) {
  failures.push('ScheduledReportGenerator must statically import Tauri listen.');
}

for (const [configPath, configSource] of [
  ['packages/web/vite.config.ts', webViteConfig],
  ['packages/desktop/vite.config.ts', desktopViteConfig]
]) {
  if (configSource.includes('manualChunks')) {
    failures.push(`${configPath} must not manually merge editor dependencies into giant chunks.`);
  }
  if (!configSource.includes('chunkSizeWarningLimit: 1500')) {
    failures.push(`${configPath} must set a 1500KB chunk warning limit for lazy editor and Mermaid chunks.`);
  }
}

if (failures.length > 0) {
  console.error('Moondown integration check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Moondown integration check passed.');
