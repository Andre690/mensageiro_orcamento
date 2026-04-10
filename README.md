# Disparador de Mensagens - Orçamento

Sistema de gestão e disparo de mensagens de controle orçamentário via WhatsApp. Permite visualizar o status do orçamento de diversos setores, gerar extratos detalhados em PDF (com separação de Entradas e Saídas) e enviar esses relatórios automaticamente para os gestores responsáveis.

## Funcionalidades

- **Dashboard Interativo**: Visualização rápida de setores com orçamento ultrapassado (≥100%), em alerta (≥90%) ou controlados (<90%).
- **Processamento de Planilhas**: Importação e análise de arquivos Excel (`.xlsx`/`.xls`) e CSV para Orçamento Geral, Orçamento por Categoria e Contatos dos Setores.
- **Geração de PDF**: Criação automática de extratos orçamentários detalhados com resumos separados de Entradas (receitas) e Saídas (despesas), usando `PDFKit`. Inclui formatação dinâmica de valores monetários e cores condicionais por percentual de uso.
- **Integração WhatsApp**: Conexão via QR Code com API de WhatsApp (Ex: Evolution API / Baileys).
- **Envio em Massa com Retry**: Disparo automatizado de mensagens de texto e arquivos PDF com lógica de até 3 tentativas por contato e intervalo progressivo entre retries.
- **Preview de PDF**: Visualização prévia do PDF de qualquer setor antes do disparo.
- **Log de Envios**: Monitoramento em tempo real do status dos disparos (limitado a 100 entradas).

## Tecnologias Utilizadas

- **Runtime**: Node.js 18+
- **Backend**: Express 4
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES Modules)
- **Bibliotecas**:
  - `pdfkit` — Geração de PDFs no backend
  - `xlsx` (CDN) — Processamento de planilhas Excel no frontend
  - `axios` — Requisições HTTP para a API de WhatsApp
  - `morgan` — Logger de requisições HTTP
  - `dotenv` — Carregamento de variáveis de ambiente
  - `nodemon` (dev) — Hot-reload durante desenvolvimento

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior instalado
- Uma instância de API de WhatsApp (como [Evolution API](https://github.com/EvolutionAPI/evolution-api)) rodando e configurada

## Instalação

1. Clone o repositório:
    ```bash
    git clone <url-do-repositorio>
    cd mensageiro_orcamento
    ```

2. Instale as dependências:
    ```bash
    npm install
    ```

## Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis de ambiente:

```env
# Configurações do Servidor
PORT=4000
JSON_LIMIT=10mb

# Configurações da API WhatsApp
API_URL=http://seu-endereco-api:8080
API_INSTANCE=NomeDaSuaInstancia
API_KEY=sua-api-key-aqui
```

> **Nota**: `API_INSTANCE` deve corresponder ao nome da instância criada na sua API de gerenciamento de WhatsApp. O arquivo `.env` é ignorado pelo Git (`.gitignore`) e pelo Docker (`.dockerignore`).

## Como Usar

1. **Inicie o servidor**:
    ```bash
    npm run dev      # desenvolvimento (com nodemon)
    # ou
    npm start        # produção
    ```

2. **Acesse a interface**:
    Abra o navegador em `http://localhost:4000` (ou a porta definida no `.env`).

3. **Conecte o WhatsApp**:
    - Clique em "Testar Conexão" para verificar o status da API.
    - Clique em "Conectar WhatsApp" e escaneie o QR Code se necessário.
    - Aguarde o status mudar para "ONLINE".

4. **Carregue as Planilhas**:
    O sistema espera 3 arquivos (Excel `.xlsx`/`.xls` ou `.csv`):

    | Arquivo | Descrição | Colunas Esperadas |
    |---------|-----------|-------------------|
    | **Orçamento Geral** | Resumo orçado × realizado por setor | `setor`, `orcado` (ou `orcamento_total`, `orcado_total`, `orcado_mensal`), `realizado` |
    | **Orçamento Categoria** | Detalhamento por grupo/categoria/classificação | `setor`, `grupo`, `categoria`, `classificacao`, `descricao`, `orcado_mensal` (ou `orcado`), `realizado`, `movimento` (ou `tipo`) |
    | **Contatos Setores** | Mapeamento Setor → Número WhatsApp | `nome_setor` (ou `setor`, `nome`), `numero` (ou `telefone`, `contato`) |

    > Os nomes das colunas são normalizados automaticamente (sem acentos, case-insensitive). A coluna `movimento` aceita valores como "Entrada", "Receita", "Crédito", "Recebimento" para entradas; qualquer outro valor é tratado como saída.

5. **Disparar Mensagens**:
    - Verifique as estatísticas no dashboard.
    - Use "Visualizar PDF" em qualquer setor para conferir o extrato antes do envio.
    - Opcionalmente, desmarque "Enviar PDF" se quiser enviar apenas texto.
    - Clique em "Disparar Mensagens para Setores".

## Estrutura do Projeto

```
mensageiro_orcamento/
├── server.js                         # Servidor principal (monolítico) — rotas, middlewares, Express
├── app.js                            # App Express modular (API versionada, health check)
├── package.json
├── .env                              # Variáveis de ambiente (não versionado)
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
│
├── config/
│   └── env.js                        # Centralização das variáveis de ambiente
│
├── api/
│   └── v1/
│       ├── controllers/
│       │   └── health.controller.js  # Controller de health check
│       └── routes/
│           └── health.routes.js      # Rota GET /api/v1/health
│
├── middlewares/
│   ├── errorHandler.js               # Handler global de erros (com stack trace em dev)
│   ├── notFound.js                   # Handler de rotas 404
│   └── requestLogger.js             # Logger HTTP via morgan (dev/combined)
│
├── models/
│   └── .gitkeep                      # Reservado para futuros modelos de dados
│
├── routes/
│   └── index.js                      # Agregador de rotas versionadas (/api/v1)
│
├── services/
│   ├── pdf.service.js                # Gerador de PDF com PDFKit (596 linhas)
│   └── health.service.js             # Serviço de health check
│
├── utils/
│   └── asyncHandler.js               # Wrapper para rotas async no Express
│
└── public/                           # Frontend estático
    ├── index.html                    # Página principal (SPA)
    ├── style.css                     # Estilos globais (549 linhas)
    ├── favicon.ico
    └── js/                           # Módulos JavaScript (ES Modules)
        ├── main.js                   # Entry point — bind de eventos e inicialização
        ├── state.js                  # Estado global da aplicação
        ├── api.js                    # Cliente HTTP — testar conexão, QR Code, envio de mensagens
        ├── dataLoader.js             # Processamento de planilhas Excel/CSV e merge de dados
        ├── messaging.js              # Geração de mensagens e disparo em massa
        ├── ui.js                     # Renderização de estatísticas e lista de setores
        ├── pdf.js                    # Toggle e preview de PDF
        ├── metrics.js                # Cálculo de percentuais e status (danger/warning/success)
        ├── logger.js                 # Gerenciamento do log de envios no DOM
        └── utils.js                  # Normalização de texto, parsing numérico, formatação de telefone
```

## Arquitetura

O projeto possui duas configurações Express coexistentes:

### `server.js` — Servidor Principal (em uso)
Ponto de entrada efetivo da aplicação (`npm start` / `npm run dev`). Contém:
- Middleware de UTF-8 forçado em todas as respostas JSON
- Arquivos estáticos servidos de `public/`
- Todas as rotas operacionais de negócio (envio de mensagens, PDF, conexão WhatsApp)

### `app.js` — Arquitetura Modular (secundário)
Configuração modular com separação em camadas (controllers, services, middlewares). Atualmente monta apenas a rota de health check (`GET /api/v1/health`). Preparado para expansão futura.

## API — Endpoints

### Rotas do `server.js`

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/` | Serve o `index.html` (frontend) |
| `GET` | `/api/testar-conexao` | Verifica estado da conexão WhatsApp |
| `GET` | `/api/qrcode` | Obtém QR Code para autenticação WhatsApp |
| `POST` | `/api/send-message` | Envia mensagem de texto + PDF opcional via WhatsApp |
| `POST` | `/api/gerar-pdf-preview` | Gera e retorna um PDF para preview no navegador |

### Rotas do `app.js` (API versionada)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Ping simples (`{ status: 'ok' }`) |
| `GET` | `/api/v1/health` | Health check detalhado (status, uptime, timestamp) |

### Detalhes dos Payloads

#### `POST /api/send-message`
```json
{
  "number": "5511999999999",
  "text": "Mensagem de texto",
  "enviarPdf": true,
  "dadosSetor": {
    "nome": "Nome do Setor",
    "grupos": [
      {
        "nome": "Grupo",
        "categorias": [
          {
            "nome": "Categoria",
            "orcado": 10000,
            "realizado": 8500,
            "classificacoes": [
              {
                "nome": "Classificação",
                "orcado": 5000,
                "realizado": 4200,
                "tipo": "Saída"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

#### `POST /api/gerar-pdf-preview`
```json
{
  "dadosSetor": { /* mesma estrutura acima */ }
}
```

## PDF — Detalhes da Geração

O serviço `pdf.service.js` gera relatórios A4 com:

- **Cabeçalho**: Título "RELATÓRIO ORÇAMENTÁRIO", nome do setor e data/hora de geração.
- **Resumo de Entradas** (verde): Exibido apenas quando há registros com `tipo = "Entrada"`. Mostra orçado, realizado, diferença (Realizado − Orçado) e percentual.
- **Resumo de Saídas** (cinza): Sempre exibido. Mostra orçado, realizado, diferença (Orçado − Realizado) e percentual.
- **Tabela Detalhada**: Lista categorias (negrito) e classificações (indentadas) com valores de orçado, realizado, diferença e percentual.
- **Cores Condicionais**:
  - 🟢 Verde (`#28a745`): < 90% para saídas, ≥ 100% para entradas
  - 🟡 Amarelo (`#ffc107`): 90%–99%
  - 🔴 Vermelho (`#dc3545`): ≥ 100% para saídas, < 90% para entradas
- **Paginação Automática**: Quebra de página com repetição do cabeçalho da tabela.
- **Formatação Monetária Dinâmica**: Redução automática do tamanho da fonte quando o valor não cabe na coluna.

## Docker

Para rodar a aplicação com Docker:

1. Certifique-se de ter Docker e Docker Compose instalados.
2. Crie/atualize seu arquivo `.env` (veja seção Configuração).
3. Execute:
    ```bash
    docker-compose up --build -d
    ```
4. A aplicação estará disponível em `http://localhost:4000`.

O container usa `node:18-alpine` como base e monta a pasta `public/` como volume para permitir atualizações de arquivos estáticos sem rebuild.

## Fluxo de Dados

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND (public/)                                          │
│                                                              │
│  Excel/CSV ──► dataLoader.js ──► state.dadosProcessados      │
│                    │                      │                   │
│                    ▼                      ▼                   │
│              Normaliza nomes       ui.js renderiza            │
│              Agrupa por:           dashboard + lista          │
│              Setor → Grupo →                                  │
│              Categoria →           messaging.js gera          │
│              Classificação         mensagem por setor         │
│                                         │                    │
│                                         ▼                    │
│                              api.js envia via fetch           │
│                              (com retry até 3×)              │
└────────────────────────────────┬─────────────────────────────┘
                                 │ POST /api/send-message
                                 ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND (server.js)                                         │
│                                                              │
│  1. Envia texto via API WhatsApp (sendText)                  │
│  2. Se enviarPdf = true:                                     │
│     a. Gera PDF (pdf.service.js)                             │
│     b. Converte para base64                                  │
│     c. Envia como documento via API WhatsApp (sendMedia)     │
└──────────────────────────────────────────────────────────────┘
```

## Scripts Disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| `start` | `node server.js` | Inicia o servidor em produção |
| `dev` | `nodemon server.js` | Inicia com hot-reload para desenvolvimento |

---

Desenvolvido para automatizar o controle orçamentário — Top Fama.
