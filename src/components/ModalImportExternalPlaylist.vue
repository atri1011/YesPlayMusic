<template>
  <Modal
    class="import-playlist-modal"
    :show="show"
    :close="close"
    :title="$t('library.importExternalPlaylist')"
    width="40vw"
  >
    <template slot="default">
      <div class="platform-row">
        <button
          v-for="adapter in platformAdapters"
          :key="adapter.id"
          class="platform-chip"
          :class="{ active: selectedPlatform === adapter.id }"
          @click="selectPlatform(adapter.id)"
        >
          <svg-icon :icon-class="adapter.iconClass" class="platform-icon" />
          <span class="platform-label">{{ adapter.label }}</span>
        </button>
      </div>

      <div v-if="selectedAdapter" class="hint">
        {{ selectedAdapter.placeholder }}
      </div>

      <textarea
        v-model="rawInput"
        class="raw-input"
        :placeholder="selectedAdapter ? selectedAdapter.placeholder : ''"
        rows="6"
      ></textarea>

      <div class="playlist-name-row">
        <input
          v-model="playlistName"
          type="text"
          class="playlist-name-input"
          :placeholder="$t('library.importPlaylistNamePlaceholder')"
          maxlength="40"
        />
      </div>

      <div v-if="parsedPlaylist" class="parsed-summary">
        <div class="summary-title">
          {{ $t('library.importParsedTitle') }}：{{ parsedPlaylist.title }}
        </div>
        <div class="summary-count">
          {{
            $t('library.importParsedCount', {
              count: parsedPlaylist.tracks.length,
            })
          }}
        </div>
        <div class="track-preview">
          <div
            v-for="(track, index) in parsedPlaylist.tracks.slice(0, 5)"
            :key="index"
            class="track-line"
          >
            <span class="track-name">{{ track.name }}</span>
            <span v-if="track.artist" class="track-artist">
              — {{ track.artist }}</span
            >
          </div>
          <div v-if="parsedPlaylist.tracks.length > 5" class="track-more">
            {{
              $t('library.importMoreTracks', {
                count: parsedPlaylist.tracks.length - 5,
              })
            }}
          </div>
        </div>
      </div>

      <div v-if="importProgress.total > 0" class="progress-row">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
        <div class="progress-text">
          {{
            $t('library.importMatchingProgress', {
              matched: importProgress.matched,
              total: importProgress.total,
            })
          }}
        </div>
      </div>
    </template>
    <template slot="footer">
      <button class="ghost" @click="close">
        {{ $t('modal.close') }}
      </button>
      <button class="primary" :disabled="isWorking" @click="runParse">
        {{ $t('library.importParseButton') }}
      </button>
      <button
        class="primary"
        :disabled="isWorking || !parsedPlaylist"
        @click="runImport"
      >
        {{ $t('library.importConfirmButton') }}
      </button>
    </template>
  </Modal>
</template>

<script>
import Modal from '@/components/Modal.vue';
import SvgIcon from '@/components/SvgIcon.vue';
import locale from '@/locale';
import { mapMutations, mapState, mapActions } from 'vuex';
import { platformAdapters } from '@/utils/externalPlaylistImport';
import { createPlaylist, addOrRemoveTrackFromPlaylist } from '@/api/playlist';
import { search } from '@/api/others';
import { isAccountLoggedIn } from '@/utils/auth';

export default {
  name: 'ModalImportExternalPlaylist',
  components: {
    Modal,
    SvgIcon,
  },
  data() {
    return {
      rawInput: '',
      playlistName: '',
      selectedPlatform: 'netease',
      parsedPlaylist: null,
      isWorking: false,
      importProgress: {
        matched: 0,
        total: 0,
      },
    };
  },
  computed: {
    ...mapState(['modals']),
    platformAdapters() {
      return platformAdapters;
    },
    show: {
      get() {
        return this.modals.importExternalPlaylistModal.show;
      },
      set(value) {
        this.updateModal({
          modalName: 'importExternalPlaylistModal',
          key: 'show',
          value,
        });
        if (!value) {
          this.$store.commit('enableScrolling', true);
        } else {
          this.$store.commit('enableScrolling', false);
        }
      },
    },
    selectedAdapter() {
      return platformAdapters.find(a => a.id === this.selectedPlatform);
    },
    progressPercent() {
      if (this.importProgress.total === 0) return 0;
      return Math.round(
        (this.importProgress.matched / this.importProgress.total) * 100
      );
    },
  },
  methods: {
    ...mapMutations(['updateModal', 'updateData']),
    ...mapActions(['showToast', 'fetchLikedPlaylist']),
    close() {
      this.show = false;
      this.resetState();
    },
    resetState() {
      this.rawInput = '';
      this.playlistName = '';
      this.parsedPlaylist = null;
      this.isWorking = false;
      this.importProgress = { matched: 0, total: 0 };
    },
    selectPlatform(id) {
      this.selectedPlatform = id;
      this.parsedPlaylist = null;
    },
    async runParse() {
      if (!this.selectedAdapter) return;
      if (!this.rawInput.trim()) {
        this.showToast(this.$t('library.importEmptyInput'));
        return;
      }
      this.isWorking = true;
      this.parsedPlaylist = null;
      try {
        const playlist = await this.selectedAdapter.parse(this.rawInput);
        this.parsedPlaylist = playlist;
        if (!this.playlistName) {
          this.playlistName = playlist.title;
        }
      } catch (error) {
        this.showToast(error.message || String(error));
      } finally {
        this.isWorking = false;
      }
    },
    async runImport() {
      if (!isAccountLoggedIn()) {
        this.showToast(locale.t('toast.needToLogin'));
        return;
      }
      if (!this.parsedPlaylist || this.parsedPlaylist.tracks.length === 0) {
        this.showToast(this.$t('library.importNoTracks'));
        return;
      }
      this.isWorking = true;
      this.importProgress = {
        matched: 0,
        total: this.parsedPlaylist.tracks.length,
      };

      try {
        const playlistName = this.playlistName || this.parsedPlaylist.title;
        const createResult = await createPlaylist({ name: playlistName });
        if (createResult.code !== 200 || !createResult.id) {
          this.showToast(this.$t('library.importCreateFailed'));
          return;
        }
        const newPlaylistId = createResult.id;
        const matchedTrackIds = [];

        for (const track of this.parsedPlaylist.tracks) {
          // 已经带网易云 ID 的曲目（例如网易云自身导入）可直接使用。
          if (track.neteaseId) {
            matchedTrackIds.push(track.neteaseId);
            this.importProgress.matched++;
            continue;
          }
          const keyword = `${track.name} ${track.artist}`.trim();
          if (!keyword) continue;
          try {
            const searchResult = await search({
              keywords: keyword,
              limit: 1,
              type: 1,
            });
            const song =
              searchResult?.result?.songs?.[0] ||
              searchResult?.result?.song?.songs?.[0];
            if (song) {
              // 粗略校验：名称需与原曲名接近，避免误匹配。
              const candidateName = song.name.toLowerCase();
              const originalName = track.name.toLowerCase();
              if (
                candidateName.includes(originalName) ||
                originalName.includes(candidateName)
              ) {
                matchedTrackIds.push(song.id);
              }
            }
          } catch (searchError) {
            // 搜索失败则跳过该曲，继续处理后续曲目，保证整体流程不被中断。
          }
          this.importProgress.matched++;
        }

        // 分批加入歌单，网易云单次 add 最多 10 首。
        if (matchedTrackIds.length > 0) {
          const batchSize = 10;
          for (let i = 0; i < matchedTrackIds.length; i += batchSize) {
            const batch = matchedTrackIds.slice(i, i + batchSize);
            try {
              await addOrRemoveTrackFromPlaylist({
                op: 'add',
                pid: newPlaylistId,
                tracks: batch.join(','),
              });
            } catch (batchError) {
              // 批次失败不中断，保留已成功添加的曲目。
            }
          }
        }

        this.updateData({ key: 'libraryPlaylistFilter', value: 'mine' });
        this.fetchLikedPlaylist();
        this.showToast(
          this.$t('library.importSuccess', {
            matched: matchedTrackIds.length,
            total: this.parsedPlaylist.tracks.length,
          })
        );
        this.close();
      } catch (error) {
        this.showToast(error.message || String(error));
      } finally {
        this.isWorking = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.import-playlist-modal {
  .content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .platform-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .platform-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid rgba(128, 128, 128, 0.2);
    background: var(--color-secondary-bg-for-transparent);
    color: var(--color-text);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    &:hover {
      border-color: var(--color-primary);
      opacity: 0.9;
    }
    &.active {
      background: var(--color-primary-gradient);
      color: var(--color-primary-bg);
      border-color: transparent;
      font-weight: 600;
      .platform-icon {
        color: var(--color-primary-bg);
      }
    }
    .platform-icon {
      width: 16px;
      height: 16px;
      color: var(--color-primary);
    }
  }
  .hint {
    font-size: 12px;
    color: var(--color-text);
    opacity: 0.65;
  }
  .raw-input,
  .playlist-name-input {
    width: calc(100% - 24px);
    background: var(--color-secondary-bg-for-transparent);
    font-size: 14px;
    border: none;
    font-weight: 600;
    padding: 10px 12px;
    border-radius: 8px;
    color: var(--color-text);
    resize: vertical;
    font-family: inherit;
    box-sizing: content-box;
    &:focus {
      background: var(--color-primary-bg-for-transparent);
      outline: none;
    }
  }
  .playlist-name-row {
    display: flex;
  }
  .parsed-summary {
    background: var(--color-secondary-bg-for-transparent);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    .summary-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    .summary-count {
      opacity: 0.75;
      margin-bottom: 8px;
    }
    .track-preview {
      display: flex;
      flex-direction: column;
      gap: 4px;
      .track-line {
        font-size: 12px;
        opacity: 0.85;
      }
      .track-more {
        font-size: 12px;
        opacity: 0.65;
        margin-top: 4px;
      }
    }
  }
  .progress-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    .progress-bar {
      height: 6px;
      width: 100%;
      background: var(--color-secondary-bg-for-transparent);
      border-radius: 999px;
      overflow: hidden;
      .progress-fill {
        height: 100%;
        background: var(--color-primary-gradient);
        transition: width 0.3s ease;
      }
    }
    .progress-text {
      font-size: 12px;
      opacity: 0.75;
    }
  }
  .footer {
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.ghost {
      background: var(--color-secondary-bg-for-transparent);
      color: var(--color-text);
    }
  }
}
</style>
