import Vue from 'vue';
import DesktopLyric from './DesktopLyric.vue';
import '@/assets/icons';

// 这个入口不能碰 @/store：store/index.js 在模块顶层就 new Player()，
// 第二个窗口一旦引入就会多出一个 Howler 实例，两边同时读写 localStorage 的
// player 字段。同理也不能 import @/locale，它转手 import 了 store。
// 窗口需要的一切都由主窗口经 ipcMain 推过来。

Vue.config.productionTip = false;

new Vue({
  render: h => h(DesktopLyric),
}).$mount('#app');
