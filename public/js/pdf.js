import { state } from './state.js';
import { adicionarLog } from './logger.js';

export function atualizarEstadoPdf() {
  const checkbox = document.getElementById('togglePdfCheckbox');
  if (!checkbox) return;

  // Sincroniza o state com o checkbox
  state.enviarPdfHabilitado = checkbox.checked;
}

export function toggleEnvioPDF() {
  const checkbox = document.getElementById('togglePdfCheckbox');
  if (!checkbox) return;

  state.enviarPdfHabilitado = checkbox.checked;

  if (state.enviarPdfHabilitado) {
    adicionarLog('info', 'Envio de PDF habilitado. O arquivo será enviado após a mensagem.');
  } else {
    adicionarLog('info', 'Envio de PDF desabilitado. Apenas a mensagem será enviada.');
  }
}

export async function visualizarPDF(setor) {
  if (!setor) {
    adicionarLog('warning', 'Nenhum setor selecionado para gerar preview.');
    return;
  }

  try {
    adicionarLog('info', `Gerando preview do PDF para ${setor.nome}...`);

    const response = await fetch('/api/gerar-pdf-preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json; charset=utf-8'
      },
      body: JSON.stringify({ dadosSetor: setor })
    });

    if (!response.ok) {
      throw new Error('Erro ao gerar PDF.');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');

    adicionarLog('success', `Preview do PDF gerado para ${setor.nome}.`);
  } catch (error) {
    adicionarLog('error', `Erro ao gerar preview: ${error.message}`);
  }
}