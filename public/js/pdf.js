import { state } from './state.js';
import { adicionarLog } from './logger.js';

export function atualizarEstadoPdf() {
  const btn = document.getElementById('togglePdfBtn');
  if (!btn) return;

  if (state.enviarPdfHabilitado) {
    btn.classList.add('active');
    btn.innerHTML = '<span>PDF</span> PDF Ativado';
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '<span>PDF</span> Enviar PDF';
  }
}

export function toggleEnvioPDF() {
  state.enviarPdfHabilitado = !state.enviarPdfHabilitado;
  atualizarEstadoPdf();

  if (state.enviarPdfHabilitado) {
    adicionarLog('info', 'Envio de PDF habilitado. O arquivo sera enviado apos a mensagem.');
  } else {
    adicionarLog('info', 'Envio de PDF desabilitado. Apenas a mensagem sera enviada.');
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
