import axios from 'axios';
import Dexie from 'dexie';
import store from '@/store';
import { isGameMode } from '@/utils/gameMode';
// import pkg from "../../package.json";

const db = new Dexie('yesplaymusic');

// 歌单详情缓存。打开歌单时先用它把内容铺出来，网络回来再校正，
// 避免整页空白干等一次跨公网的 /playlist/detail。
db.version(7).stores({
  playlist: '&id, updateTime',
});

// 外部逐字歌词库（AMLL）的查询结果，存的是原始 yrc 文本或 null（表示该库没有）
db.version(6).stores({
  externalYrc: '&id, updateTime',
});

// lyricNew 与 lyric 分表存储：/lyric/new 的响应是 /lyric 的超集（多出 yrc /
// ytlrc / yromalrc），共用一张表会让先写入的一方决定形状，导致逐字歌词时有时无。
db.version(5).stores({
  lyricNew: '&id, updateTime',
});

db.version(4).stores({
  trackDetail: '&id, updateTime',
  lyric: '&id, updateTime',
  album: '&id, updateTime',
});

db.version(3)
  .stores({
    trackSources: '&id, createTime',
  })
  .upgrade(tx =>
    tx
      .table('trackSources')
      .toCollection()
      .modify(
        track => !track.createTime && (track.createTime = new Date().getTime())
      )
  );

db.version(1).stores({
  trackSources: '&id',
});

let tracksCacheBytes = 0;

// fs / path 仅在 Electron 环境下可用（renderer 拥有 nodeIntegration）
const isElectron = process.env.IS_ELECTRON === true;
const fs = isElectron ? window.require('fs') : null;
const path = isElectron ? window.require('path') : null;

/**
 * 读取当前自定义缓存目录。
 * 优先使用用户在设置中指定的 cachePath；若为 null 则回退到 IndexedDB。
 */
function getCachePath() {
  const customPath = store.state.settings?.cachePath;
  return typeof customPath === 'string' && customPath.length > 0
    ? customPath
    : null;
}

/**
 * 拼装某首歌在磁盘缓存目录下的完整路径。
 * 文件名包含 trackId 与 from 来源，避免不同来源同名冲突。
 */
function buildTrackCacheFilePath(trackId, from = 'netease') {
  const cacheDir = getCachePath();
  if (!cacheDir) return null;
  const safeId = String(trackId).replace(/[\\/:*?"<>|]/g, '_');
  const safeFrom = String(from).replace(/[\\/:*?"<>|]/g, '_');
  return path.join(cacheDir, `${safeId}-${safeFrom}.cache`);
}

// 等待 settings 可用
async function waitForSettingsReady(timeoutMs = 5000) {
  const interval = 100;
  const maxTries = Math.ceil(timeoutMs / interval);
  let tries = 0;
  while (
    (store.state == null ||
      store.state.settings == null ||
      store.state.settings.cacheLimit === undefined) &&
    tries < maxTries
  ) {
    await new Promise(resolve => setTimeout(resolve, interval));
    tries++;
  }
  return store.state && store.state.settings;
}

// 初始化现有缓存总大小，确保应用启动时能正确判断并清理超限缓存
async function initTracksCacheBytes() {
  if (!isElectron) return;
  try {
    await waitForSettingsReady();
    // 自定义目录：扫描目录下的 .cache 文件累加大小
    if (getCachePath()) {
      tracksCacheBytes = await sumDiskCacheBytes();
      console.debug(
        '[debug][db.js] initTracksCacheBytes (disk), total bytes:',
        tracksCacheBytes
      );
      deleteExcessCache();
      return;
    }
    const all = await db.trackSources.toArray();
    tracksCacheBytes = all.reduce(
      (sum, t) => sum + (t?.source?.byteLength || 0),
      0
    );
    console.debug(
      '[debug][db.js] initTracksCacheBytes, total bytes:',
      tracksCacheBytes
    );
    deleteExcessCache();
  } catch (err) {
    console.debug('[debug][db.js] initTracksCacheBytes failed', err);
  }
}

/**
 * 遍历自定义缓存目录统计总大小。
 * 任何 I/O 异常均被吞掉并回退为 0，避免影响播放。
 */
async function sumDiskCacheBytes() {
  const cacheDir = getCachePath();
  if (!cacheDir || !fs) return 0;
  try {
    const entries = await fs.promises.readdir(cacheDir);
    const sizes = await Promise.all(
      entries
        .filter(name => name.endsWith('.cache'))
        .map(async name => {
          try {
            const stat = await fs.promises.stat(path.join(cacheDir, name));
            return stat.isFile() ? stat.size : 0;
          } catch {
            return 0;
          }
        })
    );
    return sizes.reduce((s1, s2) => s1 + s2, 0);
  } catch (err) {
    console.debug('[debug][db.js] sumDiskCacheBytes failed', err);
    return 0;
  }
}

/**
 * 解析文件名中的 trackId 与 from 字段。
 * 文件名格式：{trackId}-{from}.cache
 */
function parseDiskCacheFileName(fileName) {
  const baseName = fileName.endsWith('.cache')
    ? fileName.slice(0, -'.cache'.length)
    : fileName;
  const lastDash = baseName.lastIndexOf('-');
  if (lastDash === -1) return null;
  const from = baseName.slice(lastDash + 1);
  const idStr = baseName.slice(0, lastDash);
  const id = Number(idStr);
  if (Number.isNaN(id)) return null;
  return { id, from };
}

/**
 * 读取磁盘上某一首歌的缓存文件，返回 ArrayBuffer。
 * 不存在或读取失败时返回 null。
 */
async function readDiskCacheFile(id, from = 'netease') {
  const filePath = buildTrackCacheFilePath(id, from);
  if (!filePath) return null;
  try {
    await fs.promises.access(filePath);
  } catch {
    return null;
  }
  try {
    const buffer = await fs.promises.readFile(filePath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  } catch (err) {
    console.debug('[debug][db.js] readDiskCacheFile failed', err);
    return null;
  }
}

// 模块加载时触发初始化
initTracksCacheBytes();

async function deleteExcessCache() {
  if (
    store.state.settings.cacheLimit === false ||
    tracksCacheBytes < store.state.settings.cacheLimit * Math.pow(1024, 2)
  ) {
    return;
  }
  // 自定义目录：按 mtime 升序删除最旧文件直至不超限
  if (getCachePath()) {
    try {
      const cacheDir = getCachePath();
      const entries = await fs.promises.readdir(cacheDir);
      const fileInfos = await Promise.all(
        entries
          .filter(name => name.endsWith('.cache'))
          .map(async name => {
            const filePath = path.join(cacheDir, name);
            try {
              const stat = await fs.promises.stat(filePath);
              return {
                name,
                filePath,
                size: stat.isFile() ? stat.size : 0,
                mtimeMs: stat.mtimeMs,
              };
            } catch {
              return null;
            }
          })
      );
      const validFiles = fileInfos
        .filter(Boolean)
        .sort((a, b) => a.mtimeMs - b.mtimeMs);
      for (const file of validFiles) {
        if (
          tracksCacheBytes <
          store.state.settings.cacheLimit * Math.pow(1024, 2)
        ) {
          break;
        }
        try {
          await fs.promises.unlink(file.filePath);
          tracksCacheBytes -= file.size;
          console.debug(
            `[debug][db.js] deleteExcessCacheSucces (disk), file: ${file.name}, size: ${file.size}, cacheSize:${tracksCacheBytes}`
          );
        } catch (err) {
          console.debug('[debug][db.js] deleteExcessCacheFailed (disk)', err);
        }
      }
      return;
    } catch (err) {
      console.debug('[debug][db.js] deleteExcessCache failed (disk)', err);
      return;
    }
  }
  // IndexedDB 路径：按 createTime 升序删除
  try {
    const delCache = await db.trackSources.orderBy('createTime').first();
    await db.trackSources.delete(delCache.id);
    tracksCacheBytes -= delCache.source.byteLength;
    console.debug(
      `[debug][db.js] deleteExcessCacheSucces, track: ${delCache.name}, size: ${delCache.source.byteLength}, cacheSize:${tracksCacheBytes}`
    );
    deleteExcessCache();
  } catch (error) {
    console.debug('[debug][db.js] deleteExcessCacheFailed', error);
  }
}

export async function cacheTrackSource(
  trackInfo,
  url,
  bitRate,
  from = 'netease'
) {
  if (!isElectron) return;
  const name = trackInfo.name;
  const artist =
    (trackInfo.ar && trackInfo.ar[0]?.name) ||
    (trackInfo.artists && trackInfo.artists[0]?.name) ||
    'Unknown';
  let cover = trackInfo.al.picUrl;
  if (cover.slice(0, 5) !== 'https') {
    cover = 'https' + cover.slice(4);
  }
  // 这三发请求的结果直接丢弃，只为把各尺寸封面暖进 HTTP 缓存。
  // 游戏模式下界面根本不显示这些尺寸，每首歌白烧几百 KB 带宽，跳过。
  if (!isGameMode()) {
    axios.get(`${cover}?param=512y512`);
    axios.get(`${cover}?param=224y224`);
    axios.get(`${cover}?param=1024y1024`);
  }
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
  });
  const data = response.data;
  const cachePath = getCachePath();
  // 自定义目录：写入磁盘文件
  if (cachePath) {
    const filePath = buildTrackCacheFilePath(trackInfo.id, from);
    if (filePath) {
      try {
        // 写入前先检查同名文件是否已存在，存在则先减去其原大小再覆盖
        try {
          const stat = await fs.promises.stat(filePath);
          if (stat.isFile()) {
            tracksCacheBytes -= stat.size;
          }
        } catch {
          // 文件不存在属正常情况
        }
        await fs.promises.writeFile(filePath, Buffer.from(data));
        tracksCacheBytes += data.byteLength;
        console.debug(
          `[debug][db.js] cached track to disk 👉 ${name} by ${artist} -> ${filePath}`
        );
        deleteExcessCache();
        return { trackID: trackInfo.id, source: data, bitRate };
      } catch (err) {
        console.debug('[debug][db.js] cacheTrackSource disk write failed', err);
        // 写盘失败时回退到 IndexedDB
      }
    }
  }
  // IndexedDB 路径
  db.trackSources.put({
    id: trackInfo.id,
    source: data,
    bitRate,
    from,
    name,
    artist,
    createTime: new Date().getTime(),
  });
  console.debug(`[debug][db.js] cached track 👉 ${name} by ${artist}`);
  tracksCacheBytes += data.byteLength;
  deleteExcessCache();
  return { trackID: trackInfo.id, source: data, bitRate };
}

export async function getTrackSource(id) {
  const trackIdNum = Number(id);
  // 自定义目录：按 from 枚举查找（一个 track 可能有多来源缓存）
  if (getCachePath()) {
    const cacheDir = getCachePath();
    const idStr = String(trackIdNum).replace(/[\\/:*?"<>|]/g, '_');
    try {
      const entries = await fs.promises.readdir(cacheDir);
      const matched = entries.find(
        name => name.startsWith(`${idStr}-`) && name.endsWith('.cache')
      );
      if (matched) {
        const parsed = parseDiskCacheFileName(matched);
        if (parsed) {
          const source = await readDiskCacheFile(parsed.id, parsed.from);
          if (source) {
            console.debug(
              `[debug][db.js] get track from disk cache 👉 ${matched}`
            );
            return {
              id: parsed.id,
              source,
              bitRate: 0,
              from: parsed.from,
              name: null,
              artist: null,
              createTime: null,
            };
          }
        }
      }
    } catch (err) {
      console.debug('[debug][db.js] getTrackSource disk read failed', err);
    }
    return null;
  }
  // IndexedDB 路径
  const track = await db.trackSources.get(trackIdNum);
  if (!track) return null;
  console.debug(
    `[debug][db.js] get track from cache 👉 ${track.name} by ${track.artist}`
  );
  return track;
}

// 游戏模式下这些元数据表一律不写：它们服务的是「下次打开界面时快一点」，
// 而游戏模式压根没有界面，写进去只是白占磁盘 I/O。读取路径不受影响，
// 已有缓存照常命中。
export function cacheTrackDetail(track, privileges) {
  if (isGameMode()) return;
  db.trackDetail.put({
    id: track.id,
    detail: track,
    privileges: privileges,
    updateTime: new Date().getTime(),
  });
}

export function getTrackDetailFromCache(ids) {
  return db.trackDetail
    .filter(track => {
      return ids.includes(String(track.id));
    })
    .toArray()
    .then(tracks => {
      const result = { songs: [], privileges: [] };
      ids.map(id => {
        const one = tracks.find(t => String(t.id) === id);
        result.songs.push(one?.detail);
        result.privileges.push(one?.privileges);
      });
      if (result.songs.includes(undefined)) {
        return undefined;
      }
      return result;
    });
}

export function cacheLyric(id, lyrics) {
  if (isGameMode()) return;
  db.lyric.put({
    id,
    lyrics,
    updateTime: new Date().getTime(),
  });
}

export function getLyricFromCache(id) {
  return db.lyric.get(Number(id)).then(result => {
    if (!result) return undefined;
    return result.lyrics;
  });
}

export function cacheLyricNew(id, lyrics) {
  if (isGameMode()) return;
  db.lyricNew.put({
    id: Number(id),
    lyrics,
    updateTime: new Date().getTime(),
  });
}

export function getLyricNewFromCache(id) {
  return db.lyricNew.get(Number(id)).then(result => {
    if (!result) return undefined;
    return result.lyrics;
  });
}

// 外部歌词库「查过但没有」也要记下来，否则网易没逐字的歌每次播放都要白跑一次
// 公网请求。命中长期有效，未命中则留有效期——社区随时可能补投这首歌。
const EXTERNAL_YRC_MISS_TTL = 7 * 24 * 60 * 60 * 1000;

// 抓取或加工歌词的方式一变（比如给 QQ 源加了时间轴修正），旧记录就过时了。
// 版本号对不上直接当没缓存，重新拉一遍，省得用户还要手动清缓存
const EXTERNAL_YRC_CACHE_VERSION = 2;

/**
 * @param {number|string} id
 * @param {string|null} yrc 原始 yrc 文本，null 表示该库确认没有这首歌
 */
export function cacheExternalYrc(id, yrc) {
  if (isGameMode()) return;
  db.externalYrc.put({
    id: Number(id),
    yrc,
    version: EXTERNAL_YRC_CACHE_VERSION,
    updateTime: new Date().getTime(),
  });
}

/**
 * @returns {Promise<string|null|undefined>} 文本 / null（确认没有）/ undefined（没查过、记录过期或版本过时）
 */
export function getExternalYrcFromCache(id) {
  return db.externalYrc.get(Number(id)).then(result => {
    if (!result) return undefined;
    if (result.version !== EXTERNAL_YRC_CACHE_VERSION) return undefined;
    const expired =
      result.yrc === null &&
      new Date().getTime() - result.updateTime > EXTERNAL_YRC_MISS_TTL;
    return expired ? undefined : result.yrc;
  });
}

export function cacheAlbum(id, album) {
  if (isGameMode()) return;
  db.album.put({
    id: Number(id),
    album,
    updateTime: new Date().getTime(),
  });
}

export function getAlbumFromCache(id) {
  return db.album.get(Number(id)).then(result => {
    if (!result) return undefined;
    return result.album;
  });
}

// 缓存只是「先给眼睛一点东西看」，命中后照样发请求校正，所以 TTL 给得宽松；
// 网络慢或断网时，展示一份稍旧的歌单也远好过一片空白。
const PLAYLIST_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
// tracks 只留首屏够用的量，其余翻页时再拉，避免单条记录膨胀到几 MB
const PLAYLIST_CACHE_MAX_TRACKS = 100;
const PLAYLIST_CACHE_MAX_ENTRIES = 50;

export function cachePlaylist(id, playlist) {
  if (isGameMode()) return;
  if (!id || !playlist) return;
  db.playlist
    .put({
      id: Number(id),
      playlist: {
        ...playlist,
        tracks: (playlist.tracks || []).slice(0, PLAYLIST_CACHE_MAX_TRACKS),
        // trackIds 只用到 id，整条留下来的话上万首的歌单能占到 1MB
        trackIds: (playlist.trackIds || []).map(t => ({ id: t.id })),
      },
      updateTime: new Date().getTime(),
    })
    .then(prunePlaylistCache)
    .catch(err => console.debug('[debug][db.js] cachePlaylist failed', err));
}

export function getPlaylistFromCache(id) {
  if (!id) return Promise.resolve(undefined);
  return db.playlist
    .get(Number(id))
    .then(result => {
      if (!result) return undefined;
      const expired =
        new Date().getTime() - result.updateTime > PLAYLIST_CACHE_TTL;
      return expired ? undefined : result.playlist;
    })
    .catch(() => undefined);
}

// 浏览过的歌单会一直累积，按 updateTime 淘汰最旧的，保住最近常看的那批
async function prunePlaylistCache() {
  const count = await db.playlist.count();
  if (count <= PLAYLIST_CACHE_MAX_ENTRIES) return;
  const stale = await db.playlist
    .orderBy('updateTime')
    .limit(count - PLAYLIST_CACHE_MAX_ENTRIES)
    .primaryKeys();
  await db.playlist.bulkDelete(stale);
}

/**
 * 统计当前缓存大小与歌曲数量。
 * 自定义目录模式下扫描磁盘文件，否则回退到 IndexedDB。
 */
export async function countDBSize() {
  if (getCachePath()) {
    const cacheDir = getCachePath();
    try {
      const entries = await fs.promises.readdir(cacheDir);
      const cacheFiles = entries.filter(name => name.endsWith('.cache'));
      const sizes = await Promise.all(
        cacheFiles.map(async name => {
          try {
            const stat = await fs.promises.stat(path.join(cacheDir, name));
            return stat.isFile() ? stat.size : 0;
          } catch {
            return 0;
          }
        })
      );
      const res = {
        bytes: sizes.reduce((s1, s2) => s1 + s2, 0),
        length: cacheFiles.length,
      };
      tracksCacheBytes = res.bytes;
      console.debug(
        `[debug][db.js] load tracksCacheBytes (disk): ${tracksCacheBytes}`
      );
      return res;
    } catch (err) {
      console.debug('[debug][db.js] countDBSize disk failed', err);
      return { bytes: 0, length: 0 };
    }
  }
  const trackSizes = [];
  return db.trackSources
    .each(track => {
      trackSizes.push(track.source.byteLength);
    })
    .then(() => {
      const res = {
        bytes: trackSizes.reduce((s1, s2) => s1 + s2, 0),
        length: trackSizes.length,
      };
      tracksCacheBytes = res.bytes;
      console.debug(
        `[debug][db.js] load tracksCacheBytes: ${tracksCacheBytes}`
      );
      return res;
    });
}

/**
 * 清空缓存。
 * 自定义目录模式下删除目录下所有 .cache 文件；同时清空 IndexedDB 的其他表。
 */
export async function clearDB() {
  if (getCachePath()) {
    const cacheDir = getCachePath();
    try {
      const entries = await fs.promises.readdir(cacheDir);
      await Promise.all(
        entries
          .filter(name => name.endsWith('.cache'))
          .map(async name => {
            try {
              await fs.promises.unlink(path.join(cacheDir, name));
            } catch (err) {
              console.debug('[debug][db.js] clearDB disk unlink failed', err);
            }
          })
      );
      tracksCacheBytes = 0;
    } catch (err) {
      console.debug('[debug][db.js] clearDB disk failed', err);
    }
  }
  // 始终清空 IndexedDB 中各表（包括 trackSources 兜底及其他元数据表）
  await Promise.all(db.tables.map(table => table.clear()));
}
