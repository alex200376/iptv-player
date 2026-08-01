---
name: release
description: Use when the user asks to push, build, test, and/or release this IPTV Player project on GitHub. Trigger keywords: release, publish, push, build, dist, version bump, github release, deploy, tag.
---

# IPTV Player Release Workflow

Canonical, verified pipeline for the **IPTV Player** Electron project: test → build → push → local release via `release.ps1`. Run the steps in order. **Never** push tags (the `.github/workflows/release.yml` tag-triggered job is for CI build checks only; local `release.ps1` is the release path of record to avoid double-publishing).

## 0. Preflight (every time)

```powershell
# 1. gh authed?
gh auth status

# 2. token present for release.ps1 (must be set in the shell that runs release.ps1)
if (-not $env:GH_TOKEN -and -not $env:GITHUB_TOKEN) { Write-Warning "set GH_TOKEN or GITHUB_TOKEN" }

# 3. ffmpeg bundled (gitignored; needed by stream proxy + packaging)
Test-Path resources\ffmpeg.exe

# 4. clean-ish tree, on main, up to date
git status --short
git branch --show-current
git fetch origin
```

If `resources\ffmpeg.exe` is missing, download it (BtbN build, much faster than gyan.dev):

```powershell
$zip = "$env:TEMP\ffmpeg-win64-gpl.zip"
(New-Object Net.WebClient).DownloadFile("https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip", $zip)
Expand-Archive -Path $zip -DestinationPath "$env:TEMP\ffmpeg-extract" -Force
Copy-Item "$env:TEMP\ffmpeg-extract\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe" "resources\ffmpeg.exe"
```

## 1. Test

```powershell
npm.cmd test
npx tsc --project tsconfig.node.json --noEmit
```

> Use `npm.cmd`, not `npm` — PowerShell execution policy blocks `npm.ps1`. Do **not** run `tsc --project tsconfig.web.json` standalone: it reports pre-existing resolver errors (missing `electronAPI`, `../../../../shared/types`) that the real electron-vite build does not have. Only treat NEW errors introduced by a change as failures.

## 2. Build

```powershell
npm.cmd run build        # electron-vite compile
npm.cmd run dist:check   # electron-builder package + asar integrity check
```

`dist:check` = `npm run dist` + `node scripts/verify-asar.mjs` (checks `release/win-unpacked/resources/app.asar`).

## 3. Push to GitHub

Commit and push **before** releasing so the release is based on the pushed commit:

```powershell
git add src/ package.json package-lock.json scripts/ release.ps1
git commit -m "<type>: <description>"
git push origin main
```

Rules:
- **Never commit** `opencode.json` (personal LMStudio LAN config) or `resources/ffmpeg.exe` (gitignored). Stage explicitly — `git add -A` will pick up junk like `vlc-help.txt`; exclude it.
- If git identity is unset, use the repo-local identity from prior commits: `git config user.name "alex200376"; git config user.email "anthorytsang@gmail.com"`.

## 4. Release (local, canonical)

```powershell
powershell -ExecutionPolicy Bypass -File .\release.ps1 -Version "1.8.1" -Notes "Release notes"
```

What `release.ps1` does (in order):
1. Aborts if `gh release view v<Version>` already succeeds (no overwrite).
2. Bumps `version` in `package.json` via regex + UTF-8 write (preserves the Chinese description; PS 5.1 `ConvertFrom-Json`/`Set-Content` corrupt UTF-8).
3. Sets `CSC_IDENTITY_AUTO_DISCOVERY=false` (no signing cert; auto-discovery downloads winCodeSign and fails extracting macOS symlinks) and runs `npm.cmd run dist`.
4. `gh release create v<Version>` with `IPTV-Player-Setup-<Version>.exe`, `.blockmap`, and `latest.yml` (needed by electron-updater).

Verify:

```powershell
gh release view v1.8.1
```

## Prerequisites (fresh machine, one-time)

- **Native binding**: `electron-vlc-player` compiles `vlc_binding.node` for the Electron version. If the app crashes with `Cannot find module ...electron-vlc-player\build\Release\vlc_binding.node`:
  ```powershell
  $env:PYTHON = "C:\Users\WOW\AppData\Local\Programs\Python\Python312\python.exe"
  npx electron-rebuild -f -w electron-vlc-player
  ```
  Requires Python 3.x + VS Build Tools 2022 C++ workload.
- **`gh` CLI**: `winget install --id GitHub.cli -e` (lands at `C:\Program Files\GitHub CLI\gh.exe`).

## Troubleshooting

- **winCodeSign symlink extraction fails** (`Cannot create symbolic link ... darwin/10.12/lib/libcrypto.dylib`) during `npm run dist`: happens only if signing discovery runs. Fix is `CSC_IDENTITY_AUTO_DISCOVERY=false` (baked into `release.ps1`).
- **`author is missed in the package.json`** warning: harmless, does not block packaging.
- **`spawn ffmpeg ENOENT`** at runtime: `resources/ffmpeg.exe` missing — see preflight.
- **`gh` not found in release.ps1**: ensure GitHub CLI is installed or the path `C:\Program Files\GitHub CLI` is on `PATH`.

## Version bump pattern

Semver `1.x.x`. Third digit = patch, second = feature, first = breaking. Pick the next version and pass it to `release.ps1`; never release the same version twice.
