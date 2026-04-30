import { state } from './state.js';
import { adicionarLog } from './logger.js';
import { calcularPercentual } from './metrics.js';
import { enviarMensagemWhatsAppComRetry } from './api.js';

export function gerarMensagem(setor) {
  const percentual = calcularPercentual(setor.realizado, setor.orcado);
  const diferencaSetor = (setor.orcado || 0) - (setor.realizado || 0);
  const linhas = [];

  linhas.push(
    `Olá! Segue abaixo o relatório do setor *${setor.nome}*, com os valores orçados e realizados. O detalhamento completo está disponível no PDF em anexo.`
  );
  linhas.push('');
  linhas.push('*RESUMO FINANCEIRO*');
  linhas.push(
    `• Valor orçado: R$ ${(setor.orcado || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2
    })}`
  );
  linhas.push(
    `• Valor realizado: R$ ${(setor.realizado || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2
    })}`
  );
  linhas.push(
    `• Diferença: R$ ${diferencaSetor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2
    })}`
  );
  linhas.push(`• Percentual realizado: ${percentual.toFixed(2)}%`);

  const status =
    percentual >= 100
      ? {
          icone: '🚨',
          titulo: '*Crítico* – orçamento ultrapassado.',
          complemento: '> Recomendamos atenção imediata.'
        }
      : percentual >= 90
      ? {
          icone: '⚠️',
          titulo: '*Alerta* – próximo do limite.',
          complemento: '> Sugerimos acompanhar os próximos movimentos.'
        }
      : {
          icone: '✅',
          titulo: 'Controlado.',
          complemento: '> Situação dentro do planejado.'
        };

  linhas.push('');
  linhas.push(`${status.icone} *Situação atual:* ${status.titulo}`);
  linhas.push(`  ${status.complemento}`);

  if (Array.isArray(setor.classificacoes) && setor.classificacoes.length > 0) {
    linhas.push('');
    linhas.push(
      `_Foram identificadas ${setor.classificacoes.length} classificação(ões) com orçamento ultrapassado._ *Detalhes no PDF.*`
    );
  }

  linhas.push('');
  linhas.push('Ficamos à disposição para qualquer esclarecimento adicional.');
  linhas.push(`*Gerado em: ${new Date().toLocaleString('pt-BR')}*`);

  return linhas.join('\n');
}

export async function dispararMensagens() {
  if (state.dadosProcessados.length === 0) {
    adicionarLog('error', 'Nenhum setor carregado para disparo.');
    return;
  }

  const apiStatus = document.getElementById('apiStatus');
  if (apiStatus && apiStatus.textContent === 'OFFLINE') {
    adicionarLog('warning', 'Teste a conexão com a API antes de iniciar o disparo.');
    return;
  }

  const btn = document.getElementById('disparadorBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<div class="spinner" style="width: 20px; height: 20px;"></div> Enviando mensagens...';
  }

  const modoPDF = state.enviarPdfHabilitado ? ' (com PDF)' : '';
  adicionarLog(
    'info',
    `Iniciando disparo${modoPDF} para ${state.dadosProcessados.length} setores.`
  );

  let sucessos = 0;
  let erros = 0;

  for (const [index, setor] of state.dadosProcessados.entries()) {
    try {
      // Pula setor sem contato cadastrado
      if (!setor.telefone) {
        adicionarLog(
          'warning',
          `${setor.nome} - sem telefone cadastrado. Setor ignorado no disparo.`
        );
        erros += 1;
        continue;
      }

      const descricaoPdf = state.enviarPdfHabilitado ? ' + PDF' : '';
      adicionarLog(
        'info',
        `Enviando para ${setor.nome}${descricaoPdf} (${index + 1}/${
          state.dadosProcessados.length
        }).`
      );

      const mensagem = gerarMensagem(setor);
      const resultado = await enviarMensagemWhatsAppComRetry(
        mensagem,
        setor.telefone,
        setor
      );

      if (resultado.success) {
        let mensagemSucesso = `${setor.nome} - mensagem enviada com sucesso`;
        const pdfInfo = resultado.pdf || resultado.response?.pdf;

        if (state.enviarPdfHabilitado) {
          if (pdfInfo?.success) {
            mensagemSucesso += ' e PDF enviado';
          } else if (pdfInfo && pdfInfo.success === false) {
            mensagemSucesso += ' (PDF falhou)';
            adicionarLog(
              'warning',
              `${setor.nome} - falha no envio do PDF: ${pdfInfo.message || 'sem detalhes'}`
            );
          } else {
            mensagemSucesso += ' (PDF sem confirmação)';
          }
        }

        adicionarLog('success', mensagemSucesso);
        sucessos += 1;
      } else {
        const errorMsg =
          resultado.response?.message || resultado.error || 'Erro desconhecido';
        adicionarLog('error', `${setor.nome} - erro: ${errorMsg}`);
        erros += 1;
      }

      const intervalo = state.enviarPdfHabilitado ? 3000 : 2000;
      if (index < state.dadosProcessados.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalo));
      }
    } catch (error) {
      adicionarLog('error', `${setor.nome} - erro: ${error.message}`);
      erros += 1;

      if (error.message.includes('rede') || error.message.includes('timeout')) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  adicionarLog(
    'info',
    `Disparo finalizado. Sucessos: ${sucessos}. Erros: ${erros}.`
  );

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span>📤</span> Disparar Mensagens para Setores';
  }
}
