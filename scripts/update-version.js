import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {execSync} from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let newVersion = args[0];

const rootPackagePath = path.join(rootDir, 'package.json');
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf-8'));

if (!newVersion) {
    console.log('No version provided in args, using root package.json version.');
    newVersion = rootPackage.version;
} else {
    console.log(`Updating root package.json to ${newVersion}...`);
    rootPackage.version = newVersion;
    fs.writeFileSync(rootPackagePath, JSON.stringify(rootPackage, null, 2) + '\n');
}

console.log(`🚀 Syncing version ${newVersion} across the workspace...`);

const filesToUpdate = [
    path.join(rootDir, 'packages/core/package.json'),
    path.join(rootDir, 'packages/web/package.json'),
    path.join(rootDir, 'packages/desktop/package.json'),
    path.join(rootDir, 'packages/desktop/src-tauri/tauri.conf.json'),
];

filesToUpdate.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (filePath.endsWith('tauri.conf.json')) {
            content.version = newVersion;
        } else {
            content.version = newVersion;
        }

        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
        console.log(`✅ Updated ${path.relative(rootDir, filePath)}`);
    } else {
        console.warn(`⚠️ File not found: ${filePath}`);
    }
});

const cargoPath = path.join(rootDir, 'packages/desktop/src-tauri/Cargo.toml');
if (fs.existsSync(cargoPath)) {
    let cargoContent = fs.readFileSync(cargoPath, 'utf-8');
    const versionRegex = /^version\s*=\s*".*"/m;
    cargoContent = cargoContent.replace(versionRegex, `version = "${newVersion}"`);
    fs.writeFileSync(cargoPath, cargoContent);
    console.log(`✅ Updated ${path.relative(rootDir, cargoPath)}`);
}

const appConfigPath = path.join(rootDir, 'packages/core/src/config/app.ts');
if (fs.existsSync(appConfigPath)) {
    let tsContent = fs.readFileSync(appConfigPath, 'utf-8');
    const appVersionRegex = /export const APP_VERSION = ['"].*['"];/;

    tsContent = tsContent.replace(appVersionRegex, `export const APP_VERSION = '${newVersion}';`);

    fs.writeFileSync(appConfigPath, tsContent);
    console.log(`✅ Updated ${path.relative(rootDir, appConfigPath)}`);
}

execSync(`git tag v${newVersion}`)

console.log(`🎉 Version sync complete! Run 'pnpm install' to update lockfiles if needed.`);