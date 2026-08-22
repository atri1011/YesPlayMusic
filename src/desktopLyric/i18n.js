import Vue from 'vue';
import VueI18n from 'vue-i18n';
import en from '@/locale/lang/en.js';
import zhCN from '@/locale/lang/zh-CN.js';
import zhTW from '@/locale/lang/zh-TW.js';
import tr from '@/locale/lang/tr.js';

/**
 * 桌面歌词窗口自己的 VueI18n 实例。
 *
 * 不能复用 @/locale：它模块顶层就 import 了 @/store，而 store/index.js 又在顶层
 * new Player()，这个窗口一旦引入就会多出一个 Howler 实例。所以这里直接 import
 * 四个语言文件，绕开 store。
 */

Vue.use(VueI18n);

const messages = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  tr,
};
const FALLBACK_LOCALE = 'en';

export function normalizeLocale(lang) {
  return messages[lang] ? lang : FALLBACK_LOCALE;
}

/**
 * 两个窗口同源，localStorage 是共享的，而主窗口启动时已经把探测到的语言写回去了
 * （见 store/index.js）。开窗瞬间就能取到正确语言，不用等主窗口推第一条 IPC。
 */
function initialLocale() {
  try {
    return normalizeLocale(JSON.parse(localStorage.getItem('settings'))?.lang);
  } catch (error) {
    // 首次启动或数据损坏
    return FALLBACK_LOCALE;
  }
}

export default new VueI18n({
  locale: initialLocale(),
  fallbackLocale: FALLBACK_LOCALE,
  messages,
  silentTranslationWarn: true,
});
