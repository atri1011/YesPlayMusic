# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

YesPlayMusic 前端质量靠 **ESLint + Prettier + husky pre-commit** 三层保障。

- **ESLint** (`eslint ^6.7.2`，配置在 `package.json` 的 `eslintConfig`)：
  - extends: `plugin:vue/essential`、`plugin:vue/recommended`、`plugin:prettier/recommended`、`eslint:recommended`
  - parser: `babel-eslint`
  - env: `node` + `browser`
- **Prettier** (`prettier 2.5.1`，配置在 `.prettierrc`)：
  - single quote、trailing comma es5、no semi-parallel、tabWidth 2、arrowParens avoid、endOfLine lf
- **husky** (`husky ^4.3.0`)：`pre-commit` 钩子跑 `npm run prettier`（全量格式化 `src`）。

---

## Forbidden Patterns

- **使用 Composition API / `<script setup>`**：Vue 2 项目，禁用。
- **使用 TypeScript**：纯 JS 项目，禁用 `.ts/.tsx`。
- **直接修改 Vuex state**（除 Player Proxy 外）：必须走 mutation。
- **在组件里 `new axios` / 绕过 `@/utils/request`**：会丢失拦截器注入。
- **硬编码 UI 文案**：必须走 `$t('...')` i18n。
- **硬编码颜色**：主题色走 `themeColorPresets`，不内联 `#xxxxxx`。
- **`var` 声明**：用 `const` / `let`。
- **`==` 宽松比较**：用 `===`（与 null 比较可用 `== null`）。
- **`console.log` 提交**：调试日志不入仓（`background.js` 里的 `log()` 封装除外）。

---

## Required Patterns

- **import 顺序**：第三方 → `@/api` → `@/store` → `@/utils` → `@/components` → 相对路径。
- **组件 `name` 选项必填**：PascalCase。
- **props 显式类型 + required/default**：见 component-guidelines.md。
- **scoped SCSS**：`<style lang="scss" scoped>`。
- **i18n**：用户可见文案走 `$t`，key 按页面/模块分组。
- **平台分支**：Electron 专属代码用 `process.env.IS_ELECTRON === true` 守卫，不要 `window.require` 不判环境。
- **可选链**：访问深层 API 响应字段用 `?.` + `??`。

---

## Testing Requirements

- **当前无自动化测试**：仓库无 jest/vitest 配置、无 `__tests__`。
- **手动验证**：`npm run serve` 启动 dev server，`npm run electron:serve` 启动 Electron dev。
- **回归点**：
  - Web 模式（`npm run serve`）与 Electron 模式（`npm run electron:serve`）行为一致。
  - 登录态、播放、歌词、下载四条核心路径。
- **新增功能**：至少手动跑一遍 Web + Electron 双模式。

---

## Code Review Checklist

- [ ] `npm run lint` 无 error（warning 视情况）。
- [ ] `prettier` 已格式化（husky 会自动跑，但 review 再确认）。
- [ ] 无 `console.log` 残留。
- [ ] 用户文案走 i18n。
- [ ] 颜色走主题变量，未硬编码。
- [ ] Electron 专属代码有 `IS_ELECTRON` 守卫。
- [ ] props 有类型 + required/default。
- [ ] 组件有 `name`。
- [ ] 异步 fetch 后 `commit` 而非直接改 state。
- [ ] 定时器/监听器在 `beforeDestroy` 清理。
