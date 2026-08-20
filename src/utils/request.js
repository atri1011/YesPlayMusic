import router from '@/router';
import { doLogout, getCookie } from '@/utils/auth';
import axios from 'axios';

let baseURL = '';
// Web 和 Electron 跑在不同端口避免同时启动时冲突
if (process.env.IS_ELECTRON) {
  if (process.env.NODE_ENV === 'production') {
    // Express 桥（src/background.js）在 Electron 生产环境固定监听
    // http://127.0.0.1:27232，并把 /api 代理到内嵌 NCM API（端口 10754）。
    //
    // 不直接读取 process.env.VUE_APP_ELECTRON_API_URL，原因：
    // 在 Git Bash (MSYS) 下执行 electron:build 时，shell 会把以 "/" 开头的
    // 值（如 "/api"）自动改写成本地路径（如 "C:/Program Files/Git/api"），
    // 再被 webpack DefinePlugin 内联进产物，导致渲染进程所有 axios 请求
    // 解析到文件系统（ERR_FILE_NOT_FOUND），首页/发现/音乐库全部加载失败。
    // 这里改为硬编码绝对地址，彻底规避 MSYS 路径改写。
    baseURL = 'http://127.0.0.1:27232/api';
  } else {
    baseURL = process.env.VUE_APP_ELECTRON_API_URL_DEV;
  }
} else {
  baseURL = process.env.VUE_APP_NETEASE_API_URL;
}

const service = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
});

service.interceptors.request.use(function (config) {
  if (!config.params) config.params = {};
  if (baseURL.length) {
    // 当 baseURL 是绝对地址（如 Electron 生产环境 http://127.0.0.1:27232/api，
    // 或 web 部署到独立 API 域名）时，页面 origin 与 API host 不一致，
    // 浏览器 host-only cookie 不会被 withCredentials 自动携带。
    // 此时统一通过 query 参数 cookie 显式传递 MUSIC_U，NCM API 会从 query 读取。
    // 注意：Electron 生产环境页面加载自 http://localhost:27232，而 baseURL 是
    // http://127.0.0.1:27232/api —— localhost 与 127.0.0.1 被浏览器视为不同 host，
    // cookie 无法跨 host 共享，因此 Electron 也必须走 params.cookie 注入路径。
    if (baseURL[0] !== '/' && getCookie('MUSIC_U') !== null) {
      config.params.cookie = `MUSIC_U=${getCookie('MUSIC_U')};`;
    }
  } else {
    console.error("You must set up the baseURL in the service's config");
  }

  if (!process.env.IS_ELECTRON && !config.url.includes('/login')) {
    config.params.realIP = '211.161.244.70';
  }

  // Force real_ip
  const enableRealIP = JSON.parse(
    localStorage.getItem('settings')
  ).enableRealIP;
  const realIP = JSON.parse(localStorage.getItem('settings')).realIP;
  if (process.env.VUE_APP_REAL_IP) {
    config.params.realIP = process.env.VUE_APP_REAL_IP;
  } else if (enableRealIP) {
    config.params.realIP = realIP;
  }

  const proxy = JSON.parse(localStorage.getItem('settings')).proxyConfig;
  if (['HTTP', 'HTTPS'].includes(proxy.protocol)) {
    config.params.proxy = `${proxy.protocol}://${proxy.server}:${proxy.port}`;
  }

  return config;
});

service.interceptors.response.use(
  response => {
    const res = response.data;
    return res;
  },
  async error => {
    /** @type {import('axios').AxiosResponse | null} */
    let response;
    let data;
    if (error === 'TypeError: baseURL is undefined') {
      response = error;
      data = error;
      console.error("You must set up the baseURL in the service's config");
    } else if (error.response) {
      response = error.response;
      data = response.data;
    }

    if (
      response &&
      typeof data === 'object' &&
      data.code === 301 &&
      data.msg === '需要登录'
    ) {
      console.warn('Token has expired. Logout now!');

      // 登出帳戶
      doLogout();

      // 導向登入頁面
      if (process.env.IS_ELECTRON === true) {
        router.push({ name: 'loginAccount' });
      } else {
        router.push({ name: 'login' });
      }
    }

    // 关键：必须把 error 继续向下抛出，否则调用方的 .then() 永远不会触发，
    // 也没有 .catch() 能感知到失败，调用页面会停留在 show=false 的初始态
    // 导致整页空白（home/explore/library 都依赖 .then() 才会 show=true）。
    return Promise.reject(error);
  }
);

export default service;
