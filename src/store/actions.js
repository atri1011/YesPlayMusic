// import store, { state, dispatch, commit } from "@/store";
import { isAccountLoggedIn, isLooseLoggedIn } from '@/utils/auth';
import { likeATrack } from '@/api/track';
import { getPlaylistDetail } from '@/api/playlist';
import { getTrackDetail } from '@/api/track';
import {
  userPlaylist,
  userPlayHistory,
  userLikedSongsIDs,
  likedAlbums,
  likedArtists,
  likedMVs,
  cloudDisk,
  userAccount,
  userDetail,
} from '@/api/user';

export default {
  showToast({ state, commit }, text) {
    if (state.toast.timer !== null) {
      clearTimeout(state.toast.timer);
      commit('updateToast', { show: false, text: '', timer: null });
    }
    commit('updateToast', {
      show: true,
      text,
      timer: setTimeout(() => {
        commit('updateToast', {
          show: false,
          text: state.toast.text,
          timer: null,
        });
      }, 3200),
    });
  },
  likeATrack({ state, commit, dispatch }, id) {
    if (!isAccountLoggedIn()) {
      dispatch('showToast', '此操作需要登录网易云账号');
      return;
    }
    let like = true;
    if (state.liked.songs.includes(id)) like = false;
    likeATrack({ id, like })
      .then(() => {
        if (like === false) {
          commit('updateLikedXXX', {
            name: 'songs',
            data: state.liked.songs.filter(d => d !== id),
          });
        } else {
          let newLikeSongs = state.liked.songs;
          newLikeSongs.push(id);
          commit('updateLikedXXX', {
            name: 'songs',
            data: newLikeSongs,
          });
        }
        dispatch('fetchLikedSongsWithDetails');
      })
      .catch(() => {
        dispatch('showToast', '操作失败，专辑下架或版权锁定');
      });
  },
  fetchLikedSongs: ({ state, commit }) => {
    if (!isLooseLoggedIn()) return;
    if (isAccountLoggedIn()) {
      // /user/account 在某些会话状态下可能返回 profile=null，
      // 导致 state.data.user 被覆盖成 null。此处防御性读取 userId，
      // 避免后续 /likelist 请求因 uid 缺失而抛 TypeError。
      const userId = state.data.user?.userId;
      if (!userId) return;
      return userLikedSongsIDs({ uid: userId }).then(result => {
        if (result.ids) {
          commit('updateLikedXXX', {
            name: 'songs',
            data: result.ids,
          });
        }
      });
    } else {
      // TODO:搜索ID登录的用户
    }
  },
  fetchLikedSongsWithDetails: ({ state, commit }) => {
    // likedSongPlaylistID 可能尚未由 fetchLikedPlaylist 写入（例如登录后
    // user.userId 缺失导致 userPlaylist 失败）。此时不应调用
    // getPlaylistDetail(undefined)，否则返回无 playlist 字段，再读
    // result.playlist.trackIds 会抛 "Cannot read properties of undefined"。
    const playlistId = state.data.likedSongPlaylistID;
    if (!playlistId) {
      return Promise.resolve();
    }
    return getPlaylistDetail(playlistId, true).then(result => {
      const trackIds = result?.playlist?.trackIds;
      if (!trackIds || trackIds.length === 0) {
        // 歌单为空或接口未返回 playlist 时，直接清空详情，避免渲染旧数据。
        commit('updateLikedXXX', {
          name: 'songsWithDetails',
          data: [],
        });
        return;
      }
      return getTrackDetail(
        trackIds
          .slice(0, 12)
          .map(t => t.id)
          .join(',')
      ).then(detailResult => {
        commit('updateLikedXXX', {
          name: 'songsWithDetails',
          data: detailResult?.songs ?? [],
        });
      });
    });
  },
  fetchLikedPlaylist: ({ state, commit }) => {
    if (!isLooseLoggedIn()) return;
    if (isAccountLoggedIn()) {
      return userPlaylist({
        uid: state.data.user?.userId,
        limit: 2000, // 最多只加载2000个歌单（等有用户反馈问题再修）
        timestamp: new Date().getTime(),
      }).then(result => {
        if (result.playlist) {
          commit('updateLikedXXX', {
            name: 'playlists',
            data: result.playlist,
          });
          // 更新用户”喜欢的歌曲“歌单ID
          commit('updateData', {
            key: 'likedSongPlaylistID',
            value: result.playlist[0].id,
          });
        }
      });
    } else {
      // TODO:搜索ID登录的用户
    }
  },
  fetchLikedAlbums: ({ commit }) => {
    if (!isAccountLoggedIn()) return;
    return likedAlbums({ limit: 2000 }).then(result => {
      if (result.data) {
        commit('updateLikedXXX', {
          name: 'albums',
          data: result.data,
        });
      }
    });
  },
  fetchLikedArtists: ({ commit }) => {
    if (!isAccountLoggedIn()) return;
    return likedArtists({ limit: 2000 }).then(result => {
      if (result.data) {
        commit('updateLikedXXX', {
          name: 'artists',
          data: result.data,
        });
      }
    });
  },
  fetchLikedMVs: ({ commit }) => {
    if (!isAccountLoggedIn()) return;
    return likedMVs({ limit: 1000 }).then(result => {
      if (result.data) {
        commit('updateLikedXXX', {
          name: 'mvs',
          data: result.data,
        });
      }
    });
  },
  fetchCloudDisk: ({ commit }) => {
    if (!isAccountLoggedIn()) return;
    // FIXME: #1242
    return cloudDisk({ limit: 1000 }).then(result => {
      if (result.data) {
        commit('updateLikedXXX', {
          name: 'cloudDisk',
          data: result.data,
        });
      }
    });
  },
  fetchPlayHistory: ({ state, commit }) => {
    if (!isAccountLoggedIn()) return;
    return Promise.all([
      userPlayHistory({ uid: state.data.user?.userId, type: 0 }),
      userPlayHistory({ uid: state.data.user?.userId, type: 1 }),
    ]).then(result => {
      const data = {};
      const dataType = { 0: 'allData', 1: 'weekData' };
      if (result[0] && result[1]) {
        for (let i = 0; i < result.length; i++) {
          const songData = result[i][dataType[i]].map(item => {
            const song = item.song;
            song.playCount = item.playCount;
            return song;
          });
          data[[dataType[i]]] = songData;
        }
        commit('updateLikedXXX', {
          name: 'playHistory',
          data: data,
        });
      }
    });
  },
  fetchUserProfile: ({ commit }) => {
    if (!isAccountLoggedIn()) return;
    return userAccount().then(result => {
      if (result.code !== 200) return result;
      // 正常情况：profile 非空，直接写入。
      if (result.profile) {
        commit('updateData', { key: 'user', value: result.profile });
        return result;
      }
      // 部分账号（如新注册/未设置昵称）profile 为 null，
      // 但 account.id 仍是有效 userId。用 userDetail 兜底拿一份
      // 可用的用户对象，避免 state.data.user 为 null 导致后续
      // avatarUrl/userId 读取全部报错、音乐库整页空白。
      const accountId = result.account?.id ?? result.account?.userId;
      if (!accountId) return result;
      return userDetail(accountId).then(detailResult => {
        if (detailResult.code === 200 && detailResult.profile) {
          commit('updateData', {
            key: 'user',
            value: detailResult.profile,
          });
        }
        return detailResult;
      });
    });
  },
};
