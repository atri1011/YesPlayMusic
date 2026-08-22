import Vue from 'vue';
import store from '@/store';
import { getLyricNew, getCloudLyric } from '@/api/track';
import { getExternalYrc } from '@/api/externalLyric';
import {
  findCounterpartLyric,
  lyricParser,
  parseLyric,
  parseYrc,
} from '@/utils/lyrics';
import { isGameMode } from '@/utils/gameMode';

/**
 * 歌词的唯一数据源。
 *
 * 歌词原本长在 views/lyrics.vue 里，跟着组件一起生灭。桌面歌词是第二个消费者，
 * 而它在游戏模式下还得工作——那时整棵界面树都被 GameMode 换掉了，歌词页根本
 * 不存在。所以取词、解析、配对、行定位统统搬到这里，视图只负责画。
 */

// yrc 的行首时间与 lrc 不同源（实测偏差可达 330ms），退回 lrc 系译文时
// 允许的最大就近匹配误差（秒）
const YRC_MATCH_TOLERANCE = 0.6;
// 行定位的轮询间隔（毫秒）
const TICK_INTERVAL = 50;
// 正常播放时每跳只前进 TICK_INTERVAL，跳变超过这个值说明用户拖了进度条
const SEEK_THRESHOLD_MS = 300;

export const lyricState = Vue.observable({
  trackId: 0,
  lyric: [],
  tlyric: [],
  romalyric: [],
  yrc: [],
  ytlyric: [],
  yromalyric: [],
  lyricType: 'translation', // or 'romaPronunciation'
  highlightIndex: -1,
  // 当前高亮行被点亮时的播放进度（毫秒），逐字动画以它为基准算延迟
  highlightLineStartMs: 0,
});

/**
 * 派生值挂在一个隐藏的 Vue 实例上而不是导出成普通函数：lyricToShow 每次都要
 * 遍历全曲歌词做译文配对，而行定位每 50ms 就要读一次，只有 computed 的缓存
 * 扛得住。视图侧在自己的 computed 里读这些属性，响应式照常穿透。
 */
export const lyricGetters = new Vue({
  data: { s: lyricState },
  computed: {
    useWordByWord() {
      // 设置项缺省（老版本 localStorage）时按开启处理
      return (
        store.state.settings.showLyricsWordByWord !== false &&
        this.s.yrc.length > 0
      );
    },
    activeLyric() {
      return this.useWordByWord ? this.s.yrc : this.s.lyric;
    },
    activeTlyric() {
      if (!this.useWordByWord) return this.s.tlyric;
      return this.s.ytlyric.length > 0 ? this.s.ytlyric : this.s.tlyric;
    },
    activeRomalyric() {
      if (!this.useWordByWord) return this.s.romalyric;
      return this.s.yromalyric.length > 0
        ? this.s.yromalyric
        : this.s.romalyric;
    },
    lyricWithTranslation() {
      return this.pairLyricWith(this.activeTlyric, this.s.ytlyric.length === 0);
    },
    lyricWithRomaPronunciation() {
      return this.pairLyricWith(
        this.activeRomalyric,
        this.s.yromalyric.length === 0
      );
    },
    lyricToShow() {
      return this.s.lyricType === 'translation'
        ? this.lyricWithTranslation
        : this.lyricWithRomaPronunciation;
    },
    /**
     * 下发给桌面歌词窗口的整份状态。
     *
     * 做成 computed 是刻意的：它的依赖恰好是「当前行 / 行内基准 / 播放状态 /
     * 当前歌曲」，所以它重算的时机就是该推 IPC 的时机，桥接层一个 $watch 就够，
     * 不需要额外的发布订阅。
     */
    desktopLyricPayload() {
      const player = store.state.player;
      const track = player?.currentTrack ?? {};
      const lines = this.lyricToShow;
      const index = this.s.highlightIndex;
      const line = lines[index];
      const next = lines[index + 1];
      return {
        trackId: track.id ?? 0,
        trackName: track.name ?? '',
        artistName: (track.ar ?? [])
          .map(a => a.name)
          .filter(Boolean)
          .join(', '),
        playing: player?.playing === true,
        lineStartMs: this.s.highlightLineStartMs,
        content: line?.content ?? '',
        translation: line?.contents?.[1] ?? '',
        words: line?.words ?? null,
        nextContent: next?.content ?? '',
      };
    },
  },
  methods: {
    /**
     * 把主歌词与译文（或罗马音）按时间配对成可渲染的行。
     * @param {Array} counterparts 译文或罗马音
     * @param {boolean} isLrcSourced 该译文来自 lrc 而非 yrc，需要就近匹配
     */
    pairLyricWith(counterparts, isLrcSourced) {
      const tolerance =
        this.useWordByWord && isLrcSourced ? YRC_MATCH_TOLERANCE : 0;
      return this.activeLyric
        .filter(({ content }) => Boolean(content))
        .map(line => {
          const contents = [line.content];
          const counterpart = findCounterpartLyric(
            counterparts,
            line,
            tolerance
          );
          if (counterpart) contents.push(counterpart.content);
          return {
            time: line.time,
            content: line.content,
            contents,
            words: line.words,
          };
        });
    },
  },
});

export function switchLyricType() {
  lyricState.lyricType =
    lyricState.lyricType === 'translation'
      ? 'romaPronunciation'
      : 'translation';
}

function clearLyrics() {
  lyricState.lyric = [];
  lyricState.tlyric = [];
  lyricState.romalyric = [];
  lyricState.yrc = [];
  lyricState.ytlyric = [];
  lyricState.yromalyric = [];
}

/**
 * 网易没有逐字歌词时，去社区歌词库补一次。
 *
 * 不 await：这一步要走公网，让它挡在主歌词渲染前面不值得，拉到了再回填。
 * 回填前必须确认还在放同一首歌——切歌比请求快时，回填会把上一首的逐字
 * 歌词盖到当前歌上。
 *
 * @param {Object} track 发起请求时正在播放的歌曲
 */
async function fillYrcFromExternalDB(track) {
  const settings = store.state.settings;
  if (settings.showLyricsWordByWord === false) return;
  if (settings.enableExternalYrcDB === false) return;

  const raw = await getExternalYrc({
    id: track.id,
    name: track.name,
    artists: (track.ar || []).map(a => a.name).filter(Boolean),
    durationMs: track.dt,
  });
  if (!raw || store.state.player?.currentTrack?.id !== track.id) return;

  const parsed = parseYrc(raw);
  if (parsed.length > 0) lyricState.yrc = parsed;
}

/**
 * 拉取当前歌曲的歌词。切歌时由 watcher 调用，也可以由视图在需要时补一次。
 */
export function fetchLyric() {
  const track = store.state.player?.currentTrack;
  if (!track?.id) return Promise.resolve(false);

  lyricState.trackId = track.id;
  lyricState.highlightIndex = -1;
  lyricState.highlightLineStartMs = 0;

  if (track.pc !== null && track.cd === null && store.state.data.user?.userId) {
    // 云盘未设置关联的歌曲获取其内置歌词
    return getCloudLyric(track.id, store.state.data.user?.userId).then(data => {
      clearLyrics();
      lyricState.lyric = data?.lrc?.length > 0 ? parseLyric(data.lrc) : [];
      lyricState.lyricType = 'translation';
      return true;
    });
  }

  return getLyricNew(track.id).then(data => {
    if (!data?.lrc?.lyric) {
      clearLyrics();
      return false;
    }
    let { lyric, tlyric, romalyric, yrc, ytlyric, yromalyric } =
      lyricParser(data);
    lyric = lyric.filter(l => !/^作(词|曲)\s*(:|：)\s*无$/.exec(l.content));
    const includeAM =
      lyric.length <= 10 &&
      lyric.map(l => l.content).includes('纯音乐，请欣赏');
    if (includeAM) {
      const reg = /^作(词|曲)\s*(:|：)\s*/;
      const author = track.ar?.[0]?.name;
      lyric = lyric.filter(l => {
        const regExpArr = l.content.match(reg);
        return !regExpArr || l.content.replace(regExpArr[0], '') !== author;
      });
    }
    if (lyric.length === 1 && includeAM) {
      clearLyrics();
      return false;
    }

    lyricState.lyric = lyric;
    lyricState.tlyric = tlyric;
    lyricState.romalyric = romalyric;
    lyricState.yrc = yrc;
    lyricState.ytlyric = ytlyric;
    lyricState.yromalyric = yromalyric;
    if (
      lyricGetters.activeTlyric.length * lyricGetters.activeRomalyric.length >
      0
    ) {
      lyricState.lyricType = 'translation';
    } else {
      lyricState.lyricType =
        lyric.length > 0 ? 'translation' : 'romaPronunciation';
    }
    if (yrc.length === 0) fillYrcFromExternalDB(track);
    return true;
  });
}

let tickTimer = null;
let lastProgressMs = 0;

function tick() {
  const player = store.state.player;
  const progress = player?.seek(null, false) ?? 0;
  const progressMs = progress * 1000;
  const seeked = Math.abs(progressMs - lastProgressMs) > SEEK_THRESHOLD_MS;
  lastProgressMs = progressMs;

  // 按 lyricToShow 而非 lyric 定位：lyricToShow 去掉了空行，
  // 用 lyric 的下标会让含空行的歌曲高亮错位
  const lines = lyricGetters.lyricToShow;
  const oldIndex = lyricState.highlightIndex;
  const index = lines.findIndex((l, i) => {
    const next = lines[i + 1];
    return progress >= l.time && (next ? progress < next.time : true);
  });

  lyricState.highlightIndex = index;
  if (oldIndex !== index || seeked) {
    lyricState.highlightLineStartMs = progressMs;
  }
}

function startTick() {
  if (tickTimer !== null) return;
  lastProgressMs = 0;
  tickTimer = setInterval(tick, TICK_INTERVAL);
}

function stopTick() {
  if (tickTimer === null) return;
  clearInterval(tickTimer);
  tickTimer = null;
}

/**
 * 要不要为当前歌曲拉歌词。
 *
 * 正常模式下一律预取，跟改造前一致（歌词页常驻挂载，本来每次切歌都会拉），
 * 打开歌词页时才不会空等一次网络。游戏模式的信条是「不开就零开销」，
 * 所以那时只有桌面歌词开着才拉。
 */
function needLyricData() {
  return !isGameMode() || store.state.settings?.showDesktopLyric === true;
}

// 没有任何人在看的时候不必跑行定位
function needTick() {
  return (
    store.state.showLyrics === true ||
    store.state.settings?.showDesktopLyric === true
  );
}

let initialized = false;

export function initLyricProvider() {
  if (initialized) return;
  initialized = true;

  store.watch(
    s => s.player?.currentTrack,
    () => {
      if (needLyricData()) fetchLyric();
      else clearLyrics();
    }
  );

  store.watch(needTick, on => (on ? startTick() : stopTick()));

  // 游戏模式下关着桌面歌词是不拉歌词的，开启时得把这一首补上
  store.watch(needLyricData, on => {
    if (on && lyricState.trackId !== store.state.player?.currentTrack?.id) {
      fetchLyric();
    }
  });

  if (needLyricData()) fetchLyric();
  if (needTick()) startTick();
}
