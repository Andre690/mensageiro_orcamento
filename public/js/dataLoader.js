import { state } from './state.js';
import {
  normalizarTexto,
  obterCampo,
  parseNumero,
  formatarTelefone
} from './utils.js';
import { adicionarLog } from './logger.js';
import { refreshUI } from './ui.js';

function setStatus(id, texto, cor, loadedCardId) {
  const statusEl = document.getElementById(id);
  if (statusEl) {
    statusEl.innerHTML = texto;
    statusEl.style.color = cor;
  }
  if (loadedCardId) {
    const card = document.getElementById(loadedCardId);
    if (card) {
      card.classList.add('loaded');
    }
  }
}

function csvParaJSON(csvText) {
  const linhas = csvText.split('\n');
  if (linhas.length === 0) return [];

  const headers = linhas[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  const dados = [];

  for (let i = 1; i < linhas.length; i += 1) {
    if (linhas[i].trim() === '') continue;

    const valores = linhas[i].split(',').map((v) => v.trim().replace(/"/g, ''));
    const objeto = {};

    headers.forEach((header, index) => {
      let valor = valores[index] || '';

      if (!Number.isNaN(Number(valor)) && valor !== '' && valor !== '-') {
        valor = parseFloat(valor.replace(',', '.'));
      }

      objeto[header] = valor;
    });

    dados.push(objeto);
  }

  return dados;
}

function processarArquivo(file, callback) {
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      let dados;
      if (file.name.toLowerCase().endsWith('.csv')) {
        dados = csvParaJSON(event.target.result);
      } else {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        dados = XLSX.utils.sheet_to_json(worksheet);
      }

      if (!dados || dados.length === 0) {
        throw new Error('Arquivo vazio ou sem dados validos.');
      }

      callback(null, dados);
    } catch (error) {
      callback(error, null);
    }
  };

  reader.onerror = () => {
    callback(new Error('Erro ao ler o arquivo.'), null);
  };

  if (file.name.toLowerCase().endsWith('.csv')) {
    reader.readAsText(file, 'UTF-8');
  } else {
    reader.readAsArrayBuffer(file);
  }
}

export function processarDados() {
  if (!state.dadosSetor || !state.dadosCategoria || !state.dadosContatos) {
    return;
  }

  try {
    state.dadosProcessados = [];
    let setoresEncontrados = 0;
    const setoresNaoEncontrados = [];
    const setoresSemDetalhes = [];

    state.dadosContatos.forEach((contato) => {
      const nomeSetor =
        contato.nome || obterCampo(contato, 'nome_setor', 'setor', 'nome');
      const telefone = contato.numero;
      const nomeNormalizado = normalizarTexto(nomeSetor);

      if (!nomeNormalizado) return;

      const setorDados = state.dadosSetor.find(
        (registro) => normalizarTexto(registro.setor) === nomeNormalizado
      );
      const registrosDetalhe = state.dadosCategoria.filter(
        (registro) => normalizarTexto(registro.setor) === nomeNormalizado
      );

      if (!setorDados && registrosDetalhe.length === 0) {
        setoresNaoEncontrados.push(nomeSetor);
        return;
      }

      setoresEncontrados += 1;

      const gruposMap = new Map();
      const classificacoesEstouradas = [];

      registrosDetalhe.forEach((registro) => {
        const grupoNome = registro.grupo || 'Sem grupo';
        if (!gruposMap.has(grupoNome)) {
          gruposMap.set(grupoNome, {
            nome: grupoNome,
            orcado: 0,
            realizado: 0,
            categoriasMap: new Map()
          });
        }

        const grupo = gruposMap.get(grupoNome);
        const categoriaNome = registro.categoria || 'Sem categoria';

        if (!grupo.categoriasMap.has(categoriaNome)) {
          grupo.categoriasMap.set(categoriaNome, {
            nome: categoriaNome,
            orcado: 0,
            realizado: 0,
            classificacoes: []
          });
        }

        const categoria = grupo.categoriasMap.get(categoriaNome);
        const classificacaoNome =
          registro.classificacao || registro.descricao || 'Sem classificacao';
        const orcadoClassificacao = Number.isFinite(registro.orcado)
          ? registro.orcado
          : 0;
        const realizadoClassificacao = Number.isFinite(registro.realizado)
          ? registro.realizado
          : 0;

        // Identifica o tipo de lançamento (Entrada ou Saída)
        const tipoLancamento = registro.movimento || registro.tipo || 'Saída';

        categoria.classificacoes.push({
          nome: classificacaoNome,
          descricao: registro.descricao || '',
          orcado: orcadoClassificacao,
          realizado: realizadoClassificacao,
          tipo: tipoLancamento
        });

        categoria.orcado += orcadoClassificacao;
        categoria.realizado += realizadoClassificacao;
        grupo.orcado += orcadoClassificacao;
        grupo.realizado += realizadoClassificacao;

        if (orcadoClassificacao > 0 && realizadoClassificacao > orcadoClassificacao) {
          classificacoesEstouradas.push({
            nome: classificacaoNome,
            categoria: categoriaNome,
            grupo: grupoNome,
            orcado: orcadoClassificacao,
            realizado: realizadoClassificacao
          });
        }
      });

      const grupos = Array.from(gruposMap.values()).map((grupo) => {
        const categorias = Array.from(grupo.categoriasMap.values()).map(
          (categoria) => ({
            nome: categoria.nome,
            orcado: categoria.orcado,
            realizado: categoria.realizado,
            classificacoes: categoria.classificacoes
          })
        );

        return {
          nome: grupo.nome,
          orcado: grupo.orcado,
          realizado: grupo.realizado,
          categorias
        };
      });

      if (grupos.length === 0) {
        setoresSemDetalhes.push(nomeSetor);
      }

      const totalDetalheOrcado = grupos.reduce(
        (soma, grupo) => soma + (grupo.orcado || 0),
        0
      );
      const totalDetalheRealizado = grupos.reduce(
        (soma, grupo) => soma + (grupo.realizado || 0),
        0
      );

      let totalOrcado = setorDados ? setorDados.orcado : 0;
      let totalRealizado = setorDados ? setorDados.realizado : 0;

      if (!totalOrcado) totalOrcado = totalDetalheOrcado;
      if (!totalRealizado) totalRealizado = totalDetalheRealizado;

      state.dadosProcessados.push({
        nome: nomeSetor,
        telefone,
        orcado: totalOrcado,
        realizado: totalRealizado,
        grupos,
        classificacoes: classificacoesEstouradas,
        totalGrupos: grupos.length
      });
    });

    if (setoresNaoEncontrados.length > 0) {
      adicionarLog(
        'warning',
        `${setoresNaoEncontrados.length} setores nao encontrados no orcamento: ${setoresNaoEncontrados.join(
          ', '
        )}`
      );
    }

    if (setoresSemDetalhes.length > 0) {
      adicionarLog(
        'warning',
        `${setoresSemDetalhes.length} setores sem detalhes de grupo/categoria: ${setoresSemDetalhes.join(
          ', '
        )}`
      );
    }

    adicionarLog(
      'success',
      `${setoresEncontrados} setores processados com sucesso.`
    );

    if (state.dadosProcessados.length > 0) {
      adicionarLog(
        'success',
        `Dados processados: ${state.dadosProcessados.length} setores prontos para disparo.`
      );
    }
  } catch (error) {
    adicionarLog('error', `Erro ao processar dados: ${error.message}`);
    console.error('Erro detalhado:', error);
  }
}

export function carregarArquivoSetor(event) {
  const file = event.target.files[0];
  if (!file) return;

  processarArquivo(file, (error, dadosBrutos) => {
    if (error) {
      adicionarLog(
        'error',
        `Erro ao carregar arquivo de orcamento geral: ${error.message}`
      );
      setStatus('statusSetor', 'Erro', '#dc3545');
      return;
    }

    const registros = [];

    dadosBrutos.forEach((linhaOriginal) => {
      const setorNome = obterCampo(linhaOriginal, 'setor', 'nome_setor');
      const orcadoBruto = obterCampo(
        linhaOriginal,
        'orcamento_total',
        'orcado_total',
        'orcado_mensal',
        'orcado'
      );
      const realizadoBruto = obterCampo(linhaOriginal, 'realizado');

      if (!setorNome || (orcadoBruto === undefined && realizadoBruto === undefined)) {
        return;
      }

      registros.push({
        setor: setorNome,
        orcado: parseNumero(orcadoBruto),
        realizado: parseNumero(realizadoBruto),
        original: linhaOriginal
      });
    });

    if (registros.length === 0) {
      adicionarLog(
        'error',
        'Arquivo de orcamento geral precisa conter colunas de setor e valores de orcado/realizado.'
      );
      setStatus('statusSetor', 'Formato invalido', '#dc3545');
      return;
    }

    state.dadosSetor = registros;
    setStatus('statusSetor', 'Carregado', '#28a745', 'uploadCard1');
    adicionarLog(
      'success',
      `Arquivo de orcamento geral carregado: ${state.dadosSetor.length} registros.`
    );
    processarDados();
    refreshUI();
  });
}

export function carregarArquivoCategoria(event) {
  const file = event.target.files[0];
  if (!file) return;

  processarArquivo(file, (error, dadosBrutos) => {
    if (error) {
      adicionarLog(
        'error',
        `Erro ao carregar arquivo de categoria: ${error.message}`
      );
      setStatus('statusCategoria', 'Erro', '#dc3545');
      return;
    }

    const registros = [];

    dadosBrutos.forEach((linhaOriginal) => {
      const setorNome = obterCampo(linhaOriginal, 'setor', 'nome_setor');
      const grupoNome = obterCampo(linhaOriginal, 'grupo');
      const categoriaNome = obterCampo(linhaOriginal, 'categoria');
      const classificacaoNome = obterCampo(linhaOriginal, 'classificacao', 'classificação');
      const descricao = obterCampo(linhaOriginal, 'descricao', 'descrição');
      
      // Suporta os nomes de colunas do arquivo fornecido
      const orcadoBruto = obterCampo(
        linhaOriginal,
        'orcado_mensal',
        'orcado',
        'orcamento_total',
        'orcado mensal'
      );
      const realizadoBruto = obterCampo(linhaOriginal, 'realizado');
      
      // Captura o tipo de movimento (Entrada/Saída)
      const movimento = obterCampo(linhaOriginal, 'movimento', 'tipo', 'tipo_lancamento');

      if (!setorNome) return;

      registros.push({
        setor: setorNome,
        grupo: grupoNome || 'Sem grupo',
        categoria: categoriaNome || 'Sem categoria',
        classificacao: classificacaoNome || descricao || 'Sem classificacao',
        descricao: descricao || '',
        orcado: parseNumero(orcadoBruto),
        realizado: parseNumero(realizadoBruto),
        movimento: movimento || 'Saída',
        original: linhaOriginal
      });
    });

    if (registros.length === 0) {
      adicionarLog(
        'error',
        'Arquivo de categoria deve conter as colunas "Setor", "Categoria" e "Classificacao".'
      );
      setStatus('statusCategoria', 'Formato invalido', '#dc3545');
      return;
    }

    state.dadosCategoria = registros;
    setStatus('statusCategoria', 'Carregado', '#28a745', 'uploadCard2');
    adicionarLog(
      'success',
      `Arquivo de orcamento por categoria carregado: ${state.dadosCategoria.length} registros.`
    );
    processarDados();
    refreshUI();
  });
}

export function carregarArquivoContatos(event) {
  const file = event.target.files[0];
  if (!file) return;

  processarArquivo(file, (error, dadosBrutos) => {
    if (error) {
      adicionarLog(
        'error',
        `Erro ao carregar arquivo de contatos: ${error.message}`
      );
      setStatus('statusContatos', 'Erro', '#dc3545');
      return;
    }

    const registros = [];

    dadosBrutos.forEach((linhaOriginal) => {
      const nomeSetor = obterCampo(linhaOriginal, 'nome_setor', 'setor', 'nome');
      const numeroBruto = obterCampo(linhaOriginal, 'numero', 'telefone', 'contato');

      if (!nomeSetor || !numeroBruto) return;

      const { telefone, warnings } = formatarTelefone(numeroBruto);
      warnings.forEach((mensagem) => adicionarLog('warning', mensagem));

      registros.push({
        nome: nomeSetor,
        numero: telefone,
        original: linhaOriginal
      });
    });

    if (registros.length === 0) {
      adicionarLog(
        'error',
        'Arquivo de contatos deve conter as colunas "nome_setor" e "numero".'
      );
      setStatus('statusContatos', 'Formato invalido', '#dc3545');
      return;
    }

    state.dadosContatos = registros;
    setStatus('statusContatos', 'Carregado', '#28a745', 'uploadCard3');
    adicionarLog(
      'success',
      `Arquivo de contatos carregado: ${state.dadosContatos.length} registros.`
    );
    processarDados();
    refreshUI();
  });
}