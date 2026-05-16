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

const failures = [];

if (!corePackage.dependencies?.moondown) {
  failures.push('@tada/core must depend on the published moondown package.');
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

if (failures.length > 0) {
  console.error('Moondown integration check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Moondown integration check passed.');
