import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');

const readText = (relativePath) =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const readJson = (relativePath) => JSON.parse(readText(relativePath));

const corePackage = readJson('packages/core/package.json');
const editorSource = readText('packages/core/src/components/ui/Editor.tsx');
const aiServiceSource = readText('packages/core/src/services/aiService.ts');
const mainPageSource = readText('packages/core/src/pages/MainPage.tsx');

const failures = [];

if (!corePackage.dependencies?.moondown) {
  failures.push('@tada/core must depend on the published moondown package.');
}

if (corePackage.dependencies?.moondown && !corePackage.dependencies.moondown.includes('1.0.3')) {
  failures.push('@tada/core must use moondown 1.0.3 or newer for table, slash, search, and replace fixes.');
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

if (failures.length > 0) {
  console.error('Moondown integration check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Moondown integration check passed.');
