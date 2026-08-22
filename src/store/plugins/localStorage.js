import { isGameMode } from '@/utils/gameMode';

// 原本每个 mutation 都要把 settings + data 全量 JSON.stringify 后写一遍
// localStorage，翻歌单、拖进度条这类连续操作会打出一串同步写盘。
// 改成尾部防抖：安静下来之后才落盘一次。
const FLUSH_DELAY = 1000;
const FLUSH_DELAY_GAME_MODE = 10000;

let timer = null;
let pendingState = null;

function flush() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (pendingState === null) return;
  localStorage.setItem('settings', JSON.stringify(pendingState.settings));
  localStorage.setItem('data', JSON.stringify(pendingState.data));
  pendingState = null;
}

export default store => {
  // 防抖窗口内退出会丢掉最后一次改动，关窗前补一次
  window.addEventListener('beforeunload', flush);
  store.subscribe((mutation, state) => {
    // 存的是 state 本身而不是快照，flush 时序列化到的一定是最新值
    pendingState = state;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(
      flush,
      isGameMode() ? FLUSH_DELAY_GAME_MODE : FLUSH_DELAY
    );
  });
};
