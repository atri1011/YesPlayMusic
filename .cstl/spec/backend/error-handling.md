# Error Handling

> How errors are handled in this project.

---

## Overview

YesPlayMusic 的错误处理分三层，对应渲染进程、API 调用层、Electron 主进程：

- **渲染进程组件层**：`.then(data => ...)` + `.catch(err => showToast)` 兜底，业务错误用 toast 提示。
- **API 调用层**：`src/utils/request.js` 的 axios 响应拦截器集中处理 HTTP 与业务码错误（如登录失效自动登出 + 跳登录页）。
- **Electron 主进程层**：`try/catch` + `console.error`/`electron-log`，关键路径（unblockMusic、自动更新）有兜底逻辑。

项目**没有自定义 Error 子类**，不抛带 code 的自定义异常，错误以 `Promise.reject(error)` 或 `throw new Error(msg)` 形式传播。

---

## Error Types

- **网络错误**：axios 抛 `error.response` 存在（HTTP 状态码）或 `error.request` 存在（无响应）。
- **业务错误**：NCM API 返回 `{ code: xxx, msg: '...' }`，在响应拦截器里按 `code` 分流（如 `code === 301 && msg === '需要登录'` → 触发登出）。
- **运行时错误**：渲染进程未捕获异常冒泡到全局，主进程用 `process.on('uncaughtException', ...)` 兜底（见 `src/background.js`）。
- **IPC 错误**：`ipcMain.handle` 的 handler 抛错会通过 `ipcRenderer.invoke` 的 promise reject 传回渲染进程。

---

## Error Handling Patterns

### API 响应拦截器（`src/utils/request.js`）

```js
service.interceptors.response.use(
  response => response.data,           // 成功：解包
  async error => {
    // 1. 解构 error.response / error.request
    // 2. 若 code===301（需要登录）→ doLogout() + router.push('login')
    // 3. 必须 return Promise.reject(error)  ← 关键，见下方注释
  }
);
```

> ⚠️ 拦截器里**必须** `return Promise.reject(error)`，否则调用方 `.then()` 会误触发、`.catch()` 感知不到失败，导致页面停在 `show=false` 初始态、整页空白。

### 组件层

- **fetch 后**：`.then(data => { show = true; ... })`。
- **错误兜底**：`.catch(() => dispatch('showToast', '操作失败，xxx'))`，参考 `src/store/actions.js` 的 `likeATrack` catch。
- **不静默吞错**：`.catch(() => {})` 是反模式，至少 `console.warn` 或 toast。

### 主进程

- **try/catch 包裹副作用**：如 `src/electron/ipcMain.js` 的 unblockMusic handler、`src/background.js` 的自动更新流程。
- **日志**：`console.error` + `electron-log`（生产环境）。
- **弹窗兜底**：`dialog.showMessageBox` 在不可恢复错误时提示用户，见 `src/background.js` 的关闭确认对话框。

---

## API Error Responses

NCM API 错误响应是 `{ code: number, msg: string, ... }` 形式，非 RESTful `{ error: ... }`。拦截器只识别特定 `code`：

| code | 含义 | 处理 |
|------|------|------|
| `200` | 成功 | 拦截器 `return response.data` |
| `301` | 需要登录 | `doLogout()` + 跳 `login` / `loginAccount` |
| 其他 | 业务错误 | 不在拦截器处理，透传给调用方 `.catch` |

调用方按需在 `.then` 里再判 `data.code`，或直接信任 `data` 字段。

---

## Common Mistakes

- **拦截器吞错**：`return error` 或不 return → 调用方误以为成功。必须 `return Promise.reject(error)`。
- **组件 `.catch` 为空**：用户看不到任何反馈，以为是 bug。
- **主进程 IPC handler 不 try/catch**：异常会让 `ipcRenderer.invoke` 的 promise 挂起，渲染进程一直 awaiting。
- **用 `throw` 替代 `Promise.reject`**：在异步回调里 `throw` 会被 Promise 吞掉，用 `reject`。
- **登录失效不跳页**：只 `doLogout` 不 `router.push`，用户停在需登录的页面反复失败。
- **toast 频繁叠加**：用 `showToast` action 里的 timer 机制（`src/store/actions.js`）去抖，不要每次直接弹。
