# Type Safety

> Type safety patterns in this project.

---

## Overview

YesPlayMusic 是 **纯 JavaScript 项目**，不使用 TypeScript、Flow 或任何静态类型系统。类型安全依靠 **JSDoc 注释 + ESLint + 运行时守卫** 三者结合。

- **无 `.ts/.tsx` 文件**，`tsconfig.json` 不存在。
- **无类型检查构建步骤**：`vue-cli-service build` 只跑 babel + eslint。
- **类型信息来源**：第三方库自带的 `.d.ts`（如 `@types/node`）仅供编辑器 IntelliSense，不参与编译。

---

## Type Organization

- **无集中 `types/` 目录**，类型即注释即代码。
- **复杂对象结构**通过 JSDoc `@typedef` 在就近模块顶部定义，如 API 响应结构。
- **第三方 API 响应**：参考网易云 API 文档，不在仓库内维护 schema 镜像。

---

## Validation

- **运行时守卫**：在入口处用 `typeof` / `Array.isArray` / `!= null` 检查外部数据。
- **登录态守卫**：`@/utils/auth.js` 的 `isAccountLoggedIn()` / `isLooseLoggedIn()` 是典型运行时守卫，调用需登录 API 前必须先检查。
- **API 响应**：axios 拦截器（`src/utils/request.js`）只 `return response.data`，不做 schema 校验；组件里用 `.then(data => ...)` 后按需访问字段，未定义字段访问为 `undefined`（不会抛错）。
- **localStorage 反序列化**：`JSON.parse(localStorage.getItem('xxx'))` 外层无 try-catch，约定这些 key 由本应用自己写入（恶意篡改风险自担）。

---

## Common Patterns

- **JSDoc 注释函数签名**：参考 `src/api/track.js` 的 `getMP3`、`getTrackDetail` —— 用 `@param {string} id` 注释参数。
- **`@type` 标注复杂变量**：如 `src/utils/request.js` 里的 `@type {import('axios').AxiosResponse | null}`。
- **`@readonly` + `@enum`** 模拟联合类型字面量：见 `src/utils/Player.js` 的 `UNPLAYABLE_CONDITION`。
- **默认值兜底**：`store.state.settings?.musicQuality ?? '320000'`（见 `src/api/track.js` 的 `getBr`）。
- **可选链 + 空值合并**：`?.` 与 `??` 广泛使用（babel 转译），避免访问深层字段抛错。

---

## Forbidden Patterns

- **引入 TypeScript / `@vue/cli-plugin-typescript`**：会改变构建链与依赖，超出项目范围。
- **`// @ts-check` 大范围开启**：编辑器报错噪音过大，按需在单个文件开启。
- **依赖第三方运行时校验库**（zod/yup/joi）：项目无此依赖，不引入。
- **用 `any` 风格的 JSDoc**（`@param {any}`）：写明具体类型或 `Object`/`string[]` 等。
- **在 axios 拦截器里做严格 schema 校验并抛错**：会破坏现有"取不到字段即 undefined"的容错约定。
