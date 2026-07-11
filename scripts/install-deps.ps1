# ============================================================
# IPTV Player - Windows Dependency Installer
# Installs: Node.js, FFmpeg, VLC
# Requires: Windows 10/11, PowerShell 5+
# Run as Administrator for best results
# ============================================================

param(
  [switch]$SkipNode,
  [switch]$SkipFFmpeg,
  [switch]$SkipVLC
)

$ErrorActionPreference = "Stop"

function Write-Header {
  param([string]$text)
  Write-Host ""
  Write-Host "============================================" -ForegroundColor Cyan
  Write-Host "  $text" -ForegroundColor Cyan
  Write-Host "============================================" -ForegroundColor Cyan
}

function Write-OK   { param([string]$t) Write-Host "[OK]  $t" -ForegroundColor Green  }
function Write-INFO { param([string]$t) Write-Host "[..] $t"  -ForegroundColor Yellow }
function Write-ERR  { param([string]$t) Write-Host "[ERR] $t" -ForegroundColor Red    }

function Test-Command([string]$cmd) {
  return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Install-Winget {
  if (-not (Test-Command "winget")) {
    Write-INFO "winget not found. Please install App Installer from the Microsoft Store."
    Start-Process "https://aka.ms/getwinget"
    Read-Host "Press Enter after winget is installed, then re-run this script"
    exit 1
  }
}

Write-Header "IPTV Player - Dependency Installer (Windows)"
Write-Host "This script will install: Node.js, FFmpeg, VLC" -ForegroundColor White
Write-Host ""

# ---- Check winget ----
Install-Winget

# ---- Node.js ----
if (-not $SkipNode) {
  Write-Header "1/3  Node.js"
  if (Test-Command "node") {
    $ver = node --version
    Write-OK "Node.js already installed: $ver"
  } else {
    Write-INFO "Installing Node.js LTS via winget..."
    winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) { Write-OK "Node.js installed successfully." }
    else { Write-ERR "Node.js installation failed. Visit https://nodejs.org" }
  }
} else {
  Write-INFO "Skipping Node.js (--SkipNode)"
}

# ---- FFmpeg ----
if (-not $SkipFFmpeg) {
  Write-Header "2/3  FFmpeg"
  if (Test-Command "ffmpeg") {
    $ver = ffmpeg -version 2>&1 | Select-Object -First 1
    Write-OK "FFmpeg already installed: $ver"
  } else {
    Write-INFO "Installing FFmpeg via winget..."
    winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) {
      Write-OK "FFmpeg installed. You may need to restart your terminal for PATH to update."
    } else {
      Write-ERR "FFmpeg winget install failed. Trying Chocolatey fallback..."
      if (Test-Command "choco") {
        choco install ffmpeg -y
      } else {
        Write-ERR "Please download FFmpeg manually from https://ffmpeg.org/download.html"
        Write-INFO "Extract and add to PATH: C:\ffmpeg\bin"
      }
    }
  }
} else {
  Write-INFO "Skipping FFmpeg (--SkipFFmpeg)"
}

# ---- VLC ----
if (-not $SkipVLC) {
  Write-Header "3/3  VLC Media Player"
  $vlcPaths = @(
    "${env:ProgramFiles}\VideoLAN\VLC\vlc.exe",
    "${env:ProgramFiles(x86)}\VideoLAN\VLC\vlc.exe"
  )
  $vlcFound = $vlcPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

  if ($vlcFound) {
    Write-OK "VLC already installed at: $vlcFound"
  } else {
    Write-INFO "Installing VLC via winget..."
    winget install --id VideoLAN.VLC -e --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) { Write-OK "VLC installed successfully." }
    else { Write-ERR "VLC install failed. Download from https://www.videolan.org/vlc/" }
  }
} else {
  Write-INFO "Skipping VLC (--SkipVLC)"
}

# ---- npm install ----
Write-Header "Final Step: npm install"
$projectRoot = Split-Path -Parent $PSScriptRoot
Write-INFO "Running npm install in $projectRoot ..."
Set-Location $projectRoot
npm install
if ($LASTEXITCODE -eq 0) { Write-OK "npm install completed." }
else { Write-ERR "npm install failed. Check the output above." }

Write-Header "Done!"
Write-Host "All dependencies installed. Run `npm run dev` to start the app." -ForegroundColor Green
Write-Host ""
