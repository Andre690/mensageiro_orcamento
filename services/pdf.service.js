const PDFDocument = require('pdfkit');

/**
 * Gera um PDF de extrato orcamentario totalmente formatado.
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

      const pageWidth = doc.page.width - 100; // margem esquerda e direita
      const colOrcado = pageWidth - 240;
      const colRealizado = pageWidth - 140;
      const colPercent = pageWidth - 40;

      renderCabecalho(doc, dadosSetor);
      renderResumo(doc, dadosSetor, pageWidth);
      renderTabela(doc, dadosSetor, { colOrcado, colRealizado, colPercent, pageWidth });
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
    .text('RELATORIO ORCAMENTARIO', { align: 'center' });

  doc
    .moveDown(0.5)
    .fontSize(12)
    .font('Helvetica')
    .text(`Setor: ${dados.nome || 'Nao informado'}`, { align: 'center' });

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
    .text('Orcado Total:', 60, boxY + 30)
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
  const { colOrcado, colRealizado, colPercent, pageWidth } = layout;

  const headerY = doc.y;
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor('#555555');

  doc.text('Descricao', 50, headerY);
  doc.text('Orcado', colOrcado, headerY, { width: 90, align: 'right' });
  doc.text('Realizado', colRealizado, headerY, { width: 90, align: 'right' });
  doc.text('%', colPercent, headerY, { width: 50, align: 'right' });

  doc
    .moveTo(50, headerY + 15)
    .lineTo(50 + pageWidth, headerY + 15)
    .strokeColor('#cccccc')
    .stroke();

  doc.moveDown(1.5).fillColor('#000000');

  const grupos = Array.isArray(dados.grupos) ? dados.grupos : [];

  const PAGE_MARGINS = doc.page.margins || { top: 72, bottom: 72 };
  const bottomLimit = doc.page.height - PAGE_MARGINS.bottom;

  const ensureSpace = (neededHeight) => {
    if (doc.y + neededHeight <= bottomLimit) {
      return;
    }
    doc.addPage();
  };

  grupos.forEach((grupo, grupoIdx) => {
    ensureSpace(80);

    const grupoY = doc.y;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#1a1a1a')
      .text(grupo.nome || 'Grupo sem nome', 50, grupoY, { width: colOrcado - 60 });

    const percGrupo =
      grupo.orcado > 0 ? ((grupo.realizado / grupo.orcado) * 100).toFixed(1) : '0.0';

    doc.text(formatarMoeda(grupo.orcado || 0), colOrcado, grupoY, {
      width: 90,
      align: 'right'
    });
    doc.text(formatarMoeda(grupo.realizado || 0), colRealizado, grupoY, {
      width: 90,
      align: 'right'
    });
    doc
      .fillColor(getCorPorcentagem(percGrupo))
      .text(`${percGrupo}%`, colPercent, grupoY, { width: 50, align: 'right' });

    doc.moveDown(0.8).fillColor('#000000');

    const categorias = Array.isArray(grupo.categorias) ? grupo.categorias : [];
    categorias.forEach((categoria) => {
      ensureSpace(60);

      const catY = doc.y;
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text(categoria.nome || 'Categoria sem nome', 70, catY, {
          width: colOrcado - 80
        });

      const percCat =
        categoria.orcado > 0
          ? ((categoria.realizado / categoria.orcado) * 100).toFixed(1)
          : '0.0';

      doc.text(formatarMoeda(categoria.orcado || 0), colOrcado, catY, {
        width: 90,
        align: 'right'
      });
      doc.text(formatarMoeda(categoria.realizado || 0), colRealizado, catY, {
        width: 90,
        align: 'right'
      });
      doc
        .fillColor(getCorPorcentagem(percCat))
        .text(`${percCat}%`, colPercent, catY, { width: 50, align: 'right' });

      doc.moveDown(0.6).fillColor('#000000');

      const classificacoes = Array.isArray(categoria.classificacoes)
        ? categoria.classificacoes
        : [];

      classificacoes.forEach((classificacao) => {
        ensureSpace(45);

        const classY = doc.y;
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#555555')
          .text(
            classificacao.nome || classificacao.descricao || 'Sem classificacao',
            90,
            classY,
            {
              width: colOrcado - 100
            }
          );

        const percClass =
          classificacao.orcado > 0
            ? ((classificacao.realizado / classificacao.orcado) * 100).toFixed(1)
            : '0.0';

        doc.text(formatarMoeda(classificacao.orcado || 0), colOrcado, classY, {
          width: 90,
          align: 'right'
        });
        doc.text(formatarMoeda(classificacao.realizado || 0), colRealizado, classY, {
          width: 90,
          align: 'right'
        });
        doc
          .fillColor(getCorPorcentagem(percClass))
          .text(`${percClass}%`, colPercent, classY, { width: 50, align: 'right' });

        doc.moveDown(0.5).fillColor('#000000');
      });

      doc.moveDown(0.3);
    });

    if (grupoIdx < grupos.length - 1) {
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
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
      .text(`Pagina ${i + 1} de ${pages.count}`, 50, doc.page.height - 50, {
        align: 'center'
      });

    doc.text('Sistema de Controle Orcamentario', 50, doc.page.height - 35, {
      align: 'center'
    });
  }
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
