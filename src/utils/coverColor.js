import Vue from 'vue';
import store from '@/store';
import * as Vibrant from 'node-vibrant/dist/vibrant.worker.min.js';
import Color from 'color';
import { isGameMode } from '@/utils/gameMode';

/**
 * 封面取色的唯一数据源。
 *
 * 原本长在 views/lyrics.vue 里。桌面歌词是第二个消费者，而 Vibrant 跑一次要下载
 * 并解码整张封面，两边各跑一次纯属浪费；何况游戏模式下歌词页根本不挂载，
 * 那时桌面歌词就再也拿不到颜色了。
 */

// 取色饱和度低于此值的封面（黑白/单色）取出来的 hue 是噪声，换下一个候选
const ACCENT_MIN_SATURATION = 12;
// 下限 55 是硬约束而非审美：高亮色只有色相跟着背景走，明度又被提到 74%，
// 再不留住饱和度就会和接近纯白的未唱文字糊成一片，扫过的边界直接消失
const ACCENT_SATURATION_RANGE = [55, 85];

export const coverColorState = Vue.observable({
  // 逐字高亮色的 H/S 分量。只存 H/S、不存 L，是为了让 CSS 按当前主题深浅
  // 自行决定亮度；取色失败或封面是灰度时置 null，回退到 CSS 里的兜底值
  accentHue: null,
  accentSaturation: null,
  // 桌面歌词单独一份：它永远浮在别人的界面上，没有任何可跟随的背景，
  // 所以哪怕歌词页正跟着背景走，这一份也始终取 Vibrant 系保住封面辨识度
  desktopAccentHue: null,
  desktopAccentSaturation: null,
  // 歌词页的渐变背景，跟高亮色共用同一次取色
  background: '',
});

// 已经取过色的歌曲 id，避免反复开关歌词页时对同一首重复取色
let coverColorTrackId = null;

/**
 * 从候选色卡里挑第一个够鲜艳的，换算成 H/S。
 * 首选太灰（黑白封面的 DarkMuted 常常如此）时按顺位下探，而不是直接放弃——
 * 封面里往往还有别的色卡能救。全都太灰就返回 null，让 CSS 的兜底值生效。
 */
function pickAccent(candidates) {
  const color = candidates
    .filter(swatch => swatch?._rgb)
    .map(swatch => Color.rgb(swatch._rgb))
    .find(c => c.saturationl() >= ACCENT_MIN_SATURATION);
  if (!color) return null;
  const [min, max] = ACCENT_SATURATION_RANGE;
  return {
    hue: Math.round(color.hue()),
    saturation: Math.round(Math.min(Math.max(color.saturationl(), min), max)),
  };
}

function applyPalette(palette) {
  // 歌词页开着背景时跟背景取同一支色卡（DarkMuted），高亮就成了背景色的提亮版、
  // 和整屏同属一个色系；关着时页面是纯色 body 背景、无背景可跟，
  // 改用 Vibrant 保住封面辨识度
  const pageAccent = pickAccent(
    store.state.settings?.lyricsBackground === true
      ? [palette.DarkMuted, palette.Vibrant, palette.LightVibrant]
      : [palette.Vibrant, palette.LightVibrant, palette.Muted]
  );
  const desktopAccent = pickAccent([
    palette.Vibrant,
    palette.LightVibrant,
    palette.Muted,
  ]);
  coverColorState.accentHue = pageAccent?.hue ?? null;
  coverColorState.accentSaturation = pageAccent?.saturation ?? null;
  coverColorState.desktopAccentHue = desktopAccent?.hue ?? null;
  coverColorState.desktopAccentSaturation = desktopAccent?.saturation ?? null;

  if (store.state.settings?.lyricsBackground !== true) return;
  if (!palette.DarkMuted?._rgb) return;
  const originColor = Color.rgb(palette.DarkMuted._rgb);
  const color = originColor.darken(0.1).rgb().string();
  const color2 = originColor.lighten(0.28).rotate(-30).rgb().string();
  coverColorState.background = `linear-gradient(to top left, ${color}, ${color2})`;
}

/**
 * 清空取色结果。
 * 必须连 coverColorTrackId 一起清掉：留着的话下次重新需要取色时会被
 * 「这首取过了」挡在门外，颜色就永远回不来了。
 */
function resetCoverColor() {
  coverColorTrackId = null;
  coverColorState.accentHue = null;
  coverColorState.accentSaturation = null;
  coverColorState.desktopAccentHue = null;
  coverColorState.desktopAccentSaturation = null;
}

/**
 * 要不要为当前封面取色。
 *
 * 游戏模式下一律不取：Vibrant 要下载并解码整张封面，正是游戏模式要掐掉的那类
 * 开销，桌面歌词那时退回固定色。其余情况只要有人看得见颜色就取。
 */
function needCoverColor() {
  if (isGameMode()) return false;
  const s = store.state;
  return (
    s.showLyrics === true ||
    s.settings?.lyricsBackground === true ||
    s.settings?.showDesktopLyric === true
  );
}

function updateCoverColor() {
  const track = store.state.player?.currentTrack;
  if (!track?.al?.picUrl) return;
  if (!needCoverColor()) return;
  if (coverColorTrackId === track.id) return;
  coverColorTrackId = track.id;

  Vibrant.from(track.al.picUrl + '?param=256y256', { colorCount: 1 })
    .getPalette()
    .then(applyPalette)
    // 封面下载失败或解码失败时 Vibrant 会 reject。清掉标记，
    // 下次还有人要颜色时可以重试（可能只是临时的网络失败）
    .catch(resetCoverColor);
}

let initialized = false;

export function initCoverColor() {
  if (initialized) return;
  initialized = true;

  store.watch(s => s.player?.currentTrack, updateCoverColor);

  // 关着的时候切歌不取色，重新有人要看时补上
  store.watch(needCoverColor, on => {
    if (on) updateCoverColor();
  });

  // 游戏模式要的是「桌面歌词退回固定色」，所以进模式时必须把取色结果清掉，
  // 否则会一直挂着进模式前那一首的颜色。别的原因（歌词页关了之类）不清：
  // 留着缓存，反复开关歌词页时才不会对同一首重复跑 Vibrant
  store.watch(isGameMode, on => {
    if (on) resetCoverColor();
  });

  // 这个开关决定歌词页的高亮色跟背景走还是跟 Vibrant 走，切换后同一首歌也得重取，
  // 否则要等到下一次切歌才生效
  store.watch(
    s => s.settings?.lyricsBackground,
    () => {
      coverColorTrackId = null;
      updateCoverColor();
    }
  );

  updateCoverColor();
}
