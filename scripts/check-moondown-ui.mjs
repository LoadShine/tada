import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { chromium } from '@playwright/test';

const host = '127.0.0.1';
let serverProcess;

const rootUrl = await startWebServer();

try {
  await runMoondownUiChecks(rootUrl);
  console.log('Tada Moondown UI check passed.');
} finally {
  await stopWebServer();
}

async function runMoondownUiChecks(url) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    await openSeededTask(page, url);
    await assertDesktopEditorSearchReplace(page);
    await assertChaoticMoondownEditorWorkflow(page, url);
    await assertNoHorizontalOverflow(page, 'desktop editor layout');

    await page.setViewportSize({ width: 390, height: 740 });
    await openSeededTask(page, url);
    await assertMobileEditorSearchPanel(page);
    await assertNoHorizontalOverflow(page, 'mobile editor layout');

    assert.deepEqual(errors, [], 'browser console/page errors should be empty');
  } finally {
    await browser.close();
  }
}

async function openSeededTask(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((seed) => {
    localStorage.clear();
    localStorage.setItem('tada-userProfile', JSON.stringify(seed.profile));
    localStorage.setItem('tada-lists', JSON.stringify(seed.lists));
    localStorage.setItem('tada-tasks', JSON.stringify(seed.tasks));
  }, createSeedData());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.getByText('Markdown Hit Test', { exact: true }).click();
  await page.locator('.cm-content').waitFor({ timeout: 5000 });
  assert.match(await editorText(page), /alpha after rule/, 'seeded Moondown content should render in task detail');
}

async function assertDesktopEditorSearchReplace(page) {
  await page.keyboard.press(`${modifierKey()}+F`);
  await page.locator('.cm-search input[name="search"]').click();
  await page.keyboard.type('alpha');
  await page.waitForTimeout(120);
  assert.equal(await page.locator('.cm-searchMatch,.cm-searchMatch-selected').count(), 3, 'search should highlight every exact match');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  assert.equal(await selectedText(page), 'alpha', 'Enter should select the active exact match');

  await page.locator('.cm-search button[name="next"]').click();
  await page.waitForTimeout(120);
  assert.equal(await selectedText(page), 'alpha', 'Next should keep an exact match selected after a horizontal rule');

  await page.keyboard.press(`${modifierKey()}+R`);
  await page.locator('.cm-search input[name="replace"]').fill('omega');
  await page.locator('.cm-search button[name="replace"]').click();
  await page.waitForTimeout(180);

  const afterReplace = await editorText(page);
  assert.match(afterReplace, /omega after rule/, 'replace should update the active match after the horizontal rule');
  assert.match(afterReplace, /alpha first/, 'replace should not update inactive previous matches');
}

async function assertMobileEditorSearchPanel(page) {
  await page.keyboard.press(`${modifierKey()}+F`);
  await page.locator('.cm-search input[name="search"]').click();
  await page.keyboard.type('alpha');
  await page.waitForTimeout(120);
  assert.equal(await page.locator('.cm-searchMatch,.cm-searchMatch-selected').count(), 3, 'mobile search should highlight exact matches');
  await assertBoxInsideViewport(page, '.cm-search', 'mobile Moondown search panel');
}

async function assertChaoticMoondownEditorWorkflow(page, url) {
  await page.setViewportSize({ width: 390, height: 740 });
  await openSeededTask(page, url);

  const content = [
    '# Chaos',
    '',
    'alpha before rule',
    '---',
    'alpha after rule one',
    'alpha after rule two',
    '',
    '| A | B | C |',
    '| - | - | - |',
    '| 1 | 2 | 3 |',
    '| 4 | 5 | 6 |',
    '',
    '```latex',
    '\\\\frac{a}{b}',
    '```',
    '',
    'tail',
    '',
  ].join('\n');

  await page.locator('.cm-content').click();
  await page.keyboard.press(`${modifierKey()}+A`);
  await page.keyboard.insertText(content);
  await page.waitForTimeout(250);

  await focusEditorText(page, 'tail', 'tail'.length);
  await page.keyboard.type('\n/table');
  await page.waitForTimeout(180);
  await assertBoxInsideViewport(page, '.cm-slash-command-menu', 'mobile slash command menu near editor bottom');
  await page.keyboard.press('Escape');

  await page.keyboard.press(`${modifierKey()}+F`);
  await page.locator('.cm-search input[name="search"]').fill('alpha after');
  await page.waitForTimeout(160);
  assert.equal(await page.locator('.cm-searchMatch,.cm-searchMatch-selected').count(), 2, 'filled search input should immediately highlight exact matches');
  await assertBoxInsideViewport(page, '.cm-search', 'mobile filled search panel');
  await page.keyboard.press('Escape');

  await page.locator('.table-helper td').nth(4).click();
  await page.locator('.table-helper-operate-button.left').click();
  await page.waitForTimeout(120);
  await assertBoxInsideViewport(page, '.table-action-popover', 'mobile table row action popover');
  await page.locator('.table-action-popover .tippy-button[title="Insert row below"]').last().click();
  await page.waitForTimeout(160);
  const focusedCell = await page.locator('.table-helper td:focus').evaluate((cell) => ({
    rowIndex: cell.parentElement?.rowIndex,
    cellIndex: cell.cellIndex,
  }));
  assert.deepEqual(focusedCell, { rowIndex: 2, cellIndex: 1 }, 'inserted table row should receive focus in the same column');
}

async function assertNoHorizontalOverflow(page, label) {
  const layout = await page.evaluate(() => {
    const root = document.documentElement;
    const editor = document.querySelector('.cm-editor')?.getBoundingClientRect();
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      editor: editor && {
        x: editor.x,
        y: editor.y,
        right: editor.right,
        bottom: editor.bottom,
        width: editor.width,
        height: editor.height,
      },
    };
  });
  assert.ok(layout.scrollWidth <= layout.clientWidth + 1, `${label} should not horizontally overflow`);
  assert.ok(layout.editor?.width > 0 && layout.editor?.height > 0, `${label} editor should be visible`);
}

async function assertBoxInsideViewport(page, selector, label) {
  const box = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  assert.ok(box.width > 0 && box.height > 0, `${label} should be visible`);
  assert.ok(box.x >= -0.5, `${label} should not overflow left`);
  assert.ok(box.y >= -0.5, `${label} should not overflow top`);
  assert.ok(box.right <= box.viewportWidth + 0.5, `${label} should not overflow right`);
  assert.ok(box.bottom <= box.viewportHeight + 0.5, `${label} should not overflow bottom`);
}

async function editorText(page) {
  return page.locator('.cm-content').evaluate((node) => node.textContent || '');
}

async function selectedText(page) {
  return page.evaluate(() => getSelection()?.toString() || '');
}

async function focusEditorText(page, needle, offset = 0) {
  const line = page.locator('.cm-line').filter({ hasText: needle }).last();
  await line.scrollIntoViewIfNeeded();
  const box = await line.boundingBox();
  if (!box) throw new Error(`Line is unavailable for text: ${needle}`);
  await page.mouse.click(box.x + Math.min(42 + offset * 6, Math.max(8, box.width - 4)), box.y + box.height / 2);
  if (offset >= needle.length) {
    await page.keyboard.press('End');
  }
}

function createSeedData() {
  const now = Date.now();
  return {
    profile: {
      persona: null,
      workRealityModel: {
        taskView: null,
        uncertaintyTolerance: null,
        incompletionStyle: null,
        confidence: { taskView: 0.7, uncertaintyTolerance: 0.7, incompletionStyle: 0.7 },
      },
      userNote: null,
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    },
    lists: [{ id: 'list-inbox', name: 'Inbox', icon: 'inbox', order: 1 }],
    tasks: [{
      id: 'task-e2e',
      title: 'Markdown Hit Test',
      completed: false,
      completedAt: null,
      completePercentage: null,
      startDate: null,
      dueDate: null,
      listId: 'list-inbox',
      listName: 'Inbox',
      content: '# Heading\n\nalpha first\n---\nalpha after rule\nbeta alpha beta',
      order: 1000,
      createdAt: now,
      updatedAt: now,
      tags: [],
      priority: null,
      groupCategory: 'nodate',
      subtasks: [],
    }],
  };
}

function modifierKey() {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

async function startWebServer() {
  const port = await getFreePort();
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const args = ['--filter', '@tada/web', 'exec', 'vite', '--host', host, '--port', String(port), '--strictPort'];
  serverProcess = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });

  let output = '';
  serverProcess.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  serverProcess.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  const url = `http://${host}:${port}/tada/`;
  await waitForServer(url, () => output);
  return url;
}

async function stopWebServer() {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill('SIGTERM');
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2000);
    serverProcess.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function waitForServer(url, getOutput) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 25_000) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`Tada web server exited early.\n${getOutput()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep polling until Vite is ready or the timeout expires.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for Tada web server.\n${getOutput()}`);
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address) resolve(address.port);
        else reject(new Error('Could not allocate a free port.'));
      });
    });
  });
}
