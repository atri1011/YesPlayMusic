<template>
  <div id="app" :class="{ 'user-select-none': userSelectNone }">
    <!-- 游戏模式：只留一个能放歌的内核，其余界面一律不渲染（不是 v-show，是真的不挂载），
         keep-alive 缓存页、backdrop-filter 合成层、歌词页取色都随之消失。 -->
    <GameMode v-if="gameMode" />
    <template v-else>
      <Scrollbar v-show="!showLyrics" ref="scrollbar" />
      <Navbar v-show="showNavbar" ref="navbar" />
      <main
        ref="main"
        :style="{ overflow: enableScrolling ? 'auto' : 'hidden' }"
        @scroll="handleScroll"
      >
        <keep-alive>
          <router-view v-if="$route.meta.keepAlive"></router-view>
        </keep-alive>
        <router-view v-if="!$route.meta.keepAlive"></router-view>
      </main>
      <transition name="slide-up">
        <Player v-if="enablePlayer" v-show="showPlayer" ref="player" />
      </transition>
      <ModalAddTrackToPlaylist v-if="isAccountLoggedIn" />
      <ModalNewPlaylist v-if="isAccountLoggedIn" />
      <ModalImportExternalPlaylist v-if="isAccountLoggedIn" />
      <ModalTrackComments v-if="enablePlayer" />
      <transition v-if="enablePlayer" name="slide-up">
        <Lyrics v-show="showLyrics" />
      </transition>
    </template>
    <Toast />
  </div>
</template>

<script>
import ModalAddTrackToPlaylist from './components/ModalAddTrackToPlaylist.vue';
import ModalNewPlaylist from './components/ModalNewPlaylist.vue';
import ModalImportExternalPlaylist from './components/ModalImportExternalPlaylist.vue';
import ModalTrackComments from './components/ModalTrackComments.vue';
import Scrollbar from './components/Scrollbar.vue';
import Navbar from './components/Navbar.vue';
import Player from './components/Player.vue';
import GameMode from './components/GameMode.vue';
import Toast from './components/Toast.vue';
import { ipcRenderer } from './electron/ipcRenderer';
import { isAccountLoggedIn, isLooseLoggedIn } from '@/utils/auth';
import { initLyricProvider } from '@/utils/lyricProvider';
import { initDesktopLyricBridge } from '@/utils/desktopLyric';
import Lyrics from './views/lyrics.vue';
import { mapState } from 'vuex';

export default {
  name: 'App',
  components: {
    Navbar,
    Player,
    GameMode,
    Toast,
    ModalAddTrackToPlaylist,
    ModalNewPlaylist,
    ModalImportExternalPlaylist,
    ModalTrackComments,
    Lyrics,
    Scrollbar,
  },
  data() {
    return {
      isElectron: process.env.IS_ELECTRON, // true || undefined
      userSelectNone: false,
    };
  },
  computed: {
    ...mapState(['showLyrics', 'settings', 'player', 'enableScrolling']),
    gameMode() {
      return this.settings.gameMode === true;
    },
    isAccountLoggedIn() {
      return isAccountLoggedIn();
    },
    showPlayer() {
      return (
        [
          'mv',
          'loginUsername',
          'login',
          'loginAccount',
          'lastfmCallback',
        ].includes(this.$route.name) === false
      );
    },
    enablePlayer() {
      return this.player.enabled && this.$route.name !== 'lastfmCallback';
    },
    showNavbar() {
      return this.$route.name !== 'lastfmCallback';
    },
  },
  watch: {
    gameMode(on) {
      // 歌词页在游戏模式下不渲染，但 showLyrics 还留在 store 里，
      // 不清掉的话退出游戏模式会直接弹回歌词页
      if (on && this.showLyrics) this.$store.commit('toggleLyrics');
      // 退出时把进游戏模式期间跳过的音乐库数据补回来
      if (!on) this.fetchData();
    },
  },
  created() {
    if (this.isElectron) ipcRenderer(this);
    // 歌词不再挂在歌词页上：游戏模式下整棵界面树都被 GameMode 换掉，
    // 而桌面歌词那时还得工作
    initLyricProvider();
    initDesktopLyricBridge();
    window.addEventListener('keydown', this.handleKeydown);
    this.fetchData();
  },
  methods: {
    handleKeydown(e) {
      if (e.code === 'Space') {
        if (e.target.tagName === 'INPUT') return false;
        if (this.$route.name === 'mv') return false;
        e.preventDefault();
        this.player.playOrPause();
      }
    },
    fetchData() {
      if (!isLooseLoggedIn()) return;
      // 喜欢的歌曲 ID 列表决定了播放界面上那颗心的状态，游戏模式下也要，所以留着；
      // 其余几个只喂音乐库页面，界面都拆了，没必要占游戏的带宽。
      this.$store.dispatch('fetchLikedSongs');
      if (this.gameMode) return;
      this.$store.dispatch('fetchLikedSongsWithDetails');
      this.$store.dispatch('fetchLikedPlaylist');
      if (isAccountLoggedIn()) {
        this.$store.dispatch('fetchLikedAlbums');
        this.$store.dispatch('fetchLikedArtists');
        this.$store.dispatch('fetchLikedMVs');
        this.$store.dispatch('fetchCloudDisk');
      }
    },
    handleScroll() {
      // 游戏模式下 Scrollbar 没有挂载，而 <main> 上的 scroll 监听在切换的
      // 那一帧还可能触发一次
      this.$refs.scrollbar?.handleScroll();
    },
  },
};
</script>

<style lang="scss">
#app {
  width: 100%;
  transition: all 0.4s;
}

main {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
  overflow: auto;
  padding: 64px 10vw 96px 10vw;
  box-sizing: border-box;
  scrollbar-width: none; // firefox
}

@media (max-width: 1336px) {
  main {
    padding: 64px 5vw 96px 5vw;
  }
}

main::-webkit-scrollbar {
  width: 0px;
}
</style>
