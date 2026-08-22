<template>
  <div
    class="desktop-lyric"
    :class="{ locked, paused: !payload.playing }"
    :style="accentStyle"
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
          <button
            class="tool"
            :title="$t('player.previous')"
            @click="control('previous')"
          >
            <svg-icon icon-class="previous" />
          </button>
          <button
            class="tool"
            :title="payload.playing ? $t('player.pause') : $t('player.play')"
            @click="control('play')"
          >
            <svg-icon :icon-class="payload.playing ? 'pause' : 'play'" />
          </button>
          <button
            class="tool"
            :title="$t('player.next')"
            @click="control('next')"
          >
            <svg-icon icon-class="next" />
          </button>
          <span class="divider"></span>
          <button
            class="tool label"
            :title="$t('desktopLyric.fontSizeDown')"
            @click="control('fontSizeDown')"
            >A-</button
          >
          <button
            class="tool label"
            :title="$t('desktopLyric.fontSizeUp')"
            @click="control('fontSizeUp')"
            >A+</button
          >
          <span class="divider"></span>
          <button
            class="tool"
            :class="{ active: locked }"
            :title="
              locked ? $t('desktopLyric.unlock') : $t('desktopLyric.lock')
            "
            @click="control('lock')"
          >
            <svg-icon :icon-class="locked ? 'lock' : 'lock-open'" />
          </button>
          <button
            class="tool"
            :title="$t('desktopLyric.close')"
            @click="control('close')"
          >
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
         左右两条把手自己算新 bounds 让主进程整块换掉。
         锁定时整个摘掉而不只是改光标：悬停热区会让主进程临时恢复整窗可点，
         把手横跨全高，那一刻正好能在顶部两角被抓到 -->
    <template v-if="!locked">
      <div
        v-for="edge in ['left', 'right']"
        :key="edge"
        class="resize-handle"
        :class="[edge, { visible: hovering }]"
        @pointerdown="startResize($event, edge)"
        @pointermove="onResizeMove"
        @pointerup="stopResize"
        @pointercancel="stopResize"
        @lostpointercapture="stopResize"
      >
        <span class="grip"></span>
      </div>
    </template>
  </div>
</template>

<script>
import SvgIcon from '@/components/SvgIcon';
import { normalizeLocale } from './i18n';

// 图标逐个 import，不走 @/assets/icons：那个模块用 require.context 把 47 个
// 图标一并塞进 sprite，将近 100 KiB，而这个窗口只用得到下面这 7 个
import '@/assets/icons/previous.svg';
import '@/assets/icons/play.svg';
import '@/assets/icons/pause.svg';
import '@/assets/icons/next.svg';
import '@/assets/icons/lock.svg';
import '@/assets/icons/lock-open.svg';
import '@/assets/icons/x.svg';

const { ipcRenderer } = window.require('electron');

// 扫过时长直接取该字的真实时长，只保底不封顶：长拖腔就该慢慢扫过去。
// durationMs 为 0 的异常项兜底到这个值，免得一闪而过
const WORD_SWEEP_MIN_MS = 60;
// 辉光在字唱完之后继续淡出的时间（毫秒）
const WORD_GLOW_TAIL_MS = 260;
const DEFAULT_FONT_SIZE = 30;

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
  accentHue: null,
  accentSaturation: null,
});

export default {
  name: 'DesktopLyric',
  components: {
    SvgIcon,
  },
  data() {
    return {
      payload: emptyPayload(),
      locked: false,
      hovering: false,
      fontSize: DEFAULT_FONT_SIZE,
      showTranslation: true,
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
    /**
     * 高亮色的 H/S 跟着封面走。取色失败、封面是灰度、或游戏模式下压根没取色时
     * 主窗口推的是 null，这里就不覆盖，SCSS 里的兜底主题蓝生效。
     */
    accentStyle() {
      if (this.payload.accentHue === null) return {};
      return {
        '--dl-accent-h': this.payload.accentHue,
        '--dl-accent-s': `${this.payload.accentSaturation}%`,
      };
    },
  },
  created() {
    // 拖动状态刻意不放进 data：它每帧都要写 frame，而且没有任何模板读它，
    // 做成响应式只会白白触发重渲染
    this.resizing = null;
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
      // 译文与字号都是桌面歌词自己的设置项，不跟歌词页共用：一个是浮在别人
      // 界面上的一两行，一个是占满整屏的滚动列表
      this.showTranslation = settings.desktopLyricTranslation !== false;
      this.fontSize = settings.desktopLyricFontSize || DEFAULT_FONT_SIZE;
      this.locked = settings.desktopLyricLocked === true;
      this.$i18n.locale = normalizeLocale(settings.lang);
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
      // 指针捕获而不是往 window 上挂 mousemove：窗口是等 IPC 回来才变宽的，
      // 稍微拖快一点光标就跑到窗口外面去了，那之后 mousemove / mouseup
      // 事件全都收不到——拖动僵在半路，listener 也留着不清。捕获之后这一串
      // 事件无论光标去了哪儿都只发给这个把手，抬手还会自动释放
      event.currentTarget.setPointerCapture(event.pointerId);
      this.resizing = {
        edge,
        startScreenX: event.screenX,
        startX: window.screenX,
        startWidth: window.outerWidth,
        frame: null,
      };
    },
    onResizeMove(event) {
      const state = this.resizing;
      if (!state) return;
      const delta = event.screenX - state.startScreenX;
      // 左把手要同时改 x 和 width；宽度被上下限截断时右边缘怎么钉住
      // 由主进程回算，这里只管把「本来想要的」那一组值送过去
      const patch =
        state.edge === 'left'
          ? { x: state.startX + delta, width: state.startWidth - delta }
          : { width: state.startWidth + delta };

      // 指针事件比窗口重绘密集得多，逐个 setBounds 会把主进程刷爆
      if (state.frame !== null) cancelAnimationFrame(state.frame);
      state.frame = requestAnimationFrame(() => {
        state.frame = null;
        ipcRenderer.send('desktopLyric:setBounds', patch);
      });
    },
    stopResize() {
      const state = this.resizing;
      if (state?.frame != null) cancelAnimationFrame(state.frame);
      this.resizing = null;
    },
  },
};
</script>

<style lang="scss" scoped>
.desktop-lyric {
  // 高亮色的 H/S 由封面取色随 payload 覆盖到这一层，兜底值取
  // --color-primary(#335eea) 的 H/S。L 只在 CSS 里定死：窗口永远浮在
  // 未知底色上，靠描边保证可读性，不像歌词页那样有深浅主题之分。
  //
  // 三个分量只各自声明、不在本层合成成一个 hsl()：自定义属性的 var() 是在
  // 「声明所在元素」上就地替换的，在这层合成会把兜底蓝烧死成字面量，
  // 内联样式覆盖 H/S 也追不回来。合成放到真正用色的地方
  --dl-accent-h: 226;
  --dl-accent-s: 90%;
  --dl-accent-l: 68%;

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

  // A- / A+ 用文字而不是图标：字号调节没有哪个通用图标一眼能看懂
  &.label {
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  &.active {
    color: hsl(var(--dl-accent-h), var(--dl-accent-s), var(--dl-accent-l));
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
    hsl(var(--dl-accent-h), var(--dl-accent-s), var(--dl-accent-l)) 0,
    hsl(var(--dl-accent-h), var(--dl-accent-s), var(--dl-accent-l))
      calc(50% - 0.2em),
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
  // 14px 是上限：再宽就压到 .stage 的 18px 内边距上，
  // 而 .stage 是 app-region: drag，重叠了会跟拖动区抢事件
  width: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ew-resize;
  -webkit-app-region: no-drag;

  &.left {
    left: 0;
  }

  &.right {
    right: 0;
  }
}

// 窗口本身是全透明的，把手再不给视觉线索就等于不存在——只有 cursor 会变，
// 而那得先蒙对位置。跟工具条同一个时机浮出来：鼠标一进顶部热区，
// 两侧抓手一起显形，用户就知道该抓哪儿
.grip {
  width: 4px;
  height: 26px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.85);
  opacity: 0;
  transition: opacity 0.18s;
}

.resize-handle.visible .grip,
.resize-handle:hover .grip {
  opacity: 1;
}

.resize-handle:hover .grip {
  background: #fff;
}

// 锁定时不能拖动窗口。悬停热区会让主进程临时恢复整窗可点，
// 这时鼠标只要滑到歌词上就能把「锁着的」窗口拖走
.desktop-lyric.locked .stage {
  -webkit-app-region: no-drag;
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
