# 🎬 IPTV Player

> IPTV 全能播放器 - 支持 RTMP / M3U 等多種串流格式

![Version](https://img.shields.io/badge/version-1.0.5-blue.svg)
![Electron](https://img.shields.io/badge/Electron-43.x-47848F?logo=electron)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Platform](https://img.shields.io/badge/platform-Windows)

---

## ✨ 功能特色

- 🎥 支援 **RTMP**、**M3U**、**M3U8** 等主流串流格式
- ⚡ 基於 **electron-vlc-player** 的高效能影音解碼
- 🖥️ 跨平台支援：Windows、macOS、Linux
- 🔄 內建自動更新（`electron-updater`）
- 🎨 現代化 UI（React 19 + Tailwind CSS + Radix UI）
- 📋 頻道清單管理，支援虛擬捲動（`@tanstack/react-virtual`）
- 💾 使用 Zustand 進行狀態管理

---

## 🖼️ 截圖

> *(截圖即將上線)*

---

## 🛠️ 技術架構

| 技術 | 版本 | 用途 |
|------|------|------|
| Electron | 43.x | 桌面應用框架 |
| React | 19.x | 前端 UI |
| TypeScript | 5.x | 型別安全 |
| Vite (electron-vite) | 5.x | 建置工具 |
| Tailwind CSS | 3.x | 樣式框架 |
| Radix UI | latest | 無障礙 UI 元件 |
| Zustand | 5.x | 狀態管理 |
| electron-vlc-player | 1.x | 影音播放引擎 |

---

## 🚀 快速開始

### 前置需求

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

### 安裝依賴

```bash
npm install
```

> ⚠️ 安裝後會自動執行 `electron-rebuild` 以重新編譯原生模組。

### 開發模式

```bash
npm run dev
```

### Windows 快速啟動

```bash
start.bat
```

---

## 📦 建置與發佈

### 建置應用程式

```bash
npm run build
```

### 打包安裝檔（不發佈）

```bash
npm run pack
```

### 完整發佈建置

```bash
npm run dist
```

### 建置並驗證 ASAR

```bash
npm run dist:check
```

### 使用 PowerShell 發佈腳本

```powershell
.\release.ps1
```

---

## 📁 專案結構

```
iptv-player/
├── src/                  # 原始碼
│   ├── main/             # Electron 主進程
│   ├── preload/          # Preload 腳本
│   └── renderer/         # React 前端介面
├── build/                # 建置資源（圖示等）
├── scripts/              # 工具腳本
├── electron-builder.yml  # 打包設定
├── electron.vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── start.bat             # Windows 快速啟動
```

---

## 🔧 設定檔

主要設定位於 `electron-builder.yml`，可調整：
- 應用程式名稱、圖示
- 目標平台（Windows `.exe`、macOS `.dmg`、Linux `.AppImage`）
- 自動更新伺服器設定

---

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request！

1. Fork 本專案
2. 建立你的功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 開啟 Pull Request

---

## 📄 授權

本專案以 [MIT License](LICENSE) 授權釋出。

---

<p align="center">Made with ❤️ by <a href="https://github.com/alex200376">alex200376</a></p>
