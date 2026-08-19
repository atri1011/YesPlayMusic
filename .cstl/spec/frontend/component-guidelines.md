# Component Guidelines

> How components are built in this project.

---

## Overview

YesPlayMusic 使用 **Vue 2 Options API**，不使用 Composition API、`<script setup>` 或 TypeScript。组件统一为单文件组件 `.vue`，模板 + Options API 脚本 + scoped SCSS 三段式。

- **Vue 版本**：`vue ^2.6.11`、`vue-template-compiler ^2.6.11`。
- **UI 组件库**：自研组件 + 少量第三方（`vue-slider-component`、`vue-clipboard2`、`plyr`）。
- **图标**：`vscode-codicons` + 自定义 SVG（`svg-sprite-loader`，见 `src/assets/icons`）。
- **国际化**：`vue-i18n ^8`，模板中用 `$t('key')`。

---

## Component Structure

标准 `.vue` 文件结构（参考 `src/components/Player.vue`、`src/components/TrackList.vue`）：

```vue
<template>
  <div class="component-root">
    <!-- 模板内容 -->
  </div>
</template>

<script>
// 1. import：第三方 → @/api → @/store → @/utils → @/components
import { getMP3 } from '@/api/track';
import { isAccountLoggedIn } from '@/utils/auth';
import ButtonIcon from '@/components/ButtonIcon.vue';

// 2. 组件选项（Options API）
export default {
  name: 'ComponentName',          // PascalCase，必须
  components: { ButtonIcon },     // 局部注册
  props: {
    // 声明类型 + required + default，不使用 object 简写
    track: { type: Object, required: true },
    showCover: { type: Boolean, default: true },
  },
  data() {
    return {};
  },
  computed: {
    // 映射 store 用 mapState/mapGetters（来自 vuex）
  },
  watch: {},
  created() {},
  mounted() {},
  beforeDestroy() {},
  methods: {},
};
</script>

<style lang="scss" scoped>
.component-root {
  /* 嵌套样式 */
}
</style>
```

---

## Props Conventions

- **必须显式声明类型**：`{ type: Object, required: true }`，禁止仅写 `type` 而省略 `required`/`default`。
- **Boolean 默认值** 用 `default: true` 或 `default: false`，不用 `default: null`。
- **Object/Array 默认值** 必须用工厂函数 `default: () => ({})` / `default: () => []`。
- **不在子组件直接修改 props**：通过 `$emit` 通知父组件。
- **事件命名**：kebab-case，如 `@click.native`、`@update:visible`。

---

## Styling Patterns

- **`<style lang="scss" scoped>`**：组件级样式一律 scoped + SCSS。
- **全局样式** 仅放 `src/assets/css/global.scss`、`transitions.scss`、`nprogress.css`。
- **主题色**：通过 `changeAppearance(theme)` 切换 `data-theme` 属性，SCSS 用 `[data-theme="light"]` / `[data-theme="dark"]` 变量。
- **主题色变量**：定义在 `src/utils/common.js` 的 `themeColorPresets`（default/sunset/ocean/...），不要硬编码颜色。
- **字体/间距**：复用 `src/assets/css/global.scss` 变量。
- **禁止内联 style 写颜色**（除非动态计算值），便于主题切换。

---

## Accessibility

- 按钮用 `<button-icon>` 组件并传 `title`（i18n key），见 `src/components/Player.vue` 的 `:title="$t('player.like')"`。
- 图标按钮至少提供 `title` 或 `aria-label`。
- 可点击区域用 `<button>` 或带 `@click` 的元素，避免用纯 `<div>` 充当按钮（确有需要时补 `role="button"`）。
- 表单输入提供 `<label>` 关联。

---

## Common Mistakes

- **使用 Composition API / `setup()`**：本项目是 Vue 2，不要引入 `@vue/composition-api` 写法。
- **直接修改 `this.$route.query/params`**：用 `this.$router.push` 导航。
- **在模板里写复杂表达式**：抽到 `computed`。
- **忘记 `name` 选项**：devtools 与递归组件需要。
- **跨组件直接访问 `$parent`/`$children`**：优先走 props/events 或 Vuex。
- **组件内硬编码文案**：必须走 `$t('...')`。
