# Changelog

## [1.7.1] - 2026-07-12

### Fixed
- Playlist metadata disappearing after app restart
  - Fixed Zustand v5 persist format mismatch in custom `ipcStorage.getItem` — now wraps persisted data in `{ state, version }` to match the expected shape
  - Serialized `save-user-data` IPC calls to prevent race conditions between rapid `setChannels` + `addPlaylist` dispatches
  - Added defensive normalization of `playlists` in `saveUserData` and `loadUserData` so a missing key never silently corrupts the data file
  - Relaxed `isValidUserData` to accept files without a `playlists` key

## [1.7.0] - 2026-07-12

### Fixed
- Prevent data loss on app restart with atomic writes & backup
- Playlist lost on restart — persist playlistId counter and restore on boot
