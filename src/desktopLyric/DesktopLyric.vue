<template>
  <div
    class="desktop-lyric"
    :class="{ locked, paused: !payload.playing }"
    :style="rootStyle"
  >
    <!-- 热区不能放进 app-region: drag 的区域里：拖动区在 Windows 上会吞掉
         mousemove，锁定态下就再也收不到悬停事件，解锁按钮永远浮不出来 -->
    <div
      class="hot-zone"
      @mouseenter="setHover(true)"
      @mouseleave="setHover(false)"
    >
      <transition name="fade">
        <div v-show="hovering" class="toolbar">
          <button class="tool" @click="control('previous')">
            <svg-icon icon-class="previous" />
          </button>
          <button class="tool" @click="control('play')">
            <svg-icon :icon-class="payload.playing ? 'pause' : 'play'" />
          </button>
          <button class="tool" @click="control('next')">
            <svg-icon icon-class="next" />
          </button>
          <span class="divider"></span>
          <button
            class="tool"
            :class="{ active: locked }"
            @click="control('lock')"
          >
            <svg-icon icon-class="lock" />
          </button>
          <button class="tool" @click="control('close')">
            <svg-icon icon-class="x" />
          </button>
        </div>
      </transition>
    </div>

    <div class="stage">
      <div class="current">
        <span
          v-if="hasWords"
          :key="lineKey"
          class="words"
          :style="{ fontSize: `${fontSize}px` }"
        >
          <span
            v-for="(word, index) in payload.words"
            :key="index"
            class="word"
            :style="wordAnimationStyle(word)"
            >{{ word.text }}</span
          >
        </span>
        <span v-else class="plain" :style="{ fontSize: `${fontSize}px` }">{{
          currentText
        }}</span>
      </div>

      <div
        v-if="payload.translation && showTranslation"
        class="translation"
        :style="{ fontSize: `${fontSize * 0.6}px` }"
        >{{ payload.translation }}</div
      >

      <div
        v-if="payload.nextContent"
        class="next"
        :style="{ fontSize: `${fontSize * 0.66}px` }"
        >{{ payload.nextContent }}</div
      >
    </div>

    <!-- transparent 窗口不能用原生 resize（Electron 官方限制），
         左右两条把手自己算新 bounds 让主进程整块换掉 -->
    <div class="resize-handle left" @mousedown="startResize($event, 'left')" />
    <div
      class="resize-handle right"
      @mousedown="startResize($event, 'right')"
    />
  </div>
</template>

<script>
const { ipcRenderer } = window.require('electron');

// 扫过时长直接取该字的真实时长，只保底不封顶：长拖腔就该慢慢扫过去。
// durationMs 为 0 的异常项兜底到这个值，免得一闪而过
const WORD_SWEEP_MIN_MS = 60;
// 辉光在字唱完之后继续淡出的时间（毫秒）
const WORD_GLOW_TAIL_MS = 260;
const MIN_WIDTH = 320;

const emptyPayload = () => ({
  trackId: 0,
  trackName: '',
  artistName: '',
  playing: false,
  lineStartMs: 0,
  content: '',
  translation: '',
  words: null,
  nextContent: '',
});

export default {
  name: 'DesktopLyric',
  data() {
    return {
      payload: emptyPayload(),
      locked: false,
      hovering: false,
      fontSize: 30,
      showTranslation: true,
      resizing: null,
    };
  },
  computed: {
    hasWords() {
      return Array.isArray(this.payload.words) && this.payload.words.length > 0;
    },
    /**
     * 行内基准变了就换 key，整段逐字节点重建、动画从头按新的负延迟播。
     * 同一行内拖进度条也能重新对齐。
     */
    lineKey() {
      return `${this.payload.trackId}-${this.payload.lineStartMs}`;
    },
    currentText() {
      if (this.payload.content) return this.payload.content;
      if (!this.payload.trackName) return '';
      // 没歌词、纯音乐、歌词还在路上，都显示歌名 — 歌手，窗口不空着
      return this.payload.artistName
        ? `${this.payload.trackName} — ${this.payload.artistName}`
        : this.payload.trackName;
    },
    rootStyle() {
      return {
        '--dl-font-size': `${this.fontSize}px`,
      };
    },
  },
  created() {
    this.readLocalSettings();
    ipcRenderer.on('desktopLyric:update', this.onUpdate);
    ipcRenderer.on('desktopLyric:lock', this.onLock);
    ipcRenderer.on('desktopLyric:settings', this.onSettings);
  },
  beforeDestroy() {
    ipcRenderer.removeListener('desktopLyric:update', this.onUpdate);
    ipcRenderer.removeListener('desktopLyric:lock', this.onLock);
    ipcRenderer.removeListener('desktopLyric:settings', this.onSettings);
    this.stopResize();
  },
  methods: {
    /**
     * 两个窗口同源，localStorage 是共享的。开窗瞬间直接读到当前设置，
     * 不用等主窗口推第一条 IPC，省掉一帧默认样式的闪动。
     */
    readLocalSettings() {
      try {
        this.onSettings(JSON.parse(localStorage.getItem('settings')));
      } catch (error) {
        // 首次启动或数据损坏，用默认值即可
      }
    },
    onSettings(settings) {
      if (!settings) return;
      this.showTranslation = settings.showLyricsTranslation !== false;
      this.locked = settings.desktopLyricLocked === true;
    },
    onUpdate(_, payload) {
      this.payload = { ...emptyPayload(), ...payload };
    },
    onLock(_, locked) {
      this.locked = locked === true;
      if (!locked) this.hovering = false;
    },
    setHover(hovering) {
      this.hovering = hovering;
      // 锁定时窗口整体点击穿透，主进程要据此临时恢复可点，否则工具条按不到
      ipcRenderer.send('desktopLyric:hover', hovering);
    },
    control(action) {
      ipcRenderer.send('desktopLyric:control', action);
    },
    /**
     * 逐字动画：颜色边界在字形内部从左往右扫过，速度跟该字的真实时长走。
     * 延迟为负数时 CSS 会让动画从中途开始播放，因此从行中间进入也能对上。
     */
    wordAnimationStyle(word) {
      const sweepMs = Math.max(word.durationMs, WORD_SWEEP_MIN_MS);
      return {
        animationDuration: `${sweepMs}ms, ${sweepMs + WORD_GLOW_TAIL_MS}ms`,
        animationDelay: `${word.startMs - this.payload.lineStartMs}ms`,
      };
    },
    startResize(event, edge) {
      event.preventDefault();
      this.resizing = {
        edge,
        startScreenX: event.screenX,
        startX: window.screenX,
        startWidth: window.outerWidth,
        frame: null,
      };
      window.addEventListener('mousemove', this.onResizeMove);
      window.addEventListener('mouseup', this.stopResize);
    },
    onResizeMove(event) {
      const state = this.resizing;
      if (!state) return;
      const delta = event.screenX - state.startScreenX;
      const patch =
        state.edge === 'left'
          ? {
              x: state.startX + Math.min(delta, state.startWidth - MIN_WIDTH),
              width: state.startWidth - delta,
            }
          : { width: state.startWidth + delta };

      // 鼠标事件比窗口重绘密集得多，逐个 setBounds 会把主进程刷爆
      if (state.frame !== null) cancelAnimationFrame(state.frame);
      state.frame = requestAnimationFrame(() => {
        state.frame = null;
        ipcRenderer.send('desktopLyric:setBounds', patch);
      });
    },
    stopResize() {
      window.removeEventListener('mousemove', this.onResizeMove);
      window.removeEventListener('mouseup', this.stopResize);
      if (this.resizing?.frame !== null && this.resizing?.frame !== undefined) {
        cancelAnimationFrame(this.resizing.frame);
      }
      this.resizing = null;
    },
  },
};
</script>

<style lang="scss" scoped>
// 高亮色暂时写死；跟封面主色走要等取色逻辑从 lyrics.vue 里搬出来
$accent-h: 226;
$accent-s: 90%;
$accent-l: 68%;

.desktop-lyric {
  --dl-accent-h: #{$accent-h};
  --dl-accent-s: #{$accent-s};
  --dl-accent-l: #{$accent-l};
  --dl-accent: hsl(var(--dl-accent-h), var(--dl-accent-s), var(--dl-accent-l));

  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  padding: 0 18px 10px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica,
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-weight: 600;
  text-align: center;
  color: #fff;
}

.hot-zone {
  flex: none;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(20, 20, 22, 0.72);
  backdrop-filter: blur(8px);
  -webkit-app-region: no-drag;
}

.tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;

  .svg-icon {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  &.active {
    color: var(--dl-accent);
  }
}

.divider {
  width: 1px;
  height: 14px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.2);
}

.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  // 拖歌词本体就能挪窗口，不额外占一条标题栏
  -webkit-app-region: drag;
}

.current,
.translation,
.next {
  max-width: 100%;
  line-height: 1.25;
  // 字的填充色是 transparent（靠 background-clip: text 上色），text-shadow
  // 会从字心透出来糊成一团；drop-shadow 作用在已渲染结果的 alpha 上，
  // 形状才是对的。桌面歌词浮在任意底色上，这层描边是可读性的全部保障
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9))
    drop-shadow(0 0 5px rgba(0, 0, 0, 0.55));
}

.translation {
  margin-top: 4px;
  opacity: 0.82;
  font-weight: 500;
}

.next {
  margin-top: 6px;
  opacity: 0.45;
  font-weight: 500;
}

.plain {
  color: #fff;
}

.word {
  // 字里自带的空格是断词依据，不能被折叠掉
  white-space: pre-wrap;

  // 未唱部分保持白色、已唱部分换成高亮色，推进靠颜色边界在字形内部滑过
  // 而不是整字亮度跳变——这是它看起来连续的根本原因。渐变图铺成字宽的
  // 两倍多，动 background-position 把边界推过去：设字宽 w、柔边宽 f = 0.4em，
  // 图总宽 2w + f，则 50% ∓ 0.2em 正好是已唱区右端与未唱区左端
  background-image: linear-gradient(
    to right,
    var(--dl-accent) 0,
    var(--dl-accent) calc(50% - 0.2em),
    #fff calc(50% + 0.2em),
    #fff 100%
  );
  background-size: calc(200% + 0.4em) 100%;
  background-repeat: no-repeat;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;

  animation-name: dl-word-sweep;
  animation-timing-function: linear;
  // both 而非 forwards：延迟期间也要保持 from 帧（整字未唱），
  // 否则未轮到的字会先按静态值渲染再跳一下
  animation-fill-mode: both;
}

// 暂停时 CSS 动画不会自己停下，需要跟着播放状态一起冻结
.desktop-lyric.paused .word {
  animation-play-state: paused;
}

@keyframes dl-word-sweep {
  from {
    background-position: 100% 0;
  }

  to {
    background-position: 0 0;
  }
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  -webkit-app-region: no-drag;

  &.left {
    left: 0;
  }

  &.right {
    right: 0;
  }
}

.desktop-lyric.locked .resize-handle {
  // 锁定时整窗穿透，把手留着也点不到，去掉光标避免误导
  cursor: default;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
