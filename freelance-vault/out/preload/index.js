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
  filesList: (payload) => electron.ipcRenderer.invoke("files:list", payload),
  filesOpen: (filePath) => electron.ipcRenderer.invoke("files:open", filePath),
  filesDelete: (payload) => electron.ipcRenderer.invoke("files:delete", payload),
  folderOpen: (folderPath) => electron.ipcRenderer.invoke("folder:open", folderPath),
  projectCreateFolders: (projectId) => electron.ipcRenderer.invoke("project:create-folders", projectId),
  projectGetFolder: (projectId) => electron.ipcRenderer.invoke("project:get-folder", projectId)
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
