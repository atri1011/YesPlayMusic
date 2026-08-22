import store from '@/store';
import { lyricGetters } from '@/utils/lyricProvider';

/**
 * 桌面歌词在渲染进程这一侧的桥。
 *
 * 桌面歌词窗口是一个不加载 Vuex 的独立页面（store/index.js 顶层就 new Player()，
 * 第二个窗口一旦引入就会多出一个 Howler 实例），所以它拿不到任何播放状态，
 * 只能由这里推过去：主窗口 → ipcMain → 歌词窗口。
 *
 * 推送是事件驱动而非定时轮询：desktopLyricPayload 是个 computed，它重算的时机
 * 恰好就是切行 / seek / 暂停 / 播放 / 切歌，平均每行才一条消息。逐字动画在
 * 窗口那侧靠负 animation-delay 的 CSS 自己播完整行，中间不需要通信。
 */

const ipcRenderer =
  process.env.IS_ELECTRON === true
    ? window.require('electron').ipcRenderer
    : null;

/**
 * 可选字号。设置页的下拉框和窗口工具条的 A-/A+ 共用这一份：
 * A-/A+ 走的是这个数组的下标，两边永远选得到同一批值，不会出现
 * 工具条调出一个下拉框里没有的字号。
 */
export const DESKTOP_LYRIC_FONT_SIZES = [18, 22, 26, 30, 36, 42, 50, 60];
const DEFAULT_FONT_SIZE = 30;

export function isDesktopLyricOn() {
  return store.state.settings?.showDesktopLyric === true;
}

export function setDesktopLyric(on) {
  store.commit('updateSettings', {
    key: 'showDesktopLyric',
    value: on === true,
  });
}

export function toggleDesktopLyric() {
  setDesktopLyric(!isDesktopLyricOn());
}

export function toggleDesktopLyricLock() {
  store.commit('updateSettings', {
    key: 'desktopLyricLocked',
    value: store.state.settings?.desktopLyricLocked !== true,
  });
}

export function getDesktopLyricFontSize() {
  const size = store.state.settings?.desktopLyricFontSize;
  // 老版本 localStorage 里没有这个键，手改过的值也可能不在列表里
  return DESKTOP_LYRIC_FONT_SIZES.includes(size) ? size : DEFAULT_FONT_SIZE;
}

/**
 * 按档位挪字号。窗口上的 A-/A+ 绕回主窗口改 settings，跟其他按钮一样
 * 不在窗口那侧私存状态。
 * @param {number} delta +1 放大一档，-1 缩小一档
 */
export function stepDesktopLyricFontSize(delta) {
  const sizes = DESKTOP_LYRIC_FONT_SIZES;
  const index = sizes.indexOf(getDesktopLyricFontSize()) + delta;
  store.commit('updateSettings', {
    key: 'desktopLyricFontSize',
    value: sizes[Math.min(Math.max(index, 0), sizes.length - 1)],
  });
}

export function initDesktopLyricBridge() {
  if (ipcRenderer === null) return;

  const push = () => {
    if (!isDesktopLyricOn()) return;
    ipcRenderer.send('desktopLyric:update', lyricGetters.desktopLyricPayload);
  };

  lyricGetters.$watch('desktopLyricPayload', push);

  // 窗口是按需创建的，新窗口加载完时主窗口这边未必有任何状态变化，
  // 不补推一次就会空着直到下一行歌词
  ipcRenderer.on('desktopLyric:request', push);

  store.watch(
    s => s.settings?.showDesktopLyric === true,
    on => {
      ipcRenderer.send('desktopLyric:toggle', on);
      if (on) push();
    }
  );

  store.watch(
    s => s.settings?.desktopLyricLocked === true,
    locked => ipcRenderer.send('desktopLyric:lock', locked)
  );

  if (isDesktopLyricOn()) {
    ipcRenderer.send('desktopLyric:toggle', true);
    push();
  }
}
