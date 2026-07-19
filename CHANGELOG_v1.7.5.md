# v1.7.5 — Stream Verification Overhaul & Playback Resilience

> **30 files changed** · 886 insertions(+) · 554 deletions(-)

---

## 🎯 Channel Verification — Major Rewrite

### New Verification Dashboard
The **Channel Verifier** in Settings has been completely rebuilt with real-time analytics:

| Feature | Description |
|---|---|
| **Progress Bar** | Visual completion indicator showing check progress |
| **Filter Tabs** | Switch between All / Online / Offline / Skipped with live counts |
| **Latency Display** | Color-coded response times (green < 500ms, yellow < 1500ms, red > 1500ms) |
| **Bulk Delete Offline** | One-click removal of all offline channels |
| **CSV Export** | Download full verification report with latency data (UTF-8 BOM) |

### Smarter Stream Detection
- **Latency-based online detection**: Any stream that responds within the timeout is now marked `online` — slow streams that take >15s to respond will show **OK** instead of **XX**
- **HLS master playlist CORS fix**: Added `Origin` header to variant playlist requests; if the master playlist has `#EXT-X-STREAM-INF` but the variant fetch fails, the stream is still marked `online` (VLC can play it)
- **Increased probe timeouts**: All HTTP probes raised to 15–20s for slow-loading streams
- **Browser User-Agent headers**: `probeHls` and `probeM3u` now send full browser UA + Accept headers, matching real browser requests
- **`.ts` proxy concurrency fix**: Replaced debounced `getProxyUrl` with reentrant `createProxyUrl` to allow concurrent `.ts` stream probes without cancellation
- **`.ts` chunk reading fix**: Probe now accumulates ≥940 bytes before TS magic-byte validation
- **Retry increase**: Default `maxAttempts` raised from 3 → 5 for all probes

---

## 🔧 Playback & Player Stability

### Player Lifecycle
- **Fixed stuck Opening/Buffering**: `abandonPlayer()` now calls `unloadMedia()` to force VLC state reset, reducing hide delay from ~20s to ~2s
- **VLC player reuse**: Same-URL reloads reuse the existing player instance instead of destroying/recreating, preventing resize glitches and black screens
- **Increased reconnect resilience**: Retry count 3 → 5, reconnect interval 2s → 5s

### Dead-Stream Recovery
- Dead-stream handler now probes `state.originalUrl` instead of the proxy URL, preventing active ffmpeg proxy instances from being killed during recovery

---

## 🖥️ Native Context Menus

Replaced HTML `ContextMenu.tsx` overlay with Electron native `Menu.popup()` across:
- `ChannelList.tsx`
- `FavoriteList.tsx`  
- `HistoryList.tsx`

The native menus keep the video player fully visible while right-clicking — no more video occlusion.

---

## 🛠️ Infrastructure & Fixes

### Data Persistence
- **Atomic writes & backup**: Playlist saves now use atomic writes with `.bak` fallback to prevent data loss on crash
- **Zustand v5 format fix**: Resolved playlist data loss after restart caused by Zustand v5 serialization format mismatch
- **URL collision fix**: `urlToId` now generates collision-resistant IDs for M3U imports
- **M3U name parsing**: Improved channel name extraction from M3U playlists

### Type Safety
- Added `latencyMs?: number` to `CheckLog` type across `useStore.ts`, `preload/index.ts`, and `env.d.ts`
- Removed 67 lines of unused type definitions from `types/index.ts`

### Tests
- Added `channelStore.test.ts` and `epgParser.test.ts` with Vitest

---

## 📦 Dependencies

| Package | Change |
|---|---|
| `electron-vlc-player` | Added (embedded VLC playback) |
| `vitest` | Added (unit testing) |

---

## 🔑 Key Files Changed

| File | Change |
|---|---|
| `src/main/ipc/playlist.ts` | Probe rewrites, timeouts, CORS, latency measurement |
| `src/main/streamProxy.ts` | Reentrant proxy URL creation |
| `src/main/ipc/playback.ts` | Player lifecycle, dead-stream handler |
| `src/renderer/src/components/SettingsPage.tsx` | ChannelVerifier UI rewrite |
| `src/renderer/src/components/ChannelList.tsx` | Native menus |
| `src/renderer/src/components/PlayerContainer.tsx` | Reconnect, resize fixes |
| `src/renderer/src/stores/useStore.ts` | Latency type, Zustand v5 fix |

---

## ⚠️ Breaking Changes

None. This is a fully backward-compatible release.

## 🔄 Migration Notes

If you were relying on `ContextMenu.tsx` for custom renderer menus, those have been replaced with native Electron menus. Custom menu items should be migrated to `Menu.buildFromTemplate()` in the main process.
