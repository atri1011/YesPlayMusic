import request from '@/utils/request';

// NeteaseCloudMusicApiEnhanced util/config.json: 歌曲资源前缀为 R_SO_4_
const TRACK_RESOURCE_PREFIX = 'R_SO_4_';

/**
 * 获取歌曲评论（新版接口 /comment/new）
 * 说明 : 调用此接口 , 传入歌曲 id, 可获得该歌曲的评论列表（推荐排序 / 热度排序 / 时间排序）
 * 对应 NeteaseCloudMusicApiEnhanced module/comment_new.js
 * @param {Object} params
 * @param {number} params.id - 歌曲 id
 * @param {number=} [params.pageSize=20] - 每页评论数
 * @param {number=} [params.pageNo=1] - 页码（从 1 开始）
 * @param {number=} [params.sortType=99] - 99:推荐排序, 2:按热度排序, 3:按时间排序
 * @param {string=} [params.cursor] - 当 sortType=3 时分页游标（首页传 '0'）
 */
export function getTrackComments(params) {
  const { id, pageSize = 20, pageNo = 1, sortType = 99, cursor } = params;
  return request({
    url: '/comment/new',
    method: 'get',
    params: {
      type: 0, // 0 = 歌曲，对应 R_SO_4_
      id,
      pageSize,
      pageNo,
      sortType,
      cursor,
      timestamp: new Date().getTime(),
    },
  });
}

/**
 * 获取歌曲评论（旧版接口 /comment/music，按 offset 分页）
 * 说明 : 调用此接口 , 传入歌曲 id, 可获得该歌曲的评论列表
 * 对应 NeteaseCloudMusicApiEnhanced module/comment_music.js
 * 一般作为 /comment/new 的降级备份使用
 * @param {Object} params
 * @param {number} params.id - 歌曲 id
 * @param {number=} [params.limit=20] - 每页评论数
 * @param {number=} [params.offset=0] - 偏移量
 * @param {number=} [params.before=0] - 上一页最后一条评论的 time
 */
export function getTrackCommentsLegacy(params) {
  const { id, limit = 20, offset = 0, before = 0 } = params;
  return request({
    url: '/comment/music',
    method: 'get',
    params: {
      id,
      limit,
      offset,
      before,
      timestamp: new Date().getTime(),
    },
  });
}

/**
 * 获取楼中评论（回复列表）
 * 对应 NeteaseCloudMusicApiEnhanced module/comment_floor.js
 * @param {Object} params
 * @param {number} params.id - 歌曲 id
 * @param {number} params.parentCommentId - 主评论 id
 * @param {number=} [params.time=-1] - 分页时间游标
 * @param {number=} [params.limit=20]
 */
export function getCommentFloors(params) {
  const { id, parentCommentId, time = -1, limit = 20 } = params;
  return request({
    url: '/comment/floor',
    method: 'get',
    params: {
      type: 0,
      id,
      parentCommentId,
      time,
      limit,
      timestamp: new Date().getTime(),
    },
  });
}

/**
 * 点赞 / 取消点赞评论
 * 对应 NeteaseCloudMusicApiEnhanced module/comment_like.js
 * @param {Object} params
 * @param {number} params.id - 歌曲 id
 * @param {number} params.cid - 评论 id
 * @param {number} params.t - 1: 点赞, 0: 取消点赞
 */
export function likeComment(params) {
  const { id, cid, t } = params;
  return request({
    url: '/comment/like',
    method: 'get',
    params: {
      type: 0,
      id,
      cid,
      t,
      timestamp: new Date().getTime(),
    },
  });
}

/**
 * 发送 / 回复 / 删除评论
 * 对应 NeteaseCloudMusicApiEnhanced module/comment.js
 * @param {Object} params
 * @param {number} params.id - 歌曲 id
 * @param {number} params.t - 1: 发送, 2: 回复, 0: 删除
 * @param {string=} [params.content] - 评论内容（发送/回复时必填）
 * @param {number=} [params.commentId] - 回复或删除的目标评论 id
 */
export function submitTrackComment(params) {
  const { id, t, content, commentId } = params;
  return request({
    url: '/comment',
    method: 'get',
    params: {
      type: 0,
      id,
      t,
      content,
      commentId,
      timestamp: new Date().getTime(),
    },
  });
}

export { TRACK_RESOURCE_PREFIX };
