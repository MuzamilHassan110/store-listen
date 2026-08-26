# Changelog

## 1.0.0 — 2026-08-26

First production-ready StoreListen release.

### Added
- Windows NSIS installer and portable build (`StoreListen-Setup-1.0.0.exe`, `StoreListen-Portable-1.0.0.exe`)
- Auto-update from GitHub Releases via electron-updater (check on launch and every 4 hours)
- First-run setup wizard (API URL, license/trial, store, device name, microphone test)
- License activation, trial, status, renew, and deactivate APIs
- `GET /api/version` for minimum/critical desktop versions

### Known issues
- SmartScreen shows a warning until an OV/EV Authenticode certificate is used
- WhatsApp Web stays off unless `WHATSAPP_ENABLED=true` on the server
- Auto-update only runs in installed (packaged) builds, not `npm run dev`
