const {app, BrowserWindow, shell, Menu, dialog, session} = require("electron");
const path = require("path");

if (!app.requestSingleInstanceLock()) { app.quit(); }
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 380, minHeight: 560,
    title: "Panay Fund", backgroundColor: "#0B1730", show: false,
    icon: path.join(__dirname, "renderer", "icon.png"),
    webPreferences: {contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false}
  });
  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  // links to websites open in the normal browser
  win.webContents.setWindowOpenHandler(({url}) => { if (/^https?:/i.test(url)) shell.openExternal(url); return {action: "deny"}; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });

  // receipts, exports and backups: ask where to save
  session.defaultSession.on("will-download", (e, item) => {
    item.setSaveDialogOptions({title: "Save file", defaultPath: path.join(app.getPath("downloads"), item.getFilename())});
  });
}

function buildMenu() {
  const run = js => win && win.webContents.executeJavaScript(js).catch(() => {});
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label: "File", submenu: [{label: "Reload", accelerator: "F5", click: () => win && win.reload()}, {type: "separator"}, {role: "quit", label: "Exit"}]},
    {label: "Account", submenu: [{label: "Sign out", click: () => run("window.pfSignOut && window.pfSignOut()")}]},
    {label: "View", submenu: [{role: "zoomIn"}, {role: "zoomOut"}, {role: "resetZoom"}, {type: "separator"}, {role: "togglefullscreen"}]},
    {label: "Help", submenu: [{label: "About Panay Fund", click: () => dialog.showMessageBox(win, {type: "info", title: "Panay Fund", message: "Panay Fund", detail: `Desktop app ${app.getVersion()}\nLending management system\n\nThe app updates itself when a new version is released. Use "Check for updates" under the logo.`})}]}
  ]));
}

app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { buildMenu(); createWindow(); });
app.on("window-all-closed", () => app.quit());
