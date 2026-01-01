const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

let mainWindow;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    backgroundColor: "#0B0B10",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  mainWindow.loadURL(devUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// -----------------------------
// IPC: Files + Project Handling
// -----------------------------
ipcMain.handle("select-clips-folder", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Hudl Clips Folder (MP4 clips in chronological order)",
  });
  if (res.canceled || !res.filePaths?.[0]) return { canceled: true };
  const folder = res.filePaths[0];

  const files = fs.readdirSync(folder)
    .filter((f) => f.toLowerCase().endsWith(".mp4"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((f) => ({
      fileName: f,
      filePath: path.join(folder, f),
    }));

  return { canceled: false, folder, files };
});

ipcMain.handle("get-user-data-dir", async () => {
  const p = app.getPath("userData");
  ensureDir(p);
  return p;
});

ipcMain.handle("save-project-json", async (_evt, projectId, projectJson) => {
  const dir = path.join(app.getPath("userData"), "projects");
  ensureDir(dir);
  const filePath = path.join(dir, `${projectId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(projectJson, null, 2), "utf-8");
  return { ok: true, filePath };
});

ipcMain.handle("load-project-json", async (_evt, projectId) => {
  const filePath = path.join(app.getPath("userData"), "projects", `${projectId}.json`);
  if (!fs.existsSync(filePath)) return { ok: false, error: "Not found" };
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return { ok: true, data };
});

ipcMain.handle("list-projects", async () => {
  const dir = path.join(app.getPath("userData"), "projects");
  ensureDir(dir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  return files.map(f => ({ id: f.replace(/\.json$/,""), filePath: path.join(dir, f) }));
});

// -----------------------------
// IPC: Export XLSX/CSV
// -----------------------------
function buildWorksheetRows(project) {
  const headers = ["CLIP_FILE","QTR","ODK","DN","DIST","HASHI","YARD_LN","PLAY_TYPE_RESULT","GN_LS","OFF_FORMATION","DEF_FRONT","BLITZ","PENALTY","NOTES"];
  const rows = [headers];

  for (const r of (project.rows || [])) {
    rows.push([
      r.clipFile || "",
      r.qtr ?? "",
      r.odk || "",
      r.dn ?? "",
      r.dist ?? "",
      r.hash || "",
      (r.yardLn ?? ""),
      r.playType || "",
      (r.gnls ?? ""),
      r.offFormation || "",
      r.defFront || "",
      r.blitz || "",
      r.penalty ? "Y" : "",
      r.notes || ""
    ]);
  }
  return rows;
}

ipcMain.handle("export-xlsx", async (_evt, project) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: "Export XLSX",
    defaultPath: `FilmBreakdown_${project.projectName || "Game"}.xlsx`,
    filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }]
  });
  if (res.canceled || !res.filePath) return { canceled: true };

  const aoa = buildWorksheetRows(project);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 28 }, { wch: 6 }, { wch: 6 }, { wch: 4 }, { wch: 6 }, { wch: 6 },
    { wch: 8 }, { wch: 14 }, { wch: 6 }, { wch: 18 }, { wch: 16 }, { wch: 10 },
    { wch: 8 }, { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Breakdown");
  XLSX.writeFile(wb, res.filePath);
  return { canceled: false, filePath: res.filePath };
});

ipcMain.handle("export-csv", async (_evt, project) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: "Export CSV",
    defaultPath: `FilmBreakdown_${project.projectName || "Game"}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }]
  });
  if (res.canceled || !res.filePath) return { canceled: true };

  const aoa = buildWorksheetRows(project);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const csv = XLSX.utils.sheet_to_csv(ws);
  fs.writeFileSync(res.filePath, csv, "utf-8");
  return { canceled: false, filePath: res.filePath };
});

ipcMain.handle("open-in-folder", async (_evt, filePath) => {
  if (!filePath) return { ok: false };
  shell.showItemInFolder(filePath);
  return { ok: true };
});
