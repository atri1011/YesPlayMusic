<template>
  <div class="game-mode">
    <Win32Titlebar v-if="enableWin32Titlebar" />
    <LinuxTitlebar v-if="enableLinuxTitlebar" />

    <div class="panel">
      <img
        class="cover"
        :src="currentTrack.al && currentTrack.al.picUrl | resizeImage(224)"
        loading="lazy"
      />

      <div class="track-info">
        <div class="name">{{ currentTrack.name }}</div>
        <div class="artist">{{ artistName }}</div>
      </div>

      <div class="progress">
        <span class="time">{{
          formatTrackTime(player.progress) || '0:00'
        }}</span>
        <vue-slider
          v-model="progress"
          class="progress-bar"
          :min="0"
          :max="player.currentTrackDuration"
          :interval="1"
          :drag-on-click="true"
          :duration="0"
          :dot-size="12"
          :height="3"
          :tooltip-formatter="formatTrackTime"
          :lazy="true"
          :silent="true"
        ></vue-slider>
        <span class="time">{{
          formatTrackTime(player.currentTrackDuration) || '0:00'
        }}</span>
      </div>

      <div class="controls">
        <button-icon
          :title="
            player.isCurrentTrackLiked ? $t('player.unlike') : $t('player.like')
          "
          @click.native="likeATrack(player.currentTrack.id)"
        >
          <svg-icon
            :icon-class="player.isCurrentTrackLiked ? 'heart-solid' : 'heart'"
          />
        </button-icon>

        <button-icon
          :title="$t('player.previous')"
          @click.native="playPrevTrack"
        >
          <svg-icon icon-class="previous" />
        </button-icon>

        <button-icon
          class="play"
          :title="$t(player.playing ? 'player.pause' : 'player.play')"
          @click.native="playOrPause"
        >
          <svg-icon :icon-class="player.playing ? 'pause' : 'play'" />
        </button-icon>

        <button-icon :title="$t('player.next')" @click.native="playNextTrack">
          <svg-icon icon-class="next" />
        </button-icon>

        <button-icon
          :class="{
            active: player.repeatMode !== 'off',
            disabled: player.isPersonalFM,
          }"
          :title="
            player.repeatMode === 'one'
              ? $t('player.repeatTrack')
              : $t('player.repeat')
          "
          @click.native="switchRepeatMode"
        >
          <svg-icon
            :icon-class="player.repeatMode === 'one' ? 'repeat-1' : 'repeat'"
          />
        </button-icon>
      </div>

      <div class="volume">
        <button-icon :title="$t('player.mute')" @click.native="mute">
          <svg-icon v-show="volume > 0.5" icon-class="volume" />
          <svg-icon v-show="volume === 0" icon-class="volume-mute" />
          <svg-icon
            v-show="volume <= 0.5 && volume !== 0"
            icon-class="volume-half"
          />
        </button-icon>
        <vue-slider
          v-model="volume"
          class="volume-bar"
          :min="0"
          :max="1"
          :interval="0.01"
          :drag-on-click="true"
          :duration="0"
          tooltip="none"
          :dot-size="12"
        ></vue-slider>
      </div>

      <button class="exit" @click="exitGameMode">
        <svg-icon icon-class="x" />
        {{ $t('settings.gameModeExit') }}
      </button>

      <div class="hint">{{ $t('settings.gameModeHint') }}</div>
    </div>
  </div>
</template>

<script>
import { mapActions, mapState } from 'vuex';
import '@/assets/css/slider.css';

import ButtonIcon from '@/components/ButtonIcon.vue';
import LinuxTitlebar from '@/components/LinuxTitlebar.vue';
import VueSlider from 'vue-slider-component';
import Win32Titlebar from '@/components/Win32Titlebar.vue';
import { formatTrackTime } from '@/utils/common';
import { setGameMode } from '@/utils/gameMode';

/**
 * 游戏模式下唯一渲染的组件：只保留「把当前这首歌放出声」需要的控件。
 *
 * 刻意不使用 backdrop-filter / filter: blur() / will-change —— 这些会让浏览器
 * 常驻额外的 GPU 合成层，正是游戏模式要省掉的开销。纯扁平色即可。
 */
export default {
  name: 'GameMode',
  components: {
    ButtonIcon,
    VueSlider,
    Win32Titlebar,
    LinuxTitlebar,
  },
  data() {
    return {
      enableWin32Titlebar: false,
      enableLinuxTitlebar: false,
    };
  },
  computed: {
    ...mapState(['player', 'settings']),
    currentTrack() {
      return this.player.currentTrack;
    },
    artistName() {
      return (this.currentTrack.ar || []).map(ar => ar.name).join(', ');
    },
    progress: {
      get() {
        return this.player.progress;
      },
      set(value) {
        this.player.progress = value;
      },
    },
    volume: {
      get() {
        return this.player.volume;
      },
      set(value) {
        this.player.volume = value;
      },
    },
  },
  created() {
    // 无边框窗口（Windows 一律无边框，Linux 看设置）的标题栏挂在 Navbar 里，
    // 游戏模式把 Navbar 拆掉了，这里必须补上，否则窗口没法拖动/最小化/关闭。
    if (process.platform === 'win32') {
      this.enableWin32Titlebar = true;
    } else if (
      process.platform === 'linux' &&
      this.settings.linuxEnableCustomTitlebar
    ) {
      this.enableLinuxTitlebar = true;
    }
  },
  mounted() {
    window.addEventListener('keydown', this.handleKeydown);
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.handleKeydown);
  },
  methods: {
    ...mapActions(['likeATrack']),
    formatTrackTime(value) {
      return formatTrackTime(value);
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
    switchRepeatMode() {
      this.player.switchRepeatMode();
    },
    mute() {
      this.player.mute();
    },
    exitGameMode() {
      setGameMode(false);
    },
    handleKeydown(event) {
      switch (event.code) {
        case 'MediaPlayPause':
          this.playOrPause();
          break;
        case 'MediaTrackPrevious':
          this.playPrevTrack();
          break;
        case 'MediaTrackNext':
          this.playNextTrack();
          break;
        default:
          break;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.game-mode {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-body-bg);
  color: var(--color-text);
  -webkit-app-region: drag;
}

.panel {
  width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  -webkit-app-region: no-drag;
}

.cover {
  width: 160px;
  height: 160px;
  border-radius: 8px;
  object-fit: cover;
  background-color: var(--color-secondary-bg);
  user-select: none;
}

.track-info {
  margin-top: 20px;
  text-align: center;
  width: 100%;
  .name {
    font-size: 18px;
    font-weight: 600;
    opacity: 0.88;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .artist {
    margin-top: 4px;
    font-size: 13px;
    opacity: 0.58;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.progress {
  margin-top: 20px;
  width: 100%;
  display: flex;
  align-items: center;
  .time {
    font-size: 12px;
    opacity: 0.58;
    font-variant-numeric: tabular-nums;
    width: 40px;
    text-align: center;
    flex-shrink: 0;
  }
  .progress-bar {
    flex: 1;
  }
}

.controls {
  margin-top: 12px;
  display: flex;
  align-items: center;
  .button-icon {
    margin: 0 6px;
  }
  .play {
    height: 42px;
    width: 42px;
    .svg-icon {
      width: 24px;
      height: 24px;
    }
  }
  .active .svg-icon {
    color: var(--color-primary);
  }
  .disabled {
    cursor: default;
    opacity: 0.38;
    &:hover {
      background: none;
    }
    &:active {
      transform: unset;
    }
  }
}

.volume {
  margin-top: 12px;
  width: 100%;
  display: flex;
  align-items: center;
  .volume-bar {
    flex: 1;
    margin-left: 8px;
  }
}

.exit {
  margin-top: 28px;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-primary-bg);
  .svg-icon {
    width: 14px;
    height: 14px;
    margin-right: 6px;
  }
}

.hint {
  margin-top: 12px;
  font-size: 12px;
  opacity: 0.48;
  text-align: center;
}
</style>
