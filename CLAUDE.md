# FruitBiz — CLAUDE.md

## Project Overview
Local offline business document system for Thai SMEs. Electron desktop app with embedded Express API server and React UI.

## Tech Stack
- **Frontend**: React + TypeScript + Vite (`src-ui/`)
- **Backend**: Express.js + better-sqlite3 (`src/`)
- **Desktop**: Electron v34 (`electron/main.js`, `electron/preload.js`)
- **Build**: electron-builder v25, GitHub Actions

## Project Structure
```
electron/main.js        — Electron main process, auto-updater, IPC handlers
electron/preload.js     — Context bridge (exposes electronAPI to renderer)
src/                    — Express API server (TypeScript → compiled to dist/)
src-ui/src/             — React frontend
  App.tsx               — Main layout, nav sections, update banner
  i18n.ts               — Translations (th/en/zh)
  pages/                — Page components
package.json            — electron-builder config under "build" field
.github/workflows/release.yml — CI/CD build pipeline
```

## Build Pipeline (GitHub Actions)
Triggered on: push to `main`, push of `v*` tags, `workflow_dispatch`

1. **build-windows** — NSIS installer, `--publish always` (creates the GitHub Release)
2. **build-windows-portable** — Portable `.exe`, needs build-windows first
3. **build-mac** — Two sequential DMG+zip steps, needs build-windows first

### Mac DMG Build — CRITICAL RULES
**Always build arm64 and x64 as separate sequential steps:**
```yaml
- run: npx electron-builder --mac --arm64 --publish always
- run: npx electron-builder --mac --x64 --publish always
```

**Never use `--arch arm64` — wrong flag, electron-builder doesn't know it.**
Correct flags: `--arm64`, `--x64` (boolean, no value).

**Never put `arch` in package.json mac target** — if arch is specified in config,
electron-builder ignores CLI flags and builds all listed arches in one run,
causing hdiutil mount collision (`/Volumes/FruitBiz` already mounted).

```json
// CORRECT — no arch in config, CI flags control it
"mac": { "target": [{ "target": "dmg" }, { "target": "zip" }] }

// WRONG — causes both arches to build together → hdiutil error
"mac": { "target": [{ "target": "dmg", "arch": ["arm64", "x64"] }] }
```

**Must include `zip` target alongside `dmg`** — electron-updater needs the `.zip` for
in-place Mac auto-updates. DMG alone → `latest-mac.yml` has no zip path → auto-update fails on Mac.

### Windows Portable Upload — version tag
Use package.json version, not `github.ref_name` (which is "main" for branch pushes):
```powershell
$version = node -e "console.log('v' + require('./package.json').version)"
gh release upload $version $exe.FullName --clobber
```

## Dependencies — Critical Versions
- **better-sqlite3**: must be `^11.0.0` — v9.x uses C++17, conflicts with Electron v34 headers (requires C++20)
- Mac rebuild needs: `CXXFLAGS="-std=c++20" npx @electron/rebuild -f -w better-sqlite3`

## electron-builder `files` Config
Do NOT add `node_modules/**/*` explicitly — electron-builder auto-includes all `dependencies` from package.json. Explicit node_modules globs can accidentally exclude packages like `electron-updater`.

```json
"files": [
  "electron/**/*",
  "dist/**/*",
  "web/**/*",
  "!**/*.ts",
  "!**/*.map"
]
```

## Auto-Update (electron-updater)
- Pulls from GitHub Releases of this repo (`suphasin01/fruit`)
- `latest.yml` (Windows) / `latest-mac.yml` (Mac) is published automatically by electron-builder
- Download progress is sent from main → renderer via `update-progress` IPC event
- Preload exposes: `onUpdateStatus`, `onUpdateProgress`, `onUpdateNotAvailable`, `checkForUpdates`, `installUpdate`

## i18n (src-ui/src/i18n.ts)
Three languages: `th` (Thai), `en` (English), `zh` (Chinese).
All keys must be added to **all three** language blocks.

### Nav section keys
| Key | TH | EN | ZH |
|-----|----|----|-----|
| `nav_sec_main` | หลัก | Main | 主要 |
| `nav_sec_docs` | สร้างเอกสาร | Create Documents | 创建文件 |
| `nav_sec_data` | ข้อมูล | Data | 数据 |
| `nav_sec_analyze` | วิเคราะห์ | Analytics | 分析 |

### Nav item keys
| Key | TH | EN | ZH |
|-----|----|----|-----|
| `nav_withholding_tax` | ภาษีหัก ณ ที่จ่าย | Withholding Tax | 代扣税 |

## Nav Structure (App.tsx)
```js
const navSections = [
  { label: t('nav_sec_main'),    items: ['dashboard', 'payments'] },
  { label: t('nav_sec_docs'),    items: ['documents', 'withholding_tax'] },
  { label: t('nav_sec_data'),    items: ['contacts', 'products'] },
  { label: t('nav_sec_analyze'), items: ['reports'] },
  { label: '',                   items: ['companies', 'settings'] },
]
```

## Releasing a New Version
1. Bump `"version"` in `package.json`
2. Commit: `chore: release vX.X.X`
3. Push to `main` → GitHub Actions builds and publishes automatically
