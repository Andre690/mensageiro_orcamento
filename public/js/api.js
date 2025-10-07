import { state } from './state.js';
import { adicionarLog } from './logger.js';

function getApiHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json; charset=utf-8'
  };
}

export async function testarAPI() {
  try {
    const response = await fetch('/api/testar-conexao', {
      headers: { Accept: 'application/json; charset=utf-8' }
    });
    const data = await response.json();

    const estado = data.raw?.instance?.state || data.state || 'desconhecido';
    const statusEl = document.getElementById('apiStatus');
    if (!statusEl) return;

    if (estado === 'open' || estado === 'CONNECTED') {
      statusEl.textContent = 'ONLINE';
      statusEl.className = 'api-status online';
      adicionarLog('success', 'API conectada com sucesso.');
    } else {
      statusEl.textContent = 'OFFLINE';
      statusEl.className = 'api-status offline';
      adicionarLog('warning', `API respondeu, mas o estado informado foi: ${estado}.`);
    }
  } catch (error) {
    const statusEl = document.getElementById('apiStatus');
    if (statusEl) {
      statusEl.textContent = 'OFFLINE';
      statusEl.className = 'api-status offline';
    }
    adicionarLog('error', `Erro ao testar API: ${error.message}`);
  }
}

export async function exibirQRCode() {
  const qrImg = document.getElementById('qrCodeImage');
  const qrContainer = document.getElementById('qrCodeContainer');
  if (!qrImg || !qrContainer) return;

  qrContainer.style.display = 'block';
  qrImg.src = '';
  qrImg.alt = 'Carregando...';

  try {
    const response = await fetch('/api/qrcode', {
      headers: {
        Accept: 'application/json; charset=utf-8'
      }
    });
    const data = await response.json();

    if (data.qrcode) {
      qrImg.src = data.qrcode;
      qrImg.alt = 'QR Code';
      adicionarLog('info', 'QR Code carregado com sucesso.');
    } else {
      qrImg.alt = 'QR Code indisponivel';
      adicionarLog('warning', data.message || 'Instancia ja conectada.');
    }
  } catch (error) {
    qrImg.alt = 'Erro ao carregar QR Code';
    adicionarLog('error', `Erro ao obter QR Code: ${error.message}`);
  }
}

export async function enviarMensagemWhatsApp(mensagem, telefone, dadosSetor = null) {
  try {
    const payload = {
      number: telefone,
      text: mensagem
    };

    if (state.enviarPdfHabilitado && dadosSetor) {
      payload.enviarPdf = true;
      payload.dadosSetor = dadosSetor;
    }

    const resp = await fetch('/api/send-message', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(payload)
    });

    let body = null;
    try {
      body = await resp.json();
    } catch (error) {
      adicionarLog('warning', 'Resposta do backend nao possui JSON valido.');
    }

    if (!resp.ok) {
      const msg =
        body?.message || body?.provider?.message || `Falha HTTP ${resp.status}`;
      return { success: false, status: resp.status, response: body, error: msg };
    }

    return {
      success: body?.success !== false,
      status: resp.status,
      response: body,
      pdf: body?.pdf || null
    };
  } catch (error) {
    return {
      success: false,
      error: 'Backend indisponivel ou bloqueado.'
    };
  }
}

export async function enviarMensagemWhatsAppComRetry(
  mensagem,
  telefone,
  dadosSetor = null,
  tentativas = 3
) {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let ultimaResposta = null;

  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    try {
      const resposta = await enviarMensagemWhatsApp(mensagem, telefone, dadosSetor);
      if (resposta.success) {
        return resposta;
      }

      ultimaResposta = resposta;
      const mensagemErro =
        resposta.response?.message || resposta.error || 'Erro desconhecido';
      adicionarLog(
        'warning',
        `${telefone} - Tentativa ${tentativa} falhou: ${mensagemErro}`
      );
    } catch (error) {
      ultimaResposta = { error: error.message };
      adicionarLog(
        'warning',
        `${telefone} - Erro na tentativa ${tentativa}: ${error.message}`
      );
    }

    if (tentativa < tentativas) {
      adicionarLog(
        'info',
        `${telefone} - Aguardando ${tentativa * 3}s para proxima tentativa...`
      );
      await delay(tentativa * 3000);
    }
  }

  return ultimaResposta;
}
