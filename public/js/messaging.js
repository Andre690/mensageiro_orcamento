import { state } from './state.js';
import { adicionarLog } from './logger.js';
import { calcularPercentual } from './metrics.js';
import { enviarMensagemWhatsAppComRetry } from './api.js';

export function gerarMensagem(setor) {
  const percentual = calcularPercentual(setor.realizado, setor.orcado);
  const linhas = [];

  // Cabeçalho
  linhas.push('📊 *RELATÓRIO ORÇAMENTÁRIO*\n');
  
  // Setor
  linhas.push('🏢 *SETOR*');
  linhas.push(`   ${setor.nome}\n`);
  
  // Valores
  linhas.push('💰 *VALORES*');
  linhas.push(`   • Orçado: R$ ${setor.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  linhas.push(`   • Realizado: R$ ${setor.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  const diferencaSetor = (setor.orcado || 0) - (setor.realizado || 0);
  linhas.push(`   • Diferença: R$ ${diferencaSetor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  linhas.push(`   • Percentual: ${percentual.toFixed(2)}%\n`);
  
  // Status
  linhas.push('📊 *STATUS*');
  if (percentual >= 100) {
    linhas.push('   🚨 *CRÍTICO - Orçamento ultrapassado!*');
    linhas.push('   Ação imediata necessária\n');
  } else if (percentual >= 90) {
    linhas.push('   ⚠️ *ALERTA - Próximo do limite!*');
    linhas.push('   Atenção necessária\n');
  } else {
    linhas.push('   ✅ *CONTROLADO*');
    linhas.push('   Situação estável\n');
  }
  
  // Detalhamento por categoria
  linhas.push('📋 *DETALHAMENTO POR CATEGORIA*\n');

  setor.grupos.forEach((grupo) => {
    const percGrupo = calcularPercentual(grupo.realizado, grupo.orcado);
    const iconeGrupo = percGrupo >= 100 ? '🔴' : percGrupo >= 90 ? '🟡' : '🟢';
    
    linhas.push(`${iconeGrupo} *${grupo.nome}*`);
    linhas.push(`   Orçado: R$ ${grupo.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Realizado: R$ ${grupo.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${percGrupo.toFixed(2)}%)`);
    const diferencaGrupo = (grupo.orcado || 0) - (grupo.realizado || 0);
    linhas.push(`   Diferença: R$ ${diferencaGrupo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    grupo.categorias.forEach((categoria) => {
      const percCategoria = calcularPercentual(categoria.realizado, categoria.orcado);
      
      linhas.push(`   ▸ *${categoria.nome}*`);
      linhas.push(`     Orçado: R$ ${categoria.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      linhas.push(`     Realizado: R$ ${categoria.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      const diferencaCategoria = (categoria.orcado || 0) - (categoria.realizado || 0);
      linhas.push(`     Diferença: R$ ${diferencaCategoria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      linhas.push(`     Percentual: ${percCategoria.toFixed(2)}%`);
      
      // Verifica classificações estouradas nesta categoria
      const classificacoesEstouradas = categoria.classificacoes.filter(
        c => c.orcado > 0 && c.realizado > c.orcado
      );
      
      if (classificacoesEstouradas.length > 0) {
        linhas.push('     ⚠ *Itens com orçamento estourado:*');
        classificacoesEstouradas.forEach((classificacao) => {
          const percClass = calcularPercentual(classificacao.realizado, classificacao.orcado);
          linhas.push(`     • ${classificacao.nome}`);
          linhas.push(`       Orç: R$ ${classificacao.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Real: R$ ${classificacao.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${percClass.toFixed(2)}%)`);
        });
      }
    });
    
    linhas.push(''); // Linha em branco entre grupos
  });

  // Atenção especial
  if (setor.classificacoes.length > 0) {
    linhas.push('🚨 *ATENÇÃO ESPECIAL*');
    linhas.push(`   Total de ${setor.classificacoes.length} classificação(ões) com orçamento ultrapassado\n`);
  }

  // Rodapé
  linhas.push(`📅 Gerado em: ${new Date().toLocaleString('pt-BR')}`);
  linhas.push('💼 Sistema de Controle Orçamentário');

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
