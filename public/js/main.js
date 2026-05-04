import { adicionarLog } from './logger.js';
import { testarAPI, exibirQRCode } from './api.js';
import { toggleEnvioPDF, atualizarEstadoPdf } from './pdf.js';
import {
  carregarArquivoCategoria,
  carregarArquivoContatos,
  extrairSetoresUnicos,
  removerArquivoContatos
} from './dataLoader.js';
import { refreshUI, recarregarDados } from './ui.js';
import {
  abrirModalSelecaoEnvio,
  fecharModalSelecaoEnvio,
  confirmarEnvioSelecionado
} from './envio.js';
import {
  abrirModalContatos,
  fecharModalContatos,
  abrirModalEscolhaContatos,
  fecharModalEscolha,
  acionarImportacaoArquivo,
  fecharModalNomearContatosImportados,
  salvarNomearContatosImportados
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
  if (disparadorBtn) disparadorBtn.addEventListener('click', abrirModalSelecaoEnvio);

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

  // Ações dentro do modal gerenciador
  document.getElementById('btnAnexarPlanilhaModal')?.addEventListener('click', () => {
    acionarImportacaoArquivo();
    document.getElementById('btnRemoverPlanilhaModal').style.display = 'inline-block';
  });

  document.getElementById('btnRemoverPlanilhaModal')?.addEventListener('click', () => {
    removerArquivoContatos();
    document.getElementById('btnRemoverPlanilhaModal').style.display = 'none';
  });

  // Modal Nomear Contatos Importados
  const modalNomear = document.getElementById('modalNomearContatosImportados');
  if (modalNomear) {
    modalNomear.addEventListener('click', (e) => {
      if (e.target === modalNomear) fecharModalNomearContatosImportados();
    });
  }
  document.getElementById('btnFecharNomearImportados')?.addEventListener('click', fecharModalNomearContatosImportados);
  document.getElementById('btnPularNomearImportados')?.addEventListener('click', fecharModalNomearContatosImportados);
  document.getElementById('btnSalvarNomearImportados')?.addEventListener('click', salvarNomearContatosImportados);

  // â”€â”€ Modal SeleÃ§Ã£o de Envio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const modalSelecao = document.getElementById('modalSelecaoEnvio');
  if (modalSelecao) {
    modalSelecao.addEventListener('click', (e) => {
      if (e.target === modalSelecao) fecharModalSelecaoEnvio();
    });
  }
  document.getElementById('btnFecharSelecaoEnvio')?.addEventListener('click', fecharModalSelecaoEnvio);
  document.getElementById('btnCancelarSelecaoEnvio')?.addEventListener('click', fecharModalSelecaoEnvio);
  document.getElementById('btnConfirmarSelecaoEnvio')?.addEventListener('click', confirmarEnvioSelecionado);
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
