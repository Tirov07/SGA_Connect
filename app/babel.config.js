// Config do Babel exigida pelo Expo Router. Sem este arquivo, o app crasha ao abrir
// porque o entry (expo-router/entry) nao consegue resolver as rotas.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
