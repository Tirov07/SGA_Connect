// Config do Babel. O babel-preset-expo (SDK 58) ja configura o plugin do Reanimated
// e do Expo Router automaticamente — nao declarar o plugin do reanimated aqui
// (duplicar causaria erro/warning).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
