# Longhorns Film Assistant (MVP Starter)

Offline desktop app (Electron + React) to import Hudl MP4 clips (chronological), fill a row-per-play table, compute GN/LS, and export to XLSX/CSV.

## What this starter includes
- Select clips folder (MP4) and auto-create 1 row per clip
- Review screen with:
  - Quarter markers (set start of Q2/Q3/Q4)
  - Fast entry for YARD LN in +/- notation, ODK, Run/Pass, Down/Distance, Hash, Formation, Front, Blitz, Penalty flag
  - GN/LS computed from consecutive plays with safeguards
- Autosave project JSON in app data folder
- Export XLSX and CSV (built-in template layout)

## Run (developer machine)
1. Install Node.js (LTS) on Windows/macOS.
2. Open a terminal in this folder.
3. Run:
   - `npm install`
   - `npm run dev`

## Packaging installers (later)
A developer can add `electron-builder` to produce Windows + macOS installers.
