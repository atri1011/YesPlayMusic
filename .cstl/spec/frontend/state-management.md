# State Management

> How state is managed in this project.

---

## Overview

YesPlayMusic 使用 **Vuex 3**（`vuex ^3.4.0`，Vue 2 配套版本）作为唯一全局状态管理。单 store、模块化文件拆分但**不使用 modules**，所有 state/mutations/actions/plugins 平铺在一个 `Vuex.Store` 中。

- **持久化**：通过自定义 Vuex 插件 `saveToLocalStorage` 把 `state.settings` 与 `state.data` 同步写入 `localStorage`（见 `src/store/plugins/localStorage.js`）。
- **Electron 桥接**：在 Electron 环境额外加载 `sendSettings` 插件，把设置变更通过 IPC 发给主进程（见 `src/store/plugins/sendSettings.js`）。
- **Player 特殊处理**：`store.state.player` 是 `Player` 类的 Proxy 实例（见 `src/store/index.js`），其 setter 在属性变更时自动 `saveSelfToLocalStorage` + `sendSelfToIpcMain`。

---

## State Categories

| 类型 | 存放位置 | 示例 |
|------|---------|------|
| **全局 UI/设置状态** | `state.settings` | `musicQuality`、`appearance`、`themeColor`、`lang`、`realIP`、`proxyConfig` |
| **业务数据状态** | `state.data` | `user`、`liked`、`playHistory` |
| **播放器状态** | `state.player` | `howl`、`currentTrack`、`progress`、`playing`（Proxy 实例） |
| **临时 UI 状态** | `state.showLyrics`、`state.toast`、`state.modals`、`state.contextMenu` | 无持久化，刷新即重置 |
| **组件本地状态** | 组件 `data()` | 表单输入、展开折叠等纯局部状态 |

---

## When to Use Global State

- **跨页面/跨组件共享** → Vuex（如当前播放曲目、登录态、用户偏好设置）。
- **需持久化跨会话** → 放入 `state.settings` 或 `state.data`（自动落 localStorage）。
- **纯组件内部、不影响其他组件** → 组件 `data()`（如 modal 内部表单字段）。
- **派生数据** → 用 `getters` 或组件 `computed` + `mapState`/`mapGetters`，不要把派生值写入 state。

---

## Server State

- **API 调用层**：`src/api/*.js` 直接返回 axios promise（`request` 已在响应拦截器里 `return response.data`），组件里 `.then(data => ...)` 后 `commit` 到 Vuex。
- **无集中式 server cache 库**（无 SWR/vue-query）。缓存策略：
  - 歌曲详情/歌词/专辑：走 **IndexedDB**（Dexie），见 `src/utils/db.js` 的 `cacheTrackDetail` / `cacheLyric`。
  - 用户数据（liked songs、playHistory）：放 Vuex + localStorage，不长期缓存 API 响应。
- **刷新策略**：action 里 `fetchXxx` 调用后直接 `commit('updateXxx', data)`，无 stale-while-revalidate。

---

## Mutations vs Actions

- **mutations**（`src/store/mutations.js`）：**同步**，唯一允许修改 state 的地方。命名风格 `updateXxx` / `addXxx` / `removeXxx`，接收 `(state, payload)`。
- **actions**（`src/store/actions.js`）：**异步**（API 调用、定时器），内部 `commit` mutation。命名风格动词开头 `fetchXxx` / `showToast` / `likeATrack`。
- 组件中：读用 `mapState`/`mapGetters`，写用 `mapActions`/`this.$store.dispatch`，**禁止组件直接 `this.$store.state.xxx = ...`**。

---

## Common Mistakes

- **直接修改 `store.state.xxx`**（除 Player Proxy 外）：必须走 mutation。
- **在 mutation 里做异步操作**：放到 action。
- **滥用全局 state**：纯组件态塞进 Vuex 导致冗余 re-render。
- **忘记持久化**：需要跨会话保留的数据没放进 `settings`/`data` 子树 → `saveToLocalStorage` 只持久化这两块，其他 state 刷新即丢。
- **在多个 action 里重复 fetch 同一资源**：抽公共 action 复用。
- **Player 状态当普通对象处理**：它是 Proxy，写入会自动持久化 + IPC 同步，不要手动 `localStorage.setItem('player', ...)`。
