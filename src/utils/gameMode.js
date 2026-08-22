import store from '@/store';

/**
 * 游戏模式：把播放器降级成「只会放歌的内核」。
 *
 * 一边打游戏一边听歌时，界面渲染、封面预取、元数据落盘这些跟「把当前这首歌放出声」
 * 无关的开销都在跟游戏抢带宽、抢 CPU/GPU、抢磁盘 I/O。开启后这些统统关掉，音乐不断。
 *
 * 所有降级逻辑一律只读 isGameMode()，不直接读 settings，
 * 这样切换来源（手动开关 / 将来的自动检测）时无需改动任何降级点。
 */
export function isGameMode() {
  return store.state?.settings?.gameMode === true;
}

export function setGameMode(on) {
  store.commit('updateSettings', { key: 'gameMode', value: on === true });
}

export function toggleGameMode() {
  setGameMode(!isGameMode());
}

// —— 自动检测接入点 ——
// 当前只做手动开关。Node/Electron 没有内置的「别人家窗口是否全屏」API：
// 走原生依赖（koffi + SHQueryUserNotificationState）实测浏览器 F11、PPT 放映会误报，
// 走窗口遮挡启发式又分不清游戏和最大化的浏览器，所以暂不实现。
//
// 将来要补自动检测，只需在这里实现一个 detector（轮询或原生事件），
// 在进入 / 退出全屏游戏时调用 setGameMode(true / false) 即可，降级逻辑一行都不用动。
