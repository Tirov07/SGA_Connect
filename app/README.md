# SGA Connect — App (React Native + Expo)

App mobile (iOS + Android) que consome a API do SGA Connect. Tema vermelho/cinza/preto,
estilo dashboard moderno.

## Rodar em desenvolvimento

```bash
cd app
npm install
npx expo start
```

- **iPhone:** instale o app **Expo Go** na App Store, abra a câmera e leia o QR code do terminal.
- **Android:** `npx expo start --android` (emulador aberto no Android Studio).

## Apontar para a API

`localhost` no celular/emulador **não** é a sua máquina. Configure a URL da API em
`app.json` → `expo.extra.apiUrl`:

```json
"extra": {
  "apiUrl": "http://SEU_IP_LOCAL:5443"
}
```

- **iPhone (Expo Go):** use o **IP da sua máquina** na rede Wi-Fi (ex.: `http://192.168.0.10:5443`).
  O celular e o PC precisam estar na mesma rede. Prefira a porta HTTP (5443) para evitar o
  certificado HTTPS de dev.
- **Emulador Android:** use `http://10.0.2.2:5443` (alias do host dentro do emulador).

Se não configurar, o app usa `http://10.0.2.2:5443` como padrão (emulador Android).

## Estrutura

```
app/
├── app/                      rotas (expo-router)
│   ├── _layout.tsx           provedor de auth + guarda de navegação
│   ├── index.tsx             redireciona
│   ├── login.tsx             empresa + CPF + senha
│   └── (app)/
│       ├── _layout.tsx
│       └── home.tsx          4 cards + gráfico (resumo)
└── src/
    ├── api.ts                cliente da API
    ├── auth.tsx              sessão (token no SecureStore)
    ├── config.ts             URL da API + nome do app
    ├── theme.ts              cores/raios/espaços
    ├── format.ts             moeda / hora
    └── components/           Card, StatCard
```

## Telas desta entrega

- **Login:** escolhe a empresa (de `/auth/empresas`), CPF + senha → `/auth/login`.
- **Home:** OS abertas, OS fechadas (7 dias), a receber e a pagar do mês + gráfico,
  de `/resumo`. Puxar para atualizar.
