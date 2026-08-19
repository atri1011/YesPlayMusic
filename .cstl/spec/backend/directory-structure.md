# Directory Structure

> How backend (Electron main process) code is organized in this project.

---

## Overview

YesPlayMusic 是 Electron 应用，"后端"指 **Electron 主进程**（main process）与 **内嵌的 NeteaseCloudMusicApi 服务**。主进程代码位于 `src/background.js`（入口）与 `src/electron/`（按平台功能拆分的模块）。

- **主进程入口**：`src/background.js` — 创建窗口、注册协议、启动内嵌 API、初始化 IPC、托盘、菜单、快捷键、mpris、自动更新。
- **平台功能模块**：`src/electron/` — 按职责拆分，每个文件导出一个工厂函数（`createXxx`）或初始化函数（`initXxx` / `registerXxx`）。
- **渲染进程桥接**：`src/electron/ipcMain.js` + `src/electron/ipcRenderer.js`，通过 `ipcMain.handle` / `ipcRenderer.invoke` 通信。
- **内嵌 API**：`@neteasecloudmusicapienhanced/api`，由 `src/electron/services.js` 的 `startNeteaseMusicApi()` 在 `app.whenReady()` 后启动，监听 `127.0.0.1:10754`。

---

## Directory Layout

```
src/
├── background.js              # Electron 主进程入口
├── ncmModDef.js               # 内嵌 NCM API 模块定义（require 入口）
└── electron/
    ├── services.js            # 启动内嵌 NeteaseCloudMusicApi（端口 10754）
    ├── ipcMain.js             # 主进程 IPC 处理（unblockMusic / scrobble / settings 同步）
    ├── ipcRenderer.js        # 渲染进程侧 IPC 调用封装
    ├── menu.js               # 应用菜单（createMenu）
    ├── tray.js               # 系统托盘（createTray）
    ├── dockMenu.js           # macOS Dock 菜单（createDockMenu）
    ├── touchBar.js           # macOS TouchBar（createTouchBar）
    ├── mpris.js              # Linux MPRIS（createMpris / createDbus）
    └── globalShortcut.js    # 全局快捷键（registerGlobalShortcut）
```

主进程入口 `background.js` 还内嵌一个 **Express 桥**，在 Electron 生产环境固定监听 `http://127.0.0.1:27232`，把 `/api` 代理到内嵌 NCM API（端口 10754），详见 `src/utils/request.js` 的 `baseURL` 注释。

---

## Module Organization

- **新增主进程功能** → 放入 `src/electron/`，文件名按功能域命名（如 `notifications.js`）。
- **工厂函数命名**：`createXxx`（返回实例）/ `initXxx` / `registerXxx`（执行副作用）。
- **IPC handler** → 加到 `src/electron/ipcMain.js`，用 `ipcMain.handle(channel, handler)` 支持 invoke/hook 返回值。
- **渲染进程调用** → 通过 `src/electron/ipcRenderer.js` 封装，或直接 `ipcRenderer.invoke(channel, ...args)`。
- **平台判断** → 用 `@/utils/platform.js` 的 `isWindows` / `isMac` / `isLinux` / `isCreateTray` / `isCreateMpris`，不内联 `process.platform === '...'`。

---

## Naming Conventions

- **文件名**：camelCase（`ipcMain.js`、`globalShortcut.js`、`dockMenu.js`）。
- **导出函数**：`createTray` / `createMenu` / `createMpris` / `initIpcMain` / `registerGlobalShortcut` / `startNeteaseMusicApi`。
- **IPC channel**：kebab-case 字符串，如 `'update-tray-tooltip'`、`'unblock-music'`（主进程注册与渲染进程调用需一致）。
- **日志前缀**：`clc.blueBright('[ipcMain.js]')` / `clc.blueBright('[background.js]')`，统一用 `cli-color` 着色。

---

## Examples

- 主进程装配链：`src/background.js` → `createProtocol` → `startNeteaseMusicApi()` → `initIpcMain()` → `createMenu()` → `createTray()` → `registerGlobalShortcut()`。
- IPC 双端对称：`src/electron/ipcMain.js` 的 `ipcMain.handle('unblock-music', ...)` 对应 `src/electron/ipcRenderer.js` 的 `ipcRenderer.invoke('unblock-music', ...)`。
- 平台守卫：`src/background.js` 用 `isCreateTray` / `isCreateMpris` 决定是否创建托盘/MPRIS。
