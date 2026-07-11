#!/usr/bin/env bash
# ============================================================
# IPTV Player - macOS/Linux Dependency Installer
# Installs: Node.js, FFmpeg, VLC
# ============================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]  $*${NC}"; }
info() { echo -e "${YELLOW}[..]  $*${NC}"; }
err()  { echo -e "${RED}[ERR] $*${NC}"; }
header() {
  echo ""
  echo -e "${CYAN}============================================${NC}"
  echo -e "${CYAN}  $*${NC}"
  echo -e "${CYAN}============================================${NC}"
}

cmd_exists() { command -v "$1" &>/dev/null; }

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)
      if cmd_exists apt-get; then echo "debian"
      elif cmd_exists dnf;    then echo "fedora"
      elif cmd_exists pacman; then echo "arch"
      else echo "linux"
      fi
      ;;
    *) echo "unknown" ;;
  esac
}

OS=$(detect_os)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

header "IPTV Player - Dependency Installer ($OS)"
echo "This script will install: Node.js, FFmpeg, VLC"
echo ""

# ---- Homebrew (macOS) ----
if [ "$OS" = "macos" ] && ! cmd_exists brew; then
  header "Installing Homebrew first..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# ---- Node.js ----
header "1/3  Node.js"
if cmd_exists node; then
  ok "Node.js already installed: $(node --version)"
else
  info "Installing Node.js..."
  case "$OS" in
    macos)  brew install node ;;
    debian) curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs ;;
    fedora) sudo dnf install -y nodejs ;;
    arch)   sudo pacman -S --noconfirm nodejs npm ;;
    *)      err "Please install Node.js manually from https://nodejs.org"; exit 1 ;;
  esac
  ok "Node.js installed: $(node --version)"
fi

# ---- FFmpeg ----
header "2/3  FFmpeg"
if cmd_exists ffmpeg; then
  ok "FFmpeg already installed: $(ffmpeg -version 2>&1 | head -1)"
else
  info "Installing FFmpeg..."
  case "$OS" in
    macos)  brew install ffmpeg ;;
    debian) sudo apt-get update && sudo apt-get install -y ffmpeg ;;
    fedora) sudo dnf install -y ffmpeg --allowerasing ;;
    arch)   sudo pacman -S --noconfirm ffmpeg ;;
    *)      err "Please install FFmpeg manually from https://ffmpeg.org/download.html"; exit 1 ;;
  esac
  ok "FFmpeg installed: $(ffmpeg -version 2>&1 | head -1)"
fi

# ---- VLC ----
header "3/3  VLC Media Player"
if cmd_exists vlc; then
  ok "VLC already installed: $(vlc --version 2>&1 | head -1)"
else
  info "Installing VLC..."
  case "$OS" in
    macos)  brew install --cask vlc ;;
    debian) sudo apt-get update && sudo apt-get install -y vlc ;;
    fedora) sudo dnf install -y vlc ;;
    arch)   sudo pacman -S --noconfirm vlc ;;
    *)      err "Please install VLC from https://www.videolan.org/vlc/"; exit 1 ;;
  esac
  ok "VLC installed."
fi

# ---- npm install ----
header "Final Step: npm install"
info "Running npm install in $PROJECT_ROOT ..."
cd "$PROJECT_ROOT"
npm install
ok "npm install completed."

header "Done!"
echo -e "${GREEN}All dependencies installed. Run \`npm run dev\` to start the app.${NC}"
echo ""
