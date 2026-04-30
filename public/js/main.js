import { adicionarLog } from './logger.js';
import { testarAPI, exibirQRCode } from './api.js';
import { toggleEnvioPDF, atualizarEstadoPdf } from './pdf.js';
import {
  carregarArquivoCategoria,
  carregarArquivoContatos,
  extrairSetoresUnicos
} from './dataLoader.js';
import { refreshUI, recarregarDados } from './ui.js';
import { dispararMensagens } from './messaging.js';
import {
  abrirModalContatos,
  fecharModalContatos,
  abrirModalEscolhaContatos,
  fecharModalEscolha,
  acionarImportacaoArquivo
} from './contatos.js';

function bindEvents() {
  const testApiBtn = document.getElementById('testApiBtn');
  if (testApiBtn) testApiBtn.addEventListener('click', testarAPI);

  const connectWhatsAppBtn = document.getElementById('connectWhatsAppBtn');
  if (connectWhatsAppBtn) connectWhatsAppBtn.addEventListener('click', exibirQRCode);

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', recarregarDados);

  const togglePdfCheckbox = document.getElementById('togglePdfCheckbox');
  if (togglePdfCheckbox) togglePdfCheckbox.addEventListener('change', toggleEnvioPDF);

  const disparadorBtn = document.getElementById('disparadorBtn');
  if (disparadorBtn) disparadorBtn.addEventListener('click', dispararMensagens);

  const fileCategoria = document.getElementById('fileCategoria');
  if (fileCategoria) fileCategoria.addEventListener('change', carregarArquivoCategoria);

  // fileContatos: oculto, acionado via botão "Importar Arquivo" no modal de escolha
  const fileContatos = document.getElementById('fileContatos');
  if (fileContatos) fileContatos.addEventListener('change', carregarArquivoContatos);

  // ── Modal de Escolha ──────────────────────────────────────────────────────
  // Fechar pelo overlay
  const modalEscolha = document.getElementById('modalEscolhaContatos');
  if (modalEscolha) {
    modalEscolha.addEventListener('click', (e) => {
      if (e.target === modalEscolha) fecharModalEscolha();
    });
  }
  document.getElementById('btnEscolhaFechar')?.addEventListener('click', fecharModalEscolha);

  // Opção 1: importar arquivo
  document.getElementById('btnEscolhaArquivo')?.addEventListener('click', acionarImportacaoArquivo);

  // Opção 2: digitar / usar salvos
  document.getElementById('btnEscolhaDigitar')?.addEventListener('click', () => {
    fecharModalEscolha();
    abrirModalContatos();
  });

  // ── Modal Gerenciador de Contatos ─────────────────────────────────────────
  const btnGerenciar = document.getElementById('btnGerenciarContatos');
  if (btnGerenciar) {
    btnGerenciar.addEventListener('click', () => {
      const setores = extrairSetoresUnicos();
      if (setores.length === 0) {
        adicionarLog('warning', 'Carregue a planilha de orçamento primeiro para gerenciar os contatos.');
        return;
      }
      abrirModalContatos(setores);
    });
  }

  const btnFecharContatos = document.getElementById('btnFecharModalContatos');
  if (btnFecharContatos) btnFecharContatos.addEventListener('click', fecharModalContatos);

  const modalContatos = document.getElementById('modalContatos');
  if (modalContatos) {
    modalContatos.addEventListener('click', (e) => {
      if (e.target === modalContatos) fecharModalContatos();
    });
  }

  // Fechar gerenciador via botão "Concluído"
  document.getElementById('btnConcluidoContatos')?.addEventListener('click', fecharModalContatos);
}


document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  refreshUI();
  atualizarEstadoPdf();

  adicionarLog('success', 'Sistema inicializado com sucesso.');
  adicionarLog(
    'info',
    'Configure a API WhatsApp e carregue os arquivos de dados para iniciar.'
  );

  setTimeout(() => {
    testarAPI();
  }, 1000);
});