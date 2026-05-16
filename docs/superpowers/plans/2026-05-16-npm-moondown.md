# Tada npm Moondown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Tada's embedded Moondown copy with `moondown@^1.0.0` and release `v0.3.6`.

**Architecture:** Keep Tada's existing React wrapper and storage/AI integrations. Move editor imports to the package boundary, import package CSS, remove the embedded source tree, and preserve the existing GitHub release workflow.

**Tech Stack:** pnpm 10, React 18, TypeScript 5, Vite 6, Tauri 2, npm package `moondown@1.0.0`.

---

### Task 1: Add npm package dependency and red check

**Files:**
- Modify: `packages/core/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] Run `pnpm --filter @tada/core add moondown@^1.0.0` to add the published package.
- [ ] Run `pnpm --filter @tada/core build` before import migration and confirm the current source still builds against the embedded copy. This establishes the pre-change baseline.

### Task 2: Migrate imports

**Files:**
- Modify: `packages/core/src/components/ui/Editor.tsx`
- Modify: `packages/core/src/services/aiService.ts`

- [ ] Change `Editor.tsx` to import `Moondown` and `MoondownTranslations` from `moondown`.
- [ ] Add module-level imports for `moondown/style.css` and `tippy.js/dist/tippy.css`.
- [ ] Change `aiService.ts` to import `stripBase64Images` from `moondown`.
- [ ] Add a guarded `value` synchronization effect in `Editor.tsx`:

```ts
useEffect(() => {
    const instance = moondownInstanceRef.current;
    if (!instance) return;
    if (instance.getValue() !== value) {
        instance.setValue(value);
    }
}, [value]);
```

### Task 3: Remove embedded copy

**Files:**
- Delete: `packages/core/src/lib/moondown`

- [ ] Run `rg "@/lib/moondown|src/lib/moondown|lib/moondown" packages/core/src` and confirm only migrated references remain absent.
- [ ] Remove the embedded source directory with `git rm -r packages/core/src/lib/moondown`.

### Task 4: Version and changelog

**Files:**
- Modify: `package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/web/package.json`
- Modify: `packages/desktop/package.json`
- Modify: `packages/desktop/src-tauri/tauri.conf.json`
- Modify: `packages/desktop/src-tauri/Cargo.toml`
- Modify: `packages/core/src/config/app.ts`
- Modify: `packages/core/public/content/changelog.en.md`
- Modify: `packages/core/public/content/changelog.zh-CN.md`

- [ ] Run `pnpm bump 0.3.6`.
- [ ] Add changelog entries describing the npm Moondown replacement and editor sync fix.

### Task 5: Verify and release

**Files:**
- Existing GitHub workflow: `.github/workflows/release.yml`

- [ ] Run `pnpm install --frozen-lockfile`.
- [ ] Run `pnpm --filter @tada/core build`.
- [ ] Run `pnpm --filter @tada/web build`.
- [ ] Run `pnpm --filter @tada/desktop build`.
- [ ] Run `pnpm --filter @tada/desktop tauri build --bundles app` if local Tauri dependencies are available.
- [ ] Commit with `release v0.3.6`.
- [ ] Tag `v0.3.6`.
- [ ] Push `main` and the tag to `origin` so GitHub Actions builds release artifacts.
