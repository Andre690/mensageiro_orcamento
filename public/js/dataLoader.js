import { state } from './state.js';
import {
  normalizarTexto,
  obterCampo,
  parseNumero,
  formatarTelefone
} from './utils.js';
import { adicionarLog } from './logger.js';
import { refreshUI } from './ui.js';
import { buscarContatosAgrupados, abrirModalEscolhaContatos } from './contatos.js';

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

/**
 * Retorna a lista de nomes únicos de setores da planilha carregada.
 * @returns {string[]}
 */
export function extrairSetoresUnicos() {
  if (!state.dadosCategoria) return [];
  const setores = new Set();
  state.dadosCategoria.forEach((r) => { if (r.setor) setores.add(r.setor); });
  return Array.from(setores).sort();
}

export async function processarDados() {
  if (!state.dadosCategoria) return;

  // ── Constrói mapa de telefones: setor_normalizado → Set<telefone> ──────────────
  // Fonte: arquivo carregado E banco SQLite (mesclados)
  const mapaFones = new Map();

  // 1. Pega do banco
  const contatosDb = await buscarContatosAgrupados();
  contatosDb.forEach((arrayContatos, normalizado) => {
    if (!mapaFones.has(normalizado)) mapaFones.set(normalizado, new Set());
    arrayContatos.forEach(c => {
      if (c.telefone) mapaFones.get(normalizado).add(c.telefone);
    });
  });

  // 2. Pega do arquivo, se existir
  if (state.dadosContatos) {
    state.dadosContatos.forEach((c) => {
      const nome = c.nome || obterCampo(c, 'nome_setor', 'setor', 'nome');
      if (nome) {
        const norm = normalizarTexto(nome);
        if (!mapaFones.has(norm)) mapaFones.set(norm, new Set());
        if (c.numero) mapaFones.get(norm).add(c.numero);
      }
    });
  }

  // Avisa se estiver completamente sem contatos
  if (mapaFones.size === 0) {
    adicionarLog(
      'warning',
      'Nenhum contato encontrado no banco ou arquivo. Os disparos não serão possíveis até que você adicione contatos.'
    );
    setStatus('statusContatos', 'Sem contatos', '#dc3545', 'uploadCardContatos');
  } else if (!state.dadosContatos) {
    setStatus('statusContatos', 'Usando salvos (Banco)', '#056eff', 'uploadCardContatos');
  }

  // ── Agrupa registros da Categoria por setor ───────────────────────────────
  // Estrutura intermediária: Map<setorNormalizado, { nomeOriginal, gruposMap, classificacoesEstouradas }>
  const setoresMap = new Map();

  state.dadosCategoria.forEach((registro) => {
    const nomeSetor = registro.setor;
    if (!nomeSetor) return;

    const nomeNorm = normalizarTexto(nomeSetor);

    if (!setoresMap.has(nomeNorm)) {
      setoresMap.set(nomeNorm, {
        nomeOriginal: nomeSetor,
        gruposMap: new Map(),
        classificacoesEstouradas: []
      });
    }

    const setorEntry = setoresMap.get(nomeNorm);

    // ── Grupo ────────────────────────────────────────────────────────────────
    const grupoNome = registro.grupo || 'Sem grupo';
    if (!setorEntry.gruposMap.has(grupoNome)) {
      setorEntry.gruposMap.set(grupoNome, {
        nome: grupoNome,
        orcado: 0,
        realizado: 0,
        categoriasMap: new Map()
      });
    }

    const grupo = setorEntry.gruposMap.get(grupoNome);

    // ── Categoria ────────────────────────────────────────────────────────────
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

    // ── Classificação ────────────────────────────────────────────────────────
    const classificacaoNome =
      registro.classificacao || registro.descricao || 'Sem classificacao';
    const orcadoVal = Number.isFinite(registro.orcado) ? registro.orcado : 0;
    const realizadoVal = Number.isFinite(registro.realizado) ? registro.realizado : 0;
    const tipoLancamento = registro.movimento || registro.tipo || 'Saída';

    categoria.classificacoes.push({
      nome: classificacaoNome,
      descricao: registro.descricao || '',
      orcado: orcadoVal,
      realizado: realizadoVal,
      tipo: tipoLancamento
    });

    // Acumula para cima: categoria → grupo
    categoria.orcado += orcadoVal;
    categoria.realizado += realizadoVal;
    grupo.orcado += orcadoVal;
    grupo.realizado += realizadoVal;

    // Detecta classificação estourada
    if (orcadoVal > 0 && realizadoVal > orcadoVal) {
      setorEntry.classificacoesEstouradas.push({
        nome: classificacaoNome,
        categoria: categoriaNome,
        grupo: grupoNome,
        orcado: orcadoVal,
        realizado: realizadoVal
      });
    }
  });

  // ── Monta dadosProcessados iterando pelos setores da Categoria ────────────
  try {
    state.dadosProcessados = [];
    let setoresEncontrados = 0;
    const setoresSemContato = [];

    setoresMap.forEach((setorEntry, nomeNorm) => {
      setoresEncontrados += 1;

      const telefones = Array.from(mapaFones.get(nomeNorm) || []);
      if (telefones.length === 0) setoresSemContato.push(setorEntry.nomeOriginal);

      const grupos = Array.from(setorEntry.gruposMap.values()).map((grupo) => ({
        nome: grupo.nome,
        orcado: grupo.orcado,
        realizado: grupo.realizado,
        categorias: Array.from(grupo.categoriasMap.values()).map((cat) => ({
          nome: cat.nome,
          orcado: cat.orcado,
          realizado: cat.realizado,
          classificacoes: cat.classificacoes
        }))
      }));

      // orcado e realizado do setor = soma direta das categorias
      const totalOrcado = grupos.reduce((s, g) => s + (g.orcado || 0), 0);
      const totalRealizado = grupos.reduce((s, g) => s + (g.realizado || 0), 0);

      state.dadosProcessados.push({
        nome: setorEntry.nomeOriginal,
        telefones,
        telefone: telefones[0] || '', // Mantido por retrocompatibilidade temporária (ui)
        orcado: totalOrcado,
        realizado: totalRealizado,
        grupos,
        classificacoes: setorEntry.classificacoesEstouradas,
        totalGrupos: grupos.length
      });
    });

    if (setoresSemContato.length > 0) {
      adicionarLog(
        'warning',
        `${setoresSemContato.length} setor(es) sem telefone cadastrado: ${setoresSemContato.join(', ')}`
      );
    }

    adicionarLog('success', `${setoresEncontrados} setores processados com sucesso.`);

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
      `Arquivo de orçamento atualizado: ${state.dadosCategoria.length} registros.`
    );

    // Habilita o card de contatos (remove estado acinzentado)
    const cardContatos = document.getElementById('uploadCardContatos');
    if (cardContatos) {
      cardContatos.classList.remove('upload-card-disabled');
      cardContatos.removeAttribute('title');
    }

    processarDados();
    refreshUI();

    // Se ainda não existirem contatos processados, sugere o gerenciador
    const contatosCadastrados = state.dadosProcessados.some(s => s.telefones && s.telefones.length > 0);
    if (!contatosCadastrados) {
      const setoresUnicos = extrairSetoresUnicos();
      adicionarLog('info', `${setoresUnicos.length} setores identificados. Configure os contatos.`);
      abrirModalEscolhaContatos(setoresUnicos);
    }
    
    // Reseta o input para permitir carregar o mesmo arquivo repetidas vezes caso ele seja atualizado
    event.target.value = '';
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
    event.target.value = '';
  });
}

export function removerArquivoContatos() {
  state.dadosContatos = null;
  const input = document.getElementById('fileContatos');
  if (input) input.value = '';
  setStatus('statusContatos', 'Removido', '#666', 'uploadCard3');
  adicionarLog('info', 'Planilha de contatos removida. Apenas contatos salvos no banco serão usados.');
  processarDados();
  refreshUI();
}