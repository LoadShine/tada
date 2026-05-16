# Tada npm Moondown Replacement Design

## Goal

Replace Tada's embedded `packages/core/src/lib/moondown` source with the public npm `moondown` package, keep the editor UX unchanged, and prepare the release workflow to build desktop artifacts from a version tag.

## Current State

Tada imports `Moondown`, `MoondownTranslations`, and `stripBase64Images` from the embedded source tree. The npm package `moondown@1.0.0` exports the same default editor class, core types, utility functions, and `moondown/style.css`. The package also depends on the same CodeMirror and widget libraries, so the app should not keep duplicate direct editor-core dependencies unless another Tada feature imports them directly.

## Design

`@tada/core` will depend on `moondown@^1.0.0` and import the editor API from the package entrypoint. The editor component will import `moondown/style.css` and `tippy.js/dist/tippy.css` once at module load so table helpers and widget UI render correctly in both web and desktop bundles.

The React wrapper will continue owning the Moondown instance imperatively. In addition to the existing theme, translations, and AI stream updates, it will synchronize external `value` prop changes into the editor when the editor document differs. This prevents stale editor content when a user switches tasks or imported data refreshes the task body.

`stripBase64Images` will be imported from the public package utilities through the package root, not through a private path. The embedded `packages/core/src/lib/moondown` tree will be removed after all imports are migrated.

## Release

Tada will bump from `0.3.5` to `0.3.6`, update English and Chinese changelog entries, commit the replacement, and tag `v0.3.6`. The existing `release.yml` already builds cross-platform desktop artifacts on `v*.*.*` tags; the implementation will keep that trigger and validate the build locally before pushing.

## Verification

Verification will include dependency installation, TypeScript builds for web and desktop packages, lint where feasible, and a Tauri desktop build or check when local platform dependencies allow it. The final push will include the release tag so GitHub Actions starts the automated build.
