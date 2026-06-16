---
name: add-i18n-key
description: Add or edit a UI translation key in FruitBiz. Use whenever new user-facing text is added to the React UI, or when the user asks to "add a translation", "add an i18n key", "fix a missing translation", or reports raw keys/wrong-language text showing in the app. Ensures every key exists in ALL THREE language blocks (th, en, zh) in src-ui/src/i18n.ts.
---

# Add an i18n key to FruitBiz

All UI strings live in `/home/user/fruit/src-ui/src/i18n.ts` as `I18N: Record<Lang, Record<string, string | string[]>>` with three blocks in this order: `th` (Thai), `en` (English), `zh` (Chinese).

## The rule (from CLAUDE.md)
**Every key MUST be present in all three language blocks (th / en / zh).** A key missing from a block falls back to Thai, then to the raw key string — which is the usual cause of "raw key" or wrong-language text appearing in the UI.

## Steps to add a key
1. Choose a descriptive snake_case key, prefixed by feature area (e.g. `dash_`, `emp_`, `wht_`, `ps_`, `ev_`, `nav_`, `pay_`, `lbl_`, `btn_`, `toast_`, `col_`).
2. Add the key to **all three** blocks with a correct translation:
   - `th`: natural Thai (this is the primary language).
   - `en`: concise English.
   - `zh`: Simplified Chinese.
3. Place the key near related keys in each block so the three stay roughly parallel.
4. For array values (e.g. `months`), keep the array in all three; access via `tArr('key')` not `t('key')`.
5. Placeholders use `{n}` style and are substituted in the component with `.replace('{n}', value)` (see `dash_overdue_alert`).

## Verify completeness
After editing, confirm no key is missing from any language. Quick check from the repo root:
```bash
cd /home/user/fruit/src-ui && npm run build   # tsc will not catch missing keys, but confirms no syntax break
```
To diff keys across the three blocks, extract the keys of each block and compare — a key in one block but not another is a bug. Report any asymmetry.

## Usage in components
- `const { t, tArr } = useI18n()` then `t('your_key')` / `tArr('your_array_key')`.
- Never hardcode Thai/English/Chinese literals in components — always go through `t()`.
