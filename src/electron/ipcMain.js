import { app, dialog, globalShortcut, ipcMain } from 'electron';
import { registerGlobalShortcut } from '@/electron/globalShortcut';
import cloneDeep from 'lodash/cloneDeep';
import shortcuts from '@/utils/shortcuts';
import { createMenu } from './menu';
import { isCreateTray, isMac } from '@/utils/platform';

const clc = require('cli-color');
const log = text => {
  console.log(`${clc.blueBright('[ipcMain.js]')} ${text}`);
};

const DEFAULT_UNM_SOURCES = ['kugou', 'bodian', 'migu', 'ytdlp'];
const UNM_SOURCE_ALIASES = {
  ytdl: 'youtubedl',
  pyncm: 'pyncmd',
};
const SUPPORTED_UNM_SOURCES = new Set([
  'qq',
  'kugou',
  'kuwo',
  'bodian',
  'migu',
  'joox',
  'youtube',
  'youtubedl',
  'ytdlp',
  'bilibili',
  'bilivideo',
  'pyncmd',
]);

let unblockMatch;

function getUnblockMatch() {
  if (!unblockMatch) {
    unblockMatch = require('@unblockneteasemusic/server');
  }
  return unblockMatch;
}

function configureUnblockMusic(settings) {
  const cookies = {
    joox: settings.jooxCookie || '',
    qq: settings.qqCookie || '',
    migu: settings.miguCookie || '',
  };

  process.env.ENABLE_FLAC = settings.enableFlac === true ? 'true' : 'false';
  process.env.JOOX_COOKIE = cookies.joox;
  process.env.QQ_COOKIE = cookies.qq;
  process.env.MIGU_COOKIE = cookies.migu;

  if (settings.searchMode === 'order-first') {
    process.env.FOLLOW_SOURCE_ORDER = 'true';
  } else {
    delete process.env.FOLLOW_SOURCE_ORDER;
  }

  // ENABLE_FLAC 通过 select 模块的导出属性实时读取，
  // qq/migu provider 直接引用 select.ENABLE_FLAC，故此处赋值即可生效。
  require('@unblockneteasemusic/server/src/provider/select').ENABLE_FLAC =
    settings.enableFlac === true;

  // 注意：joox/qq/migu 的 cookie 在 provider 模块加载时从 process.env 读取。
  // 由于 webpack 将 @unblockneteasemusic/server 标记为 external，无法在运行时
  // 通过 require 重新加载子路径模块来刷新 cookie。因此 cookie 变更需要重启应用才生效。
}

const exitAsk = (e, win) => {
  e.preventDefault(); //阻止默认行为
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Information',
      cancelId: 2,
      defaultId: 0,
      message: '确定要关闭吗？',
      buttons: ['最小化', '直接退出'],
    })
    .then(result => {
      if (result.response == 0) {
        e.preventDefault(); //阻止默认行为
        win.minimize(); //调用 最小化实例方法
      } else if (result.response == 1) {
        win = null;
        //app.quit();
        app.exit(); //exit()直接关闭客户端，不会执行quit();
      }
    })
    .catch(err => {
      log(err);
    });
};

const exitAskWithoutMac = (e, win) => {
  e.preventDefault(); //阻止默认行为
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Information',
      cancelId: 2,
      defaultId: 0,
      message: '确定要关闭吗？',
      buttons: ['最小化到托盘', '直接退出'],
      checkboxLabel: '记住我的选择',
    })
    .then(result => {
      if (result.checkboxChecked && result.response !== 2) {
        win.webContents.send(
          'rememberCloseAppOption',
          result.response === 0 ? 'minimizeToTray' : 'exit'
        );
      }

      if (result.response === 0) {
        e.preventDefault(); //阻止默认行为
        win.hide(); //调用 最小化实例方法
      } else if (result.response === 1) {
        win = null;
        //app.quit();
        app.exit(); //exit()直接关闭客户端，不会执行quit();
      }
    })
    .catch(err => {
      log(err);
    });
};

const client = require('discord-rich-presence')('818936529484906596');

/**
 * Parse the source string (`a, b`) to source list `['a', 'b']`.
 *
 * @param {string} sourceString The source string.
 * @returns {string[]} The source list.
 */
function parseSourceStringToList(sourceString) {
  return sourceString
    .split(',')
    .map(s => s.trim().toLowerCase())
    .map(s => UNM_SOURCE_ALIASES[s] || s)
    .filter(s => {
      const isAvailable = SUPPORTED_UNM_SOURCES.has(s);

      if (!isAvailable) {
        log(`This source is not one of the supported source: ${s}`);
      }

      return isAvailable;
    });
}

export function initIpcMain(win, store, trayEventEmitter) {
  ipcMain.handle(
    'unblock-music',
    /**
     *
     * @param {*} _
     * @param {string | null} sourceListString
     * @param {Record<string, any>} ncmTrack
     * @param {Record<string, any>} settings
     */
    async (_, sourceListString, ncmTrack, settings = {}) => {
      configureUnblockMusic(settings);

      if (settings.proxyUri) {
        try {
          global.proxy = require('url').parse(settings.proxyUri);
        } catch (error) {
          global.proxy = null;
          log(`Invalid UNM proxy: ${error}`);
        }
      } else {
        global.proxy = null;
      }

      const song = {
        id: ncmTrack.id && ncmTrack.id.toString(),
        name: ncmTrack.name,
        duration: ncmTrack.dt || ncmTrack.duration || 0,
        album: ncmTrack.al && {
          id: ncmTrack.al.id && ncmTrack.al.id.toString(),
          name: ncmTrack.al.name,
        },
        artists: ncmTrack.ar
          ? ncmTrack.ar.map(({ id, name }) => ({
              id: id && id.toString(),
              name,
            }))
          : [],
      };

      const sourceList =
        typeof sourceListString === 'string'
          ? parseSourceStringToList(sourceListString)
          : DEFAULT_UNM_SOURCES;
      log(`[UNM] using source: ${sourceList.join(', ')}`);
      log(
        `[UNM] using configuration: flac=${settings.enableFlac === true}, ` +
          `searchMode=${settings.searchMode || 'fast-first'}, ` +
          `proxy=${settings.proxyUri ? 'configured' : 'disabled'}`
      );

      try {
        const matchedSong = await getUnblockMatch()(song.id, sourceList, song);
        log(`respond with matched song…`);
        log(JSON.stringify(matchedSong));
        return matchedSong;
      } catch (err) {
        const errorMessage = err instanceof Error ? `${err.message}` : `${err}`;
        log(`UnblockNeteaseMusic failed: ${errorMessage}`);
        return null;
      }
    }
  );

  ipcMain.on('close', e => {
    if (isMac) {
      win.hide();
      exitAsk(e, win);
    } else {
      let closeOpt = store.get('settings.closeAppOption');
      if (closeOpt === 'exit') {
        win = null;
        //app.quit();
        app.exit(); //exit()直接关闭客户端，不会执行quit();
      } else if (closeOpt === 'minimizeToTray') {
        e.preventDefault();
        win.hide();
      } else {
        exitAskWithoutMac(e, win);
      }
    }
  });

  ipcMain.on('minimize', () => {
    win.minimize();
  });

  ipcMain.on('maximizeOrUnmaximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  ipcMain.on('settings', (event, options) => {
    store.set('settings', options);
    if (options.enableGlobalShortcut) {
      registerGlobalShortcut(win, store);
    } else {
      log('unregister global shortcut');
      globalShortcut.unregisterAll();
    }
  });

  ipcMain.on('playDiscordPresence', (event, track) => {
    client.updatePresence({
      details: track.name + ' - ' + track.ar.map(ar => ar.name).join(','),
      state: track.al.name,
      endTimestamp: Date.now() + track.dt,
      largeImageKey: track.al.picUrl,
      largeImageText: 'Listening ' + track.name,
      smallImageKey: 'play',
      smallImageText: 'Playing',
      instance: true,
    });
  });

  ipcMain.on('pauseDiscordPresence', (event, track) => {
    client.updatePresence({
      details: track.name + ' - ' + track.ar.map(ar => ar.name).join(','),
      state: track.al.name,
      largeImageKey: track.al.picUrl,
      largeImageText: 'YesPlayMusic',
      smallImageKey: 'pause',
      smallImageText: 'Pause',
      instance: true,
    });
  });

  ipcMain.on('setProxy', (event, config) => {
    const proxyRules = `${config.protocol}://${config.server}:${config.port}`;
    store.set('proxy', proxyRules);
    win.webContents.session.setProxy(
      {
        proxyRules,
      },
      () => {
        log('finished setProxy');
      }
    );
  });

  ipcMain.on('removeProxy', () => {
    log('removeProxy');
    win.webContents.session.setProxy({});
    store.set('proxy', '');
  });

  ipcMain.on('switchGlobalShortcutStatusTemporary', (e, status) => {
    log('switchGlobalShortcutStatusTemporary');
    if (status === 'disable') {
      globalShortcut.unregisterAll();
    } else {
      registerGlobalShortcut(win, store);
    }
  });

  ipcMain.on('updateShortcut', (e, { id, type, shortcut }) => {
    log('updateShortcut');
    let shortcuts = store.get('settings.shortcuts');
    let newShortcut = shortcuts.find(s => s.id === id);
    newShortcut[type] = shortcut;
    store.set('settings.shortcuts', shortcuts);

    createMenu(win, store);
    globalShortcut.unregisterAll();
    registerGlobalShortcut(win, store);
  });

  ipcMain.on('restoreDefaultShortcuts', () => {
    log('restoreDefaultShortcuts');
    store.set('settings.shortcuts', cloneDeep(shortcuts));

    createMenu(win, store);
    globalShortcut.unregisterAll();
    registerGlobalShortcut(win, store);
  });

  if (isCreateTray) {
    ipcMain.on('updateTrayTooltip', (_, title) => {
      trayEventEmitter.emit('updateTooltip', title);
    });
    ipcMain.on('updateTrayPlayState', (_, isPlaying) => {
      trayEventEmitter.emit('updatePlayState', isPlaying);
    });
    ipcMain.on('updateTrayLikeState', (_, isLiked) => {
      trayEventEmitter.emit('updateLikeState', isLiked);
    });
    ipcMain.on('updateTrayIcon', () => {
      trayEventEmitter.emit('updateIcon');
    });
  }
}
