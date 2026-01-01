export {};

declare global {
  interface Window {
    lhfa: {
      selectClipsFolder: () => Promise<{canceled: boolean; folder?: string; files?: {fileName:string; filePath:string}[]}>;
      getUserDataDir: () => Promise<string>;
      saveProjectJson: (projectId: string, projectJson: any) => Promise<{ok: boolean; filePath: string;}>;
      loadProjectJson: (projectId: string) => Promise<{ok: boolean; data?: any; error?: string;}>;
      listProjects: () => Promise<{id: string; filePath: string;}[]>;
      exportXlsx: (project: any) => Promise<{canceled: boolean; filePath?: string;}>;
      exportCsv: (project: any) => Promise<{canceled: boolean; filePath?: string;}>;
      openInFolder: (filePath: string) => Promise<{ok: boolean;}>;
    }
  }
}
