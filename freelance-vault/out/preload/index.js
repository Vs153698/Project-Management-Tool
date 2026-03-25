"use strict";
const electron = require("electron");
const api = {
  getSettings: () => electron.ipcRenderer.invoke("app:get-settings"),
  setCurrency: (currency) => electron.ipcRenderer.invoke("app:set-currency", currency),
  selectFolder: () => electron.ipcRenderer.invoke("app:select-folder"),
  setupComplete: (payload) => electron.ipcRenderer.invoke("app:setup-complete", payload),
  verifyPin: (pin) => electron.ipcRenderer.invoke("auth:verify-pin", pin),
  touchIdAuth: () => electron.ipcRenderer.invoke("auth:touch-id"),
  checkTouchId: () => electron.ipcRenderer.invoke("auth:check-touch-id"),
  dbRead: () => electron.ipcRenderer.invoke("db:read"),
  dbWrite: (data) => electron.ipcRenderer.invoke("db:write", data),
  filesUpload: (payload) => electron.ipcRenderer.invoke("files:upload", payload),
  filesUploadFolder: (payload) => electron.ipcRenderer.invoke("files:upload-folder", payload),
  filesList: (payload) => electron.ipcRenderer.invoke("files:list", payload),
  filesOpen: (filePath) => electron.ipcRenderer.invoke("files:open", filePath),
  filesDelete: (payload) => electron.ipcRenderer.invoke("files:delete", payload),
  folderOpen: (folderPath) => electron.ipcRenderer.invoke("folder:open", folderPath),
  projectCreateFolders: (projectId) => electron.ipcRenderer.invoke("project:create-folders", projectId),
  projectGetFolder: (projectId) => electron.ipcRenderer.invoke("project:get-folder", projectId),
  bankGet: () => electron.ipcRenderer.invoke("bank:get"),
  bankSave: (details) => electron.ipcRenderer.invoke("bank:save", details),
  bankCopyImage: (dataUrl) => electron.ipcRenderer.invoke("bank:copy-image", dataUrl),
  bankSaveImage: (dataUrl) => electron.ipcRenderer.invoke("bank:save-image", dataUrl),
  codeGenerate: (payload) => electron.ipcRenderer.invoke("code:generate", payload),
  codeListFolders: (projectId) => electron.ipcRenderer.invoke("code:list-folders", projectId),
  codeDeleteFolder: (payload) => electron.ipcRenderer.invoke("code:delete-folder", payload),
  codeDeleteDepDir: (payload) => electron.ipcRenderer.invoke("code:delete-dep-dir", payload),
  gitClone: (payload) => electron.ipcRenderer.invoke("git:clone", payload),
  gitPull: (payload) => electron.ipcRenderer.invoke("git:pull", payload),
  openInVscode: (projectId) => electron.ipcRenderer.invoke("project:open-in-vscode", projectId),
  openInAntigravity: (projectId) => electron.ipcRenderer.invoke("project:open-in-antigravity", projectId),
  codeOpenInVscode: (payload) => electron.ipcRenderer.invoke("code:open-in-vscode", payload),
  codeOpenInAntigravity: (payload) => electron.ipcRenderer.invoke("code:open-in-antigravity", payload),
  codeGetFolderPath: (payload) => electron.ipcRenderer.invoke("code:get-folder-path", payload),
  editorsDetect: () => electron.ipcRenderer.invoke("editors:detect"),
  editorsOpen: (payload) => electron.ipcRenderer.invoke("editors:open", payload),
  codeGetProjectFolderPath: (projectId) => electron.ipcRenderer.invoke("project:get-folder-path", projectId),
  backupExport: (pin) => electron.ipcRenderer.invoke("backup:export", pin),
  backupImport: (pin) => electron.ipcRenderer.invoke("backup:import", pin),
  scriptList: (payload) => electron.ipcRenderer.invoke("script:list", payload),
  scriptRun: (payload) => electron.ipcRenderer.invoke("script:run", payload),
  scriptStop: (key) => electron.ipcRenderer.invoke("script:stop", key),
  onScriptOutput: (callback) => {
    const handler = (_, payload) => callback(payload);
    electron.ipcRenderer.on("script:output", handler);
    return () => electron.ipcRenderer.off("script:output", handler);
  },
  onScriptDone: (callback) => {
    const handler = (_, payload) => callback(payload);
    electron.ipcRenderer.on("script:done", handler);
    return () => electron.ipcRenderer.off("script:done", handler);
  },
  invoiceGenerate: (payload) => electron.ipcRenderer.invoke("invoice:generate", payload),
  aiGetConfig: () => electron.ipcRenderer.invoke("ai:get-config"),
  aiSaveConfig: (config) => electron.ipcRenderer.invoke("ai:save-config", config),
  aiGenerateLinkedin: (projectId) => electron.ipcRenderer.invoke("ai:generate-linkedin", projectId),
  scannerGetStorageInfo: () => electron.ipcRenderer.invoke("scanner:get-storage-info"),
  scannerScanFiles: (sizeFilter) => electron.ipcRenderer.invoke("scanner:scan-files", sizeFilter),
  scannerGetCaches: () => electron.ipcRenderer.invoke("scanner:get-caches"),
  scannerClearCache: (cachePath) => electron.ipcRenderer.invoke("scanner:clear-cache", cachePath),
  scannerDeleteFiles: (filePaths) => electron.ipcRenderer.invoke("scanner:delete-files", filePaths),
  scannerGetProjects: () => electron.ipcRenderer.invoke("scanner:get-projects"),
  scannerGetProjectContents: (projectPath) => electron.ipcRenderer.invoke("scanner:get-project-contents", projectPath),
  masterGetBreakdown: () => electron.ipcRenderer.invoke("master:get-breakdown")
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = api;
}
