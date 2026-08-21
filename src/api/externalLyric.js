import axios from 'axios';
import { cacheExternalYrc, getExternalYrcFromCache } from '@/utils/db';

// AMLL TTML DataBase（CC0-1.0，https://github.com/amll-dev/amll-ttml-db）
// 是社区投稿的逐词歌词库，按网易云音乐 ID 直接提供 .yrc 文件，格式与网易
// /lyric/new 里的 yrc 字段完全一致，因此可以原样交给 parseYrc。
// 网易本身对大量歌曲不提供逐字歌词（yrc 为空），这里作为兜底来源。
//
// jsDelivr 排在前面：raw.githubusercontent.com 在国内常被墙，而 jsDelivr 有
// 国内可直连的节点；raw 兜底则覆盖 jsDelivr 的分支缓存滞后和偶发限流。
const YRC_SOURCES = [
  id =>
    `https://cdn.jsdelivr.net/gh/amll-dev/amll-ttml-db@main/ncm-lyrics/${id}.yrc`,
  id =>
    `https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/ncm-lyrics/${id}.yrc`,
];

// 兜底歌词是锦上添花，不该让用户为它久等；两个源串行最多也就等两轮
const REQUEST_TIMEOUT = 8000;

// QQ 音乐这一级由 Electron 主进程代劳（QRC 要解密，且 QQ 不给 CORS 头），
// 这里直接打主进程的 Express 桥。地址与 request.js 里一样硬编码，理由见那边注释
const QQ_LYRIC_URL = 'http://127.0.0.1:27232/qq-lyric';

/**
 * 走主进程去 QQ 音乐取逐字歌词。
 *
 * @returns {Promise<{yrc: string, confirmedMissing: boolean}>}
 */
async function getQqYrc({ name, artists, durationMs }) {
  if (!process.env.IS_ELECTRON || !name || !durationMs) {
    return { yrc: '', confirmedMissing: false };
  }
  try {
    const { data } = await axios.get(QQ_LYRIC_URL, {
      params: { name, artist: artists.join(','), duration: durationMs },
      timeout: REQUEST_TIMEOUT * 2, // 搜索 + 拉取两次往返，给足时间
      transformResponse: [text => text],
    });
    return {
      yrc: typeof data === 'string' ? data : '',
      confirmedMissing: false,
    };
  } catch (error) {
    return {
      yrc: '',
      confirmedMissing: error?.response?.status === 404,
    };
  }
}

/**
 * 取外部歌词库里的逐字歌词，依次尝试 AMLL 社区库和 QQ 音乐。
 *
 * @param {{id: number|string, name?: string, artists?: string[], durationMs?: number}} track
 * @returns {Promise<string|null>} 原始 yrc 文本，没有则为 null
 */
export async function getExternalYrc(track) {
  const { id } = track;
  const cached = await getExternalYrcFromCache(id);
  if (cached !== undefined) return cached;

  // 404 才说明这首歌确实没有；超时、断网、被墙只代表这次没拿到，
  // 记成「没有」会让用户在网络恢复后的整个缓存有效期内都看不到逐字歌词
  let confirmedMissing = false;

  for (const buildUrl of YRC_SOURCES) {
    try {
      const { data } = await axios.get(buildUrl(id), {
        timeout: REQUEST_TIMEOUT,
        // yrc 以 `[` 开头，不拦住 axios 的话它会当成 JSON 去解析
        transformResponse: [text => text],
      });
      const yrc = typeof data === 'string' ? data.trim() : '';
      if (yrc.length === 0) continue;
      cacheExternalYrc(id, yrc);
      return yrc;
    } catch (error) {
      if (error?.response?.status === 404) confirmedMissing = true;
    }
  }

  const qq = await getQqYrc(track);
  if (qq.yrc.length > 0) {
    cacheExternalYrc(id, qq.yrc);
    return qq.yrc;
  }

  // 两级都明确说没有，才敢记下来
  if (confirmedMissing && qq.confirmedMissing) cacheExternalYrc(id, null);
  return null;
}
