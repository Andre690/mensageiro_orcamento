# AGENTS.md — Contexto do Repositório

## Visão Geral do Projeto

**Disparador de Mensagens — Orçamento** é uma aplicação web interna da **Top Fama** para controle orçamentário automatizado via WhatsApp. O sistema permite:

1. Importar planilhas Excel/CSV com dados orçamentários (Geral, Categoria, Contatos)
2. Processar e cruzar os dados no frontend (por setor → grupo → categoria → classificação)
3. Gerar PDFs detalhados com resumo de Entradas (receitas) e Saídas (despesas)
4. Disparar mensagens formatadas + PDFs via API de WhatsApp (Evolution API)

**Público-alvo**: Gestores de setores internos que recebem relatórios orçamentários via WhatsApp.

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Runtime | Node.js | 18+ (Alpine no Docker) |
| Backend | Express | 4.x |
| Frontend | HTML5 + CSS3 + Vanilla JS (ES Modules) | — |
| PDF | PDFKit | 0.13.x |
| Planilhas | SheetJS/xlsx (CDN no frontend) | 0.18.5 |
| HTTP Client | Axios | 1.x |
| Logger HTTP | Morgan | 1.x |
| Env | dotenv | 17.x |
| Dev | nodemon | 3.x |

---

## Arquitetura

### Duas configurações Express coexistem:

1. **`server.js`** (PRINCIPAL) — Servidor monolítico que é o ponto de entrada real (`npm start`). Contém todas as rotas operacionais, middleware de UTF-8 e serve o frontend estático.

2. **`app.js`** (SECUNDÁRIO) — Configuração modular com camadas separadas (controllers → services → middlewares). Atualmente só monta o health check (`GET /api/v1/health`). **Não é usado em produção diretamente** — existe como base para futura refatoração.

> **IMPORTANTE**: Ao adicionar novas rotas de negócio, adicione em `server.js`. Use a estrutura `api/v1/` apenas para endpoints REST puros e versionados.

### Frontend (SPA estática)

O frontend é uma SPA servida estaticamente de `public/`. Usa ES Modules nativos do browser (sem bundler). Os módulos são:

| Módulo | Responsabilidade |
|--------|-----------------|
| `main.js` | Entry point, bind de eventos DOM e inicialização |
| `state.js` | Estado global (`dadosSetor`, `dadosCategoria`, `dadosContatos`, `dadosProcessados`, `enviarPdfHabilitado`) |
| `dataLoader.js` | Leitura e parsing de Excel/CSV, merge dos 3 arquivos, agrupamento hierárquico |
| `api.js` | Chamadas HTTP ao backend (testar conexão, QR Code, envio de mensagens com retry) |
| `messaging.js` | Geração do texto da mensagem WhatsApp e orquestração do disparo em massa |
| `ui.js` | Renderização do dashboard (estatísticas, lista de setores, barra de progresso) |
| `pdf.js` | Toggle do envio de PDF e preview via API |
| `metrics.js` | Cálculos de percentual e classificação de status (danger/warning/success) |
| `logger.js` | Log visual no DOM (máximo 100 entradas) |
| `utils.js` | Normalização de texto (sem acentos, lowercase), parsing numérico BR, formatação de telefone |

---

## Estrutura de Diretórios

```
mensageiro_orcamento/
├── server.js                          # Servidor principal (monolítico)
├── app.js                             # App Express modular (secundário)
├── package.json
├── .env                               # Variáveis de ambiente (NÃO versionado)
├── Dockerfile                         # node:18-alpine
├── docker-compose.yml                 # Monta volume ./public:/app/public
│
├── config/
│   └── env.js                         # Centraliza process.env em objeto tipado
│
├── api/v1/
│   ├── controllers/
│   │   └── health.controller.js       # GET /api/v1/health
│   └── routes/
│       └── health.routes.js
│
├── middlewares/
│   ├── errorHandler.js                # Tratamento global de erros (stack em dev)
│   ├── notFound.js                    # 404 handler
│   └── requestLogger.js              # Morgan (dev em DEV, combined em PROD)
│
├── models/                            # Vazio — reservado para futuro
│
├── routes/
│   └── index.js                       # Agrega rotas versionadas sob /api
│
├── services/
│   ├── pdf.service.js                 # Geração de PDF (596 linhas, lógica complexa)
│   └── health.service.js              # Retorna status + uptime + timestamp
│
├── utils/
│   └── asyncHandler.js                # Wrapper para rotas async do Express
│
└── public/                            # Frontend (servido como estático)
    ├── index.html
    ├── style.css                      # 549 linhas de CSS
    ├── favicon.ico
    └── js/                            # 10 módulos ES Modules
        ├── main.js, state.js, api.js, dataLoader.js,
        ├── messaging.js, ui.js, pdf.js, metrics.js,
        ├── logger.js, utils.js
```

---

## Endpoints da API

### Rotas em `server.js` (operacionais)

| Método | Rota | Body | Descrição |
|--------|------|------|-----------|
| `GET` | `/` | — | Serve `index.html` |
| `GET` | `/api/testar-conexao` | — | Verifica estado da conexão WhatsApp na Evolution API |
| `GET` | `/api/qrcode` | — | Obtém QR Code base64 para autenticação |
| `POST` | `/api/send-message` | `{ number, text, enviarPdf?, dadosSetor? }` | Envia texto + PDF opcional |
| `POST` | `/api/gerar-pdf-preview` | `{ dadosSetor }` | Gera PDF e retorna como `application/pdf` |

### Rotas em `app.js` (versionadas)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Ping simples |
| `GET` | `/api/v1/health` | Health check detalhado |

---

## Variáveis de Ambiente (.env)

```env
PORT=4000              # Porta do servidor Express
JSON_LIMIT=10mb        # Limite de payload JSON
API_URL=               # URL base da Evolution API (ex: http://192.168.99.50:8080)
API_INSTANCE=          # Nome da instância WhatsApp
API_KEY=               # Chave de autenticação da Evolution API
```

---

## Modelo de Dados

### Objeto `dadosSetor` (estrutura central)

```javascript
{
  nome: "Nome do Setor",           // string
  telefone: "5511999999999",       // string (formatado com DDI 55)
  orcado: 150000.00,               // number
  realizado: 120000.00,            // number
  grupos: [{                       // array de grupos
    nome: "Grupo A",
    orcado: 75000.00,
    realizado: 60000.00,
    categorias: [{                 // array de categorias
      nome: "Categoria X",
      orcado: 30000.00,
      realizado: 25000.00,
      classificacoes: [{           // array de classificações
        nome: "Classificação Y",
        descricao: "Descrição",
        orcado: 15000.00,
        realizado: 12000.00,
        tipo: "Saída"             // "Entrada" ou "Saída"
      }]
    }]
  }],
  classificacoes: [{...}],         // classificações com orçamento estourado
  totalGrupos: 2                   // number
}
```

### Regra de diferença por tipo de movimento

- **Saída (despesa)**: `diferença = orçado - realizado` (positivo = sobrou)
- **Entrada (receita)**: `diferença = realizado - orçado` (positivo = arrecadou a mais)

### Regra de cores por percentual

| Tipo | Verde | Amarelo | Vermelho |
|------|-------|---------|----------|
| Saída | < 90% | 90%–99% | ≥ 100% |
| Entrada | ≥ 100% | 90%–99% | < 90% |

---

## Convenções de Código

### Geral
- **Idioma do código**: Variáveis e funções em **português** (ex: `gerarPDFOrcamento`, `dadosSetor`, `formatarMoeda`)
- **Idioma de comentários**: Português preferível, inglês aceitável
- **Sem TypeScript**: O projeto é 100% JavaScript
- **Sem bundler**: Frontend usa ES Modules nativos do browser (`<script type="module">`)
- **Sem framework de frontend**: Vanilla JS puro com manipulação direta do DOM

### Backend
- **Não usar `xlsx` no backend** — o processamento de planilhas é feito inteiramente no frontend via CDN
- **UTF-8 forçado**: O `server.js` tem middleware que adiciona `charset=utf-8` a todas as respostas JSON
- **Headers da API WhatsApp**: Sempre usar `buildApiHeaders()` que inclui `apikey` do `.env`
- **Padrão de serviço**: Lógica de negócio fica em `services/`, rotas ficam em `server.js` ou `api/v1/routes/`

### Frontend
- **Estado centralizado**: Todo estado mutável fica em `state.js`. Nunca criar variáveis globais
- **Normalização de nomes**: Sempre usar `normalizarTexto()` de `utils.js` ao comparar nomes de setores entre arquivos
- **Log visual**: Usar `adicionarLog(tipo, mensagem)` de `logger.js` — tipos válidos: `success`, `error`, `info`, `warning`
- **Nomes de colunas**: O sistema aceita variações (ex: `orcado`, `orcado_total`, `orcamento_total`, `orcado_mensal`) via `obterCampo()` que normaliza chaves

### CSS
- **Sem classes utilitárias**: CSS puro, sem Tailwind ou similares
- **Cores do sistema**: Verde WhatsApp (`#25D366`, `#128C7E`), Vermelho (`#dc3545`), Amarelo (`#ffc107`), Verde sucesso (`#28a745`), Azul info (`#17a2b8`)
- **Animações**: `slideIn`, `fadeInUp`, `spin` (spinner), `move` (pattern do header)

---

## Fluxo de Dados Completo

```
[Usuário carrega 3 planilhas no browser]
        │
        ▼
dataLoader.js → processarArquivo() → Excel/CSV → JSON
        │
        ▼
processarDados() → Cruza "Contatos" × "Geral" × "Categorias"
        │           Agrupa por: Setor → Grupo → Categoria → Classificação
        │           Identifica classificações estouradas
        ▼
state.dadosProcessados[] → Array de objetos dadosSetor
        │
        ├──► ui.js renderiza dashboard + lista de setores
        │
        ├──► pdf.js → POST /api/gerar-pdf-preview → pdf.service.js → PDF buffer
        │
        └──► messaging.js → gerarMensagem() + dispararMensagens()
                    │
                    ▼
              api.js → POST /api/send-message (com retry 3×)
                    │
                    ▼
              server.js → axios POST Evolution API /message/sendText
                       → axios POST Evolution API /message/sendMedia (PDF base64)
```

---

## Comandos

```bash
npm install          # Instalar dependências
npm run dev          # Desenvolvimento com hot-reload (nodemon)
npm start            # Produção

# Docker
docker-compose up --build -d    # Build e start
docker-compose down             # Parar
```

---

## Armadilhas Conhecidas

1. **Dois Express apps**: `server.js` e `app.js` são independentes. O `app.js` não é usado pelo `server.js`. Cuidado para não confundir em qual adicionar rotas.

2. **`renderTabela_old.txt`** e **`tmp_view.txt`**: Arquivos legados/temporários na raiz. Não são usados pelo sistema. Podem ser removidos.

3. **`setores.txt`**: Documentação interna sobre mapeamento de setores. Não é código executável.

4. **`xlsx` duplicado no HTML**: A lib `xlsx` é carregada duas vezes em `index.html` (linhas 8 e 139). A segunda é a que efetivamente funciona pois o script principal é `type="module"`.

5. **Formatação monetária com monkey-patch**: `formatarMoedaDinamico()` em `pdf.service.js` faz monkey-patching no método `doc.text()` do PDFKit para restaurar tamanho de fonte. Cuidado ao alterar essa função.

6. **Rodapé do PDF desabilitado**: A chamada a `renderRodape()` está comentada em `gerarPDFOrcamento()`. A função existe mas não é usada.

7. **Telefone**: O sistema assume DDI Brasil (`55`). Números são truncados em 13 dígitos.

8. **models/ vazio**: O diretório `models/` contém apenas `.gitkeep`. Não há ORM nem banco de dados — todos os dados são processados em memória no frontend.
