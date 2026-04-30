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
  salvarContatosDoModal
} from './contatos.js';

function bindEvents() {
  const testApiBtn = document.getElementById('testApiBtn');
  if (testApiBtn) {
    testApiBtn.addEventListener('click', testarAPI);
  }

  const connectWhatsAppBtn = document.getElementById('connectWhatsAppBtn');
  if (connectWhatsAppBtn) {
    connectWhatsAppBtn.addEventListener('click', exibirQRCode);
  }

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', recarregarDados);
  }

  const togglePdfCheckbox = document.getElementById('togglePdfCheckbox');
  if (togglePdfCheckbox) {
    togglePdfCheckbox.addEventListener('change', toggleEnvioPDF);
  }

  const disparadorBtn = document.getElementById('disparadorBtn');
  if (disparadorBtn) {
    disparadorBtn.addEventListener('click', dispararMensagens);
  }

  const fileCategoria = document.getElementById('fileCategoria');
  if (fileCategoria) {
    fileCategoria.addEventListener('change', carregarArquivoCategoria);
  }

  const fileContatos = document.getElementById('fileContatos');
  if (fileContatos) {
    fileContatos.addEventListener('change', carregarArquivoContatos);
  }

  // Botão "Gerenciar Contatos" (abre modal manual sem upload)
  const btnGerenciarContatos = document.getElementById('btnGerenciarContatos');
  if (btnGerenciarContatos) {
    btnGerenciarContatos.addEventListener('click', () => {
      const setores = extrairSetoresUnicos();
      if (setores.length === 0) {
        adicionarLog('warning', 'Carregue a planilha de orçamento primeiro para gerenciar os contatos.');
        return;
      }
      abrirModalContatos(setores);
    });
  }

  // Modal: fechar pelo botão X
  const btnFecharModal = document.getElementById('btnFecharModalContatos');
  if (btnFecharModal) {
    btnFecharModal.addEventListener('click', fecharModalContatos);
  }

  // Modal: fechar clicando no overlay
  const modalContatos = document.getElementById('modalContatos');
  if (modalContatos) {
    modalContatos.addEventListener('click', (e) => {
      if (e.target === modalContatos) fecharModalContatos();
    });
  }

  // Modal: salvar contatos
  const btnSalvarContatos = document.getElementById('btnSalvarContatos');
  if (btnSalvarContatos) {
    btnSalvarContatos.addEventListener('click', salvarContatosDoModal);
  }
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