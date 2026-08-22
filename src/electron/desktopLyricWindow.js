import { BrowserWindow, screen } from 'electron';
import { isMac } from '@/utils/platform';

const clc = require('cli-color');
const log = text => {
  console.log(`${clc.blueBright('[desktopLyricWindow.js]')} ${text}`);
};

// 窗口不能靠原生 resize 改尺寸：Electron 官方在 transparent 窗口的 Limitations
// 里明确写着「Transparent windows are not resizable. Setting resizable to true
// may make a transparent window stop working on some platforms」。宽度改由页面
// 内自绘的把手算好新 bounds 后走 IPC 过来。
const MIN_WIDTH = 320;
const MIN_HEIGHT = 90;
const DEFAULT_HEIGHT = 170;
// 默认占工作区宽度的比例，两侧留白让长歌词也不至于顶到屏幕边缘
const DEFAULT_WIDTH_RATIO = 0.7;
// 离工作区底部的距离按比例算而不写死像素。workArea 与窗口 bounds 都是 DIP，
// 一块 1080p 屏在 150% 缩放下只有约 680 DIP 高，固定 120px 的间距加上 170px
// 的窗身就吃掉了 43% 的屏高，窗口会落在屏幕中部而不是底部。
// 上下限只是防止超宽超窄的工作区把间距算到离谱的值上
const DEFAULT_BOTTOM_GAP_RATIO = 0.06;
const DEFAULT_BOTTOM_GAP_RANGE = [24, 90];
const SAVE_BOUNDS_DELAY = 500;

let win = null;
let saveBoundsTimer = null;
let locked = false;
// 锁定时鼠标悬停在控制条上要临时恢复可点，这个标记记住「现在是因为悬停才可点的」
let hoverInteractive = false;

function defaultBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.round(workArea.width * DEFAULT_WIDTH_RATIO);
  const [minGap, maxGap] = DEFAULT_BOTTOM_GAP_RANGE;
  const gap = Math.min(
    Math.max(Math.round(workArea.height * DEFAULT_BOTTOM_GAP_RATIO), minGap),
    maxGap
  );
  return {
    width,
    height: DEFAULT_HEIGHT,
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + workArea.height - DEFAULT_HEIGHT - gap,
  };
}

/**
 * 记住的位置是否还落在某块屏幕上。拔掉副屏之后直接套用旧 bounds 会把窗口
 * 放到看不见的地方，而它既没有任务栏图标也没有边框，用户根本找不回来。
 */
function isBoundsVisible(bounds) {
  return screen.getAllDisplays().some(({ workArea }) => {
    return (
      bounds.x + bounds.width > workArea.x + 50 &&
      bounds.x < workArea.x + workArea.width - 50 &&
      bounds.y + bounds.height > workArea.y &&
      bounds.y < workArea.y + workArea.height - 50
    );
  });
}

function restoreBounds(store) {
  const saved = store.get('desktopLyricWindow');
  if (
    !saved ||
    typeof saved.x !== 'number' ||
    typeof saved.y !== 'number' ||
    saved.width < MIN_WIDTH ||
    saved.height < MIN_HEIGHT ||
    !isBoundsVisible(saved)
  ) {
    return defaultBounds();
  }
  return saved;
}

/**
 * 拖动过程中 'moved' 会连着触发，跟主窗口一样做尾部防抖，停手后只写一次。
 */
function saveBounds(store) {
  if (saveBoundsTimer !== null) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    saveBoundsTimer = null;
    if (!win || win.isDestroyed()) return;
    store.set('desktopLyricWindow', win.getBounds());
  }, SAVE_BOUNDS_DELAY);
}

/**
 * forward: true 让窗口在点击穿透的同时仍能收到 mousemove，页面据此判断鼠标
 * 有没有悬到控制条上，再回过头请求临时恢复可点——这是锁定态下还能有个
 * 解锁按钮的唯一办法。
 */
function applyMouseMode() {
  if (!win || win.isDestroyed()) return;
  // forward 只在 ignore 为 true 时有意义，恢复可点时不要带上
  if (locked && !hoverInteractive)
    win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(false);
}

export function getDesktopLyricWindow() {
  return win && !win.isDestroyed() ? win : null;
}

export function sendToDesktopLyric(channel, payload) {
  getDesktopLyricWindow()?.webContents.send(channel, payload);
}

export function setDesktopLyricLocked(value) {
  locked = value === true;
  hoverInteractive = false;
  applyMouseMode();
  sendToDesktopLyric('desktopLyric:lock', locked);
}

export function setDesktopLyricHover(hovering) {
  hoverInteractive = hovering === true;
  applyMouseMode();
}

/**
 * 页面内自绘把手拖出来的新尺寸。原生 resize 不能用，只能整块换 bounds。
 */
export function setDesktopLyricBounds(store, patch) {
  const target = getDesktopLyricWindow();
  if (!target || !patch) return;
  const current = target.getBounds();
  // 拖太宽会把窗口拉到屏幕外面去，宽度封顶在所在那块屏的工作区
  const { workArea } = screen.getDisplayMatching(current);
  const width = Math.min(
    workArea.width,
    Math.max(MIN_WIDTH, Math.round(patch.width ?? current.width))
  );
  const next = {
    x: Math.round(patch.x ?? current.x),
    y: Math.round(patch.y ?? current.y),
    width,
    height: Math.max(MIN_HEIGHT, Math.round(patch.height ?? current.height)),
  };
  // 拖左把手时右边缘必须钉住。宽度一旦被上下限截断，x 就得按截断后的宽度
  // 回算，否则拖到最窄/最宽之后再继续拖，窗口会整个横着漂走
  if (patch.x !== undefined && patch.width !== undefined) {
    next.x = Math.round(patch.x + patch.width - width);
  }
  target.setBounds(next);
  saveBounds(store);
}

/**
 * @param {Electron.BrowserWindow} mainWindow 主窗口，歌词窗口加载完要向它讨一次当前状态
 * @param {Store} store electron-store，用来记住窗口位置
 */
export function createDesktopLyricWindow(mainWindow, store) {
  if (getDesktopLyricWindow()) return win;
  log('creating desktop lyric window');

  const bounds = restoreBounds(store);
  win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    title: 'YesPlayMusic Desktop Lyric',
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 'screen-saver' 是常规窗口能取到的最高层级，普通应用的置顶窗口压不过它。
  // 独占全屏的游戏仍然盖不住，那是显示模式决定的，不是层级问题。
  win.setAlwaysOnTop(true, 'screen-saver');
  if (isMac) {
    // 切 Space 或别的应用进全屏时不跟着消失
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  win.setMenuBarVisibility(false);

  const url = process.env.WEBPACK_DEV_SERVER_URL
    ? `${process.env.WEBPACK_DEV_SERVER_URL}desktop-lyric.html`
    : 'http://localhost:27232/desktop-lyric.html';
  win.loadURL(url);

  win.once('ready-to-show', () => {
    win.show();
    applyMouseMode();
  });

  win.webContents.on('did-finish-load', () => {
    // 窗口是按需创建的，主窗口这边未必马上有状态变化，先讨一次当前行
    sendToDesktopLyric('desktopLyric:lock', locked);
    mainWindow?.webContents.send('desktopLyric:request');
  });

  win.on('moved', () => saveBounds(store));

  win.on('closed', () => {
    win = null;
  });

  return win;
}

export function destroyDesktopLyricWindow() {
  if (saveBoundsTimer !== null) {
    clearTimeout(saveBoundsTimer);
    saveBoundsTimer = null;
  }
  const target = getDesktopLyricWindow();
  if (!target) return;
  log('destroying desktop lyric window');
  target.destroy();
  win = null;
}
