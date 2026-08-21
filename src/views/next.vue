<template>
  <div class="next-tracks">
    <h1>{{ $t('next.nowPlaying') }}</h1>
    <TrackList
      :tracks="[currentTrack]"
      type="playlist"
      dbclick-track-func="none"
    />
    <h1 v-show="playNextList.length > 0"
      >插队播放
      <button @click="player.clearPlayNextList()">清除队列</button>
    </h1>
    <TrackList
      v-show="playNextList.length > 0"
      :tracks="playNextTracks"
      type="playlist"
      :highlight-playing-track="false"
      dbclick-track-func="playTrackOnListByID"
      item-key="id+index"
      :extra-context-menu-item="['removeTrackFromQueue']"
    />
    <h1>{{ $t('next.nextUp') }}</h1>
    <TrackList
      :tracks="filteredTracks"
      type="playlist"
      :highlight-playing-track="false"
      dbclick-track-func="playTrackOnListByID"
    />

    <h1 v-show="similarTracks.length > 0"
      >{{ $t('next.similarSongs') }}
      <button @click="addSimilarTracksToQueue">{{
        $t('next.addAllToQueue')
      }}</button>
    </h1>
    <TrackList
      v-show="similarTracks.length > 0"
      :tracks="similarTracks"
      type="playlist"
      :highlight-playing-track="false"
      dbclick-track-func="playNext"
    />

    <h1 v-show="similarPlaylists.length > 0">{{
      $t('next.similarPlaylists')
    }}</h1>
    <CoverRow
      v-show="similarPlaylists.length > 0"
      :items="similarPlaylists"
      type="playlist"
      sub-text="creator"
      :show-play-button="true"
    />
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { getTrackDetail, simiSongs } from '@/api/track';
import { simiPlaylists } from '@/api/playlist';
import TrackList from '@/components/TrackList.vue';
import CoverRow from '@/components/CoverRow.vue';

export default {
  name: 'Next',
  components: {
    TrackList,
    CoverRow,
  },
  data() {
    return {
      tracks: [],
      similarTracks: [],
      similarPlaylists: [],
      // 已经取过相似推荐的歌曲 id，避免重复请求与响应乱序覆盖
      similarLoadedFor: 0,
    };
  },
  computed: {
    ...mapState(['player']),
    currentTrack() {
      return this.player.currentTrack;
    },
    playerShuffle() {
      return this.player.shuffle;
    },
    filteredTracks() {
      let trackIDs = this.player.list.slice(
        this.player.current + 1,
        this.player.current + 100
      );
      return trackIDs
        .map(tid => this.tracks.find(t => t.id === tid))
        .filter(t => t);
    },
    playNextList() {
      return this.player.playNextList;
    },
    playNextTracks() {
      return this.playNextList.map(tid => {
        return this.tracks.find(t => t.id === tid);
      });
    },
  },
  watch: {
    currentTrack() {
      this.loadTracks();
      this.loadSimilar();
    },
    playerShuffle() {
      this.loadTracks();
    },
    playNextList() {
      this.loadTracks();
    },
  },
  activated() {
    this.loadTracks();
    this.loadSimilar();
    this.$parent.$refs.scrollbar.restorePosition();
  },
  methods: {
    ...mapActions(['playTrackOnListByID']),
    loadTracks() {
      // 获取播放列表当前歌曲后100首歌
      let trackIDs = this.player.list.slice(
        this.player.current + 1,
        this.player.current + 100
      );

      // 将playNextList的歌曲加进trackIDs
      trackIDs.push(...this.playNextList);

      // 获取已经加载了的歌曲
      let loadedTrackIDs = this.tracks.map(t => t.id);

      if (trackIDs.length > 0) {
        getTrackDetail(trackIDs.join(',')).then(data => {
          let newTracks = data.songs.filter(
            t => !loadedTrackIDs.includes(t.id)
          );
          this.tracks.push(...newTracks);
        });
      }
    },
    /**
     * 拉取当前歌曲的相似歌曲与相似歌单。
     * 推荐区拉不到内容不应影响播放队列的展示，因此错误只做静默处理。
     */
    loadSimilar() {
      const trackID = this.currentTrack?.id;
      if (!trackID || trackID === this.similarLoadedFor) return;
      this.similarLoadedFor = trackID;
      this.similarTracks = [];
      this.similarPlaylists = [];

      simiSongs(trackID, 12)
        .then(data => {
          const ids = (data?.songs ?? []).map(song => song.id);
          // 相似歌曲接口返回的是旧版歌曲结构（artists / album），
          // TrackList 需要 ar / al，这里再换一次详情
          if (ids.length === 0) return;
          return getTrackDetail(ids.join(',')).then(detail => {
            if (this.similarLoadedFor !== trackID) return;
            this.similarTracks = (detail?.songs ?? []).filter(Boolean);
          });
        })
        .catch(err => {
          console.error('[next] simiSongs failed:', err);
        });

      simiPlaylists(trackID, 10)
        .then(data => {
          if (this.similarLoadedFor !== trackID) return;
          this.similarPlaylists = data?.playlists ?? [];
        })
        .catch(err => {
          console.error('[next] simiPlaylists failed:', err);
        });
    },
    addSimilarTracksToQueue() {
      this.similarTracks.forEach(track => {
        this.player.addTrackToPlayNext(track.id);
      });
    },
  },
};
</script>

<style lang="scss" scoped>
h1 {
  margin-top: 36px;
  margin-bottom: 18px;
  cursor: default;
  animation: hero-title-enter 0.5s var(--ease-out-expo) both;
  color: var(--color-text);
  display: flex;
  justify-content: space-between;
  button {
    color: var(--color-text);
    border-radius: 8px;
    padding: 0 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: 0.2s;
    opacity: 0.68;
    font-weight: 500;
    &:hover {
      opacity: 1;
      background: var(--color-secondary-bg);
    }
    &:active {
      opacity: 1;
      transform: scale(0.92);
    }
  }
}
</style>
