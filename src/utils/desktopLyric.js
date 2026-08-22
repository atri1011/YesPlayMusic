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
