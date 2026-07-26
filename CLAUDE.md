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
  whtForm.ts            — Builds the 50ทวิ certificate (overlay on official form)
  whtFormBg.ts          — Official RD blank form as base64 PNG (print background)
  whtFormFields.ts      — Exact AcroForm field positions (auto-generated)
package.json            — electron-builder config under "build" field
```

## Withholding Tax (50 ทวิ) Certificate — EXACT form match
The printed certificate IS the official Revenue Department form, not a re-drawn table.
- `whtFormBg.ts` — the official blank PDF rendered to a 150dpi grayscale PNG (data URI),
  used as a full-page CSS background. Every line/border/static label is the real form.
- `whtFormFields.ts` — every data field's exact rectangle, extracted from the official
  PDF's **AcroForm** (`pypdf` → `/Annots` `/Rect`). PDF origin is bottom-left, so
  `t = 842 - y1`. Comb fields (`id1`, `tin1`) carry `comb: maxLen` (13-digit id uses a
  17-cell comb string `"D DDDD DDDDD DD D"`; 10-digit uses 13-cell).
- `whtForm.ts` overlays data at those positions (pt → mm). Font is `AngsanaUPC` (the
  form's own font, present on Windows) with web fallbacks.
- chk1..chk7 = ภ.ง.ด 1ก/1กพิเศษ/2/3/2ก/3ก/53; chk8..11 = payer type.

## Local Builds Only
GitHub Releases and automatic release workflows are intentionally disabled.
Pushing to `main` must not build, publish, or upload installers.

- `npm run dist:win` builds the Windows installer locally with `--publish never`.
- `npm run dist:win-portable` builds the portable Windows executable locally.
- `npm run dist:mac` builds macOS artifacts locally with `--publish never`.

## Dependencies — Critical Versions
- **better-sqlite3**: must be `^11.0.0` — v9.x uses C++17, conflicts with Electron v34 headers (requires C++20)
- Mac rebuild needs: `CXXFLAGS="-std=c++20" npx @electron/rebuild -f -w better-sqlite3`

## electron-builder `files` Config
Do NOT add `node_modules/**/*` explicitly — electron-builder auto-includes all `dependencies` from package.json.

```json
"files": [
  "electron/**/*",
  "dist/**/*",
  "web/**/*",
  "!**/*.ts",
  "!**/*.map"
]
```

## Updates and GitHub Releases
The installed application has no auto-update integration and does not connect to
GitHub Releases. Do not add `electron-updater`, publish metadata, or release workflows.

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

## Version Policy
Do not bump the application version unless the user explicitly requests it.
