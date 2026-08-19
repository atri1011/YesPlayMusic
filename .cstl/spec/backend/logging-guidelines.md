# Logging Guidelines

> How logging is done in this project.

---

## Overview

YesPlayMusic 的日志输出按进程分两套：

- **渲染进程**：直接 `console.log` / `console.warn` / `console.error`，输出到 DevTools Console。仅在开发模式有意义；生产 Electron 用户可通过菜单打开 DevTools 查看。
- **主进程**：`cli-color` 着色前缀 + `console.log`（开发模式）+ `electron-log ^4.3.0`（生产模式写文件）。`src/background.js` 与 `src/electron/ipcMain.js` 有统一的 `log()` 封装。

项目**无结构化日志库**（无 winston/pino 集成），日志是人类可读文本，非 JSON。

---

## Log Levels

- **`console.log` / `log()`**：常规信息（服务启动、IPC 收到、设置同步）。
- **`console.warn`**：可恢复异常（token 过期、缓存未命中、API 限流）。
- **`console.error`**：不可恢复错误、catch 块兜底（拦截器吞错、自动更新失败）。
- **无 debug 级别**：开发期临时 `console.log` 调试，提交前应删除。

---

## Structured Logging

- **格式**：`[前缀] 消息`，前缀用 `cli-color` 着色区分模块：
  - `[background.js]` — `clc.blueBright`
  - `[ipcMain.js]` — `clc.blueBright`
  - `[NetEase API]` — `clc.redBright`
- **无 JSON 结构化输出**：纯文本，无 timestamp 字段（终端自带时间戳）。
- **无统一 logger 模块**：每个主进程文件顶部自建 `const log = text => console.log(...)`，复制该模式即可保持一致。

---

## What to Log

- **服务启动/停止**：`startNeteaseMusicApi` 启动、Express 桥监听端口、MPRIS 创建。
- **IPC 关键事件**：unblockMusic 收到请求、设置同步、托盘更新。
- **登录态变化**：token 过期、登出、跳登录页（`src/utils/request.js` 的 `console.warn('Token has expired...')`）。
- **自动更新事件**：检查更新、下载进度、更新失败（`src/background.js` 的 autoUpdater 流程）。
- **关键错误**：所有 catch 块至少 `console.error`，不可恢复时弹 `dialog`。

---

## What NOT to Log

- **用户凭据**：`MUSIC_U` cookie、网易云账号密码、lastfm token、Discord token。
- **完整请求 URL 带 cookie 参数**：`src/utils/request.js` 注入 `cookie` 到 params，日志里不要打印整个 config。
- **用户播放历史/歌单内容**：业务数据，不是日志。
- **高频事件**：播放进度更新、mousemove、scroll —— 会刷屏。
- **生产环境 DevTools 内部信息**：无需 log。

---

## Platform-Specific Notes

- **Electron 打包后 stdout 不可用**：`src/electron/ipcMain.js` 里 `@unblockneteasemusic/server` 用 pino + sonic-boom 写 fd 1，打包成 asar 的 Windows GUI 没有 stdout 会抛 `EBADF`。仅在 `app.isPackaged` 时重定向到 `app.getPath('logs')` 下的文件。
- **electron-log**：主进程可用 `import log from 'electron-log'`，默认写入 `userData/logs/main.log`。项目当前主要用 `console.*` + `cli-color`，electron-log 作为生产日志文件输出兜底。
- **渲染进程生产日志**：无持久化，DevTools 关闭后即丢。
