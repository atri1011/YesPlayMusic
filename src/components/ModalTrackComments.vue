<template>
  <Modal
    class="track-comments-modal"
    :show="show"
    :close="close"
    :show-footer="false"
    :title="modalTitle"
    width="640px"
    min-width="calc(min(40rem, 100vw))"
  >
    <div class="track-comments">
      <div class="track-meta">
        <img
          :src="trackCover"
          loading="lazy"
          class="track-cover"
          @click="goToAlbum"
        />
        <div class="track-text">
          <div class="track-name">{{ track.name }}</div>
          <div class="track-artist">
            <span
              v-for="(ar, index) in track.ar"
              :key="ar.id"
              @click="ar.id && goToArtist(ar.id)"
              ><span :class="{ ar: ar.id }">{{ ar.name }}</span
              ><span v-if="index !== track.ar.length - 1">, </span></span
            >
          </div>
        </div>
        <div v-if="totalComments > 0" class="comment-count">
          {{ totalComments | formatPlayCount }} {{ $t('player.commentCount') }}
        </div>
      </div>

      <div class="sort-tabs">
        <button
          v-for="option in sortOptions"
          :key="option.value"
          :class="['sort-tab', { active: sortType === option.value }]"
          @click="switchSort(option.value)"
        >
          {{ $t(option.label) }}
        </button>
      </div>

      <div v-if="isAccountLoggedIn" class="comment-input">
        <img :src="userAvatar" class="user-avatar" loading="lazy" />
        <div class="input-wrap">
          <textarea
            ref="input"
            v-model="commentText"
            class="input"
            :placeholder="$t('player.commentPlaceholder')"
            rows="2"
            @keydown.enter.exact.prevent="submitComment"
          ></textarea>
          <div class="input-actions">
            <span v-if="replyTarget" class="reply-target">
              {{ $t('player.replyTo') }}{{ replyTarget.user.nickname }}
              <button class="cancel-reply" @click="cancelReply">×</button>
            </span>
            <button
              class="send-button"
              :disabled="!commentText.trim() || submitting"
              @click="submitComment"
              >{{ $t('player.sendComment') }}</button
            >
          </div>
        </div>
      </div>

      <div v-if="loading && comments.length === 0" class="loading">
        {{ $t('player.loadingComments') }}
      </div>

      <div v-else-if="comments.length === 0" class="empty">
        {{ $t('player.noComments') }}
      </div>

      <transition-group v-else name="comment-list" tag="div" class="comments">
        <div
          v-for="comment in comments"
          :key="comment.commentId"
          class="comment"
        >
          <img
            :src="comment.user.avatarUrl | resizeImage(128)"
            class="avatar"
            loading="lazy"
            @click="comment.user.userId && goToUser(comment.user.userId)"
          />
          <div class="body">
            <div class="head">
              <span class="nickname" @click="goToUser(comment.user.userId)">{{
                comment.user.nickname
              }}</span>
              <span class="time">{{
                comment.time | formatDate('YYYY-MM-DD')
              }}</span>
            </div>
            <div
              class="content"
              v-html="decorateContent(comment.content)"
            ></div>
            <div
              v-if="comment.beReplied && comment.beReplied.length"
              class="replied"
            >
              <span
                v-for="(rep, repIndex) in comment.beReplied.slice(0, 3)"
                :key="repIndex"
                class="reply-line"
              >
                <span class="reply-name">@{{ rep.user.nickname }}：</span
                >{{ rep.content }}
              </span>
              <span
                v-if="comment.beReplied.length > 3"
                class="reply-more"
                @click="toggleFloors(comment)"
                >{{ $t('player.viewFloors') }}（{{
                  comment.beReplied.length
                }}）</span
              >
            </div>
            <div class="actions">
              <button
                :class="[
                  'action',
                  'like',
                  { liked: likedSet.has(comment.commentId) },
                ]"
                @click="toggleLikeComment(comment)"
              >
                <svg-icon
                  :icon-class="
                    likedSet.has(comment.commentId) ? 'heart-solid' : 'heart'
                  "
                />
                <span v-if="comment.likedCount > 0" class="count">{{
                  comment.likedCount | formatPlayCount
                }}</span>
              </button>
              <button class="action reply" @click="startReply(comment)">
                <svg-icon icon-class="comment" />
                <span>{{ $t('player.reply') }}</span>
              </button>
            </div>

            <transition name="floor-list">
              <div v-if="floorsMap[comment.commentId]" class="floors">
                <div
                  v-for="floor in floorsMap[comment.commentId].list"
                  :key="floor.commentId"
                  class="floor"
                >
                  <img
                    :src="floor.user.avatarUrl | resizeImage(64)"
                    class="floor-avatar"
                    loading="lazy"
                  />
                  <div class="floor-body">
                    <div class="floor-head">
                      <span class="floor-nickname">{{
                        floor.user.nickname
                      }}</span>
                      <span class="floor-time">{{
                        floor.time | formatDate('YYYY-MM-DD')
                      }}</span>
                    </div>
                    <div class="floor-content">{{ floor.content }}</div>
                  </div>
                </div>
                <button
                  v-if="floorsMap[comment.commentId].hasMore"
                  class="load-floors"
                  :disabled="floorsMap[comment.commentId].loading"
                  @click="loadMoreFloors(comment)"
                  >{{ $t('player.loadMore') }}</button
                >
              </div>
            </transition>
          </div>
        </div>
      </transition-group>

      <div v-if="comments.length > 0" class="footer-actions">
        <button
          v-if="hasMore"
          class="load-more"
          :disabled="loading"
          @click="loadMore"
          >{{
            loading ? $t('player.loadingComments') : $t('player.loadMore')
          }}</button
        >
        <span v-else class="no-more">{{ $t('player.noMoreComments') }}</span>
      </div>
    </div>
  </Modal>
</template>

<script>
import { mapState, mapMutations, mapActions } from 'vuex';
import Modal from '@/components/Modal.vue';
import {
  getTrackComments,
  getCommentFloors,
  likeComment,
  submitTrackComment,
} from '@/api/comment';
import { isAccountLoggedIn } from '@/utils/auth';

const SORT_RECOMMENDED = 99;
const SORT_HOTTEST = 2;
const SORT_NEWEST = 3;

export default {
  name: 'ModalTrackComments',
  components: { Modal },
  data() {
    return {
      loading: false,
      submitting: false,
      comments: [],
      totalComments: 0,
      pageNo: 1,
      pageSize: 20,
      hasMore: true,
      cursor: '0',
      commentText: '',
      replyTarget: null,
      likedSet: new Set(),
      floorsMap: {},
      sortType: SORT_RECOMMENDED,
    };
  },
  computed: {
    ...mapState(['modals', 'player', 'data', 'settings']),
    show: {
      get() {
        return this.modals.trackCommentsModal.show;
      },
      set(value) {
        this.updateModal({
          modalName: 'trackCommentsModal',
          key: 'show',
          value,
        });
      },
    },
    track() {
      return this.player.currentTrack || {};
    },
    trackId() {
      return this.track.id;
    },
    trackCover() {
      const url = this.track.al?.picUrl;
      return url ? this.$options.filters.resizeImage(url, 224) : '';
    },
    userAvatar() {
      return this.data?.user?.avatarUrl
        ? this.$options.filters.resizeImage(this.data.user.avatarUrl, 128)
        : '';
    },
    isAccountLoggedIn() {
      return isAccountLoggedIn();
    },
    modalTitle() {
      return this.$t('player.comments');
    },
    sortOptions() {
      return [
        { value: SORT_RECOMMENDED, label: 'player.sortRecommended' },
        { value: SORT_HOTTEST, label: 'player.sortHottest' },
        { value: SORT_NEWEST, label: 'player.sortNewest' },
      ];
    },
  },
  watch: {
    show(value) {
      if (value && this.trackId) {
        this.resetAndFetch();
      } else if (!value) {
        this.resetState();
      }
    },
    trackId(newId, oldId) {
      if (this.show && newId && newId !== oldId) {
        this.resetAndFetch();
      }
    },
  },
  methods: {
    ...mapMutations(['updateModal']),
    ...mapActions(['showToast']),
    close() {
      this.show = false;
    },
    resetState() {
      this.comments = [];
      this.totalComments = 0;
      this.pageNo = 1;
      this.hasMore = true;
      this.cursor = '0';
      this.commentText = '';
      this.replyTarget = null;
      this.likedSet = new Set();
      this.floorsMap = {};
      this.sortType = SORT_RECOMMENDED;
    },
    resetAndFetch() {
      this.resetState();
      this.fetchComments();
    },
    fetchComments() {
      if (!this.trackId) return;
      this.loading = true;
      const params = {
        id: this.trackId,
        pageSize: this.pageSize,
        pageNo: this.pageNo,
        sortType: this.sortType,
      };
      if (this.sortType === SORT_NEWEST) {
        params.cursor = this.cursor;
      }
      getTrackComments(params)
        .then(data => {
          if (data.code === 200) {
            const newComments = data.data?.comments || [];
            if (this.pageNo === 1) {
              this.comments = newComments;
            } else {
              this.comments = this.comments.concat(newComments);
            }
            this.totalComments = data.data?.totalCount || 0;
            this.hasMore =
              data.data?.hasMore ?? newComments.length >= this.pageSize;
            if (this.sortType === SORT_NEWEST && newComments.length) {
              const last = newComments[newComments.length - 1];
              this.cursor = String(last.time || 0);
            }
            newComments.forEach(c => {
              if (c.liked) this.likedSet.add(c.commentId);
            });
          }
        })
        .catch(error => {
          console.error('Failed to fetch comments', error);
        })
        .finally(() => {
          this.loading = false;
        });
    },
    switchSort(value) {
      if (this.sortType === value) return;
      this.sortType = value;
      this.resetState();
      this.sortType = value;
      this.fetchComments();
    },
    loadMore() {
      if (!this.hasMore || this.loading) return;
      this.pageNo += 1;
      this.fetchComments();
    },
    toggleLikeComment(comment) {
      if (!this.isAccountLoggedIn) {
        this.showToast(this.$t('toast.needToLogin'));
        return;
      }
      const liked = this.likedSet.has(comment.commentId);
      const optimisticDelta = liked ? -1 : 1;
      if (liked) {
        this.likedSet.delete(comment.commentId);
        comment.likedCount = Math.max(0, (comment.likedCount || 0) - 1);
      } else {
        this.likedSet.add(comment.commentId);
        comment.likedCount = (comment.likedCount || 0) + 1;
      }
      likeComment({
        id: this.trackId,
        cid: comment.commentId,
        t: liked ? 0 : 1,
      }).catch(error => {
        // 回滚
        if (liked) {
          this.likedSet.add(comment.commentId);
          comment.likedCount -= optimisticDelta;
        } else {
          this.likedSet.delete(comment.commentId);
          comment.likedCount -= optimisticDelta;
        }
        console.error('Failed to like comment', error);
        this.showToast(this.$t('player.commentFailed'));
      });
    },
    startReply(comment) {
      if (!this.isAccountLoggedIn) {
        this.showToast(this.$t('toast.needToLogin'));
        return;
      }
      this.replyTarget = comment;
      this.commentText = '';
      this.$nextTick(() => this.$refs.input?.focus());
    },
    cancelReply() {
      this.replyTarget = null;
      this.commentText = '';
    },
    submitComment() {
      const content = this.commentText.trim();
      if (!content || this.submitting) return;
      if (!this.isAccountLoggedIn) {
        this.showToast(this.$t('toast.needToLogin'));
        return;
      }
      this.submitting = true;
      const params = {
        id: this.trackId,
        t: this.replyTarget ? 2 : 1,
        content,
      };
      if (this.replyTarget) {
        params.commentId = this.replyTarget.commentId;
      }
      submitTrackComment(params)
        .then(data => {
          if (data.code === 200) {
            this.showToast(this.$t('player.commentSuccess'));
            this.commentText = '';
            this.replyTarget = null;
            // 刷新首页
            this.pageNo = 1;
            this.fetchComments();
          } else {
            this.showToast(data.msg || this.$t('player.commentFailed'));
          }
        })
        .catch(error => {
          console.error('Failed to submit comment', error);
          this.showToast(this.$t('player.commentFailed'));
        })
        .finally(() => {
          this.submitting = false;
        });
    },
    toggleFloors(comment) {
      const existing = this.floorsMap[comment.commentId];
      if (existing) {
        this.$delete(this.floorsMap, comment.commentId);
        return;
      }
      this.$set(this.floorsMap, comment.commentId, {
        list: comment.beReplied.slice(0, 3),
        hasMore: comment.beReplied.length > 3,
        loading: false,
        time: -1,
      });
      if (comment.beReplied.length > 3) {
        this.loadMoreFloors(comment);
      }
    },
    loadMoreFloors(comment) {
      const state = this.floorsMap[comment.commentId];
      if (!state || state.loading) return;
      state.loading = true;
      getCommentFloors({
        id: this.trackId,
        parentCommentId: comment.commentId,
        time: state.time,
      })
        .then(data => {
          if (data.code === 200) {
            const floors = data.data?.comments || [];
            state.list = state.list.concat(floors);
            state.hasMore = data.data?.hasMore ?? false;
            if (floors.length) {
              state.time = floors[floors.length - 1].time;
            }
          }
        })
        .catch(error => {
          console.error('Failed to fetch floors', error);
        })
        .finally(() => {
          state.loading = false;
        });
    },
    decorateContent(content) {
      if (!content) return '';
      // 转义 HTML，避免注入
      const escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      // 网易云链接高亮
      return escaped.replace(
        /(@[^\s@]+)|(\bhttps?:\/\/\S+\b)/g,
        match => `<span class="content-link">${match}</span>`
      );
    },
    goToAlbum() {
      const albumId = this.track.al?.id;
      if (albumId) {
        this.show = false;
        this.$router.push({ path: '/album/' + albumId });
      }
    },
    goToArtist(id) {
      if (!id) return;
      this.show = false;
      this.$router.push({ path: '/artist/' + id });
    },
    goToUser(userId) {
      if (!userId) return;
      this.show = false;
      this.$router.push({ path: '/user/' + userId });
    },
  },
};
</script>

<style lang="scss" scoped>
.track-comments {
  display: flex;
  flex-direction: column;
  min-height: 240px;
}

.track-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 16px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.18);
  margin-bottom: 16px;

  .track-cover {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    box-shadow: 0 4px 10px -2px rgba(0, 0, 0, 0.12);
    cursor: pointer;
    object-fit: cover;
    transition: transform 0.28s var(--ease-out-quint);
    &:hover {
      transform: scale(1.04);
    }
  }
  .track-text {
    flex: 1;
    min-width: 0;
    .track-name {
      font-weight: 600;
      font-size: 15px;
      color: var(--color-text);
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
    }
    .track-artist {
      font-size: 12px;
      opacity: 0.62;
      margin-top: 2px;
      color: var(--color-text);
      .ar {
        cursor: pointer;
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
  .comment-count {
    font-size: 12px;
    opacity: 0.58;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
  }
}

.sort-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  .sort-tab {
    padding: 4px 12px;
    border-radius: 999px;
    background: transparent;
    color: var(--color-text);
    opacity: 0.58;
    font-size: 13px;
    border: 1px solid transparent;
    transition: all 0.2s var(--ease-out-quart);
    &:hover {
      opacity: 0.88;
      background: var(--color-secondary-bg-for-transparent);
    }
    &.active {
      opacity: 1;
      background: var(--color-primary-bg);
      color: var(--color-primary);
      border-color: transparent;
      font-weight: 600;
    }
  }
}

.comment-input {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .input-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--color-secondary-bg);
    border-radius: 12px;
    padding: 10px 12px;
    transition: background 0.2s var(--ease-out-quart);
    &:focus-within {
      background: var(--color-secondary-bg-for-transparent);
    }
  }
  .input {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    color: var(--color-text);
    font-size: 13px;
    font-family: inherit;
    line-height: 1.6;
    &::placeholder {
      opacity: 0.5;
    }
  }
  .input-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }
  .reply-target {
    margin-right: auto;
    font-size: 12px;
    color: var(--color-primary);
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cancel-reply {
    background: transparent;
    border: none;
    color: var(--color-text);
    opacity: 0.6;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 2px;
    border-radius: 50%;
    &:hover {
      opacity: 1;
      background: var(--color-secondary-bg-for-transparent);
    }
  }
  .send-button {
    padding: 5px 14px;
    border-radius: 8px;
    background: var(--color-primary-gradient);
    color: var(--color-primary-bg);
    border: none;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.12s var(--ease-out-quint),
      opacity 0.2s var(--ease-out-quart);
    &:hover:not(:disabled) {
      transform: translateY(-1px);
    }
    &:active:not(:disabled) {
      transform: scale(0.96);
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.loading,
.empty {
  text-align: center;
  padding: 48px 0;
  color: var(--color-text);
  opacity: 0.5;
  font-size: 13px;
}

.comments {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.comment {
  display: flex;
  gap: 12px;
  padding: 12px 4px;
  border-radius: 8px;
  transition: background 0.2s var(--ease-out-quart);
  &:hover {
    background: var(--color-secondary-bg-for-transparent);
    .actions {
      opacity: 1;
    }
  }
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    cursor: pointer;
    transition: transform 0.24s var(--ease-out-quint);
    &:hover {
      transform: scale(1.06);
    }
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
    .nickname {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text);
      opacity: 0.88;
      cursor: pointer;
      &:hover {
        text-decoration: underline;
      }
    }
    .time {
      font-size: 11px;
      opacity: 0.5;
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
    }
  }
  .content {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text);
    opacity: 0.92;
    word-break: break-word;
    white-space: pre-wrap;
    ::v-deep .content-link {
      color: var(--color-primary);
      cursor: pointer;
    }
  }
  .replied {
    margin-top: 8px;
    padding: 8px 12px;
    background: var(--color-secondary-bg);
    border-radius: 8px;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    .reply-line {
      opacity: 0.72;
      color: var(--color-text);
      line-height: 1.5;
      word-break: break-word;
    }
    .reply-name {
      color: var(--color-primary);
      font-weight: 500;
    }
    .reply-more {
      color: var(--color-primary);
      cursor: pointer;
      opacity: 0.9;
      font-size: 12px;
      &:hover {
        opacity: 1;
        text-decoration: underline;
      }
    }
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 6px;
    opacity: 0.55;
    transition: opacity 0.2s var(--ease-out-quart);
  }
  .action {
    display: flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: var(--color-text);
    font-size: 12px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 6px;
    transition: color 0.2s var(--ease-out-quart),
      background 0.2s var(--ease-out-quart);
    .svg-icon {
      width: 14px;
      height: 14px;
    }
    &:hover {
      color: var(--color-primary);
      background: var(--color-primary-bg);
    }
    &.like.liked {
      color: var(--color-primary);
    }
    .count {
      font-variant-numeric: tabular-nums;
    }
  }
}

.floors {
  margin-top: 8px;
  padding: 8px 12px 4px;
  background: var(--color-secondary-bg);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  .floor {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .floor-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
  }
  .floor-body {
    flex: 1;
    min-width: 0;
  }
  .floor-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 2px;
    .floor-nickname {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text);
      opacity: 0.82;
    }
    .floor-time {
      font-size: 10px;
      opacity: 0.5;
      color: var(--color-text);
    }
  }
  .floor-content {
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text);
    opacity: 0.88;
    word-break: break-word;
  }
  .load-floors {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: var(--color-primary);
    font-size: 12px;
    cursor: pointer;
    padding: 4px 0;
    &:hover {
      text-decoration: underline;
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.footer-actions {
  display: flex;
  justify-content: center;
  padding: 20px 0 8px;
  .load-more {
    background: var(--color-secondary-bg);
    color: var(--color-text);
    border: none;
    border-radius: 999px;
    padding: 8px 24px;
    font-size: 13px;
    cursor: pointer;
    transition: transform 0.12s var(--ease-out-quint),
      background 0.2s var(--ease-out-quart);
    &:hover:not(:disabled) {
      background: var(--color-secondary-bg-for-transparent);
      transform: translateY(-1px);
    }
    &:active:not(:disabled) {
      transform: scale(0.97);
    }
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
  .no-more {
    font-size: 12px;
    opacity: 0.5;
    color: var(--color-text);
  }
}

// 过渡
.comment-list-enter-active,
.comment-list-leave-active {
  transition: opacity 0.24s var(--ease-out-quart),
    transform 0.24s var(--ease-out-quart);
}
.comment-list-enter,
.comment-list-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.floor-list-enter-active,
.floor-list-leave-active {
  transition: opacity 0.2s var(--ease-out-quart),
    max-height 0.24s var(--ease-out-quart);
  overflow: hidden;
}
.floor-list-enter,
.floor-list-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
