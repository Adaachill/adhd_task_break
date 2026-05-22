// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite (web) は wa-sqlite.wasm をアセットとして読み込む
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer を有効化するため COOP/COEP ヘッダーを付与（web の SQLite に必要）
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    return middleware(req, res, next);
  };
};

module.exports = config;
