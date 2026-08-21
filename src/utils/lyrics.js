export function lyricParser(lrc) {
  return {
    lyric: parseLyric(lrc?.lrc?.lyric || ''),
    tlyric: parseLyric(lrc?.tlyric?.lyric || ''),
    romalyric: parseLyric(lrc?.romalrc?.lyric || ''),
    yrc: parseYrc(lrc?.yrc?.lyric || ''),
    ytlyric: parseLyric(lrc?.ytlrc?.lyric || ''),
    yromalyric: parseLyric(lrc?.yromalrc?.lyric || ''),
    lyricuser: lrc.lyricUser,
    transuser: lrc.transUser,
  };
}

// regexr.com/6e52n
const extractLrcRegex =
  /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm;
const extractTimestampRegex =
  /\[(?<min>\d+):(?<sec>\d+)(?:\.|:)*(?<ms>\d+)*\]/g;

/**
 * @typedef {{time: number, rawTime: string, content: string}} ParsedLyric
 */

/**
 * Parse the lyric string.
 *
 * @param {string} lrc The `lrc` input.
 * @returns {ParsedLyric[]} The parsed lyric.
 * @example parseLyric("[00:00.00] Hello, World!\n[00:00.10] Test\n");
 */
export function parseLyric(lrc) {
  /**
   * A sorted list of parsed lyric and its timestamp.
   *
   * @type {ParsedLyric[]}
   * @see binarySearch
   */
  const parsedLyrics = [];

  /**
   * Find the appropriate index to push our parsed lyric.
   * @param {ParsedLyric} lyric
   */
  const binarySearch = lyric => {
    let time = lyric.time;

    let low = 0;
    let high = parsedLyrics.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midTime = parsedLyrics[mid].time;
      if (midTime === time) {
        return mid;
      } else if (midTime < time) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return low;
  };

  for (const line of lrc.trim().matchAll(extractLrcRegex)) {
    const { lyricTimestamps, content } = line.groups;

    for (const timestamp of lyricTimestamps.matchAll(extractTimestampRegex)) {
      const { min, sec, ms } = timestamp.groups;
      const validMs = ms?.slice(0, 2) ?? '00';
      const rawTime = `[${min}:${sec}.${validMs}]`;
      const time = Number(min) * 60 + Number(sec) + Number(validMs) * 0.01;

      /** @type {ParsedLyric} */
      const parsedLyric = { rawTime, time, content: trimContent(content) };
      parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric);
    }
  }

  return parsedLyrics;
}

/**
 * @param {string} content
 * @returns {string}
 */
function trimContent(content) {
  let t = content.trim();
  return t.length < 1 ? content : t;
}

// yrc 行首：[行起始ms,行时长ms]，其后是若干 (字起始ms,字时长ms,0)字
const extractYrcLineRegex = /^\[(?<start>\d+),(?<duration>\d+)\](?<body>.*)$/;
const extractYrcWordTagRegex = /\((\d+),(\d+),(-?\d+)\)/g;

/**
 * @typedef {{startMs: number, durationMs: number, text: string}} ParsedYrcWord
 * @typedef {ParsedLyric & {durationMs: number, words: ParsedYrcWord[]}} ParsedYrcLine
 */

/**
 * 把 yrc 一行的正文切成逐字片段。
 *
 * 不能按 `(` 直接切分——英文歌词的正文本身就可能带括号（如
 * `(oooh, poor boy)`），那样会把歌词截断。这里先定位所有合法的时间戳标签，
 * 再取相邻两个标签之间的原文作为该字的内容。
 *
 * @param {string} body 去掉行首 `[start,duration]` 后的剩余部分
 * @returns {ParsedYrcWord[]}
 */
function parseYrcWords(body) {
  const tags = [...body.matchAll(extractYrcWordTagRegex)];
  const words = [];

  tags.forEach((tag, index) => {
    const textStart = tag.index + tag[0].length;
    const textEnd =
      index + 1 < tags.length ? tags[index + 1].index : body.length;
    const text = body.slice(textStart, textEnd);
    // 空片段不产生可渲染的字，但只由空格组成的片段要保留，它是词间的间隔
    if (text.length === 0) return;
    words.push({
      startMs: Number(tag[1]),
      durationMs: Number(tag[2]),
      text,
    });
  });

  return words;
}

/**
 * 把毫秒格式化成 parseLyric 产出的 rawTime 形式（`[mm:ss.SS]`），
 * 好让逐字歌词能按同样的规则去匹配 ytlrc / yromalrc。
 *
 * @param {number} ms
 * @returns {string}
 */
function formatRawTime(ms) {
  const min = String(Math.floor(ms / 60000)).padStart(2, '0');
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  // parseLyric 是截断而非四舍五入地取前两位毫秒，此处保持一致
  const centi = String(ms % 1000)
    .padStart(3, '0')
    .slice(0, 2);
  return `[${min}:${sec}.${centi}]`;
}

/**
 * 解析逐字歌词。
 *
 * 开头形如 `{"t":0,"c":[{"tx":"作词: "}]}` 的行是作词/作曲等元信息，
 * 不参与逐字高亮，直接跳过。
 *
 * @param {string} yrc
 * @returns {ParsedYrcLine[]}
 * @example parseYrc("[180,3180](180,450,0)Is (630,360,0)this");
 */
export function parseYrc(yrc) {
  const lines = [];

  for (const rawLine of yrc.trim().split('\n')) {
    const matched = extractYrcLineRegex.exec(rawLine.trim());
    if (!matched) continue;

    const words = parseYrcWords(matched.groups.body);
    if (words.length === 0) continue;

    const startMs = Number(matched.groups.start);
    lines.push({
      time: startMs / 1000,
      rawTime: formatRawTime(startMs),
      durationMs: Number(matched.groups.duration),
      content: trimContent(words.map(w => w.text).join('')),
      words,
    });
  }

  return lines;
}

/**
 * 在译文（或罗马音）中找出与某行歌词对应的一行。
 *
 * 常规 lrc 与其译文共用同一套时间戳，按 rawTime 精确匹配即可。但 yrc 的行首
 * 时间是另行标注的，与 lrc 存在几十到几百毫秒的偏差（实测可达 330ms），
 * 精确匹配会全部落空，因此允许调用方给一个就近匹配的容差。
 *
 * @param {ParsedLyric[]} list 译文或罗马音
 * @param {ParsedLyric} line 主歌词的一行
 * @param {number} [tolerance=0] 就近匹配的最大时间差（秒），0 表示只做精确匹配
 * @returns {ParsedLyric | undefined}
 */
export function findCounterpartLyric(list, line, tolerance = 0) {
  const exact = list.find(({ rawTime }) => rawTime === line.rawTime);
  if (exact || tolerance <= 0) return exact;

  let nearest;
  let nearestDelta = Infinity;
  for (const candidate of list) {
    const delta = Math.abs(candidate.time - line.time);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearest = candidate;
    }
  }

  return nearestDelta <= tolerance ? nearest : undefined;
}

/**
 * @param {string} lyric
 */
export async function copyLyric(lyric) {
  const textToCopy = lyric;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
      alert('复制失败，请手动复制！');
    }
  } else {
    const tempInput = document.createElement('textarea');
    tempInput.value = textToCopy;
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      alert('复制失败，请手动复制！');
    }
    document.body.removeChild(tempInput);
  }
}
