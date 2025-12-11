# Disparador de Mensagens - Orçamento

Sistema de gestão e disparo de mensagens de controle orçamentário via WhatsApp. O sistema permite visualizar o status do orçamento de diversos setores, gerar extratos detalhados em PDF e enviar esses relatórios automaticamente para os gestores responsáveis.

## Funcionalidades

- **Dashboard Interativo**: Visualização rápida de setores com orçamento ultrapassado, em alerta (próximos do limite) ou controlados.
- **Processamento de Excel**: Importação e análise de planilhas de Orçamento Geral, por Categoria e Contatos.
- **Geração de PDF**: Criação automática de extratos orçamentários detalhados (Entradas vs Saídas) usando `PDFKit`.
- **Integração WhatsApp**: Conexão via QR Code com API de WhatsApp (Ex: Evolution API / Baileys).
- **Envio em Massa**: Disparo automatizado de mensagens e arquivos PDF para os contatos dos setores.
- **Log de Envios**: Monitoramento em tempo real do status dos disparos.

## Tecnologias Utilizadas

- **Backend**: Node.js, Express
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Bibliotecas Principais**:
    - `pdfkit`: Geração de PDFs.
    - `xlsx`: Processamento de planilhas Excel.
    - `axios`: Requisições HTTP.
    - `socket.io` (se aplicável, ou polling): Comunicação com API.

## Pré-requisitos

- [Node.js](https://nodejs.org/) instalado.
- Uma instância de API de WhatsApp (como [Evolution API](https://github.com/EvolutionAPI/evolution-api) ou similar) rodando e configurada.

## Instalação

1. Clone o repositório ou baixe os arquivos.
2. Navegue até a pasta do projeto:
    ```bash
    cd mensageiro_orcamento
    ```
3. Instale as dependências:
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
API_KEY=sua-api-key-aqui
API_INSTANCE=NomeDaSuaInstancia
```

> **Nota**: `API_INSTANCE` deve corresponder ao nome da instância criada na sua API de gerenciamento de WhatsApp.

## Como Usar

1. **Inicie o servidor**:
    ```bash
    npm run dev
    # ou
    npm start
    ```
2. **Acesse a interface**:
    Abra o navegador em `http://localhost:4000` (ou a porta definida no `.env`).

3. **Conecte o WhatsApp**:
    - Clique em "Conectar WhatsApp" e escaneie o QR Code se necessário.
    - Aguarde o status mudar para "Conectado".

4. **Carregue as Planilhas**:
    O sistema espera 3 arquivos específicos (Excel ou CSV):
    - **Orçamento Geral**: Dados gerais de orçado x realizado por setor.
    - **Orçamento Categoria**: Detalhamento por categoria/classificação.
    - **Contatos Setores**: Mapeamento de Setor -> Número de WhatsApp.

5. **Disparar Mensagens**:
    - Verifique as estatísticas no dashboard.
    - Clique em "Disparar Mensagens para Setores".
    - Opcionalmente, desmarque "Enviar PDF" se quiser enviar apenas texto.

## Estrutura do Projeto

```
mensageiro_orcamento/
├── public/             # Arquivos do Frontend (HTML, CSS, JS)
│   ├── js/             # Lógica do cliente
│   └── style.css       # Estilos
├── services/           # Lógica de negócios
│   └── pdf.service.js  # Gerador de PDF
├── server.js           # Ponto de entrada do Backend
├── app.js              # Configuração Express (Modular - uso secundário)
└── .env                # Variáveis de ambiente
```

## Formato das Planilhas

Para que o sistema funcione corretamente, as planilhas devem seguir padrões específicos de colunas esperados pelo processador de dados (verifique `public/js/dataLoader.js` para detalhes das colunas obrigatórias como "Setor", "Realizado", "Orçado", etc).

---
Desenvolvido para automatizar o controle orçamentário.

## Docker

To run the application using Docker:

1.  Make sure you have Docker and Docker Compose installed.
2.  Create/Update your `.env` file (see above).
3.  Run the command:
    ```bash
    docker-compose up --build -d
    ```
4.  The application will be available at `http://localhost:4000`.
