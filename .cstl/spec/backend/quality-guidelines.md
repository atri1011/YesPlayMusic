# Quality Guidelines

> Code quality standards for backend (Electron main process) development.

---

## Overview

主进程代码质量标准与前端一致，遵守项目 ESLint + Prettier 配置（见 frontend/quality-guidelines.md），额外关注 **Electron 安全性与跨平台行为**。

- **ESLint 环境**：`env: { node: true, browser: true }`，主进程文件按 node 环境编写。
- **构建**：`vue-cli-service electron:build`（webpack 打包 + electron-builder）。
- **CI**：`.github/workflows` 下有构建校验。
- **无自动化测试**：手动跑 `npm run electron:serve`（dev）与 `npm run electron:build`（产物）验证。

---

## Forbidden Patterns

- **`nodeIntegration: true` 与 `contextIsolation: false` 同时开**：安全风险。本项目渲染进程需要 nodeIntegration（用 `window.require`），但必须配合 CSP 与只加载可信内容。新增窗口默认 `nodeIntegration: false` + `contextIsolation: true` + `preload`。
- **`eval` / `new Function`**：CSP 禁止。
- **直接使用 `remote` 模块**：已废弃，用 `ipcMain.handle` + `ipcRenderer.invoke` 替代。
- **内联 `process.platform === 'darwin'`**：用 `@/utils/platform.js` 的 `isMac`/`isWindows`/`isLinux`。
- **硬编码端口/路径**：内嵌 API 端口 `10754`、Express 桥 `27232` 已硬编码在 `src/utils/request.js`（有注释说明 Git Bash MSYS 改写问题），新增端口定义到 `src/electron/services.js` 或环境变量。
- **`console.log` 提交**：调试日志不入仓；封装为模块级 `log()`。
- **阻塞主进程**：CPU 密集任务放子进程（`spawn`/`fork`），不卡 event loop。

---

## Required Patterns

- **IPC handler 必须 try/catch**：`ipcMain.handle(channel, async (...args) => { try { ... } catch (e) { console.error(e); throw e; } })`，避免 `ipcRenderer.invoke` 永久挂起。
- **错误向上传播**：handler 抛错后渲染进程 `.catch` 能感知。
- **平台守卫**：所有平台特定代码（托盘、MPRIS、TouchBar、Dock）用 `isCreateTray`/`isCreateMpris`/`isMac` 判断。
- **Electron 环境守卫**：渲染进程访问 `window.require('electron')` 前必须 `process.env.IS_ELECTRON === true`，见 `src/utils/Player.js`。
- **资源路径**：用 `__dirname` 或 `app.getAppPath()`，不硬编码绝对路径。
- **自动更新**：走 `electron-updater`，不自行实现下载逻辑。
- **日志前缀**：每个主进程模块顶部建 `const log = text => console.log(clc.blueBright('[模块名]') + ' ' + text)`。

---

## Testing Requirements

- **无单元测试**：仓库无 jest/mocha 配置。
- **手动验证矩阵**：

| 场景 | 命令 | 关注点 |
|------|------|--------|
| Electron dev | `npm run electron:serve` | 主进程热重载、IPC、托盘 |
| Electron 产物 | `npm run electron:build-win` | 打包后行为、自动更新、Express 桥 |
| Web dev | `npm run serve` | 无主进程时降级路径 |
| 三平台 | `-w` / `-m` / `-l` | 平台守卫（托盘/MPRIS/TouchBar） |

- **回归点**：登录、播放、歌词、unblockMusic、关闭到托盘、自动更新。

---

## Code Review Checklist

- [ ] `npm run lint` 无 error。
- [ ] `prettier` 已格式化（husky 会跑，review 再确认）。
- [ ] IPC handler 有 try/catch。
- [ ] 平台代码有 `isMac`/`isWindows`/`isLinux` 守卫。
- [ ] 渲染进程访问 electron 有 `IS_ELECTRON` 守卫。
- [ ] 无硬编码端口/路径（除已注释的 `10754`/`27232`）。
- [ ] 日志用 `log()` 封装，前缀着色一致。
- [ ] 无敏感信息（cookie/token）入日志。
- [ ] CPU 密集任务放子进程。
- [ ] 新窗口默认 `nodeIntegration: false` + `contextIsolation: true`。
