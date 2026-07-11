<div align="center">

[![Header](https://capsule-render.vercel.app/api?type=waving&color=0:1a1a2e,50:16213e,100:0f3460&height=200&section=header&text=IPTV%20Player&fontSize=60&fontColor=e94560&animation=fadeIn&fontAlignY=38&desc=全能桌面%20IPTV%20播放器%20·%20Electron%20%2B%20React%20%2B%20VLC&descAlignY=58&descColor=a8b2d8)](https://github.com/alex200376/iptv-player)

<!-- Dynamic Badges -->
[![Release](https://img.shields.io/github/v/release/alex200376/iptv-player?style=for-the-badge&logo=github&label=Latest%20Release&color=e94560)](https://github.com/alex200376/iptv-player/releases)
[![Downloads](https://img.shields.io/github/downloads/alex200376/iptv-player/total?style=for-the-badge&logo=github&label=Total%20Downloads&color=0f3460)](https://github.com/alex200376/iptv-player/releases)
[![Stars](https://img.shields.io/github/stars/alex200376/iptv-player?style=for-the-badge&logo=github&color=f5a623)](https://github.com/alex200376/iptv-player/stargazers)
[![Last Commit](https://img.shields.io/github/last-commit/alex200376/iptv-player?style=for-the-badge&logo=git&color=16213e)](https://github.com/alex200376/iptv-player/commits)
[![Issues](https://img.shields.io/github/issues/alex200376/iptv-player?style=for-the-badge&logo=github&color=e94560)](https://github.com/alex200376/iptv-player/issues)
[![License](https://img.shields.io/github/license/alex200376/iptv-player?style=for-the-badge&color=4caf50)](LICENSE)

> 🎬 一款輕量、現代、跨平台的桌面 IPTV 播放器，支援 M3U / RTMP 串流格式，內建 VLC 核心引擎，帶來流暢的直播體驗。

</div>

---

## ⚡ 技術棧

<div align="center">

[![Skills](https://skillicons.dev/icons?i=electron,react,ts,tailwind,nodejs,vite&theme=dark)](https://skillicons.dev)

</div>

| 層級 | 技術 |
|------|------|
| **Frontend** | React 19 · TypeScript 5.7 · Tailwind CSS 3 · Radix UI |
| **Runtime** | Electron 43 · Node.js |
| **Player** | electron-vlc-player (VLC core) |
| **State** | Zustand 5 |
| **I18n** | i18next 26 · react-i18next |
| **Build** | electron-builder 26 · electron-vite · Vite |

---

## ✨ 功能特色

| 功能 | 說明 |
|------|------|
| 🎞️ **多格式串流支援** | 支援 M3U、RTMP、HLS 等主流 IPTV 串流格式 |
| ⚡ **VLC 核心引擎** | 基於 `electron-vlc-player` 提供穩定高效的播放能力 |
| 🌐 **多語言介面** | 整合 `i18next`，支援自動偵測系統語言 |
| 🗂️ **頻道管理** | 匯入 M3U 播放清單，分組瀏覽頻道 |
| 🔄 **自動更新** | 使用 `electron-updater` 實現靜默後台更新 |
| 🎨 **現代 UI** | Tailwind CSS + Radix UI 打造的深色主題介面 |
| 📦 **虛擬列表渲染** | 採用 `@tanstack/react-virtual` 流暢渲染大量頻道 |
| 🔧 **狀態管理** | 使用 `Zustand` 輕量管理應用狀態 |

---

## 📦 安裝與使用

### 方法一：下載發行版（推薦）

前往 [Releases](https://github.com/alex200376/iptv-player/releases) 下載最新版安裝包。

| 平台 | 安裝包格式 |
|------|-----------|
| Windows | `.exe` 安裝程式 / Portable |

### 方法二：從原始碼啟動（開發模式）

**環境需求：** Node.js >= 18、npm

```bash
# 1. 克隆倉庫
git clone https://github.com/alex200376/iptv-player.git
cd iptv-player

# 2. 安裝依賴（自動 rebuild electron-vlc-player）
npm install

# 3. 啟動開發模式
npm run dev
```

> 💡 亦可使用 `start.bat` 快速啟動（Windows）

---

## 📁 項目結構

```
iptv-player/
├── src/
│   ├── main/          # Electron 主進程
│   ├── preload/       # Preload 腳本
│   └── renderer/      # React 前端頁面
├── resources/         # 應用圖標及靜態資源
├── build/             # 構建輸出配置
├── electron-builder.yml
├── electron.vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## 🚀 可用腳本

```bash
npm run dev          # 啟動開發模式（熱重載）
npm run build        # 構建應用
npm run dist         # 打包為安裝程式
npm run dist:check   # 打包並驗證 ASAR 完整性
npm run preview      # 預覽構建結果
```

---

## 📋 系統需求

- **作業系統：** Windows 10 / 11（64-bit）
- **記憶體：** 最低 4GB RAM（建議 8GB）
- **儲存空間：** 至少 500MB 可用空間
- **網路：** 穩定的網際網路連線（用於串流播放）

---

## 🗺️ 開發路線圖

- [x] M3U 播放清單匯入
- [x] RTMP 串流支援
- [x] 多語言介面
- [x] 自動更新
- [ ] EPG 電子節目表整合
- [ ] 收藏頻道功能
- [ ] macOS / Linux 支援
- [ ] 畫中畫（PiP）模式

---

## 📊 倉庫活躍度

![Alt](https://repobeats.axiom.co/api/embed/3b690494bfeb187b8b6b030f7ee27c861a26dbba.svg "Repobeats analytics image")

---

## 🤝 貢獻指南

歡迎提交 Pull Request 或 Issue！

1. Fork 此倉庫
2. 建立功能分支：`git checkout -b feature/your-feature`
3. 提交變更：`git commit -m 'feat: add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 開啟 Pull Request

### 👥 貢獻者

<a href="https://github.com/alex200376/iptv-player/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=alex200376/iptv-player" />
</a>

---

## 📄 授權協議

本項目採用 [MIT License](LICENSE) 開源授權。

---

<div align="center">

[![Footer](https://capsule-render.vercel.app/api?type=waving&color=0:1a1a2e,50:16213e,100:0f3460&height=120&section=footer)](https://github.com/alex200376/iptv-player)

Made with ❤️ by [alex200376](https://github.com/alex200376)

⭐ 如果這個項目對你有幫助，請給個 Star 支持！

</div>
