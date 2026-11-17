# SgaConnect.Api

API ASP.NET Core (.NET 8) que lê os bancos Access do SGA (`DADOSTAB.accdb`) em
**modo somente leitura** e expõe os dados em JSON para o app mobile.

## Pré-requisitos (servidor Windows)

- .NET 8 Runtime (ASP.NET Core)
- **Microsoft Access Database Engine 2016 (x64)** — o driver ACE/OLEDB que lê o `.accdb`.
  Sem ele, as consultas ao Access falham (o resto da API funciona).

> No Linux a API **compila e roda**, mas qualquer leitura do Access retorna erro
> avisando que o driver só existe no Windows. Teste a leitura real no Windows.

## Configuração

1. Copie `appsettings.Local.json.exemplo` para `appsettings.Local.json` (está no `.gitignore`).
2. Defina:
   - `Sga:PastaRaiz` — a pasta que contém as pastas `SGA_<EMPRESA>` (ex.: `C:\sga`, ou
     uma pasta de teste na sua máquina).
   - `Jwt:Key` — uma chave longa e aleatória (≥ 32 caracteres).

Alternativa a segredos no arquivo: variáveis de ambiente com prefixo `SGACONNECT_`,
ex.: `SGACONNECT_Jwt__Key`, `SGACONNECT_Sga__PastaRaiz`.

## Como a API acha as empresas

Varre `Sga:PastaRaiz` procurando subpastas `SGA_*` e, em cada uma,
`bd\DADOSTAB.accdb`. A "chave" da empresa é o nome da pasta sem o prefixo
(`SGA_FULLTAC` → `FULLTAC`). Adicionar empresa nova = só criar a pasta; não precisa
reiniciar nem editar config.

## Endpoints (esta etapa)

| Método | Rota | Protegido | O que faz |
|---|---|---|---|
| GET | `/health` | não | Status + empresas encontradas |
| GET | `/diagnostico/conexoes` | não (dev) | Testa abrir o `DADOSTAB` de cada empresa |
| GET | `/auth/empresas` | não | Lista as empresas para a tela de login |
| POST | `/auth/login` | não (rate-limited) | Valida contra `EmpresaxUsuariosConn`, devolve JWT |
| GET | `/resumo` | **sim (JWT)** | OS abertas/fechadas + a receber do mês |

## Login

O cliente informa **empresa + login + senha**. A senha é validada contra a tabela
`EmpresaxUsuariosConn` do `DADOSTAB` daquela empresa (somente leitura). A empresa
escolhida é selada no JWT (claims `empresa` e `codEmpresa`); daí em diante o app nunca
mais informa a empresa — todo request de dados é resolvido pelo token no servidor.

Request de login:
```json
{ "login": "<CPF>", "senha": "<senha>", "empresa": "FULLTAC" }
```

O login é o **CPF** e a `Password_Usu` é texto puro (confirmado). A senha nunca sai da
API: a comparação acontece no servidor e a senha não volta em nenhuma resposta.

## Rodar

```bash
dotnet run --project SgaConnect.Api
# Swagger em https://localhost:7443/swagger (Development)
```

## Segurança aplicada

- Access aberto com `Mode=Read` — **nunca** escreve no SGA.
- A empresa do usuário vai no claim `empresa` do JWT; o app **nunca** informa empresa
  nem caminho de arquivo → isolamento entre clientes e sem path traversal.
- Senhas com PBKDF2; mesma mensagem para login/senha inválidos; rate limiting no login.
- Segredos fora do git.

## Regras de negócio confirmadas

- **OS aberta** = `DataFechamento` vazia; **fechada** = preenchida. Canceladas ignoradas.
- **A receber** (`CTREC`): empresa = `CodEmpresa`, vencimento = `DataVencimento`.
- **A pagar** (`CTPAG`): empresa = `CodigoEmpresa`, vencimento = `Vencimento` (nomes
  diferentes da CTREC — cuidado ao copiar queries).

## Próximos passos

- Telas de detalhe: últimos recebimentos (`PGCTREC`) e pagamentos (`LIQCTPAG`),
  títulos a vencer em 30 dias, notas emitidas, estoque.
- App React Native (Expo).
