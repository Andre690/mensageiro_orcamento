📊 Disparador de Mensagens - Sistema Orçamentário

Sistema web para envio de mensagens via API de WhatsApp com base em dados orçamentários de setores carregados a partir de planilhas Excel.

🚀 Funcionalidades

Upload de 3 planilhas (.xlsx/.xls/.csv):

Orçamento Geral

Orçamento por Categoria

Contatos dos Setores

Geração automática de relatório de controle orçamentário

Disparo de mensagens personalizadas para cada setor via WhatsApp API

Reenvio automático em caso de falha (até 3 tentativas)

Log de sucesso e falhas

Interface responsiva e simples

📁 Estrutura do Projeto

seu-projeto/
├── public/
│   ├── index.html       # Interface web
│   ├── style.css        # Estilos da pagina
│   └── js/              # Modulos JavaScript do frontend
│       ├── main.js      # Inicializacao e bindings de eventos
│       ├── dataLoader.js# Importacao e processamento de planilhas
│       ├── messaging.js # Disparo de mensagens e geracao de texto
│       ├── api.js       # Integracao com o backend
│       ├── ui.js        # Atualizacoes de interface
│       ├── state.js     # Estado compartilhado do frontend
│       └── utils.js etc # Utilitarios e funcoes de apoio
├── server.js            # Backend Express que envia mensagens para API
├── .env                 # Configuracao da API WhatsApp (URL, KEY, etc.)
├── package.json         # Dependencias e scripts
└── README.md
Configuração da API WhatsApp (URL, KEY, etc.)
├── package.json         # Dependências e scripts
└── README.md

⚙️ Configuração Inicial

1. Instalar dependências:

npm install

3. Iniciar o servidor

node server.js

Ou com nodemon (se instalado):

npx nodemon server.js

Acesse em:

http://localhost:3000

📤 Como Usar

Abra a página principal no navegador

Carregue os 3 arquivos Excel correspondentes

Visualize os setores, status orçamentário e estatísticas

Clique em “Disparar Mensagens”

O sistema processa, envia via API e exibe o log

🛠 Tecnologias Usadas

Front-end: HTML, CSS, JavaScript puro, XLSX.js

Back-end: Node.js + Express + dotenv + axios

✅ Observações Importantes

A API do WhatsApp precisa estar rodando e acessível pela rede

Os arquivos Excel devem ter estrutura compatível com o sistema

Os campos de configuração da API foram retirados do front e são definidos via .env

📄 Licença

Projeto desenvolvido para uso interno. Caso queira customizar ou reutilizar, adapte conforme necessidade.
