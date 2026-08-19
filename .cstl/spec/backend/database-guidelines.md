# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

YesPlayMusic **没有传统 SQL 数据库**。数据持久化分三层，按运行环境与数据类型选择：

| 层 | 技术 | 环境 | 用途 |
|----|------|------|------|
| **渲染进程 IndexedDB** | `Dexie ^3.0.3`（封装于 `src/utils/db.js`） | Web + Electron | 歌曲详情、歌词、专辑、歌曲源缓存 |
| **渲染进程 localStorage** | 原生 Web API（封装于 `src/store/plugins/localStorage.js`） | Web + Electron | 用户设置（`settings`）、业务数据（`data`）、播放器快照（`player`）、lastfm token |
| **主进程 electron-store** | `electron-store ^8.0.1`（`src/background.js`） | 仅 Electron | 主进程侧设置镜像（与渲染进程通过 IPC 同步）、自动更新状态等 |

---

## Query Patterns

### IndexedDB (Dexie)

- **单例 db**：`src/utils/db.js` 顶部 `const db = new Dexie('yesplaymusic')`，整个应用共用此实例。
- **schema 版本管理**：`db.version(N).stores({...})` 递增；升级回调用 `.upgrade(tx => ...)` 迁移数据，见 `db.js` 里 `version(3).upgrade(...)` 为旧记录补 `createTime`。
- **按主键查询**：`db.trackDetail.get({ id })` / `db.lyric.get({ id })`。
- **批量写**：`db.trackDetail.bulkPut(items)`（项目当前多用单条 `put`）。
- **缓存带时间戳**：每张表都有 `updateTime` 字段，`getTrackDetailFromCache` 用它判断缓存是否过期。

### localStorage

- **读写封装**：读 `JSON.parse(localStorage.getItem('settings'))`，写 `localStorage.setItem('settings', JSON.stringify(value))`。
- **自动持久化**：Vuex 插件 `saveToLocalStorage`（`src/store/plugins/localStorage.js`）在每次 mutation 后把 `state.settings` 与 `state.data` 同步写回。
- **初始化**：`src/store/initLocalStorage.js` 定义首次启动的默认值，`state.js` 在加载时若 `appVersion` 缺失则写入默认。

### electron-store

- **实例化**：主进程里 `import Store from 'electron-store'; const store = new Store()`。
- **用途**：主进程需要独立读取的设置（如 `closeAppOption`、托盘状态），通过 IPC 与渲染进程的 `settings` 保持一致。
- **API**：`store.get(key)` / `store.set(key, value)`。

---

## Migrations

- **IndexedDB**：用 Dexie 的 `db.version(N).stores(...).upgrade(tx => ...)`。新增表或字段就 bump version，旧数据在 `.upgrade` 里迁移。参考 `src/utils/db.js` 的 `version(3)`/`version(4)`。
- **localStorage**：`src/utils/updateApp.js`（被 `state.js` 引入）在版本升级时按 `appVersion` diff 执行迁移逻辑；`initLocalStorage.js` 是首个版本的默认值。
- **electron-store**：无正式 migration，靠 `Store` 的默认值与显式 `store.get(key, defaultValue)`。

---

## Naming Conventions

- **Dexie 表名**：camelCase（`trackDetail`、`lyric`、`album`、`trackSources`）。
- **主键**：`&id`（Dexie schema 语法），二级索引用 `, field`。
- **时间戳字段**：`updateTime`（毫秒时间戳）或 `createTime`。
- **localStorage key**：`'settings'` / `'data'` / `'player'` / `'lastfm'` / `'appVersion'`，全小写单词。
- **electron-store key**：与渲染进程 `settings` 子字段同名的字符串路径（如 `'settings.closeAppOption'`）。

---

## Common Mistakes

- **在 Web 模式用 `fs`/`path`**：`src/utils/db.js` 用 `process.env.IS_ELECTRON === true` 守卫，新增文件读写也要守卫，否则 Web 模式崩溃。
- **新增 Dexie 表不 bump version**：会导致 schema 不生效。
- **localStorage 存大对象**：`settings`/`data` 已是顶层 key，不要把整个 `state` 序列化进单个 key。
- **直接改 `state.player`**：是 Proxy，写它会自动持久化，不要手动 `localStorage.setItem('player', ...)`。
- **跨进程访问对方存储**：渲染进程不要直接读 electron-store，主进程不要直接读 IndexedDB；走 IPC 同步。
- **缓存不查过期**：`getTrackDetailFromCache` 等必须检查 `updateTime`，不要无脑返回缓存。
