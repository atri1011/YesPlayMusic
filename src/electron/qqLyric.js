import axios from 'axios';
import zlib from 'zlib';
import { des, DesType } from './qrcDes';

/**
 * QQ 音乐逐字歌词（QRC）。
 *
 * 网易对大量歌曲不提供 yrc，QQ 音乐的覆盖面要大得多，这里作为最后一级兜底。
 * 放在主进程有三个原因：QRC 解密要用 Node 的 zlib 和 Buffer；`u.y.qq.com`
 * 不返回任何 CORS 头，渲染进程直连要靠 `webSecurity: false` 这种全局开关；
 * 以及那份定制 DES 有 300 行，没必要塞进渲染进程的包体。
 */

// 歌词密码。三把 16 字节的 key，实际只用前 8 字节参与 DES 密钥编排
const QRC_KEY1 = Buffer.from('!@#)(NHLiuy*$%^&');
const QRC_KEY2 = Buffer.from('123ZXC!@#)(*$%^&');
const QRC_KEY3 = Buffer.from('!@#)(*$%^&abcDEF');

// 新版 QRC 的字节混淆表，密文以 0x98 0x25 开头时需要先还原成旧版
// prettier-ignore
const VERSION_CONVERT_CODE = [
  0x77, 0x48, 0x32, 0x73, 0xDE, 0xF2, 0xC0, 0xC8, 0x95, 0xEC, 0x30, 0xB2, 0x51, 0xC3, 0xE1, 0xA0,
  0x9E, 0xE6, 0x9D, 0xCF, 0xFA, 0x7F, 0x14, 0xD1, 0xCE, 0xB8, 0xDC, 0xC3, 0x4A, 0x67, 0x93, 0xD6,
  0x28, 0xC2, 0x91, 0x70, 0xCA, 0x8D, 0xA2, 0xA4, 0xF0, 0x08, 0x61, 0x90, 0x7E, 0x6F, 0xA2, 0xE0,
  0xEB, 0xAE, 0x3E, 0xB6, 0x67, 0xC7, 0x92, 0xF4, 0x91, 0xB5, 0xF6, 0x6C, 0x5E, 0x84, 0x40, 0xF7,
  0xF3, 0x1B, 0x02, 0x7F, 0xD5, 0xAB, 0x41, 0x89, 0x28, 0xF4, 0x25, 0xCC, 0x52, 0x11, 0xAD, 0x43,
  0x68, 0xA6, 0x41, 0x8B, 0x84, 0xB5, 0xFF, 0x2C, 0x92, 0x4A, 0x26, 0xD8, 0x47, 0x6A, 0x7C, 0x95,
  0x61, 0xCC, 0xE6, 0xCB, 0xBB, 0x3F, 0x47, 0x58, 0x89, 0x75, 0xC3, 0x75, 0xA1, 0xD9, 0xAF, 0xCC,
  0x08, 0x73, 0x17, 0xDC, 0xAA, 0x9A, 0xA2, 0x16, 0x41, 0xD8, 0xA2, 0x06, 0xC6, 0x8B, 0xFC, 0x66,
  0x34, 0x9F, 0xCF, 0x18, 0x23, 0xA0, 0x0A, 0x74, 0xE7, 0x2B, 0x27, 0x70, 0x92, 0xE9, 0xAF, 0x37,
  0xE6, 0x8C, 0xA7, 0xBC, 0x62, 0x65, 0x9C, 0xC2, 0x08, 0xC9, 0x88, 0xB3, 0xF3, 0x43, 0xAC, 0x74,
  0x2C, 0x0F, 0xD4, 0xAF, 0xA1, 0xC3, 0x01, 0x64, 0x95, 0x4E, 0x48, 0x9F, 0xF4, 0x35, 0x78, 0x95,
  0x7A, 0x39, 0xD6, 0x6A, 0xA0, 0x6D, 0x40, 0xE8, 0x4F, 0xA8, 0xEF, 0x11, 0x1D, 0xF3, 0x1B, 0x3F,
  0x3F, 0x07, 0xDD, 0x6F, 0x5B, 0x19, 0x30, 0x19, 0xFB, 0xEF, 0x0E, 0x37, 0xF0, 0x0E, 0xCD, 0x16,
  0x49, 0xFE, 0x53, 0x47, 0x13, 0x1A, 0xBD, 0xA4, 0xF1, 0x40, 0x19, 0x60, 0x0E, 0xED, 0x68, 0x09,
  0x06, 0x5F, 0x4D, 0xCF, 0x3D, 0x1A, 0xFE, 0x20, 0x77, 0xE4, 0xD9, 0xDA, 0xF9, 0xA4, 0x2B, 0x76,
  0x1C, 0x71, 0xDB, 0x00, 0xBC, 0xFD, 0x0C, 0x6C, 0xA5, 0x47, 0xF7, 0xF6, 0x00, 0x79, 0x4A, 0x11,
];

const OFFSET_TAG = Buffer.from('[offset:');

const QQ_HEADERS = {
  Referer: 'https://y.qq.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

const REQUEST_TIMEOUT = 8000;

// 时长差超过这个值就不认为是同一版本。实测网易与 QQ 对同一母带的时长标注能差
// 到 2 秒，而《旅行的意义》最近的另一个版本差 4.6 秒，3 秒刚好把两者分开
const DURATION_TOLERANCE_MS = 3000;

/** 归一化后比较歌名/歌手，避免大小写、空格、标点造成的假不匹配 */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

function convertNewQrc(content) {
  const result = Buffer.alloc(content.byteLength);
  for (let i = 0; i < content.byteLength; ++i) {
    result[i] = content[i] ^ VERSION_CONVERT_CODE[(i * i + 0x013c1b) % 256];
  }
  return result;
}

/** DES 按 8 字节分组处理，末尾补零对齐 */
function padBuffer(buffer, offset) {
  let len = buffer.byteLength - offset;
  const mod = len % 8;
  if (mod) len += 8 - mod;
  const result = Buffer.alloc(len, 0);
  buffer.copy(result, 0, offset, buffer.length);
  return result;
}

/**
 * 解密 QRC，得到歌词 XML。
 *
 * @param {Buffer} raw
 * @returns {string|null} 解密失败返回 null
 */
export function decryptQrc(raw) {
  try {
    let buffer = raw;
    if (buffer[0] === 0x98 && buffer[1] === 0x25)
      buffer = convertNewQrc(buffer);

    // 以 [offset: 开头的是本地 .qrc 文件，密文从第 11 字节才开始
    const isLocalFile = !buffer.compare(
      OFFSET_TAG,
      0,
      OFFSET_TAG.length,
      0,
      OFFSET_TAG.length
    );
    const content = padBuffer(buffer, isLocalFile ? 0x0b : 0);

    des(content, QRC_KEY1, DesType.Decode);
    des(content, QRC_KEY2, DesType.Encode);
    des(content, QRC_KEY3, DesType.Decode);

    // 本地文件是裸 deflate，网络下发的带 gzip/zlib 头，unzipSync 两者都吃
    const result = isLocalFile
      ? zlib.inflateSync(content)
      : zlib.unzipSync(content);
    return result.toString();
  } catch (error) {
    return null;
  }
}

function unescapeXml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

// QQ 的时间轴整体比网易音频晚一点，逐字扫过时看得出来。
//
// 实测两组数据：网易自己也有 yrc 的歌（两家多半同一母带），QQ 相对网易 yrc
// 只差 +0.031s；而网易没有 yrc 的歌（老歌居多，网易常用另一版母带），拿 AMLL
// 的手工逐字当真值，22 首的中位偏差是 +0.157s，且分布很集中（20 首落在
// -0.02 ~ +0.33）。会用到 QQ 的正是后一种场景，所以整体提前这个量。
//
// 没有改成「按网易 lrc 逐首对齐」：lrc 相对 yrc 自身就有 -0.58 ~ +0.78s 的
// 噪声，比这里要修正的偏差大得多，拿它当基准反而更糟。
const QQ_TIMING_OFFSET_MS = 157;

/** 时间戳整体提前，负数没有意义，夹到 0 */
function shift(ms) {
  return Math.max(0, Number(ms) - QQ_TIMING_OFFSET_MS);
}

// 行首 [起始ms,时长ms]，其后是若干 字(起始ms,时长ms)——时间戳跟在字**后面**，
// 与网易 yrc 的前置写法正好相反
const QRC_LINE_REGEX = /^\[(\d+),(\d+)\](.*)$/;
const QRC_WORD_TAG_REGEX = /\((\d+),(\d+)\)/g;

// QQ 把「词：xxx」「编曲：xxx」这类署名也写成带时间戳的正式歌词行，而网易的
// yrc 是把它们放在 JSON 元数据里、解析时就跳过了。不清掉的话开头会有几行署名
// 跟着逐字扫过去，和网易源的歌显示得不一样
const CREDIT_LINE_REGEX = /^[^\s：:]{1,10}[：:]/;

/**
 * 去掉开头连续的署名行。
 *
 * 只从头部开始扫、遇到第一行正文就停：署名一定在最前面，而正文里出现冒号
 * （「他说：」）并不罕见，从中间也删就会吃掉真歌词。
 */
function stripCreditLines(lines) {
  let start = 0;
  while (start < lines.length) {
    const text = lines[start].text;
    const isTitle = start === 0 && /\s-\s/.test(text);
    if (!isTitle && !CREDIT_LINE_REGEX.test(text)) break;
    start += 1;
  }
  return lines.slice(start);
}

/**
 * 把 QRC 的 XML 转成网易 yrc 的文本格式。
 *
 * 转成 yrc 而不是直接吐结构，是为了让渲染进程继续走同一条
 * `原始 yrc 文本 → parseYrc` 的路，缓存与解析都不用为 QQ 再开一套。
 *
 * @param {string} xml
 * @returns {string} 失败或没有逐字内容时返回空串
 */
export function qrcToYrc(xml) {
  const matched = /LyricContent="([\s\S]*?)"\s*\/?>/.exec(xml);
  if (!matched) return '';

  const lines = [];
  for (const rawLine of unescapeXml(matched[1]).split('\n')) {
    const line = QRC_LINE_REGEX.exec(rawLine.trim());
    if (!line) continue;

    const body = line[3];
    // 不能按 `(` 切分：歌词正文里本来就可能有括号（如 `(Cheer Chen)`）。
    // 先定位所有时间戳，字的内容取相邻两个时间戳之间的原文
    const tags = [...body.matchAll(QRC_WORD_TAG_REGEX)];
    if (tags.length === 0) continue;

    let cursor = 0;
    const words = [];
    let text = '';
    for (const tag of tags) {
      const word = body.slice(cursor, tag.index);
      cursor = tag.index + tag[0].length;
      if (word.length === 0) continue;
      words.push(`(${shift(tag[1])},${tag[2]},0)${word}`);
      text += word;
    }
    if (words.length === 0) continue;

    lines.push({
      text,
      yrc: `[${shift(line[1])},${line[2]}]${words.join('')}`,
    });
  }

  return stripCreditLines(lines)
    .map(line => line.yrc)
    .join('\n');
}

/**
 * 在 QQ 音乐搜歌，挑出与网易这首歌同一个录音的那条。
 *
 * 歌名相近、歌手有交集、时长接近三条同时满足才算数——只靠歌名会匹配到翻唱，
 * 只靠时长会匹配到同专辑的别的歌。
 *
 * @returns {Promise<{songmid: string, songid: number, interval: number}|null>}
 */
async function searchSong({ name, artists, durationMs }) {
  const keywords = `${name} ${artists.join(' ')}`.trim();
  const { data } = await axios.get(
    'https://c.y.qq.com/soso/fcgi-bin/client_search_cp',
    {
      params: { w: keywords, format: 'json', p: 1, n: 10 },
      headers: QQ_HEADERS,
      timeout: REQUEST_TIMEOUT,
    }
  );

  const candidates = data?.data?.song?.list || [];
  const wantedName = normalize(name);
  const wantedArtists = artists.map(normalize).filter(Boolean);

  return candidates
    .map(song => {
      const songName = normalize(song.songname);
      const singers = (song.singer || []).map(s => normalize(s.name));
      const nameHit =
        songName.startsWith(wantedName) || wantedName.startsWith(songName);
      const artistHit =
        wantedArtists.length === 0 ||
        wantedArtists.some(a =>
          singers.some(s => s.includes(a) || a.includes(s))
        );
      const delta = Math.abs(song.interval * 1000 - durationMs);
      return {
        song,
        ok: nameHit && artistHit && delta <= DURATION_TOLERANCE_MS,
        delta,
      };
    })
    .filter(item => item.ok)
    .sort((a, b) => a.delta - b.delta)
    .map(item => ({
      songmid: item.song.songmid,
      songid: item.song.songid,
      interval: item.song.interval,
    }))[0];
}

/** 拉取密文歌词，没有逐字版本时返回空 */
async function fetchQrc({ songmid, songid, interval }) {
  const payload = {
    comm: { ct: '19', cv: '1859', uin: '0' },
    req: {
      module: 'music.musichallSong.PlayLyricInfo',
      method: 'GetPlayLyricInfo',
      param: {
        songMID: songmid,
        songID: songid,
        format: 'json',
        crypt: 1,
        lrc_t: 0,
        interval,
        qrc: 1,
        qrc_t: 0,
        roma: 0,
        roma_t: 0,
        trans: 0,
        trans_t: 0,
      },
    },
  };

  const { data } = await axios.post(
    'https://u.y.qq.com/cgi-bin/musicu.fcg',
    payload,
    { headers: QQ_HEADERS, timeout: REQUEST_TIMEOUT }
  );

  const result = data?.req?.data;
  // qrc=0 表示这首歌只有逐行歌词，对我们没用
  if (!result || result.qrc !== 1 || !result.lyric) return '';
  return result.lyric;
}

/**
 * 取 QQ 音乐的逐字歌词，转成网易 yrc 文本格式。
 *
 * 输出的时间戳已按 QQ_TIMING_OFFSET_MS 整体提前，理由见该常量处的注释。
 *
 * @param {{name: string, artists: string[], durationMs: number}} track
 * @returns {Promise<string>} 找不到时返回空串
 */
export async function getQqYrc(track) {
  const matched = await searchSong(track);
  if (!matched) return '';

  const hex = await fetchQrc(matched);
  if (!hex) return '';

  const xml = decryptQrc(Buffer.from(hex, 'hex'));
  if (!xml) return '';

  return qrcToYrc(xml);
}
