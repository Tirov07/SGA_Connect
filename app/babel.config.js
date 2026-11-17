// Config do Babel exigida pelo Expo Router + Reanimated.
// O plugin do react-native-reanimated DEVE ser o ultimo da lista.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-reanimated/plugin"],
  };
};
