# 📊 Disparador de Mensagens - Controle Orçamentário via WhatsApp

Sistema web desenvolvido para leitura de arquivos Excel (.xlsx, .xls ou .csv), processamento de dados orçamentários e envio automatizado de mensagens via API WhatsApp para setores definidos.

---

## 🚀 Funcionalidades

- Leitura de 3 planilhas: Orçamento Geral, Orçamento por Categoria e Contatos
- Análise de consumo por setor (ultrapassado, próximo, controlado)
- Geração automática de mensagens de alerta orçamentário
- Disparo em massa via API WhatsApp com até **3 tentativas por setor**
- Interface visual moderna com painéis e logs em tempo real

---

## 🧰 Tecnologias Utilizadas

- HTML5 + CSS3 + JavaScript
- Biblioteca [xlsx](https://cdnjs.com/libraries/xlsx) para leitura de planilhas
- API REST para envio de mensagens via WhatsApp

---

## 🖥️ Como Rodar o Projeto

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
cd disparador-orcamento
```

### 2. Inicie um servidor local (exemplo com Node.js ou Python)

#### Usando VS Code + extensão Live Server (recomendado):
- Clique com botão direito em `index.html` > **"Open with Live Server"**

#### Alternativa via terminal com Python 3:
```bash
python -m http.server
# Acesse http://localhost:8000
```

---

## 📁 Estrutura esperada dos arquivos

### 🗂️ Arquivo 1: `arquivodedados.xlsx` (Orçamento Geral)

| Setor      | ORÇADO | REALIZADO |
|------------|--------|-----------|
| Marketing  | 10000  | 9500      |

### 🗂️ Arquivo 2: `OrcamentoCategoria.xlsx` (Por Classificação)

| Setor      | Classificação     | ORÇADO | REALIZADO |
|------------|-------------------|--------|-----------|
| Marketing  | Google Ads        | 3000   | 3200      |

### 🗂️ Arquivo 3: `contato_setores.xlsx` (Contatos)

| nome_setor | numero           |
|------------|------------------|
| Marketing  | 81999999999      |

> ⚠️ Os números devem estar no padrão nacional. O sistema irá padronizar para `55XXXXXXXXXXX`.

---

## ⚙️ Configuração da API WhatsApp

Na interface principal, preencha:

- **URL da API**: `http://192.168.99.41:8080`
- **Instância**: `MensageiroOrcamento` (nome registrado na sua API)
- **Chave da API**: `T0pF4m4D3vs` (ou a sua chave)

Clique em **"🔍 Testar Conexão"** para validar.

---

## 📤 Como utilizar

1. Acesse a interface local pelo navegador
2. Preencha a configuração da API
3. Carregue os 3 arquivos exigidos
4. Aguarde o processamento dos dados
5. Clique em **“📤 Disparar Mensagens para Setores”**

> O sistema irá enviar uma mensagem personalizada para cada setor detectado com base nas planilhas.

---

## 🛡️ Segurança

Evite subir sua `apikey` em repositórios públicos. Adicione um `.gitignore` e guarde essas informações em `.env` ou configuráveis.

---

## 👨‍💻 Desenvolvido por

AutomatizAI • Especialista em automação com n8n, Python, APIs e UIs
