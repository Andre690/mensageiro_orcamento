import { state } from './state.js';
import { adicionarLog } from './logger.js';
import { calcularPercentual } from './metrics.js';
import { enviarMensagemWhatsAppComRetry } from './api.js';

export function gerarMensagem(setor) {
  const percentual = calcularPercentual(setor.realizado, setor.orcado);
  const linhas = [];

  linhas.push('*RELATORIO ORCAMENTARIO*');
  linhas.push(`*Setor:* ${setor.nome}`);
  linhas.push(
    `*Orcado:* R$ ${setor.orcado.toLocaleString('pt-BR', {
      minimumFractionDigits: 2
    })}`
  );
  linhas.push(
    `*Realizado:* R$ ${setor.realizado.toLocaleString('pt-BR', {
      minimumFractionDigits: 2
    })}`
  );
  linhas.push(`*Percentual atingido:* ${percentual.toFixed(2)}%`);
  linhas.push('');

  if (percentual >= 100) {
    linhas.push('*ATENCAO:* setor ultrapassou o orcamento.');
  } else if (percentual >= 90) {
    linhas.push('*ALERTA:* setor proximo do limite de orcamento.');
  } else {
    linhas.push('Situcao controlada.');
  }

  linhas.push('');
  linhas.push('*Resumo por grupo:*');

  setor.grupos.forEach((grupo) => {
    const percGrupo = calcularPercentual(grupo.realizado, grupo.orcado);
    linhas.push(`- ${grupo.nome}: ${percGrupo.toFixed(1)}% (R$ ${grupo.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);

    grupo.categorias.forEach((categoria) => {
      const percCategoria = calcularPercentual(categoria.realizado, categoria.orcado);
      linhas.push(
        `  • ${categoria.nome}: ${percCategoria.toFixed(1)}% (R$ ${categoria.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
      );
    });
  });

  if (setor.classificacoes.length > 0) {
    linhas.push('');
    linhas.push('*Classificacoes estouradas:*');
    setor.classificacoes.forEach((classificacao) => {
      linhas.push(
        `- ${classificacao.nome} (${classificacao.categoria} / ${classificacao.grupo}) - Realizado R$ ${classificacao.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      );
    });
  }

  linhas.push('');
  linhas.push(`Relatorio gerado em: ${new Date().toLocaleString('pt-BR')}`);
  linhas.push('Sistema de Controle Orcamentario');

  return linhas.join('\n');
}

export async function dispararMensagens() {
  if (state.dadosProcessados.length === 0) {
    adicionarLog('error', 'Nenhum setor carregado para disparo.');
    return;
  }

  const apiStatus = document.getElementById('apiStatus');
  if (apiStatus && apiStatus.textContent === 'OFFLINE') {
    adicionarLog('warning', 'Teste a conexao com a API antes de iniciar o disparo.');
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
            mensagemSucesso += ' (PDF sem confirmacao)';
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
    btn.innerHTML = '<span>Enviar</span> Disparar Mensagens para Setores';
  }
}
