import { state, resetDadosCarregados } from './state.js';
import { adicionarLog } from './logger.js';
import { calcularPercentual, getStatusClass, getStatusText } from './metrics.js';
import { visualizarPDF, atualizarEstadoPdf } from './pdf.js';

function getElement(id) {
  return document.getElementById(id);
}

export function atualizarEstatisticas() {
  let ultrapassados = 0;
  let proximos = 0;
  let controlados = 0;

  state.dadosProcessados.forEach((setor) => {
    const percentual = calcularPercentual(setor.realizado, setor.orcado);
    if (percentual >= 100) {
      ultrapassados += 1;
    } else if (percentual >= 90) {
      proximos += 1;
    } else {
      controlados += 1;
    }
  });

  getElement('setoresUltrapassados').textContent = ultrapassados;
  getElement('setoresProximos').textContent = proximos;
  getElement('setoresControlados').textContent = controlados;
  getElement('totalSetores').textContent = state.dadosProcessados.length;
}

export function renderizarSetores() {
  const container = getElement('setoresList');
  if (!container) return;

  container.innerHTML = '';

  if (state.dadosProcessados.length === 0) {
    container.innerHTML = `
      <div class="alert alert-warning">
        <strong>Atenção:</strong> Nenhum setor encontrado. Verifique se os arquivos foram carregados corretamente e se os nomes dos setores coincidem entre os arquivos.
      </div>
    `;
    return;
  }

  const setoresOrdenados = [...state.dadosProcessados].sort((a, b) => {
    const percA = calcularPercentual(a.realizado, a.orcado);
    const percB = calcularPercentual(b.realizado, b.orcado);
    return percB - percA;
  });

  setoresOrdenados.forEach((setor) => {
    const percentual = calcularPercentual(setor.realizado, setor.orcado);
    const statusClass = getStatusClass(percentual);
    const statusText = getStatusText(percentual);
    const classificacoesEstouradas =
      (setor.classificacoes && setor.classificacoes.length) || 0;

    const setorElement = document.createElement('div');
    setorElement.className = `setor-item ${statusClass}`;
    setorElement.innerHTML = `
      <div class="setor-header">
        <div class="setor-name">${setor.nome}</div>
        <div class="setor-status status-${statusClass}">${statusText}</div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill progress-${statusClass}" style="width: ${Math.min(
          percentual,
          100
        )}%"></div>
      </div>
      <div class="setor-row">
        <span>Orçado: R$ ${setor.orcado.toLocaleString('pt-BR', {
          minimumFractionDigits: 2
        })}</span>
        <span>Realizado: R$ ${setor.realizado.toLocaleString('pt-BR', {
          minimumFractionDigits: 2
        })}</span>
        <span>${percentual.toFixed(2)}%</span>
      </div>
      <div class="setor-actions">
        <span>Telefone: ${setor.telefone}</span>
        <button class="preview-pdf-btn" type="button">Visualizar PDF</button>
        <span>${classificacoesEstouradas} classificação(ões) estourada(s)</span>
      </div>
    `;

    const previewBtn = setorElement.querySelector('.preview-pdf-btn');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => visualizarPDF(setor));
    }

    container.appendChild(setorElement);
  });
}

export function refreshUI() {
  atualizarEstatisticas();
  renderizarSetores();

  const disparadorBtn = getElement('disparadorBtn');
  if (disparadorBtn) {
    disparadorBtn.disabled = state.dadosProcessados.length === 0;
  }
}

export function recarregarDados() {
  resetDadosCarregados();

  const statusElements = [
    { id: 'statusSetor', card: 'uploadCard1' },
    { id: 'statusCategoria', card: 'uploadCard2' },
    { id: 'statusContatos', card: 'uploadCard3' }
  ];

  statusElements.forEach(({ id, card }) => {
    const statusEl = getElement(id);
    const cardEl = getElement(card);
    if (statusEl) {
      statusEl.innerHTML = 'Aguardando arquivo...';
      statusEl.style.color = '#666';
    }
    if (cardEl) {
      cardEl.classList.remove('loaded');
    }
  });

  getElement('fileSetor').value = '';
  getElement('fileCategoria').value = '';
  getElement('fileContatos').value = '';

  refreshUI();
  atualizarEstadoPdf();
  adicionarLog('info', 'Dados reiniciados. Carregue os arquivos novamente.');
}
