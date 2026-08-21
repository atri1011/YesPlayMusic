<template>
  <transition name="slide-up">
    <div
      class="lyrics-page"
      :class="{ 'no-lyric': noLyric, paused: !player.playing }"
      :data-theme="theme"
    >
      <div
        v-if="
          (settings.lyricsBackground === 'blur') |
            (settings.lyricsBackground === 'dynamic')
        "
        class="lyrics-background"
        :class="{
          'dynamic-background': settings.lyricsBackground === 'dynamic',
        }"
      >
        <div
          class="top-right"
          :style="{ backgroundImage: `url(${bgImageUrl})` }"
        />
        <div
          class="bottom-left"
          :style="{ backgroundImage: `url(${bgImageUrl})` }"
        />
      </div>
      <div
        v-if="settings.lyricsBackground === true"
        class="gradient-background"
        :style="{ background }"
      ></div>

      <div class="left-side">
        <div>
          <div v-if="settings.showLyricsTime" class="date">
            {{ date }}
          </div>
          <div class="cover">
            <div class="cover-container">
              <img :src="imageUrl" loading="lazy" />
              <div
                class="shadow"
                :style="{ backgroundImage: `url(${imageUrl})` }"
              ></div>
            </div>
          </div>
          <div class="controls">
            <div class="top-part">
              <div class="track-info">
                <div class="title" :title="currentTrack.name">
                  <router-link
                    v-if="hasList()"
                    :to="`${getListPath()}`"
                    @click.native="toggleLyrics"
                    >{{ currentTrack.name }}
                  </router-link>
                  <span v-else>
                    {{ currentTrack.name }}
                  </span>
                </div>
                <div class="subtitle">
                  <router-link
                    v-if="artist.id !== 0"
                    :to="`/artist/${artist.id}`"
                    @click.native="toggleLyrics"
                    >{{ artist.name }}
                  </router-link>
                  <span v-else>
                    {{ artist.name }}
                  </span>
                  <span v-if="album.id !== 0">
                    -
                    <router-link
                      :to="`/album/${album.id}`"
                      :title="album.name"
                      @click.native="toggleLyrics"
                      >{{ album.name }}
                    </router-link>
                  </span>
                </div>
              </div>
              <div class="top-right">
                <div class="volume-control">
                  <button-icon :title="$t('player.mute')" @click.native="mute">
                    <svg-icon v-show="volume > 0.5" icon-class="volume" />
                    <svg-icon v-show="volume === 0" icon-class="volume-mute" />
                    <svg-icon
                      v-show="volume <= 0.5 && volume !== 0"
                      icon-class="volume-half"
                    />
                  </button-icon>
                  <div class="volume-bar">
                    <vue-slider
                      v-model="volume"
                      :min="0"
                      :max="1"
                      :interval="0.01"
                      :drag-on-click="true"
                      :duration="0"
                      tooltip="none"
                      :dot-size="12"
                    ></vue-slider>
                  </div>
                </div>
                <div class="buttons">
                  <button-icon
                    :title="$t('player.like')"
                    @click.native="likeATrack(player.currentTrack.id)"
                  >
                    <svg-icon
                      :icon-class="
                        player.isCurrentTrackLiked ? 'heart-solid' : 'heart'
                      "
                    />
                  </button-icon>
                  <button-icon
                    :title="$t('contextMenu.addToPlaylist')"
                    @click.native="addToPlaylist"
                  >
                    <svg-icon icon-class="plus" />
                  </button-icon>
                  <!-- <button-icon @click.native="openMenu" title="Menu"
                    ><svg-icon icon-class="more"
                  /></button-icon> -->
                </div>
              </div>
            </div>
            <div class="progress-bar">
              <span>{{ formatTrackTime(player.progress) || '0:00' }}</span>
              <div class="slider">
                <vue-slider
                  v-model="player.progress"
                  :min="0"
                  :max="player.currentTrackDuration"
                  :interval="1"
                  :drag-on-click="true"
                  :duration="0"
                  :dot-size="12"
                  :height="2"
                  :tooltip-formatter="formatTrackTime"
                  :lazy="true"
                  :silent="true"
                ></vue-slider>
              </div>
              <span>{{ formatTrackTime(player.currentTrackDuration) }}</span>
            </div>
            <div class="media-controls">
              <button-icon
                v-show="!player.isPersonalFM"
                :title="
                  player.repeatMode === 'one'
                    ? $t('player.repeatTrack')
                    : $t('player.repeat')
                "
                :class="{ active: player.repeatMode !== 'off' }"
                @click.native="switchRepeatMode"
              >
                <svg-icon
                  v-show="player.repeatMode !== 'one'"
                  icon-class="repeat"
                />
                <svg-icon
                  v-show="player.repeatMode === 'one'"
                  icon-class="repeat-1"
                />
              </button-icon>
              <div class="middle">
                <button-icon
                  v-show="!player.isPersonalFM"
                  :title="$t('player.previous')"
                  @click.native="playPrevTrack"
                >
                  <svg-icon icon-class="previous" />
                </button-icon>
                <button-icon
                  v-show="player.isPersonalFM"
                  title="不喜欢"
                  @click.native="moveToFMTrash"
                >
                  <svg-icon icon-class="thumbs-down" />
                </button-icon>
                <button-icon
                  id="play"
                  :title="$t(player.playing ? 'player.pause' : 'player.play')"
                  @click.native="playOrPause"
                >
                  <svg-icon :icon-class="player.playing ? 'pause' : 'play'" />
                </button-icon>
                <button-icon
                  :title="$t('player.next')"
                  @click.native="playNextTrack"
                >
                  <svg-icon icon-class="next" />
                </button-icon>
              </div>
              <button-icon
                v-show="!player.isPersonalFM"
                :title="$t('player.shuffle')"
                :class="{ active: player.shuffle }"
                @click.native="switchShuffle"
              >
                <svg-icon icon-class="shuffle" />
              </button-icon>
              <button-icon
                v-show="
                  isShowLyricTypeSwitch &&
                  $store.state.settings.showLyricsTranslation &&
                  lyricType === 'translation'
                "
                :title="$t('player.translationLyric')"
                @click.native="switchLyricType"
              >
                <span class="lyric-switch-icon">译</span>
              </button-icon>
              <button-icon
                v-show="
                  isShowLyricTypeSwitch &&
                  $store.state.settings.showLyricsTranslation &&
                  lyricType === 'romaPronunciation'
                "
                :title="$t('player.PronunciationLyric')"
                @click.native="switchLyricType"
              >
                <span class="lyric-switch-icon">音</span>
              </button-icon>
            </div>
          </div>
        </div>
      </div>
      <div class="right-side">
        <transition name="slide-fade">
          <div
            v-show="!noLyric"
            ref="lyricsContainer"
            class="lyrics-container"
            :style="lyricFontSize"
          >
            <div id="line-1" class="line"></div>
            <div
              v-for="(line, index) in lyricToShow"
              :id="`line${index}`"
              :key="index"
              class="line"
              :class="{
                highlight: highlightLyricIndex === index,
              }"
              @click="clickLyricLine(line.time)"
              @dblclick="clickLyricLine(line.time, true)"
            >
              <div class="content">
                <span
                  v-if="line.words"
                  class="words"
                  @click.right="openLyricMenu($event, line, 0)"
                  ><span
                    v-for="(word, wordIndex) in line.words"
                    :key="wordKey(index, wordIndex)"
                    class="word"
                    :style="wordAnimationStyle(word)"
                    >{{ word.text }}</span
                  ></span
                >
                <span
                  v-else-if="line.contents[0]"
                  @click.right="openLyricMenu($event, line, 0)"
                  >{{ line.contents[0] }}</span
                >
                <br />
                <span
                  v-if="
                    line.contents[1] &&
                    $store.state.settings.showLyricsTranslation
                  "
                  class="translation"
                  @click.right="openLyricMenu($event, line, 1)"
                  >{{ line.contents[1] }}</span
                >
              </div>
            </div>
            <ContextMenu v-if="!noLyric" ref="lyricMenu">
              <div class="item" @click="copyLyric(false)">{{
                $t('contextMenu.copyLyric')
              }}</div>
              <div
                v-if="
                  rightClickLyric &&
                  rightClickLyric.contents[1] &&
                  $store.state.settings.showLyricsTranslation
                "
                class="item"
                @click="copyLyric(true)"
                >{{ $t('contextMenu.copyLyricWithTranslation') }}</div
              >
            </ContextMenu>
          </div>
        </transition>
      </div>
      <div class="close-button" @click="toggleLyrics">
        <button>
          <svg-icon icon-class="arrow-down" />
        </button>
      </div>
      <div class="close-button" style="left: 24px" @click="fullscreen">
        <button>
          <svg-icon v-if="isFullscreen" icon-class="fullscreen-exit" />
          <svg-icon v-else icon-class="fullscreen" />
        </button>
      </div>
    </div>
  </transition>
</template>

<script>
// The lyrics page of Apple Music is so gorgeous, so I copy the design.
// Some of the codes are from https://github.com/sl1673495/vue-netease-music

import { mapState, mapMutations, mapActions } from 'vuex';
import VueSlider from 'vue-slider-component';
import ContextMenu from '@/components/ContextMenu.vue';
import { formatTrackTime } from '@/utils/common';
import { getLyricNew, getCloudLyric } from '@/api/track';
import {
  lyricParser,
  copyLyric,
  parseLyric,
  findCounterpartLyric,
} from '@/utils/lyrics';
import ButtonIcon from '@/components/ButtonIcon.vue';
import * as Vibrant from 'node-vibrant/dist/vibrant.worker.min.js';
import Color from 'color';
import { isAccountLoggedIn } from '@/utils/auth';
import { hasListSource, getListSourcePath } from '@/utils/playList';
import locale from '@/locale';

// yrc 的行首时间与 lrc 不同源（实测偏差可达 330ms），退回 lrc 系译文时
// 允许的最大就近匹配误差（秒）
const YRC_MATCH_TOLERANCE = 0.6;
// 单个字点亮所用的时长（毫秒）；比这更长的字不会一直渐变，避免拖沓
const WORD_RAMP_MS = 260;

export default {
  name: 'Lyrics',
  components: {
    VueSlider,
    ButtonIcon,
    ContextMenu,
  },
  data() {
    return {
      lyricsInterval: null,
      lyric: [],
      tlyric: [],
      romalyric: [],
      yrcLyric: [],
      ytlyric: [],
      yromalyric: [],
      lyricType: 'translation', // or 'romaPronunciation'
      highlightLyricIndex: -1,
      // 当前高亮行被点亮时的播放进度（毫秒），逐字动画以它为基准算延迟
      highlightLineStartMs: 0,
      lastProgressMs: 0,
      minimize: true,
      background: '',
      date: this.formatTime(new Date()),
      isFullscreen: !!document.fullscreenElement,
      rightClickLyric: null,
    };
  },
  computed: {
    ...mapState(['player', 'settings', 'showLyrics']),
    currentTrack() {
      return this.player.currentTrack;
    },
    volume: {
      get() {
        return this.player.volume;
      },
      set(value) {
        this.player.volume = value;
      },
    },
    imageUrl() {
      return this.player.currentTrack?.al?.picUrl + '?param=1024y1024';
    },
    bgImageUrl() {
      return this.player.currentTrack?.al?.picUrl + '?param=512y512';
    },
    isShowLyricTypeSwitch() {
      return this.activeRomalyric.length > 0 && this.activeTlyric.length > 0;
    },
    useWordByWord() {
      // 设置项缺省（老版本 localStorage）时按开启处理
      return (
        this.settings.showLyricsWordByWord !== false && this.yrcLyric.length > 0
      );
    },
    activeLyric() {
      return this.useWordByWord ? this.yrcLyric : this.lyric;
    },
    activeTlyric() {
      if (!this.useWordByWord) return this.tlyric;
      return this.ytlyric.length > 0 ? this.ytlyric : this.tlyric;
    },
    activeRomalyric() {
      if (!this.useWordByWord) return this.romalyric;
      return this.yromalyric.length > 0 ? this.yromalyric : this.romalyric;
    },
    lyricToShow() {
      return this.lyricType === 'translation'
        ? this.lyricWithTranslation
        : this.lyricWithRomaPronunciation;
    },
    lyricWithTranslation() {
      return this.pairLyricWith(this.activeTlyric, this.ytlyric.length === 0);
    },
    lyricWithRomaPronunciation() {
      return this.pairLyricWith(
        this.activeRomalyric,
        this.yromalyric.length === 0
      );
    },
    lyricFontSize() {
      return {
        fontSize: `${this.$store.state.settings.lyricFontSize || 28}px`,
      };
    },
    noLyric() {
      return this.lyric.length == 0;
    },
    artist() {
      return this.currentTrack?.ar
        ? this.currentTrack.ar[0]
        : { id: 0, name: 'unknown' };
    },
    album() {
      return this.currentTrack?.al || { id: 0, name: 'unknown' };
    },
    theme() {
      return this.settings.lyricsBackground === true ? 'dark' : 'auto';
    },
  },
  watch: {
    currentTrack() {
      this.getLyric();
      this.getCoverColor();
    },
    showLyrics(show) {
      if (show) {
        this.setLyricsInterval();
        this.$store.commit('enableScrolling', false);
      } else {
        clearInterval(this.lyricsInterval);
        this.$store.commit('enableScrolling', true);
      }
    },
  },
  created() {
    this.getLyric();
    this.getCoverColor();
    this.initDate();
    document.addEventListener('keydown', e => {
      if (e.key === 'F11') {
        e.preventDefault();
        this.fullscreen();
      }
    });
    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen = !!document.fullscreenElement;
    });
  },
  beforeDestroy: function () {
    if (this.timer) {
      clearInterval(this.timer);
    }
  },
  destroyed() {
    clearInterval(this.lyricsInterval);
  },
  methods: {
    ...mapMutations(['toggleLyrics', 'updateModal']),
    ...mapActions(['likeATrack']),
    initDate() {
      var _this = this;
      clearInterval(this.timer);
      this.timer = setInterval(function () {
        _this.date = _this.formatTime(new Date());
      }, 1000);
    },
    formatTime(value) {
      let hour = value.getHours().toString();
      let minute = value.getMinutes().toString();
      let second = value.getSeconds().toString();
      return (
        hour.padStart(2, '0') +
        ':' +
        minute.padStart(2, '0') +
        ':' +
        second.padStart(2, '0')
      );
    },
    fullscreen() {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    },
    addToPlaylist() {
      if (!isAccountLoggedIn()) {
        this.showToast(locale.t('toast.needToLogin'));
        return;
      }
      this.$store.dispatch('fetchLikedPlaylist');
      this.updateModal({
        modalName: 'addTrackToPlaylistModal',
        key: 'show',
        value: true,
      });
      this.updateModal({
        modalName: 'addTrackToPlaylistModal',
        key: 'selectedTrackID',
        value: this.currentTrack?.id,
      });
    },
    playPrevTrack() {
      this.player.playPrevTrack();
    },
    playOrPause() {
      this.player.playOrPause();
    },
    playNextTrack() {
      if (this.player.isPersonalFM) {
        this.player.playNextFMTrack();
      } else {
        this.player.playNextTrack();
      }
    },
    getLyric() {
      if (!this.currentTrack.id) return;
      if (
        this.currentTrack.pc !== null &&
        this.currentTrack.cd === null &&
        this.$store.state.data.user?.userId
      ) {
        //云盘未设置关联的歌曲获取其内置歌词
        return getCloudLyric(
          this.currentTrack.id,
          this.$store.state.data.user?.userId
        ).then(data => {
          this.clearLyrics();
          this.lyric = data?.lrc?.length > 0 ? parseLyric(data.lrc) : [];
          this.lyricType = 'translation';
          return true;
        });
      }
      return getLyricNew(this.currentTrack.id).then(data => {
        if (!data?.lrc?.lyric) {
          this.clearLyrics();
          return false;
        } else {
          let { lyric, tlyric, romalyric, yrc, ytlyric, yromalyric } =
            lyricParser(data);
          lyric = lyric.filter(
            l => !/^作(词|曲)\s*(:|：)\s*无$/.exec(l.content)
          );
          let includeAM =
            lyric.length <= 10 &&
            lyric.map(l => l.content).includes('纯音乐，请欣赏');
          if (includeAM) {
            let reg = /^作(词|曲)\s*(:|：)\s*/;
            let author = this.currentTrack?.ar[0]?.name;
            lyric = lyric.filter(l => {
              let regExpArr = l.content.match(reg);
              return (
                !regExpArr || l.content.replace(regExpArr[0], '') !== author
              );
            });
          }
          if (lyric.length === 1 && includeAM) {
            this.clearLyrics();
            return false;
          } else {
            this.lyric = lyric;
            this.tlyric = tlyric;
            this.romalyric = romalyric;
            this.yrcLyric = yrc;
            this.ytlyric = ytlyric;
            this.yromalyric = yromalyric;
            if (this.activeTlyric.length * this.activeRomalyric.length > 0) {
              this.lyricType = 'translation';
            } else {
              this.lyricType =
                lyric.length > 0 ? 'translation' : 'romaPronunciation';
            }
            return true;
          }
        }
      });
    },
    clearLyrics() {
      this.lyric = [];
      this.tlyric = [];
      this.romalyric = [];
      this.yrcLyric = [];
      this.ytlyric = [];
      this.yromalyric = [];
    },
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
    /**
     * 逐字动画：每个字在自己的时间点亮起。
     * 延迟为负数时 CSS 会让动画从中途开始播放，因此从行中间进入也能对上。
     */
    wordAnimationStyle(word) {
      return {
        animationDuration: `${Math.min(word.durationMs, WORD_RAMP_MS)}ms`,
        animationDelay: `${word.startMs - this.highlightLineStartMs}ms`,
      };
    },
    /**
     * 只有高亮行的字才把时间基准写进 key。基准变化时节点重建，
     * 动画随之重新播放，这样在同一行内拖动进度条也能重新对齐。
     */
    wordKey(lineIndex, wordIndex) {
      return lineIndex === this.highlightLyricIndex
        ? `${wordIndex}-${this.highlightLineStartMs}`
        : wordIndex;
    },
    switchLyricType() {
      this.lyricType =
        this.lyricType === 'translation' ? 'romaPronunciation' : 'translation';
    },
    formatTrackTime(value) {
      return formatTrackTime(value);
    },
    clickLyricLine(value, startPlay = false) {
      // TODO: 双击选择还会选中文字，考虑搞个右键菜单复制歌词
      let jumpFlag = false;
      this.lyric.filter(function (item) {
        if (item.content == '纯音乐，请欣赏') {
          jumpFlag = true;
        }
      });
      if (window.getSelection().toString().length === 0 && !jumpFlag) {
        this.player.seek(value);
      }
      if (startPlay === true) {
        this.player.play();
      }
    },
    openLyricMenu(e, lyric, idx) {
      this.rightClickLyric = { ...lyric, idx };
      this.$refs.lyricMenu.openMenu(e);
      e.preventDefault();
    },
    copyLyric(withTranslation) {
      if (this.rightClickLyric) {
        const idx = this.rightClickLyric.idx;
        if (!withTranslation) {
          copyLyric(this.rightClickLyric.contents[idx]);
        } else {
          copyLyric(this.rightClickLyric.contents.join(' '));
        }
      }
    },
    setLyricsInterval() {
      this.lyricsInterval = setInterval(() => {
        const progress = this.player.seek(null, false) ?? 0;
        const progressMs = progress * 1000;
        // 正常播放时每跳只前进 50ms，出现大幅跳变说明用户拖动了进度条
        const seeked = Math.abs(progressMs - this.lastProgressMs) > 300;
        this.lastProgressMs = progressMs;

        let oldHighlightLyricIndex = this.highlightLyricIndex;
        // 按 lyricToShow 而非 lyric 定位：lyricToShow 去掉了空行，
        // 用 lyric 的下标会让含空行的歌曲高亮错位
        this.highlightLyricIndex = this.lyricToShow.findIndex((l, index) => {
          const nextLyric = this.lyricToShow[index + 1];
          return (
            progress >= l.time && (nextLyric ? progress < nextLyric.time : true)
          );
        });
        if (oldHighlightLyricIndex !== this.highlightLyricIndex || seeked) {
          this.highlightLineStartMs = progressMs;
        }
        if (oldHighlightLyricIndex !== this.highlightLyricIndex) {
          const el = document.getElementById(`line${this.highlightLyricIndex}`);
          if (el)
            el.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
        }
      }, 50);
    },
    moveToFMTrash() {
      this.player.moveToFMTrash();
    },
    switchRepeatMode() {
      this.player.switchRepeatMode();
    },
    switchShuffle() {
      this.player.switchShuffle();
    },
    getCoverColor() {
      if (this.settings.lyricsBackground !== true) return;
      const cover = this.currentTrack.al?.picUrl + '?param=256y256';
      Vibrant.from(cover, { colorCount: 1 })
        .getPalette()
        .then(palette => {
          const originColor = Color.rgb(palette.DarkMuted._rgb);
          const color = originColor.darken(0.1).rgb().string();
          const color2 = originColor.lighten(0.28).rotate(-30).rgb().string();
          this.background = `linear-gradient(to top left, ${color}, ${color2})`;
        });
    },
    hasList() {
      return hasListSource();
    },
    getListPath() {
      return getListSourcePath();
    },
    mute() {
      this.player.mute();
    },
  },
};
</script>

<style lang="scss" scoped>
.lyrics-page {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  z-index: 200;
  background: var(--color-body-bg);
  display: flex;
  clip: rect(auto, auto, auto, auto);
}

.lyrics-background {
  --contrast-lyrics-background: 75%;
  --brightness-lyrics-background: 150%;
}

[data-theme='dark'] .lyrics-background {
  --contrast-lyrics-background: 125%;
  --brightness-lyrics-background: 50%;
}

.lyrics-background {
  filter: blur(50px) contrast(var(--contrast-lyrics-background))
    brightness(var(--brightness-lyrics-background));
  position: absolute;
  height: 100vh;
  width: 100vw;

  .top-right,
  .bottom-left {
    z-index: 0;
    width: 140vw;
    height: 140vw;
    opacity: 0.6;
    position: absolute;
    background-size: cover;
  }

  .top-right {
    right: 0;
    top: 0;
    mix-blend-mode: luminosity;
  }

  .bottom-left {
    left: 0;
    bottom: 0;
    animation-direction: reverse;
    animation-delay: 10s;
  }
}

.dynamic-background > div {
  animation: rotate 150s linear infinite;
}

@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.gradient-background {
  position: absolute;
  height: 100vh;
  width: 100vw;
}

.left-side {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  margin-right: 32px;
  margin-top: 24px;
  align-items: center;
  transition: all 0.5s;

  z-index: 1;

  .date {
    max-width: 54vh;
    margin: 24px 0;
    color: var(--color-text);
    text-align: center;
    font-size: 4rem;
    font-weight: 600;
    opacity: 0.88;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
  }

  .controls {
    max-width: 54vh;
    margin-top: 24px;
    color: var(--color-text);

    .title {
      margin-top: 8px;
      font-size: 1.4rem;
      font-weight: 600;
      opacity: 0.88;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
    }

    .subtitle {
      margin-top: 4px;
      font-size: 1rem;
      opacity: 0.58;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
    }

    .top-part {
      display: flex;
      justify-content: space-between;

      .top-right {
        display: flex;
        justify-content: space-between;

        .volume-control {
          margin: 0 10px;
          display: flex;
          align-items: center;

          .volume-bar {
            width: 84px;
          }
        }

        .buttons {
          display: flex;
          align-items: center;

          button {
            margin: 0 0 0 4px;
          }

          .svg-icon {
            height: 18px;
            width: 18px;
          }
        }
      }
    }

    .progress-bar {
      margin-top: 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .slider {
        width: 100%;
        flex-grow: grow;
        padding: 0 10px;
      }

      span {
        font-size: 15px;
        opacity: 0.58;
        min-width: 28px;
      }
    }

    .media-controls {
      display: flex;
      justify-content: center;
      margin-top: 18px;
      align-items: center;

      button {
        margin: 0;
      }

      .svg-icon {
        opacity: 0.38;
        height: 14px;
        width: 14px;
      }

      .active .svg-icon {
        opacity: 0.88;
      }

      .middle {
        padding: 0 16px;
        display: flex;
        align-items: center;

        button {
          margin: 0 8px;
        }

        button#play .svg-icon {
          height: 28px;
          width: 28px;
          padding: 2px;
        }

        .svg-icon {
          opacity: 0.88;
          height: 22px;
          width: 22px;
        }
      }

      .lyric-switch-icon {
        color: var(--color-text);
        font-size: 14px;
        line-height: 14px;
        opacity: 0.88;
      }
    }
  }
}

.cover {
  position: relative;

  .cover-container {
    position: relative;
  }

  img {
    border-radius: 0.75em;
    width: 54vh;
    height: 54vh;
    user-select: none;
    object-fit: cover;
  }

  .shadow {
    position: absolute;
    top: 12px;
    height: 54vh;
    width: 54vh;
    filter: blur(16px) opacity(0.6);
    transform: scale(0.92, 0.96);
    z-index: -1;
    background-size: cover;
    border-radius: 0.75em;
  }
}

.right-side {
  flex: 1;
  font-weight: 600;
  color: var(--color-text);
  margin-right: 24px;
  z-index: 0;

  .lyrics-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding-left: 78px;
    max-width: 460px;
    overflow-y: auto;
    transition: 0.5s;
    scrollbar-width: none; // firefox

    .line {
      margin: 2px 0;
      padding: 12px 18px;
      transition: 0.5s;
      border-radius: 12px;

      &:hover {
        background: var(--color-secondary-bg-for-transparent);
      }

      .content {
        transform-origin: center left;
        transform: scale(0.95);
        transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        user-select: none;

        span {
          opacity: 0.28;
          cursor: default;
          font-size: 1em;
          transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        span.translation {
          opacity: 0.2;
          font-size: 0.925em;
        }

        // 逐字歌词的每个字自行控制不透明度。这里必须显式复位，
        // 否则会与外层 .words 的 opacity 相乘，未唱到的字暗得看不见。
        span.word {
          opacity: 1;
          transition: none;
          // 字里自带的空格是断词依据，不能被折叠掉
          white-space: pre-wrap;
        }
      }
    }

    .line#line-1:hover {
      background: unset;
    }

    .translation {
      margin-top: 0.1em;
    }

    .highlight div.content {
      transform: scale(1);

      span {
        opacity: 0.98;
        display: inline-block;
      }

      span.translation {
        opacity: 0.65;
      }

      span.word {
        // 必须压回 inline：上面的 inline-block 会让每个字变成原子盒子，
        // 字尾空格被关在盒子里，长英文歌词就找不到断行点而溢出
        display: inline;
        opacity: 0.32;
        animation-name: lyric-word-active;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
      }
    }
  }

  ::-webkit-scrollbar {
    display: none;
  }

  .lyrics-container .line:first-child {
    margin-top: 50vh;
  }

  .lyrics-container .line:last-child {
    margin-bottom: calc(50vh - 128px);
  }
}

// 暂停时 CSS 动画不会自己停下，需要跟着播放状态一起冻结
.lyrics-page.paused span.word {
  animation-play-state: paused;
}

@keyframes lyric-word-active {
  from {
    opacity: 0.32;
  }

  to {
    opacity: 1;
  }
}

.close-button {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 300;
  border-radius: 0.75rem;
  height: 44px;
  width: 44px;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0.28;
  transition: 0.2s;
  -webkit-app-region: no-drag;

  .svg-icon {
    color: var(--color-text);
    padding-top: 5px;
    height: 22px;
    width: 22px;
  }

  &:hover {
    background: var(--color-secondary-bg-for-transparent);
    opacity: 0.88;
  }
}

.lyrics-page.no-lyric {
  .left-side {
    transition: all 0.5s;
    transform: translateX(27vh);
    margin-right: 0;
  }
}

@media (max-aspect-ratio: 10/9) {
  .left-side {
    display: none;
  }

  .right-side .lyrics-container {
    max-width: 100%;
  }
}

@media screen and (min-width: 1200px) {
  .right-side .lyrics-container {
    max-width: 600px;
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s;
}

.slide-up-enter,
.slide-up-leave-to

/* .fade-leave-active below version 2.1.8 */ {
  transform: translateY(100%);
}

.slide-fade-enter-active {
  transition: all 0.5s ease;
}

.slide-fade-leave-active {
  transition: all 0.5s cubic-bezier(0.2, 0.2, 0, 1);
}

.slide-fade-enter,
.slide-fade-leave-to {
  transform: translateX(27vh);
  opacity: 0;
}
</style>
