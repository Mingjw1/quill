# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev         # Start Vite dev server (browser preview)
npm run build       # Build web version to dist/
npm run preview     # Preview built web version
npx tauri dev       # Start Tauri dev (desktop app with hot-reload)
npx tauri build     # Build release binaries
npm run tauri -- .  # Passthrough to Tauri CLI
```

No tests, no linter, no formatter configured in this project.

## Architecture

**Tauri v2 + Vue 3** desktop note-taking app. No TypeScript, no Vue Router, no Pinia — all state in a single reactive store.

### Layout (CSS Grid 3-column)
- `Sidebar.vue` (220px) — categories, favorites, collapsible to 52px
- `FilePanel.vue` (260px) — file list per category, search bar, export menu
- `ContentPanel.vue` (1fr) — Markdown/code/block rendering, TOC overlay

Root overlays rendered in `App.vue`: `ContextMenu`, `BlockMenu`, `LockOverlay`, `Toast`.

### Single Store (`src/stores/useStore.js`)
Vue 3 `reactive()` object persisted to localStorage (1s debounced `watch`). Key state:
- `data.categories`, `data.files` (keyed by category id), `data.passwords`
- UI state: `activeCategory`, `activeFile`, `sidebarCollapsed`, current view state
- Lock state: locked categories, unlock timestamps (30-min session)
- Context menu, toast state

### Markdown Rendering
`marked` v18 with plugins: `marked-alert`, `marked-highlight`, `marked-katex-extension`. Code highlighting via `highlight.js` (Atom One Dark). Dual-pane source/preview with synced scroll.

### Code Editor Mode
Transparent textarea overlaid on syntax-highlighted `<pre>` block — textarea has `color: transparent` with visible caret. Triggered by file extensions (.json, .log, .js, .py, etc.).

### Tauri Desktop Features
- `@tauri-apps/plugin-fs`: file read/write/dir operations
- `@tauri-apps/plugin-dialog`: open/save file dialogs
- `@tauri-apps/plugin-cli`: parse CLI args for external file opening
- `@tauri-apps/plugin-single-instance`: handle second-instance file open events
- Tauri detection: check `window.__TAURI_INTERNALS__` or `window.__TAURI__`

### Security Model
Category-level password protection via pattern lock + PIN. PBKDF2+SHA-256 hashing (100k iterations, 16-byte salt) using Web Crypto API. Locked categories have blurred content and blocked export. 30-minute auto-lock timer per category.

### Build Pipeline (CI/CD)
GitHub Actions on `v*` tags: matrix build for macOS (x86_64 + aarch64 universal) and Windows (NSIS installer). Uses `tauri-apps/tauri-action@v0` to create release with binaries.

## Key Conventions

- **Chinese UI** — all user-facing text is Simplified Chinese
- **No Reactivity helpers** — manual `reactive()` + `watch()` pattern, no Pinia
- **No `<script setup>`** convention — mix of Options and Composition API
- **CSS custom properties** for theming — `data-theme` attribute with 4 themes (light, dark, eye-care, sakura)
- **Font stack**: Cormorant Garamond (serif/titles), DM Sans (body), JetBrains Mono (code)
- **Version**: sync `package.json` version with Tauri config for releases
