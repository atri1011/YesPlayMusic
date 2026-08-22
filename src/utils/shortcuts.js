// default shortcuts
// for more info, check https://www.electronjs.org/docs/api/accelerator

export default [
  {
    id: 'play',
    name: '播放/暂停',
    shortcut: 'CommandOrControl+P',
    globalShortcut: 'Alt+CommandOrControl+P',
  },
  {
    id: 'next',
    name: '下一首',
    shortcut: 'CommandOrControl+Right',
    globalShortcut: 'Alt+CommandOrControl+Right',
  },
  {
    id: 'previous',
    name: '上一首',
    shortcut: 'CommandOrControl+Left',
    globalShortcut: 'Alt+CommandOrControl+Left',
  },
  {
    id: 'increaseVolume',
    name: '增加音量',
    shortcut: 'CommandOrControl+Up',
    globalShortcut: 'Alt+CommandOrControl+Up',
  },
  {
    id: 'decreaseVolume',
    name: '减少音量',
    shortcut: 'CommandOrControl+Down',
    globalShortcut: 'Alt+CommandOrControl+Down',
  },
  {
    id: 'like',
    name: '喜欢歌曲',
    shortcut: 'CommandOrControl+L',
    globalShortcut: 'Alt+CommandOrControl+L',
  },
  {
    id: 'minimize',
    name: '隐藏/显示播放器',
    shortcut: 'CommandOrControl+M',
    globalShortcut: 'Alt+CommandOrControl+M',
  },
  {
    id: 'gameMode',
    name: '游戏模式',
    shortcut: 'CommandOrControl+G',
    globalShortcut: 'Alt+CommandOrControl+G',
  },
  {
    id: 'desktopLyric',
    name: '桌面歌词',
    shortcut: 'CommandOrControl+D',
    globalShortcut: 'Alt+CommandOrControl+D',
  },
  {
    id: 'desktopLyricLock',
    // 锁定后整个窗口点击穿透，这是唯一能解锁的逃生口，必须是全局的
    name: '锁定桌面歌词',
    shortcut: 'CommandOrControl+K',
    globalShortcut: 'Alt+CommandOrControl+K',
  },
];
