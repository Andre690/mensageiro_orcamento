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
      renderResumo(doc, dadosSetor, pageWidth);
      renderTabela(doc, dadosSetor, {
        colOrcado,
        colRealizado,
        colDiferenca,
        colPercent,
        pageWidth
      });
      renderRodape(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
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

function renderResumo(doc, dados, pageWidth) {
  const percentualSetor =
    dados.orcado > 0 ? ((dados.realizado / dados.orcado) * 100).toFixed(2) : '0.00';

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
    .text('RESUMO GERAL', 60, boxY + 10);

  doc
    .fontSize(9)
    .font('Helvetica')
    .text('Orçado Total:', 60, boxY + 30)
    .text(`R$ ${formatarMoeda(dados.orcado || 0)}`, 160, boxY + 30);

  doc
    .text('Realizado Total:', 60, boxY + 45)
    .text(`R$ ${formatarMoeda(dados.realizado || 0)}`, 160, boxY + 45);

  doc
    .text('% Realizado:', 300, boxY + 30)
    .font('Helvetica-Bold')
    .fillColor(getCorPorcentagem(percentualSetor))
    .text(`${percentualSetor}%`, 380, boxY + 30);

  doc
    .fillColor('#000000')
    .font('Helvetica')
    .moveDown(5);
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
    doc.page.height - (doc.page.margins?.bottom ?? pageMargins.bottom ?? 72);

  const resetCursor = () => {
    doc.x = marginLeft;
    doc.y = marginTop;
  };

  const ensureSpace = (neededHeight) => {
    if (doc.y + neededHeight <= getBottomLimit()) {
      return;
    }

    doc.addPage();
    resetCursor();
    drawTableHeader();
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
    ensureSpace(60);

    const catY = doc.y;
    const nomeCategoria = categoria.nome || 'Categoria sem nome';
    const categoriaNomeWidth = colOrcado - categoriaX - 5;
    const categoriaHeight = doc.heightOfString(nomeCategoria, {
      width: categoriaNomeWidth
    });

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

    doc.text(formatarMoedaDinamico(categoria.orcado || 0, doc), colOrcado, catY, {
      width: 90,
      align: 'right'
    });
    doc.text(formatarMoedaDinamico(categoria.realizado || 0, doc), colRealizado, catY, {
      width: 90,
      align: 'right'
    });
    doc.text(
      formatarMoedaDinamico((categoria.orcado || 0) - (categoria.realizado || 0), doc),
      colDiferenca,
      catY,
      {
        width: 90,
        align: 'right'
      }
    );
    doc
      .fillColor(getCorPorcentagem(percCat))
      .text(percCat + '%', colPercent, catY, { width: 50, align: 'right' });

    doc.y = Math.max(doc.y, catY + categoriaHeight + 10);
    doc.fillColor('#000000');

    const classificacoes = Array.isArray(categoria.classificacoes)
      ? categoria.classificacoes
      : [];

    classificacoes.forEach((classificacao) => {
      ensureSpace(45);

      const classY = doc.y;
      const nomeClassificacao =
        classificacao.nome || classificacao.descricao || 'Sem classificação';

      // Define largura máxima para o nome (linha invisível antes dos valores)
      const larguraMaximaNome = colOrcado - classificacaoX - 5;

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#555555')
        .text(nomeClassificacao, classificacaoX, classY, {
          width: larguraMaximaNome,
          lineBreak: true
        });

      const textoHeight = doc.heightOfString(nomeClassificacao, {
        width: larguraMaximaNome,
        lineBreak: true,
        continued: false,
        wordSpacing: 0,
        characterSpacing: 0
      });

      const percClass =
        classificacao.orcado > 0
          ? ((classificacao.realizado / classificacao.orcado) * 100).toFixed(2)
          : '0.00';

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
      doc.text(
        formatarMoedaDinamico(
          (classificacao.orcado || 0) - (classificacao.realizado || 0),
          doc
        ),
        colDiferenca,
        classY,
        {
          width: 90,
          align: 'right'
        }
      );
      doc
        .fillColor(getCorPorcentagem(percClass))
        .text(percClass + '%', colPercent, classY, { width: 50, align: 'right' });

      doc.y = Math.max(doc.y, classY + textoHeight + 8);
      doc.fillColor('#000000');
    });

    doc.moveDown(0.3);

    if (categoriaIdx < categorias.length - 1) {
      doc
        .moveTo(marginLeft, doc.y)
        .lineTo(marginLeft + pageWidth, doc.y)
        .strokeColor('#e0e0e0')
        .stroke();
      doc.moveDown(0.8);
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

module.exports = { gerarPDFOrcamento };