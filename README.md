# SGA Connect

App mobile (iOS + Android) + API para consulta dos dados do **SGA** (Canadá Informática).

O objetivo é dar aos clientes um painel moderno e **sempre atualizado**: a API lê o
banco Access (`DADOSTAB.accdb`) de cada empresa **no momento da consulta** e devolve
JSON enxuto para o app. Sem job intermediário, sem dado atrasado.

```
┌──────────────────────┐    HTTPS + JWT    ┌───────────────────────────────┐
│ App React Native      │ ───────────────► │ API ASP.NET Core (Windows)    │
│ (iOS + Android)       │ ◄─────────────── │ roda no servidor da nuvem     │
│  login · dashboard    │     JSON          │ • autentica, emite JWT        │
│  gráficos             │                   │ • lê .accdb via OLEDB (ACE)   │
└──────────────────────┘                   │ • SOMENTE LEITURA no SGA      │
                                            └───────────┬───────────────────┘
                                                        │ OLEDB local (readonly)
                                                        ▼
                                           C:\sga\SGA_<EMPRESA>\bd\DADOSTAB.accdb
```

## Estrutura do repositório

```
SGA_Connect/
├── api/                  API ASP.NET Core (.NET 8) — este é o foco atual
│   └── SgaConnect.Api/
├── app/                  App React Native (Expo) — próxima etapa
└── docs/                 Decisões de arquitetura e notas
```

## Descoberta automática das empresas

A API **não** mapeia caminho por caminho. Ela recebe uma pasta raiz (ex.: `C:\sga`),
varre as subpastas `SGA_*` e, em cada uma, procura `bd\DADOSTAB.accdb`. Assim, para
adicionar uma empresa nova basta a pasta dela existir no servidor.

Em máquina de teste, a pasta raiz é configurável em `appsettings` / variável de
ambiente — veja `api/SgaConnect.Api/README.md`.

## Segurança (prioridade — a API roda dentro do servidor dos bancos)

- Access aberto **somente em modo leitura**. A API nunca escreve no SGA.
- O caminho do `.accdb` **nunca** vem do app; é resolvido no servidor a partir do
  usuário autenticado. Um cliente não consegue pedir o banco de outro.
- O app chama endpoints fixos (`/vendas`, `/financeiro`…), nunca envia SQL nem caminho.
  Toda consulta é parametrizada no servidor.
- Senhas com hash; segredos (chave JWT, config) fora do git.

## Status

- [x] Esqueleto da API (.NET 8) + descoberta de empresas + conexão OLEDB readonly
- [ ] Login (ligar na tabela de usuários do SGA — a confirmar: `EmpresaxUsuariosConn`)
- [ ] Endpoints de dados (resumo, OS, notas, financeiro, estoque)
- [ ] App React Native (Expo)
```

> Nota de build: o driver Access (ACE/OLEDB) só existe no **Windows**. No sandbox
> Linux a API compila e valida, mas a leitura real do `.accdb` só roda no Windows.
