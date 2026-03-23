"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
const Store = require("electron-store");
const store = new Store({
  defaults: {
    rootFolder: "",
    isSetup: false,
    pinHash: "",
    userName: "",
    displayCurrency: "USD"
  }
});
function hashPin(pin) {
  return crypto.createHash("sha256").update(`fv-salt-2024-${pin}`).digest("hex");
}
function getDbPath() {
  const rootFolder = store.get("rootFolder");
  return path.join(rootFolder, "FreelanceVault", "data", "db.json");
}
function readDb() {
  const dbPath = getDbPath();
  try {
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, "utf-8");
      return JSON.parse(content);
    }
  } catch {
  }
  return { projects: [], payments: [], credentials: [] };
}
function writeDb(data) {
  const dbPath = getDbPath();
  const dir = path.join(dbPath, "..");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
}
function createProjectFolders(rootFolder, projectId) {
  const base = path.join(rootFolder, "FreelanceVault", "projects", projectId);
  fs.mkdirSync(path.join(base, "files"), { recursive: true });
  fs.mkdirSync(path.join(base, "docs"), { recursive: true });
  fs.mkdirSync(path.join(base, "credentials"), { recursive: true });
}
function createMainWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#0a0a0f",
    vibrancy: "under-window",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return mainWindow;
}
electron.app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.freelancevault.app");
  if (process.platform === "darwin") {
    const iconPath = is.dev ? path.join(__dirname, "../../resources/icon.png") : path.join(process.resourcesPath, "icon.png");
    if (fs.existsSync(iconPath)) {
      electron.app.dock.setIcon(iconPath);
    }
  }
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.handle("app:get-settings", () => ({
    rootFolder: store.get("rootFolder"),
    isSetup: store.get("isSetup"),
    userName: store.get("userName"),
    hasPinSet: !!store.get("pinHash"),
    displayCurrency: store.get("displayCurrency") || "USD"
  }));
  electron.ipcMain.handle("app:set-currency", (_event, currency) => {
    store.set("displayCurrency", currency);
    return { success: true };
  });
  electron.ipcMain.handle("app:select-folder", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose FreelanceVault Location"
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  electron.ipcMain.handle(
    "app:setup-complete",
    (_event, payload) => {
      try {
        const vaultRoot = path.join(payload.rootFolder, "FreelanceVault");
        fs.mkdirSync(path.join(vaultRoot, "data"), { recursive: true });
        fs.mkdirSync(path.join(vaultRoot, "projects"), { recursive: true });
        const dbPath = path.join(vaultRoot, "data", "db.json");
        if (!fs.existsSync(dbPath)) {
          fs.writeFileSync(
            dbPath,
            JSON.stringify({ projects: [], payments: [], credentials: [] }, null, 2),
            "utf-8"
          );
        }
        store.set("rootFolder", payload.rootFolder);
        store.set("isSetup", true);
        store.set("pinHash", hashPin(payload.pin));
        store.set("userName", payload.name);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );
  electron.ipcMain.handle("auth:verify-pin", (_event, pin) => {
    const stored = store.get("pinHash");
    if (!stored) return { success: false, error: "No PIN configured" };
    const matches = hashPin(pin) === stored;
    if (matches) {
      return { success: true, user: { name: store.get("userName") } };
    }
    return { success: false, error: "Incorrect PIN" };
  });
  electron.ipcMain.handle("auth:touch-id", async () => {
    try {
      if (!electron.systemPreferences.canPromptTouchID()) {
        return { success: false, error: "Touch ID not available" };
      }
      await electron.systemPreferences.promptTouchID("to access FreelanceVault");
      return {
        success: true,
        user: { name: store.get("userName") }
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("auth:check-touch-id", () => {
    try {
      return { available: electron.systemPreferences.canPromptTouchID() };
    } catch {
      return { available: false };
    }
  });
  electron.ipcMain.handle("db:read", () => {
    try {
      return { success: true, data: readDb() };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("db:write", (_event, data) => {
    try {
      writeDb(data);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle(
    "files:upload",
    async (_event, payload) => {
      try {
        const result = await electron.dialog.showOpenDialog({
          properties: ["openFile", "multiSelections"],
          title: "Select files to upload"
        });
        if (result.canceled || result.filePaths.length === 0) return { success: false, files: [] };
        const rootFolder = store.get("rootFolder");
        const destDir = path.join(
          rootFolder,
          "FreelanceVault",
          "projects",
          payload.projectId,
          payload.category
        );
        fs.mkdirSync(destDir, { recursive: true });
        const uploaded = [];
        for (const filePath of result.filePaths) {
          const parts = filePath.split(/[/\\]/);
          const fileName = parts[parts.length - 1] || "file";
          const destPath = path.join(destDir, fileName);
          fs.copyFileSync(filePath, destPath);
          uploaded.push(fileName);
        }
        return { success: true, files: uploaded };
      } catch (err) {
        return { success: false, error: String(err), files: [] };
      }
    }
  );
  electron.ipcMain.handle(
    "files:list",
    (_event, payload) => {
      try {
        const rootFolder = store.get("rootFolder");
        const dir = path.join(
          rootFolder,
          "FreelanceVault",
          "projects",
          payload.projectId,
          payload.category
        );
        if (!fs.existsSync(dir)) return { success: true, files: [] };
        const items = fs.readdirSync(dir);
        const files = items.filter((f) => fs.statSync(path.join(dir, f)).isFile()).map((f) => {
          const stat = fs.statSync(path.join(dir, f));
          return { name: f, size: stat.size, modifiedAt: stat.mtime.toISOString(), path: path.join(dir, f) };
        });
        return { success: true, files };
      } catch (err) {
        return { success: false, error: String(err), files: [] };
      }
    }
  );
  electron.ipcMain.handle("files:open", (_event, filePath) => {
    electron.shell.openPath(path.resolve(filePath));
    return { success: true };
  });
  electron.ipcMain.handle(
    "files:delete",
    (_event, payload) => {
      try {
        const rootFolder = store.get("rootFolder");
        const filePath = path.join(
          rootFolder,
          "FreelanceVault",
          "projects",
          payload.projectId,
          payload.category,
          payload.fileName
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );
  electron.ipcMain.handle("folder:open", (_event, folderPath) => {
    electron.shell.openPath(path.resolve(folderPath));
    return { success: true };
  });
  electron.ipcMain.handle("project:create-folders", (_event, projectId) => {
    try {
      const rootFolder = store.get("rootFolder");
      createProjectFolders(rootFolder, projectId);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("project:get-folder", (_event, projectId) => {
    const rootFolder = store.get("rootFolder");
    return path.join(rootFolder, "FreelanceVault", "projects", projectId);
  });
  createMainWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
