import defaultShortcuts from '@/utils/shortcuts';
const { globalShortcut } = require('electron');

const clc = require('cli-color');
const log = text => {
  console.log(`${clc.blueBright('[globalShortcut.js]')} ${text}`);
};

export function registerGlobalShortcut(win, store) {
  log('registerGlobalShortcut');
  let shortcuts = store.get('settings.shortcuts');
  if (shortcuts === undefined) {
    shortcuts = defaultShortcuts;
  }

  // 用户配置里可能没有新版本才加进来的快捷键（渲染进程的 updateApp 补完后才会同步过来），
  // 直接 .find(...).globalShortcut 会在这一小段窗口期里炸掉，回退到默认值。
  const accelerator = id =>
    shortcuts.find(s => s.id === id)?.globalShortcut ??
    defaultShortcuts.find(s => s.id === id).globalShortcut;

  const send = (id, channel) => {
    globalShortcut.register(accelerator(id), () => {
      win.webContents.send(channel);
    });
  };

  send('play', 'play');
  send('next', 'next');
  send('previous', 'previous');
  send('increaseVolume', 'increaseVolume');
  send('decreaseVolume', 'decreaseVolume');
  send('like', 'like');
  send('gameMode', 'toggleGameMode');

  globalShortcut.register(accelerator('minimize'), () => {
    win.isVisible() ? win.hide() : win.show();
  });
}
