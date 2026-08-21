<div align="center">
	<a href="http://go.warp.dev/YesPlayMusic" target="_blank">
		<sup>Special thanks to:</sup>
		<br>
		<img alt="Warp sponsorship" width="400" src="https://github.com/warpdotdev/brand-assets/blob/main/Github/Sponsor/Warp-Github-LG-03.png?raw=true">
		<br>
		<h>Warp is built for coding with multiple AI agents</b>
		<br>
		<sup>Available for macOS, Linux and Windows</sup>
	</a>
</div>

<br>

---

<br />
<p align="center">
  <a href="https://music.qier222.com" target="blank">
    <img src="images/logo.png" alt="Logo" width="156" height="156">
  </a>
  <h2 align="center" style="font-weight: 600">YesPlayMusic</h2>

  <p align="center">
    高颜值的第三方网易云播放器
    <br />
    <a href="https://music.qier222.com" target="blank"><strong>🌎 原项目 DEMO</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="#%EF%B8%8F-安装" target="blank"><strong>📦️ 下载安装包</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="https://t.me/yesplaymusic" target="blank"><strong>💬 加入交流群</strong></a>
    <br />
    <br />
  </p>
</p>

[![Library][library-screenshot]](https://music.qier222.com)

## 🔀 关于本仓库

本仓库是 [qier222/YesPlayMusic](https://github.com/qier222/YesPlayMusic) 的 fork，由 [@atri1011](https://github.com/atri1011) 维护，在原项目 1.x 代码基础上继续开发新功能。

- 原项目：[qier222/YesPlayMusic](https://github.com/qier222/YesPlayMusic) —— 已进入维护模式，除重大 bug 修复外不再更新功能；其全新 2.0 Alpha 测试版见原项目 [Releases](https://github.com/qier222/YesPlayMusic/releases)。
- 本仓库：[atri1011/YesPlayMusic](https://github.com/atri1011/YesPlayMusic) —— 安装包、Issue 与 Pull request 请走这里。

原项目的版权与署名信息全部保留，详见文末「开源许可」与「灵感来源」。

## ✨ 特性

- ✅ 使用 Vue.js 全家桶开发
- 🔴 网易云账号登录（扫码/手机/邮箱登录）
- 📺 支持 MV 播放
- 📃 支持歌词显示，含逐字歌词（部分歌曲支持，可在设置中关闭）
- 📻 支持私人 FM / 每日推荐歌曲
- 🎯 播放队列页展示相似歌曲与相似歌单
- 🕘 音乐库支持「最近播放」（单曲 / 歌单 / 专辑）
- 🚫🤝 无任何社交功能
- 🌎️ 海外用户可直接播放（需要登录网易云账号）
- 🔐 支持 [UnblockNeteaseMusic](https://github.com/UnblockNeteaseMusic/server#音源清单)，自动使用[各类音源](https://github.com/UnblockNeteaseMusic/server#音源清单)替换变灰歌曲链接 （网页版不支持）
  - 「各类音源」指默认启用的音源。
  - YouTube 音源需自行安装 `yt-dlp`。
- ~~✔️ 每日自动签到（手机端和电脑端同时签到）~~
- 🌚 Light/Dark Mode 自动切换
- 👆 支持 Touch Bar
- 🖥️ 支持 PWA，可在 Chrome/Edge 里点击地址栏右边的 ➕ 安装到电脑
- 🟥 支持 Last.fm Scrobble
- ☁️ 支持音乐云盘
- ⌨️ 自定义快捷键和全局快捷键
- 🎧 支持 Mpris
- 🛠 更多特性开发中

## 📦️ 安装

Electron 版本最初由 [@hawtim](https://github.com/hawtim) 和 [@qier222](https://github.com/qier222) 适配并维护，支持 macOS、Windows、Linux。

访问本仓库的 [Releases](https://github.com/atri1011/YesPlayMusic/releases)
页面下载安装包。

- macOS 用户可以通过 Homebrew 来安装：`brew install --cask yesplaymusic`

- Windows 用户可以通过 Scoop 来安装：`scoop install extras/yesplaymusic`

> Homebrew 与 Scoop 装的是原项目发布的版本，不含本仓库的新功能，需要新功能请从上面的 Releases 下载。

## 同类项目（排名无先后）

欢迎大家通过 PR 分享你的项目，让更多人看到！

- [algerkong/AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer)
- [asxez/MusicBox](https://github.com/asxez/MusicBox)
- [lianchengwu/wmplayer](https://github.com/lianchengwu/wmplayer)

## ⚙️ 部署至 Vercel

除了下载安装包使用，你还可以将本项目部署到 Vercel 或你的服务器上。下面是部署到 Vercel 的方法。

原项目的 Demo (https://music.qier222.com) 就是部署在 Vercel 上的网站。

[![Powered by Vercel](https://www.datocms-assets.com/31049/1618983297-powered-by-vercel.svg)](https://vercel.com/?utm_source=ohmusic&utm_campaign=oss)

1. 部署网易云 API，详情参见 [NeteaseCloudMusicApiEnhanced/api-enhanced](https://neteasecloudmusicapienhanced.js.org/#/?id=安装)
   。你也可以将 API 部署到 Vercel。

2. 点击本仓库右上角的 Fork，复制本仓库到你的 GitHub 账号。

3. 点击仓库的 Add File，选择 Create new file，输入 `vercel.json`，将下面的内容复制粘贴到文件中，并将 `https://your-netease-api.example.com` 替换为你刚刚部署的网易云 API 地址：

```json
{
  "rewrites": [
    {
      "source": "/api/:match*",
      "destination": "https://your-netease-api.example.com/:match*"
    }
  ]
}
```

4. 打开 [Vercel.com](https://vercel.com)，使用 GitHub 登录。

5. 点击 Import Git Repository 并选择你刚刚复制的仓库并点击 Import。

6. 点击 PERSONAL ACCOUNT 旁边的 Select。

7. 点击 Environment Variables，填写 Name 为 `VUE_APP_NETEASE_API_URL`，Value 为 `/api`，点击 Add。最后点击底部的 Deploy 就可以部署到
   Vercel 了。

## ⚙️ 部署到自己的服务器

除了部署到 Vercel，你还可以部署到自己的服务器上

1. 部署网易云 API，详情参见 [NeteaseCloudMusicApiEnhanced/api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)
2. 克隆本仓库

```sh
git clone --recursive https://github.com/atri1011/YesPlayMusic.git
```

3. 安装依赖

```sh
yarn install

```

4. （可选）使用 Nginx 反向代理 API，将 API 路径映射为 `/api`，如果 API 和网页不在同一个域名下的话（跨域），会有一些 bug。

5. 复制 `/.env.example` 文件为 `/.env`，修改里面 `VUE_APP_NETEASE_API_URL` 的值为网易云 API 地址。本地开发的话可以填写 API 地址为 `http://localhost:3000`，YesPlayMusic 地址为 `http://localhost:8080`。如果你使用了反向代理 API，可以填写 API 地址为 `/api`。

```
VUE_APP_NETEASE_API_URL=http://localhost:3000
```

6. 编译打包

```sh
yarn run build
```

7. 将 `/dist` 目录下的文件上传到你的 Web 服务器

## ⚙️ 宝塔面板 docker 应用商店 部署

1. 安装宝塔面板，前往[宝塔面板官网](https://www.bt.cn/new/download.html) ，选择正式版的脚本下载安装。

2. 安装后登录宝塔面板，在左侧导航栏中点击 Docker，首次进入会提示安装 Docker 服务，点击立即安装，按提示完成安装

3. 安装完成后在应用商店中找到 YesPlayMusic，点击安装，配置域名、端口等基本信息即可完成安装。

4. 安装后在浏览器输入上一步骤设置的域名即可访问。

## ⚙️ Docker 部署

1. 构建 Docker Image

```sh
docker build -t yesplaymusic .
```

2. 启动 Docker Container

```sh
docker run -d --name YesPlayMusic -p 80:80 yesplaymusic
```

3. Docker Compose 启动

```sh
docker-compose up -d
```

YesPlayMusic 地址为 `http://localhost`

## ⚙️ 部署至 Replit

1. 新建 Repl，选择 Bash 模板

2. 在 Replit shell 中运行以下命令

```sh
bash <(curl -s -L https://raw.githubusercontent.com/atri1011/YesPlayMusic/master/install-replit.sh)
```

3. 首次运行成功后，只需点击绿色按钮 `Run` 即可再次运行

4. 由于 replit 个人版限制内存为 1G（教育版为 3G），构建过程中可能会失败，请再次运行上述命令或运行以下命令：

```sh
cd /home/runner/${REPL_SLUG}/music && yarn install && yarn run build
```

## 👷‍♂️ 打包客户端

如果在 Release 页面没有找到适合你的设备的安装包的话，你可以根据下面的步骤来打包自己的客户端。

1. 打包 Electron 需要用到 Node.js 和 Yarn。可前往 [Node.js 官网](https://nodejs.org/zh-cn/) 下载安装包。安装 Node.js
   后可在终端里执行 `npm install -g yarn` 来安装 Yarn。

2. 使用 `git clone --recursive https://github.com/atri1011/YesPlayMusic.git` 克隆本仓库到本地。

3. 使用 `yarn install` 安装项目依赖。

4. 复制 `/.env.example` 文件为 `/.env` 。

5. 选择下列表格的命令来打包适合的你的安装包，打包出来的文件在 `/dist_electron` 目录下。了解更多信息可访问 [electron-builder 文档](https://www.electron.build/cli)

| 命令                                       | 说明                      |
| ------------------------------------------ | ------------------------- |
| `yarn electron:build --windows nsis:ia32`  | Windows 32 位             |
| `yarn electron:build --windows nsis:arm64` | Windows ARM               |
| `yarn electron:build --linux deb:armv7l`   | Debian armv7l（树莓派等） |
| `yarn electron:build --macos dir:arm64`    | macOS ARM                 |

## :computer: 配置开发环境

本项目由 [NeteaseCloudMusicApiEnhanced/api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) 提供 API（原 [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) 已停更）。

运行本项目

```shell
# 安装依赖
yarn install

# 创建本地环境变量
cp .env.example .env

# 运行（网页端）
yarn serve

# 运行（electron）
yarn electron:serve
```

本地运行 NeteaseCloudMusicApi，或者将 API [部署至 Vercel](#%EF%B8%8F-部署至-vercel)

```shell
# 运行 API （默认 3000 端口）
yarn netease_api:run
```

## ☑️ Todo

原项目的 Todo 见 [qier222/YesPlayMusic Projects](https://github.com/qier222/YesPlayMusic/projects/1)。

本仓库的 Issue 和 Pull request 请提到 [atri1011/YesPlayMusic](https://github.com/atri1011/YesPlayMusic/issues)，欢迎参与。

## 📜 开源许可

本项目仅供个人学习研究使用，禁止用于商业及非法用途。

基于 [MIT license](https://opensource.org/licenses/MIT) 许可进行开源。

本仓库 fork 自 [qier222/YesPlayMusic](https://github.com/qier222/YesPlayMusic)，原作者 [@qier222](https://github.com/qier222) 保留其著作权，本仓库沿用同一许可协议。

## 灵感来源

原项目 [qier222/YesPlayMusic](https://github.com/qier222/YesPlayMusic)

API 源代码来自 [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)

- [Apple Music](https://music.apple.com)
- [YouTube Music](https://music.youtube.com)
- [Spotify](https://www.spotify.com)
- [网易云音乐](https://music.163.com)

## 🖼️ 截图

![lyrics][lyrics-screenshot]
![library-dark][library-dark-screenshot]
![album][album-screenshot]
![home-2][home-2-screenshot]
![artist][artist-screenshot]
![search][search-screenshot]
![home][home-screenshot]
![explore][explore-screenshot]

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[album-screenshot]: images/album.png
[artist-screenshot]: images/artist.png
[explore-screenshot]: images/explore.png
[home-screenshot]: images/home.png
[home-2-screenshot]: images/home-2.png
[lyrics-screenshot]: images/lyrics.png
[library-screenshot]: images/library.png
[library-dark-screenshot]: images/library-dark.png
[search-screenshot]: images/search.png
