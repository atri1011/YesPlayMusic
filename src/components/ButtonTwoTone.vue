<template>
  <button :style="buttonStyle" :class="color">
    <svg-icon
      v-if="iconClass !== null"
      :icon-class="iconClass"
      :style="{ marginRight: iconButton ? '0px' : '8px' }"
    />
    <slot></slot>
  </button>
</template>

<script>
export default {
  name: 'ButtonTwoTone',
  props: {
    iconClass: {
      type: String,
      default: null,
    },
    iconButton: {
      type: Boolean,
      default: false,
    },
    horizontalPadding: {
      type: Number,
      default: 16,
    },
    color: {
      type: String,
      default: 'blue',
    },
    backgroundColor: {
      type: String,
      default: '',
    },
    textColor: {
      type: String,
      default: '',
    },
    shape: {
      type: String,
      default: 'square',
    },
  },
  computed: {
    buttonStyle() {
      let styles = {
        borderRadius: this.shape === 'round' ? '50%' : '8px',
        padding: `8px ${this.horizontalPadding}px`,
        // height: "38px",
        width: this.shape === 'round' ? '38px' : 'auto',
      };
      if (this.backgroundColor !== '')
        styles.backgroundColor = this.backgroundColor;
      if (this.textColor !== '') styles.color = this.textColor;
      return styles;
    },
  },
};
</script>

<style lang="scss" scoped>
button {
  height: 40px;
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 18px;
  font-weight: 600;
  background-color: var(--color-primary-bg);
  color: var(--color-primary);
  margin-right: 12px;
  transition: transform var(--duration-fast) var(--ease-out-quint),
    background-color var(--duration-fast) var(--ease-out-quart),
    color var(--duration-fast) var(--ease-out-quart),
    box-shadow var(--duration-fast) var(--ease-out-quart);
  user-select: none;
  box-shadow: 0 2px 6px -2px rgba(0, 0, 0, 0.04);
  .svg-icon {
    width: 16px;
    height: 16px;
  }
  &:hover {
    transform: scale(1.04);
    box-shadow: 0 6px 14px -4px rgba(0, 0, 0, 0.12);
  }
  &:active {
    transform: scale(0.94);
    box-shadow: none;
    transition-duration: 0.08s;
  }
}
button.grey {
  background-color: var(--color-secondary-bg);
  color: var(--color-text);
  opacity: 0.78;
}
button.transparent {
  background-color: transparent;
}
</style>
