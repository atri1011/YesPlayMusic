const webpack = require('webpack');
const path = require('path');
function resolve(dir) {
  return path.join(__dirname, dir);
}

module.exports = {
  // 生产环境打包不输出 map
  productionSourceMap: false,
  devServer: {
    disableHostCheck: true,
    port: process.env.DEV_SERVER_PORT || 8080,
    proxy: {
      '^/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        pathRewrite: {
          '^/api': '/',
        },
      },
    },
  },
  pwa: {
    name: 'YesPlayMusic',
    iconPaths: {
      favicon32: 'img/icons/favicon-32x32.png',
    },
    themeColor: '#ffffff00',
    manifestOptions: {
      background_color: '#335eea',
    },
    // workboxOptions: {
    //   swSrc: "dev/sw.js",
    // },
  },
  pages: {
    index: {
      entry: 'src/main.js',
      template: 'public/index.html',
      filename: 'index.html',
      title: 'YesPlayMusic',
      chunks: ['main', 'chunk-vendors', 'chunk-common', 'index'],
    },
    // 桌面歌词是独立窗口的独立入口，不能复用 index：那个入口一路 import 到
    // store/index.js，模块顶层就 new Player()，第二个窗口会多出一个 Howler
    // 实例，两边同时读写 localStorage 的 player 字段。
    desktopLyric: {
      entry: 'src/desktopLyric/main.js',
      template: 'public/desktop-lyric.html',
      filename: 'desktop-lyric.html',
      title: 'YesPlayMusic Desktop Lyric',
      chunks: ['chunk-vendors', 'chunk-common', 'desktopLyric'],
    },
  },
  chainWebpack(config) {
    config.module.rules.delete('svg');
    config.module.rule('svg').exclude.add(resolve('src/assets/icons')).end();
    config.module
      .rule('icons')
      .test(/\.svg$/)
      .include.add(resolve('src/assets/icons'))
      .end()
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]',
      })
      .end();
    config.module
      .rule('napi')
      .test(/\.node$/)
      .use('node-loader')
      .loader('node-loader')
      .end();

    config.module
      .rule('webpack4_es_fallback')
      .test(/\.js$/)
      .include.add(/node_modules/)
      .end()
      .use('esbuild-loader')
      .loader('esbuild-loader')
      .options({ target: 'es2015', format: 'cjs' })
      .end();

    // LimitChunkCountPlugin 可以通过合并块来对块进行后期处理。用以解决 chunk 包太多的问题
    // 上限跟着入口数走：单入口时是 index + chunk-vendors + chunk-common 三块，
    // 加了 desktopLyric 入口就是四块。留不够会强制把 vendors/common 合并掉，
    // 而 pages 里的 chunks 白名单是按名字写的，合并后可能注入不到。
    config.plugin('chunkPlugin').use(webpack.optimize.LimitChunkCountPlugin, [
      {
        maxChunks: 4,
        minChunkSize: 10_000,
      },
    ]);
  },
  // 添加插件的配置
  pluginOptions: {
    // electron-builder的配置文件
    electronBuilder: {
      nodeIntegration: true,
      // vue-cli-plugin-electron-builder 的 getExternals() 仅依据子包 package.json
      // 是否缺少 main/module 字段来判定 external；@neteasecloudmusicapienhanced/api
      // 自带 "main": "main.js"，因此默认不会被算作 external，导致它从
      // bundled/package.json 的 dependencies 里被剥离，electron-builder 也就
      // 不会把它打进 app.asar。运行时 background.js 执行
      // require('@neteasecloudmusicapienhanced/api/server') 时即报
      // "Cannot find module"。这里显式加入 externals 白名单，使其既被 webpack
      // 视为 external（不进 bundle），又被保留到 bundled/package.json 的
      // dependencies，最终由 electron-builder 打包进 asar。
      externals: [
        '@unblockneteasemusic/server',
        '@neteasecloudmusicapienhanced/api',
      ],
      builderOptions: {
        productName: 'YesPlayMusic',
        copyright: 'Copyright © YesPlayMusic',
        // compression: "maximum", // 机器好的可以打开，配置压缩，开启后会让 .AppImage 格式的客户端启动缓慢
        asar: true,
        publish: [
          {
            provider: 'github',
            owner: 'atri1011',
            repo: 'YesPlayMusic',
            vPrefixedTagName: true,
            releaseType: 'draft',
          },
        ],
        directories: {
          output: 'dist_electron',
        },
        mac: {
          target: [
            {
              target: 'dmg',
              arch: ['x64', 'arm64', 'universal'],
            },
          ],
          artifactName: '${productName}-${os}-${version}-${arch}.${ext}',
          category: 'public.app-category.music',
          darkModeSupport: true,
        },
        win: {
          target: [
            {
              target: 'portable',
              arch: ['x64'],
            },
            {
              target: 'nsis',
              arch: ['x64'],
            },
          ],
          publisherName: 'YesPlayMusic',
          icon: 'build/icons/icon.ico',
          publish: ['github'],
        },
        linux: {
          target: [
            {
              target: 'AppImage',
              arch: ['x64'],
            },
            {
              target: 'tar.gz',
              arch: ['x64', 'arm64'],
            },
            {
              target: 'deb',
              arch: ['x64', 'armv7l', 'arm64'],
            },
            {
              target: 'rpm',
              arch: ['x64'],
            },
            ...(process.env.ENABLE_LINUX_SNAP === 'true'
              ? [{ target: 'snap', arch: ['x64'] }]
              : []),
            {
              target: 'pacman',
              arch: ['x64'],
            },
          ],
          category: 'Music',
          icon: './build/icon.icns',
        },
        dmg: {
          icon: 'build/icons/icon.icns',
        },
        nsis: {
          oneClick: true,
          perMachine: true,
          deleteAppDataOnUninstall: true,
        },
      },
      // 主线程的配置文件
      chainWebpackMainProcess: config => {
        config.plugin('define').tap(args => {
          args[0]['IS_ELECTRON'] = true;
          return args;
        });
        config.resolve.alias.set(
          'jsbi',
          path.join(__dirname, 'node_modules/jsbi/dist/jsbi-cjs.js')
        );

        // @neteasecloudmusicapienhanced/api 的 util/request.js 静态 require 了
        // register_checktoken_v2，后者依赖 jsdom，而 jsdom 的传递依赖
        // @csstools/css-color-parser 是 ESM(.mjs)，webpack 4 无法解析。
        // 将整个包（含 /server、/module/* 等子路径）标记为 external，运行时从
        // node_modules 加载，避免 jsdom 进入主进程 bundle。函数形式 externals
        // 才能匹配子路径（对象形式仅精确匹配包根）。
        config.externals([
          (context, request, callback) => {
            if (/^@neteasecloudmusicapienhanced\/api(\/|$)/.test(request)) {
              return callback(null, `commonjs2 ${request}`);
            }
            callback();
          },
        ]);

        config.module
          .rule('webpack4_es_fallback')
          .test(/\.js$/)
          .include.add(/node_modules/)
          .end()
          .use('esbuild-loader')
          .loader('esbuild-loader')
          .options({ target: 'es2015', format: 'cjs' })
          .end();

        // 主进程的 src/ 文件也需要 transpile（可选链 ?. 等 ES2020 语法）
        config.module
          .rule('webpack4_main_src_fallback')
          .test(/\.js$/)
          .include.add(resolve('src'))
          .end()
          .use('esbuild-loader')
          .loader('esbuild-loader')
          .options({ target: 'es2015', format: 'cjs' })
          .end();
      },
      // 渲染线程的配置文件
      chainWebpackRendererProcess: config => {
        // 渲染线程的一些其他配置
        // Chain webpack config for electron renderer process only
        // The following example will set IS_ELECTRON to true in your app
        config.plugin('define').tap(args => {
          args[0]['IS_ELECTRON'] = true;
          return args;
        });
      },
      // 主入口文件
      // mainProcessFile: 'src/main.js',
      // mainProcessArgs: []
    },
  },
};
