import { adicionarLog } from './logger.js';
import { testarAPI, exibirQRCode } from './api.js';
import { toggleEnvioPDF, atualizarEstadoPdf } from './pdf.js';
import {
  carregarArquivoSetor,
  carregarArquivoCategoria,
  carregarArquivoContatos
} from './dataLoader.js';
import { refreshUI, recarregarDados } from './ui.js';
import { dispararMensagens } from './messaging.js';

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

  const fileSetor = document.getElementById('fileSetor');
  if (fileSetor) {
    fileSetor.addEventListener('change', carregarArquivoSetor);
  }

  const fileCategoria = document.getElementById('fileCategoria');
  if (fileCategoria) {
    fileCategoria.addEventListener('change', carregarArquivoCategoria);
  }

  const fileContatos = document.getElementById('fileContatos');
  if (fileContatos) {
    fileContatos.addEventListener('change', carregarArquivoContatos);
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