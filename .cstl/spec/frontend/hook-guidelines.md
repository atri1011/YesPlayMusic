# Hook Guidelines

> How "hooks" / reusable stateful logic are used in this project.

> ⚠️ 本项目是 **Vue 2 Options API**，**没有 React 风格的 `useXxx` hooks**，也不使用 `@vue/composition-api`。本文件记录本项目对"可复用有状态逻辑"的等价约定。

---

## Overview

Vue 2 的可复用有状态逻辑通过以下三种机制承载，优先级从高到低：

1. **Vuex action/mutation**（全局有状态逻辑）→ `src/store/actions.js` / `mutations.js`
2. **工具模块的具名导出函数**（无状态逻辑）→ `src/utils/*.js`
3. **类实例 + Proxy**（有状态对象，如播放器）→ `src/utils/Player.js`

本项目**不使用** Vue mixin（仓库内无 `mixins:` 用法）、**不使用** Composition API、**不使用** render props / scoped slots 做逻辑复用。

---

## Custom Hook Patterns

Vue 2 下的等价做法：

| 需求 | 做法 | 示例 |
|------|------|------|
| 跨组件共享状态 | Vuex action + mutation | `this.$store.dispatch('fetchLikedSongsWithDetails')` |
| 无状态工具函数 | `src/utils/*.js` named export | `import { isAccountLoggedIn } from '@/utils/auth'` |
| 有状态对象 | class + 在 store 持有单例 Proxy | `store.state.player = new Proxy(new Player(), { set })` |
| 组件内定时器/监听 | `mounted` / `beforeDestroy` 成对管理 | 见 `src/utils/Player.js` 的 `setTitle` |

---

## Data Fetching

- **统一走 `src/api/*.js`**：每个函数返回 axios promise，响应已在拦截器解包为 `data`。
- **组件里 fetch**：在 `mounted` 或 `methods` 中调用，`.then` 后 `commit`。
- **不要在组件里直接 `axios.create`**：复用 `@/utils/request` 单例，保证拦截器（cookie/realIP/proxy）生效。
- **缓存**：歌曲详情/歌词走 IndexedDB（`@/utils/db.js`），不走 Vuex。

---

## Naming Conventions

- **api 函数**：动词开头 camelCase，`getXxx` / `fetchXxx` / `likeXxx`（如 `getMP3`、`getTrackDetail`、`likeATrack`）。
- **utils 函数**：动词或名词，camelCase（`isAccountLoggedIn`、`mapTrackPlayableStatus`、`changeAppearance`）。
- **class**：PascalCase（`Player`）。
- **Vuex action**：动词开头，camelCase（`showToast`、`fetchLikedSongsWithDetails`）。
- **Vuex mutation**：`updateXxx` / `addXxx` / `removeXxx`。

---

## Common Mistakes

- **引入 `@vue/composition-api` 写 `setup()`**：本项目不用 Composition API。
- **写 Vue mixin 复用逻辑**：仓库内无 mixin 用法，新增 mixin 会打破约定；优先抽为 utils 函数或 Vuex action。
- **在组件里 new axios 实例**：会绕过拦截器，丢失 cookie/realIP 注入。
- **在 `created` 做耗时异步**：阻塞渲染，改 `mounted` 或加 loading 态。
- **忘记 `beforeDestroy` 清理定时器/监听器**：导致内存泄漏。
