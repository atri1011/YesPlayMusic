# Directory Structure

> How frontend code is organized in this project.

---

## Overview

YesPlayMusic 是 Vue 2 + Electron 桌面应用。前端（renderer 进程）代码全部位于 `src/`，通过 `vue-cli-service` 构建，使用 webpack + `vue-cli-plugin-electron-builder` 打包为 Electron 应用。

- **无 TypeScript**：纯 JavaScript，不使用 `.ts/.tsx`。
- **无 `<script setup>` / Composition API**：统一使用 Vue 2 Options API（`data`/`methods`/`computed`/`watch`）。
- **模块组织按"类型"分目录**（api、components、utils、views、store、router、locale、assets），而非按"feature"分目录。

---

## Directory Layout

```
src/
├── api/                 # 网易云 API 调用层，按资源拆分（track.js/playlist.js/...）
├── assets/              # 静态资源：icons(svg-sprite)、css(scss)、images
├── components/          # 全局复用组件（扁平结构，.vue）
├── electron/            # Electron 主进程模块（tray/menu/ipcMain/mpris/touchBar/...）
├── locale/              # vue-i18n 多语言（zh-CN/en/tr/...）
├── router/              # vue-router 路由定义
├── store/               # Vuex 单一 store（state/mutations/actions/plugins）
├── utils/               # 工具函数与类（Player.js/request.js/db.js/auth.js/common.js/...）
├── views/               # 路由页面级组件（扁平结构，.vue，文件名即路由名）
├── App.vue              # 根组件
├── main.js              # 渲染进程入口（注册 Vue 插件、全局滤镜、i18n、router、store）
├── background.js        # Electron 主进程入口
├── ncmModDef.js         # 网易云 API 模块定义
└── registerServiceWorker.js
```

---

## Module Organization

- **新增 API 调用** → 放入 `src/api/`，按资源域拆分文件（如新增 `radio.js`）。每个函数导出单个 API 调用，内部统一通过 `@/utils/request`。
- **新增复用组件** → 放入 `src/components/`，文件名采用 PascalCase（如 `TrackList.vue`、`ButtonIcon.vue`），不建子目录。
- **新增页面** → 放入 `src/views/`，文件名 camelCase（如 `dailyTracks.vue`、`loginAccount.vue`），并在 `src/router` 注册。
- **新增工具函数** → 放入 `src/utils/`，按职责拆分（如 `db.js`、`auth.js`、`lyrics.js`）。
- **Electron 主进程逻辑** → 放入 `src/electron/`，按平台功能拆分（tray、menu、ipcMain、mpris、touchBar、dockMenu、globalShortcut）。

---

## Naming Conventions

- **组件文件**：PascalCase（`ButtonIcon.vue`、`TrackListItem.vue`、`ModalNewPlaylist.vue`）。
- **视图文件**：camelCase（`lastfmCallback.vue`、`loginAccount.vue`、`dailyTracks.vue`）。
- **工具/api 文件**：camelCase（`request.js`、`track.js`、`externalPlaylistImport.js`）。
- **JS 模块导出**：api 层用 named exports（`export function getMP3`），工具类用 default export（`export default class Player`）。
- **CSS 类名**：kebab-case，SCSS 嵌套 `<style scoped>`。
- **组件注册名**：PascalCase，模板中可使用 kebab-case 或 PascalCase。

---

## Examples

- API 层分层：`src/api/track.js`（歌曲 url/详情/歌词/scrobble）、`src/api/playlist.js`、`src/api/album.js`。
- 工具类典型：`src/utils/Player.js`（Howler 封装 + Vuex Proxy 持久化）、`src/utils/request.js`（axios 实例 + 拦截器）。
- 组件分层：`src/components/Player.vue`（全局播放器）、`src/components/TrackList.vue`（列表）、`src/components/TrackListItem.vue`（列表项）。
