const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lhfa", {
  selectClipsFolder: () => ipcRenderer.invoke("select-clips-folder"),
  getUserDataDir: () => ipcRenderer.invoke("get-user-data-dir"),
  saveProjectJson: (projectId, projectJson) => ipcRenderer.invoke("save-project-json", projectId, projectJson),
  loadProjectJson: (projectId) => ipcRenderer.invoke("load-project-json", projectId),
  listProjects: () => ipcRenderer.invoke("list-projects"),
  exportXlsx: (project) => ipcRenderer.invoke("export-xlsx", project),
  exportCsv: (project) => ipcRenderer.invoke("export-csv", project),
  openInFolder: (filePath) => ipcRenderer.invoke("open-in-folder", filePath),
});
