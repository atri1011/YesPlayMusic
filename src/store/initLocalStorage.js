import { playlistCategories } from '@/utils/staticData';
import shortcuts from '@/utils/shortcuts';

console.debug('[debug][initLocalStorage.js]');
const enabledPlaylistCategories = playlistCategories
  .filter(c => c.enable)
  .map(c => c.name);

let localStorage = {
  player: {},
  settings: {
    lang: null,
    musicLanguage: 'all',
    appearance: 'auto',
    themeColor: 'default',
    musicQuality: 320000,
    lyricFontSize: 28,
    outputDevice: 'default',
    showPlaylistsByAppleMusic: true,
    enableUnblockNeteaseMusic: true,
    automaticallyCacheSongs: true,
    cacheLimit: 8192,
    cachePath: null,
    enableReversedMode: false,
    gameMode: false,
    nyancatStyle: false,
    showLyricsTranslation: true,
    showLyricsWordByWord: true,
    enableExternalYrcDB: true,
    lyricsBackground: true,
    showDesktopLyric: false,
    desktopLyricLocked: false,
    // 桌面歌词的译文与字号跟歌词页各管各的：一个是浮在别人界面上的一两行，
    // 一个是占满整屏的滚动列表，合用一份设置必然有一边不合适
    desktopLyricTranslation: true,
    desktopLyricFontSize: 30,
    enableOsdlyricsSupport: false,
    closeAppOption: 'ask',
    enableDiscordRichPresence: false,
    enableGlobalShortcut: true,
    showLibraryDefault: false,
    subTitleDefault: false,
    linuxEnableCustomTitlebar: false,
    trayIconTheme: 'auto',
    enabledPlaylistCategories,
    proxyConfig: {
      protocol: 'noProxy',
      server: '',
      port: null,
    },
    enableRealIP: false,
    realIP: null,
    shortcuts: shortcuts,
  },
  data: {
    user: {},
    likedSongPlaylistID: 0,
    lastRefreshCookieDate: 0,
    loginMode: null,
  },
};

if (process.env.IS_ELECTRON === true) {
  localStorage.settings.automaticallyCacheSongs = true;
}

export default localStorage;
