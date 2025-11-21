import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const tauriRoot = path.resolve(projectRoot, 'src-tauri');

const platform = process.platform;

console.log(`🚀 Starting desktop build for platform: ${platform}`);

try {
    if (platform === 'darwin') {
        try {
            execSync('which create-dmg');
        } catch (e) {
            console.error('❌ Error: create-dmg is not installed.');
            console.error('Please run: brew install create-dmg');
            process.exit(1);
        }

        const dmgDir = path.join(tauriRoot, 'target/release/bundle/dmg');
        const macosDir = path.join(tauriRoot, 'target/release/bundle/macos');
        if (fs.existsSync(dmgDir)) fs.rmSync(dmgDir, { recursive: true, force: true });

        console.log('📦 Building .app bundle...');
        execSync('tauri build --bundles app', { stdio: 'inherit', cwd: projectRoot });

        const files = fs.readdirSync(macosDir);
        const appName = files.find(f => f.endsWith('.app'));
        if (!appName) throw new Error('Could not find .app bundle');

        const appPath = path.join(macosDir, appName);
        const version = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'))).version;
        const dmgName = `Tada_${version}_${process.arch}.dmg`;
        const dmgPath = path.join(tauriRoot, 'target/release/bundle/dmg', dmgName);

        fs.mkdirSync(path.dirname(dmgPath), { recursive: true });

        console.log('💿 Creating custom DMG with create-dmg...');

        // const volIconPath = path.join(tauriRoot, 'icons/volume.avif');
        const bgImagePath = path.join(tauriRoot, 'icons/dmg-background.png');

        const createDmgCmd = [
            'create-dmg',
            `--volname "Tada Installer"`,
            // `--volicon "${volIconPath}"`,
            `--background "${bgImagePath}"`,
            `--window-pos 200 120`,
            `--window-size 660 400`,
            `--icon-size 100`,
            `--icon "${appName}" 180 170`,
            `--app-drop-link 480 170`,
            `"${dmgPath}"`,
            `"${appPath}"`
        ].join(' ');

        execSync(createDmgCmd, { stdio: 'inherit' });

        console.log(`✅ DMG Created successfully: ${dmgPath}`);

    } else {
        console.log('🪟🐧 Standard build for Windows/Linux...');
        execSync('tauri build', { stdio: 'inherit', cwd: projectRoot });
    }
} catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
}