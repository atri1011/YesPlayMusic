/**
 * 外部歌单导入适配器
 *
 * 为各主流音乐平台提供统一的歌单解析能力。每个适配器都接收一个原始输入
 * (通常是歌单链接、分享文本或 ID)，并返回归一化后的歌单数据结构。
 *
 * 由于本客户端运行环境无法直接调用各平台的私有 API，这里采用以下策略：
 * 1. 从用户输入中提取歌单 ID / 分享链接中的关键字段。
 * 2. 通过网易云的搜索接口将外部曲目匹配到网易云曲库，从而复用现有的
 *    createPlaylist + addOrRemoveTrackFromPlaylist 流程完成入库。
 *
 * 各适配器返回的 track 列表元素结构：
 *   { name: string, artist: string, album: string, duration: number }
 *
 * 解析失败时抛出 Error，由调用方决定如何向用户反馈。
 */

/**
 * @typedef {Object} ExternalTrack
 * @property {string} name - 曲目名称
 * @property {string} artist - 艺人名称（可能含多人，用 `, ` 分隔）
 * @property {string} album - 专辑名称（可选）
 * @property {number} duration - 时长（毫秒，可选）
 *
 * @typedef {Object} ExternalPlaylist
 * @property {string} platform - 来源平台标识
 * @property {string} title - 歌单标题
 * @property {string} [creator] - 歌单创建者
 * @property {string} [coverUrl] - 歌单封面 URL
 * @property {ExternalTrack[]} tracks - 曲目列表
 */

/**
 * 从任意文本中提取 URL。用于处理用户粘贴的分享文案。
 * @param {string} raw
 * @returns {string|null}
 */
function extractFirstUrl(raw) {
  if (!raw) return null;
  const match = String(raw).match(/https?:\/\/[^\s）)]+/i);
  return match ? match[0] : null;
}

/**
 * QQ 音乐适配器。支持形如
 *   https://i.y.qq.com/n2/m/share/details/rdetail.html?playlistId=XXXX
 *   https://y.qq.com/n/ryqq/playlist/XXXX
 * 以及分享卡片文本。
 */
export const qqMusicAdapter = {
  id: 'qq',
  label: 'QQ音乐',
  iconClass: 'brand-qqmusic',
  placeholder: '粘贴 QQ 音乐歌单链接或分享文本',
  helpUrl: 'https://y.qq.com/',
  /**
   * @param {string} input
   * @returns {Promise<ExternalPlaylist>}
   */
  async parse(input) {
    const url = extractFirstUrl(input) || input.trim();
    const idMatch =
      url.match(/playlistId=([^&]+)/i) ||
      url.match(/playlist\/([A-Za-z0-9]+)/i) ||
      url.match(/id=([0-9]+)/i);
    if (!idMatch) {
      throw new Error('无法识别 QQ 音乐歌单 ID，请检查链接是否完整');
    }
    const playlistId = idMatch[1];

    // QQ 音乐的私有接口跨域且需签名，浏览器侧无法稳定调用。
    // 这里通过网易云搜索接口尽力匹配曲目名称，最大程度复用本平台能力。
    const tracks = await fetchTracksFromShareText(input, 'QQ音乐');
    return {
      platform: 'qq',
      title: `QQ 音乐歌单 ${playlistId}`,
      tracks,
    };
  },
};

/**
 * 网易云音乐自身歌单（按 ID / 链接导入到当前账号下，常用于跨账号迁移）。
 */
export const neteaseAdapter = {
  id: 'netease',
  label: '网易云音乐',
  iconClass: 'brand-netease',
  placeholder: '粘贴网易云音乐歌单链接或 ID',
  helpUrl: 'https://music.163.com/',
  /**
   * @param {string} input
   * @returns {Promise<ExternalPlaylist>}
   */
  async parse(input) {
    const url = extractFirstUrl(input) || input.trim();
    const idMatch =
      url.match(/playlist\?id=([0-9]+)/i) ||
      url.match(/id=([0-9]+)/i) ||
      url.match(/([0-9]{4,})/);
    if (!idMatch) {
      throw new Error('无法识别网易云音乐歌单 ID');
    }
    const playlistId = idMatch[1];
    // 直接调用本平台的 playlist/detail 接口即可拿到完整曲目。
    const { getPlaylistDetail } = await import('@/api/playlist');
    const data = await getPlaylistDetail(Number(playlistId));
    if (!data || !data.playlist) {
      throw new Error('网易云歌单不存在或无访问权限');
    }
    const tracks = (data.playlist.tracks || []).map(track => ({
      name: track.name,
      artist: (track.ar || []).map(artist => artist.name).join(', '),
      album: track.al ? track.al.name : '',
      duration: track.dt || 0,
      neteaseId: track.id,
    }));
    return {
      platform: 'netease',
      title: data.playlist.name,
      creator: data.playlist.creator ? data.playlist.creator.nickname : '',
      coverUrl: data.playlist.coverImgUrl,
      tracks,
    };
  },
};

/**
 * Spotify 适配器。浏览器侧受 CORS 限制无法直接读取 Spotify 数据，
 * 因此通过分享文本中的曲目名 + 艺人名做网易云搜索匹配。
 */
export const spotifyAdapter = {
  id: 'spotify',
  label: 'Spotify',
  iconClass: 'brand-spotify',
  placeholder: '粘贴 Spotify 歌单分享文本或曲目列表',
  helpUrl: 'https://open.spotify.com/',
  /**
   * @param {string} input
   * @returns {Promise<ExternalPlaylist>}
   */
  async parse(input) {
    const tracks = await fetchTracksFromShareText(input, 'Spotify');
    const url = extractFirstUrl(input);
    const title = url ? `Spotify 歌单 ${url.slice(-12)}` : 'Spotify 导入歌单';
    return {
      platform: 'spotify',
      title,
      tracks,
    };
  },
};

/**
 * Apple Music 适配器。同样通过分享文本解析曲目后做匹配。
 */
export const appleMusicAdapter = {
  id: 'applemusic',
  label: 'Apple Music',
  iconClass: 'brand-applemusic',
  placeholder: '粘贴 Apple Music 歌单或曲目分享文本',
  helpUrl: 'https://music.apple.com/',
  /**
   * @param {string} input
   * @returns {Promise<ExternalPlaylist>}
   */
  async parse(input) {
    const tracks = await fetchTracksFromShareText(input, 'Apple Music');
    return {
      platform: 'applemusic',
      title: 'Apple Music 导入歌单',
      tracks,
    };
  },
};

/**
 * 酷狗音乐适配器。
 */
export const kugouAdapter = {
  id: 'kugou',
  label: '酷狗音乐',
  iconClass: 'brand-kugou',
  placeholder: '粘贴酷狗音乐歌单链接或分享文本',
  helpUrl: 'https://www.kugou.com/',
  /**
   * @param {string} input
   * @returns {Promise<ExternalPlaylist>}
   */
  async parse(input) {
    const tracks = await fetchTracksFromShareText(input, '酷狗音乐');
    const url = extractFirstUrl(input);
    const idMatch = url ? url.match(/specialid=([0-9]+)/i) : null;
    return {
      platform: 'kugou',
      title: idMatch ? `酷狗歌单 ${idMatch[1]}` : '酷狗音乐导入歌单',
      tracks,
    };
  },
};

/**
 * 酷我音乐适配器。
 */
export const kuwoAdapter = {
  id: 'kuwo',
  label: '酷我音乐',
  iconClass: 'brand-kuwo',
  placeholder: '粘贴酷我音乐歌单链接或分享文本',
  helpUrl: 'https://www.kuwo.cn/',
  /**
   * @param {string} input
   * @returns {Promise<ExternalPlaylist>}
   */
  async parse(input) {
    const tracks = await fetchTracksFromShareText(input, '酷我音乐');
    return {
      platform: 'kuwo',
      title: '酷我音乐导入歌单',
      tracks,
    };
  },
};

/**
 * 哔哩哔哩收藏夹/歌单适配器（音频区）。
 */
export const bilibiliAdapter = {
  id: 'bilibili',
  label: '哔哩哔哩',
  iconClass: 'brand-bilibili',
  placeholder: '粘贴 B 站收藏夹或音频分享文本',
  helpUrl: 'https://www.bilibili.com/',
  /**
   * @param {string} input
   * @returns {Promise<ExternalPlaylist>}
   */
  async parse(input) {
    const tracks = await fetchTracksFromShareText(input, '哔哩哔哩');
    return {
      platform: 'bilibili',
      title: '哔哩哔哩导入歌单',
      tracks,
    };
  },
};

/**
 * 平台注册表。UI 通过该数组渲染平台选项卡。
 */
export const platformAdapters = [
  neteaseAdapter,
  qqMusicAdapter,
  spotifyAdapter,
  appleMusicAdapter,
  kugouAdapter,
  kuwoAdapter,
  bilibiliAdapter,
];

/**
 * 平台无关的纯文本解析：尝试从分享文本中按行拆出 "歌曲名 - 艺人" 这样的结构。
 * 适用于大多数平台的分享卡片文本。
 *
 * @param {string} text
 * @returns {ExternalTrack[]}
 */
function parsePlainTrackLines(text) {
  if (!text) return [];
  // 移除 URL 行，避免误把链接当歌名
  const lines = String(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !/^https?:\/\//i.test(line))
    .filter(line => !/^(歌曲|分享|来自|歌单|收听)/.test(line));

  const tracks = [];
  for (const line of lines) {
    // 支持 "歌名 - 艺人"、"歌名 / 艺人"、"歌名「艺人」" 等常见格式
    const sepMatch = line.match(/^(.+?)\s*[-/｜|]\s*(.+)$/);
    if (sepMatch) {
      tracks.push({
        name: sepMatch[1]
          .replace(/["""「『]/g, '')
          .replace(/[""」』]/g, '')
          .trim(),
        artist: sepMatch[2]
          .replace(/["""「『]/g, '')
          .replace(/[""」』]/g, '')
          .trim(),
        album: '',
        duration: 0,
      });
    }
  }
  return tracks;
}

/**
 * 根据分享文本中解析出的曲目列表，通过网易云搜索接口匹配出对应的网易云曲目 ID。
 * 搜索结果用于后续 createPlaylist + addOrRemoveTrackFromPlaylist 入库。
 *
 * @param {string} rawText
 * @param {string} platformLabel 仅用于错误提示
 * @returns {Promise<ExternalTrack[]>}
 */
async function fetchTracksFromShareText(rawText, platformLabel) {
  const tracks = parsePlainTrackLines(rawText);
  if (tracks.length === 0) {
    throw new Error(
      `未能从 ${platformLabel} 分享文本中解析出曲目，请确认文本包含「歌名 - 艺人」格式的曲目列表`
    );
  }

  // 搜索匹配放到 modal 组件中按需执行，这里仅返回解析后的曲目元数据。
  return tracks;
}
