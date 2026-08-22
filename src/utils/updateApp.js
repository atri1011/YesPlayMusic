import initLocalStorage from '@/store/initLocalStorage.js';
import pkg from '../../package.json';

const updateSetting = () => {
  const parsedSettings = JSON.parse(localStorage.getItem('settings'));
  const settings = {
    ...initLocalStorage.settings,
    ...parsedSettings,
  };

  // 修复历史升级逻辑写入的 null/undefined 项：旧版把 undefined push 进
  // shortcuts 数组，JSON.stringify 后变成 null，渲染时 v-for 访问 .id 崩溃
  settings.shortcuts = (settings.shortcuts || []).filter(
    s => s && typeof s === 'object' && 'id' in s
  );

  if (
    settings.shortcuts.length !== initLocalStorage.settings.shortcuts.length
  ) {
    // 当新增 shortcuts 时，把默认配置中用户缺失的快捷键补回去
    const oldShortcutsId = settings.shortcuts.map(s => s.id);
    const newShortcuts = initLocalStorage.settings.shortcuts.filter(
      s => oldShortcutsId.includes(s.id) === false
    );
    settings.shortcuts.push(...newShortcuts);
  }

  if (localStorage.getItem('appVersion') === '"0.3.9"') {
    settings.lyricsBackground = true;
  }

  localStorage.setItem('settings', JSON.stringify(settings));
};

const updateData = () => {
  const parsedData = JSON.parse(localStorage.getItem('data'));
  const data = {
    ...parsedData,
  };
  localStorage.setItem('data', JSON.stringify(data));
};

const updatePlayer = () => {
  let parsedData = JSON.parse(localStorage.getItem('player'));
  let appVersion = localStorage.getItem('appVersion');
  if (appVersion === `"0.2.5"`) parsedData = {}; // 0.2.6版本重构了player
  const data = {
    ...parsedData,
  };
  localStorage.setItem('player', JSON.stringify(data));
};

const removeOldStuff = () => {
  // remove old indexedDB databases created by localforage
  indexedDB.deleteDatabase('tracks');
};

export default function () {
  updateSetting();
  updateData();
  updatePlayer();
  removeOldStuff();
  localStorage.setItem('appVersion', JSON.stringify(pkg.version));
}
