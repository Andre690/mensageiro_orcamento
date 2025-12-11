const PDFDocument = require('pdfkit');

/**
 * Gera um PDF de extrato orçamentário totalmente formatado com suporte a UTF-8.
 * @param {object} dadosSetor
 * @returns {Promise<Buffer>}
 */
async function gerarPDFOrcamento(dadosSetor) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100;
      const colPercent = pageWidth - 60;
      const colDiferenca = colPercent - 90;
      const colRealizado = colDiferenca - 90;
      const colOrcado = colRealizado - 90;

      renderCabecalho(doc, dadosSetor);

      // Calcula totais separados por movimento
      const { entradas, saidas } = calcularTotaisPorMovimento(dadosSetor);

      // Renderiza resumo de Entradas se houver
      if (entradas.totalOrcado > 0 || entradas.totalRealizado > 0 || entradas.temMovimento) {
        // Pequeno ajuste para garantir que renderize se tiver movimento, mesmo que valores sejam 0 (improvável mas seguro)
        renderResumoReceitas(doc, entradas, pageWidth);
      }

      // Renderiza resumo de Saídas passamos o objeto 'saidas'
      renderResumo(doc, saidas, pageWidth);

      renderTabela(doc, dadosSetor, {
        colOrcado,
        colRealizado,
        colDiferenca,
        colPercent,
        pageWidth
      });
      //renderRodape(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Calcula os totais separados por movimento (Entrada/Saída)
 * @param {object} dados 
 * @returns {object} { entradas: { orcado, realizado, diferenca }, saidas: { orcado, realizado, diferenca } }
 */
function calcularTotaisPorMovimento(dados) {
  let entradas = { orcado: 0, realizado: 0, temMovimento: false };
  let saidas = { orcado: 0, realizado: 0 };

  const grupos = Array.isArray(dados.grupos) ? dados.grupos : [];
  const categoriasAgrupadas = grupos.flatMap((grupo) =>
    Array.isArray(grupo.categorias) ? grupo.categorias : []
  );
  const categorias =
    categoriasAgrupadas.length === 0 && Array.isArray(dados.categorias)
      ? dados.categorias
      : categoriasAgrupadas;

  categorias.forEach((categoria) => {
    const classificacoes = Array.isArray(categoria.classificacoes)
      ? categoria.classificacoes
      : [];

    classificacoes.forEach((classificacao) => {
      // Verifica o movimento
      if (isEntrada(classificacao)) {
        entradas.orcado += classificacao.orcado || 0;
        entradas.realizado += classificacao.realizado || 0;
        entradas.temMovimento = true;
      } else {
        // Assume saída se não for entrada
        saidas.orcado += classificacao.orcado || 0;
        saidas.realizado += classificacao.realizado || 0;
      }
    });
  });

  return {
    entradas: {
      orcado: entradas.orcado,
      realizado: entradas.realizado,
      diferenca: entradas.realizado - entradas.orcado, // Receita: Realizado - Orçado
      temMovimento: entradas.temMovimento
    },
    saidas: {
      orcado: saidas.orcado,
      realizado: saidas.realizado,
      diferenca: saidas.orcado - saidas.realizado // Despesa: Orçado - Realizado
    }
  };
}

/**
 * Verifica se uma classificação é uma entrada (receita)
 * @param {object} classificacao 
 * @returns {boolean}
 */
function isEntrada(classificacao) {
  const tipo = classificacao.tipo || classificacao.movimento || '';
  return tipo.toLowerCase().includes('entrada');
}

/**
 * Calcula a diferença baseada no tipo de lançamento
 * Para entradas (receitas): Realizado - Orçado
 * Para saídas (despesas): Orçado - Realizado
 * @param {number} orcado 
 * @param {number} realizado 
 * @param {boolean} isReceita 
 * @returns {number}
 */
function calcularDiferenca(orcado, realizado, isReceita) {
  if (isReceita) {
    return realizado - orcado; // Receita: quanto arrecadou a mais/menos
  }
  return orcado - realizado; // Despesa: quanto sobrou do orçamento
}

/**
 * Renderiza o cabeçalho de resumo de receitas
 * @param {PDFDocument} doc 
 * @param {object} totais 
 * @param {number} pageWidth 
 */
function renderResumoReceitas(doc, totais, pageWidth) {
  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor('#333333');

  const boxY = doc.y;
  doc
    .roundedRect(50, boxY, pageWidth, 60, 5)
    .fillAndStroke('#e8f5e9', '#4caf50');

  doc
    .fillColor('#000000')
    .fontSize(10)
    .text('RESUMO ENTRADAS', 60, boxY + 10);

  // Percentual de realizado (entradas)
  const percentualReceita =
    totais.orcado > 0 ? ((totais.realizado / totais.orcado) * 100).toFixed(2) : '0.00';

  doc
    .fontSize(9)
    .font('Helvetica')
    // Primeira linha (esquerda): Receita Orçada
    .text('Orçado Total:', 60, boxY + 30)
    .text(`R$ ${formatarMoeda(totais.orcado)}`, 180, boxY + 30);

  // Primeira linha (direita): Diferença (Realizado - Orçado), em cor condicional
  const corDiferenca = totais.diferenca < 0 ? '#dc3545' : '#28a745';
  // FIX: Force negative sign explicitly if negative, or positive if positive/zero (optional, user requested sign for negative) 
  // Actually, formatarMoeda doesn't add sign for negative numbers if we rely on Math.abs. 
  // Let's rely on standard logic: if it's negative, show '-', if positive show '+'.
  const sinalDiferenca = totais.diferenca >= 0 ? '+' : '-';

  doc
    .text('Diferença:', 300, boxY + 30)
    .font('Helvetica-Bold')
    .fillColor(corDiferenca)
    .text(`${sinalDiferenca}R$ ${formatarMoeda(Math.abs(totais.diferenca))}`, 380, boxY + 30);

  // Segunda linha (esquerda): Receita Realizada
  doc
    .fillColor('#000000')
    .font('Helvetica')
    .text('Realizado Total:', 60, boxY + 45)
    .text(`R$ ${formatarMoeda(totais.realizado)}`, 180, boxY + 45);

  // Segunda linha (direita): % Realizado (para entradas, >=100% deve ficar verde)
  doc
    .text('% Realizado:', 300, boxY + 45)
    .font('Helvetica-Bold')
    .fillColor(getCorPercentualPorMovimento(percentualReceita, true))
    .text(`${percentualReceita}%`, 380, boxY + 45);

  doc
    .fillColor('#000000')
    .font('Helvetica')
    .moveDown(2.5);
}

function renderCabecalho(doc, dados) {
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('RELATÓRIO ORÇAMENTÁRIO', { align: 'center' });

  doc
    .moveDown(0.5)
    .fontSize(12)
    .font('Helvetica')
    .text(`Setor: ${dados.nome || 'Não informado'}`, { align: 'center' });

  doc
    .moveDown(0.3)
    .fontSize(10)
    .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' })
    .moveDown(1);
}

function renderResumo(doc, totais, pageWidth) {
  const percentualSetor =
    totais.orcado > 0 ? ((totais.realizado / totais.orcado) * 100).toFixed(2) : '0.00';

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor('#333333');

  const boxY = doc.y;
  doc
    .roundedRect(50, boxY, pageWidth, 60, 5)
    .fillAndStroke('#f0f0f0', '#cccccc');

  doc
    .fillColor('#000000')
    .fontSize(10)
    .text('RESUMO SAÍDA', 60, boxY + 10);

  doc
    .fontSize(9)
    .font('Helvetica')
    .text('Orçado Total:', 60, boxY + 30)
    .text(`R$ ${formatarMoeda(totais.orcado || 0)}`, 160, boxY + 30);

  doc
    .text('Realizado Total:', 60, boxY + 45)
    .text(`R$ ${formatarMoeda(totais.realizado || 0)}`, 160, boxY + 45);

  doc
    .text('% Realizado:', 300, boxY + 45)
    .font('Helvetica-Bold')
    .fillColor(getCorPorcentagem(percentualSetor))
    .text(`${percentualSetor}%`, 380, boxY + 45);

  // Diferença (Saídas): Já vem calculada no objeto totais
  const diferencaSaida = totais.diferenca;
  const corDiferencaSaida = diferencaSaida < 0 ? '#dc3545' : '#28a745';
  const sinalDiferencaSaida = diferencaSaida >= 0 ? '+' : ''; // FIX: explicit sign logic consistent with above

  doc
    .fillColor('#000000')
    .font('Helvetica')
    .text('Diferença:', 300, boxY + 30)
    .font('Helvetica-Bold')
    .fillColor(corDiferencaSaida)
    .text(`${sinalDiferencaSaida}R$ ${formatarMoeda(Math.abs(diferencaSaida))}`, 380, boxY + 30);

  doc
    .fillColor('#000000')
    .font('Helvetica')
    .moveDown(2.5);
}

function renderTabela(doc, dados, layout) {
  const { colOrcado, colRealizado, colDiferenca, colPercent, pageWidth } = layout;

  const pageMargins =
    doc.page.margins || { top: 72, bottom: 72, left: 72, right: 72 };
  const marginLeft = doc.page.margins?.left ?? pageMargins.left ?? 50;
  const marginTop = doc.page.margins?.top ?? pageMargins.top ?? 72;

  const categoriaX = marginLeft;
  const classificacaoX = marginLeft + 30;

  const drawTableHeader = () => {
    const headerY = doc.y ?? marginTop;

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#555555');

    doc.text('Descrição', marginLeft, headerY);
    doc.text('Orçado', colOrcado, headerY, { width: 90, align: 'right' });
    doc.text('Realizado', colRealizado, headerY, { width: 90, align: 'right' });
    doc.text('Diferença', colDiferenca, headerY, { width: 90, align: 'right' });
    doc.text('%', colPercent, headerY, { width: 50, align: 'right' });

    doc
      .moveTo(marginLeft, headerY + 15)
      .lineTo(marginLeft + pageWidth, headerY + 15)
      .strokeColor('#cccccc')
      .stroke();

    doc.moveDown(1.5).fillColor('#000000');
  };

  const getBottomLimit = () =>
    doc.page.height - (doc.page.margins?.bottom ?? pageMargins.bottom ?? 72) - 50;

  const resetCursor = () => {
    doc.x = marginLeft;
    doc.y = marginTop;
  };

  const ensureSpace = (neededHeight) => {
    const bottomLimit = getBottomLimit();
    const currentY = doc.y || marginTop;

    if (currentY + neededHeight > bottomLimit) {
      doc.addPage();
      resetCursor();
      drawTableHeader();
      return true;
    }
    return false;
  };

  drawTableHeader();

  const grupos = Array.isArray(dados.grupos) ? dados.grupos : [];
  const categoriasAgrupadas = grupos.flatMap((grupo) =>
    Array.isArray(grupo.categorias) ? grupo.categorias : []
  );
  const categorias =
    categoriasAgrupadas.length === 0 && Array.isArray(dados.categorias)
      ? dados.categorias
      : categoriasAgrupadas;

  categorias.forEach((categoria, categoriaIdx) => {
    const nomeCategoria = categoria.nome || 'Categoria sem nome';
    const categoriaNomeWidth = colOrcado - categoriaX - 5;

    const categoriaHeight = doc.heightOfString(nomeCategoria, {
      width: categoriaNomeWidth
    });

    const classificacoes = Array.isArray(categoria.classificacoes)
      ? categoria.classificacoes
      : [];

    const alturaMinimaNecessaria = categoriaHeight + 30 +
      (classificacoes.length > 0 ? 50 : 0);

    ensureSpace(alturaMinimaNecessaria);

    const catY = doc.y;

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#1a1a1a')
      .text(nomeCategoria, categoriaX, catY, {
        width: categoriaNomeWidth,
        continued: false,
        wordSpacing: 0,
        characterSpacing: 0
      });

    const percCat =
      categoria.orcado > 0
        ? ((categoria.realizado / categoria.orcado) * 100).toFixed(2)
        : '0.00';

    // Verifica se a categoria inteira é de receitas
    const categoriaIsReceita = classificacoes.length > 0 &&
      classificacoes.every(c => isEntrada(c));

    const diferencaCategoria = calcularDiferenca(
      categoria.orcado || 0,
      categoria.realizado || 0,
      categoriaIsReceita
    );

    doc.text(formatarMoedaDinamico(categoria.orcado || 0, doc), colOrcado, catY, {
      width: 90,
      align: 'right'
    });
    doc.text(formatarMoedaDinamico(categoria.realizado || 0, doc), colRealizado, catY, {
      width: 90,
      align: 'right'
    });

    // FIX: Color logic for Category Difference
    if (diferencaCategoria < 0) {
      doc.fillColor('#dc3545'); // red
    }
    doc.text(
      formatarMoedaDinamico(diferencaCategoria, doc),
      colDiferenca,
      catY,
      {
        width: 90,
        align: 'right'
      }
    );
    doc.fillColor('#000000'); // Reset to black

    doc
      .fillColor(getCorPercentualPorMovimento(percCat, categoriaIsReceita))
      .text(percCat + '%', colPercent, catY, { width: 50, align: 'right' });

    doc.y = Math.max(doc.y, catY + categoriaHeight + 10);
    doc.fillColor('#000000');

    classificacoes.forEach((classificacao) => {
      const nomeClassificacao =
        classificacao.nome || classificacao.descricao || 'Sem classificação';

      const larguraMaximaNome = colOrcado - classificacaoX - 5;

      const textoHeight = doc.heightOfString(nomeClassificacao, {
        width: larguraMaximaNome,
        lineBreak: true,
        continued: false,
        wordSpacing: 0,
        characterSpacing: 0
      });

      ensureSpace(textoHeight + 20);

      const classY = doc.y;

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#555555')
        .text(nomeClassificacao, classificacaoX, classY, {
          width: larguraMaximaNome,
          lineBreak: true
        });

      const percClass =
        classificacao.orcado > 0
          ? ((classificacao.realizado / classificacao.orcado) * 100).toFixed(2)
          : '0.00';

      // Calcula diferença baseada no tipo de lançamento
      const classificacaoIsReceita = isEntrada(classificacao);
      const diferencaClassificacao = calcularDiferenca(
        classificacao.orcado || 0,
        classificacao.realizado || 0,
        classificacaoIsReceita
      );

      doc.text(formatarMoedaDinamico(classificacao.orcado || 0, doc), colOrcado, classY, {
        width: 90,
        align: 'right'
      });
      doc.text(
        formatarMoedaDinamico(classificacao.realizado || 0, doc),
        colRealizado,
        classY,
        {
          width: 90,
          align: 'right'
        }
      );

      // FIX: Color logic for Classification Difference
      if (diferencaClassificacao < 0) {
        doc.fillColor('#dc3545'); // red
      }
      doc.text(
        formatarMoedaDinamico(diferencaClassificacao, doc),
        colDiferenca,
        classY,
        {
          width: 90,
          align: 'right'
        }
      );
      doc.fillColor('#555555'); // Reset to default grey for classifications (or black if you prefer, but prev code seemed to rely on inheritance or explicit sets. Previous text was #555555, percentages use conditional color)

      doc
        .fillColor(getCorPercentualPorMovimento(percClass, classificacaoIsReceita))
        .text(percClass + '%', colPercent, classY, { width: 50, align: 'right' });

      doc.y = Math.max(doc.y, classY + textoHeight + 8);
      doc.fillColor('#000000');
    });

    if (categoriaIdx < categorias.length - 1) {
      doc.moveDown(0.3);

      const bottomLimit = getBottomLimit();
      if (doc.y + 15 <= bottomLimit) {
        doc
          .moveTo(marginLeft, doc.y)
          .lineTo(marginLeft + pageWidth, doc.y)
          .strokeColor('#e0e0e0')
          .stroke();
        doc.moveDown(0.8);
      }
    }
  });
}

function renderRodape(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(i);

    doc
      .fontSize(8)
      .fillColor('#999999')
      .text(`Página ${i + 1} de ${pages.count}`, 50, doc.page.height - 50, {
        align: 'center'
      });

    doc.text('Sistema de Controle Orçamentário', 50, doc.page.height - 35, {
      align: 'center'
    });
  }
}

function formatarMoedaDinamico(valor, doc, limite = 85) {
  const texto = formatarMoeda(valor);

  if (!doc || typeof doc.widthOfString !== 'function') {
    return texto;
  }

  if (!doc.__formatarMoedaPatched) {
    const originalText = doc.text;
    doc.text = function (...args) {
      const restoreSize = this._pendingFontRestore;
      const resultado = originalText.apply(this, args);
      if (typeof restoreSize === 'number') {
        this.fontSize(restoreSize);
        this._pendingFontRestore = null;
      }
      return resultado;
    };
    doc.__formatarMoedaPatched = true;
  }

  const originalSize = doc._fontSize || 12;
  const larguraTexto = doc.widthOfString(texto);

  if (larguraTexto <= limite) {
    doc._pendingFontRestore = null;
    return texto;
  }

  const novoTamanho = Math.max(6, Math.floor((limite / larguraTexto) * originalSize));

  if (novoTamanho >= originalSize) {
    doc._pendingFontRestore = null;
    return texto;
  }

  doc._pendingFontRestore = originalSize;
  doc.fontSize(novoTamanho);
  return texto;
}

function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getCorPorcentagem(percentual) {
  const percNumber = parseFloat(percentual);
  if (Number.isNaN(percNumber)) return '#28a745';
  if (percNumber >= 100) return '#dc3545';
  if (percNumber >= 90) return '#ffc107';
  return '#28a745';
}

// Para entradas, >=100% deve ser verde; caso contrário usa a regra padrão
function getCorPercentualPorMovimento(percentual, isReceita) {
  const percNumber = parseFloat(percentual);
  if (Number.isNaN(percNumber)) return '#28a745';
  if (isReceita) {
    if (percNumber >= 100) return '#28a745';
    return getCorPorcentagem(percNumber);
  }
  return getCorPorcentagem(percNumber);
}

module.exports = { gerarPDFOrcamento };
