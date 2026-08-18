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
    // @unblockneteasemusic/server 内部用 pino + sonic-boom 输出日志，
    // 默认写入 fd 1 (stdout)。打包成 asar 的 Windows GUI 应用没有有效的
    // stdout 文件描述符，sonic-boom 写入时会抛 EBADF: bad file descriptor，
    // 进程被 Uncaught Exception 终止。仅在打包环境下把日志重定向到 userData
    // 下的文件，让 pino.destination() 打开真实文件而非 fd 1；开发模式仍输出到终端。
    if (app.isPackaged && !process.env.LOG_FILE) {
      const path = require('path');
      const logDir = app.getPath('logs') || app.getPath('userData');
      try {
        const fs = require('fs');
        fs.mkdirSync(logDir, { recursive: true });
      } catch (mkdirError) {
        // 目录已存在或不可创建，忽略错误继续
      }
      process.env.LOG_FILE = path.join(logDir, 'unm.log');
    }
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
  // 选择自定义缓存目录：弹出原生目录选择对话框
  // 返回用户所选目录路径，取消选择时返回 null
  ipcMain.handle('select-cache-directory', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: '选择缓存文件夹',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const selectedPath = result.filePaths[0];
    const fs = require('fs');
    const path = require('path');
    // 确保所选目录可写，写入一个占位文件以校验权限
    const cacheDir = path.join(selectedPath, 'yesplaymusic-cache');
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      // 写入测试文件以确认权限
      const testFile = path.join(cacheDir, '.write-test');
      fs.writeFileSync(testFile, '', { flag: 'w' });
      fs.unlinkSync(testFile);
    } catch (error) {
      log(`select-cache-directory: 目录不可写 ${cacheDir} -> ${error}`);
      return { error: String(error), path: selectedPath };
    }
    return { path: cacheDir };
  });

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

  // 外部歌单导入：在主进程侧抓取 QQ 音乐歌单详情。
  // 浏览器侧直接请求 QQ 音乐接口会被 CORS / Referer 校验拦截，
  // 这里借助 Electron 的 net 模块带上 Referer 伪装成客户端，再返回归一化的曲目列表。
  ipcMain.handle(
    'fetch-external-playlist',
    async (_, platform, playlistId) => {
      if (platform !== 'qq') {
        return {
          error: `unsupported platform: ${platform}`,
          tracks: [],
        };
      }
      try {
        const net = require('electron').net;
        const queryResult = await new Promise((resolve, reject) => {
          const endpointUrl =
            'https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg';
          const queryString = new URLSearchParams({
            disstid: String(playlistId),
            format: 'json',
            outCharset: 'utf-8',
            type: '1',
            json: '1',
            utf8: '1',
            onlysong: '0',
            new_format: '1',
          }).toString();
          const fullUrl = `${endpointUrl}?${queryString}`;
          let body = '';
          const request = net.request({
            method: 'GET',
            url: fullUrl,
            redirect: 'follow',
          });
          request.setHeader('Referer', 'https://y.qq.com/');
          request.setHeader(
            'User-Agent',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
              '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'
          );
          request.on('response', response => {
            response.on('data', chunk => {
              body += chunk.toString('utf8');
            });
            response.on('end', () => {
              try {
                resolve(JSON.parse(body));
              } catch (parseError) {
                reject(parseError);
              }
            });
          });
          request.on('error', error => {
            reject(error);
          });
          request.end();
        });

        const cdList =
          queryResult?.cdlist?.[0] || queryResult?.data?.cdlist?.[0] || null;
        if (!cdList) {
          return {
            error: 'QQ 音乐返回的歌单数据为空，可能需要登录或歌单不存在',
            tracks: [],
            title: `QQ 音乐歌单 ${playlistId}`,
          };
        }
        const title = cdList.dissname || `QQ 音乐歌单 ${playlistId}`;
        const creator =
          cdList.nickname || (cdList.creator && cdList.creator.name) || '';
        const coverUrl = cdList.logo || '';
        const tracks = (cdList.songlist || []).map(song => ({
          name: song.songname || song.name || '',
          artist: (song.singer || [])
            .map(singer => singer.name)
            .join(', '),
          album: song.albumname || (song.album && song.album.name) || '',
          duration: (song.interval || 0) * 1000,
        }));
        return { title, creator, coverUrl, tracks };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        log(`fetch-external-playlist failed: ${errorMessage}`);
        return {
          error: `抓取 QQ 音乐歌单失败：${errorMessage}`,
          tracks: [],
        };
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
