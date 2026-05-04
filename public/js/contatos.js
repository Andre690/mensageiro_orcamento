import { normalizarTexto, formatarTelefone } from './utils.js';
import { adicionarLog } from './logger.js';
import { processarDados } from './dataLoader.js';
import { refreshUI } from './ui.js';
import { state } from './state.js';

const API_BASE = '/api';

// Setores do orçamento atual — preenchido ao abrir o modal de escolha
let _setoresAtuais = [];

function formatarTelefoneMascara(numero) {
  if (!numero) return '';
  let digitos = String(numero).replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length >= 12) digitos = digitos.slice(2);
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

/**
 * Busca todos os contatos salvos, agrupados por setor_normalizado → [telefone, ...]
 * @returns {Promise<Map<string, Array<{id,nome_contato,telefone}>>>}
 */
export async function buscarContatosSalvos() {
  try {
    const resp = await fetch(`${API_BASE}/contatos`);
    const json = await resp.json();
    if (!json.success) throw new Error(json.message);

    // Retorna mapa simplificado: normalizado → primeiro telefone (para compatibilidade com dataLoader)
    const mapa = new Map();
    (json.contatos || []).forEach((c) => {
      const norm = normalizarTexto(c.setor);
      if (!mapa.has(norm)) mapa.set(norm, c.telefone);
    });
    return mapa;
  } catch (err) {
    adicionarLog('warning', `Não foi possível carregar contatos salvos: ${err.message}`);
    return new Map();
  }
}

/**
 * Busca todos os contatos agrupados em Map<normalizado, [{id, nome_contato, telefone}]>
 */
export async function buscarContatosAgrupados() {
  try {
    const resp = await fetch(`${API_BASE}/contatos`);
    const json = await resp.json();
    if (!json.success) throw new Error(json.message);

    const mapa = new Map();
    (json.contatos || []).forEach((c) => {
      const norm = normalizarTexto(c.setor);
      if (!mapa.has(norm)) mapa.set(norm, []);
      mapa.get(norm).push({ id: c.id, nome_contato: c.nome_contato || '', telefone: c.telefone, setor: c.setor });
    });
    return mapa;
  } catch (err) {
    adicionarLog('warning', `Erro ao carregar contatos: ${err.message}`);
    return new Map();
  }
}

// ─── Modal de Escolha ─────────────────────────────────────────────────────────

/**
 * Abre o modal de escolha: Importar via arquivo OU Digitar/usar contatos salvos.
 * Chamado automaticamente ao carregar a planilha de orçamento.
 * @param {string[]} nomesDosSetores
 */
export function abrirModalEscolhaContatos(nomesDosSetores) {
  _setoresAtuais = [...new Set(nomesDosSetores)].sort();
  const modal = document.getElementById('modalEscolhaContatos');
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function fecharModalEscolha() {
  const modal = document.getElementById('modalEscolhaContatos');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Modal: nomear contatos importados (planilha sem coluna de nome)
export async function abrirModalNomearContatosImportados(registros) {
  if (!Array.isArray(registros) || registros.length === 0) return;

  const modal = document.getElementById('modalNomearContatosImportados');
  const lista = document.getElementById('listaNomearContatosImportados');
  if (!modal || !lista) return;

  const contatosAgrupados = await buscarContatosAgrupados();

  // Dedup: setor_normalizado + telefone
  const unicos = new Map();
  registros.forEach((r) => {
    const setorNome = (r?.nome || r?.setor || '').toString().trim();
    const telefone = (r?.numero || r?.telefone || '').toString().trim();
    if (!setorNome || !telefone) return;
    const norm = normalizarTexto(setorNome);
    const key = `${norm}|${telefone}`;
    if (!unicos.has(key)) unicos.set(key, { setor: setorNome, setor_normalizado: norm, telefone });
  });

  const listaOrdenada = Array.from(unicos.values()).sort((a, b) => a.setor.localeCompare(b.setor));

  lista.innerHTML = '';

  listaOrdenada.forEach((c) => {
    const contatosDbSetor = contatosAgrupados.get(c.setor_normalizado) || [];
    const existente = contatosDbSetor.find((x) => String(x.telefone) === String(c.telefone));
    const nomePrefill = existente?.nome_contato || '';

    const row = document.createElement('div');
    row.className = 'contato-row';
    row.innerHTML = `
      <div>
        <div class="contato-setor-nome">${c.setor}</div>
        <div class="contato-subinfo">${formatarTelefoneMascara(c.telefone)}</div>
      </div>
      <div class="contato-input-wrapper">
        <input
          type="text"
          class="contato-input"
          placeholder="Nome do contato (ex: Gerente)"
          maxlength="60"
          autocomplete="off"
          value="${(nomePrefill || '').replace(/\"/g, '&quot;')}"
          data-setor="${c.setor}"
          data-setor-normalizado="${c.setor_normalizado}"
          data-telefone="${c.telefone}"
        >
      </div>
    `;
    lista.appendChild(row);
  });

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function fecharModalNomearContatosImportados() {
  const modal = document.getElementById('modalNomearContatosImportados');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

export async function salvarNomearContatosImportados() {
  const lista = document.getElementById('listaNomearContatosImportados');
  if (!lista) return;

  const inputs = Array.from(lista.querySelectorAll('input[data-setor-normalizado][data-telefone]'));
  if (inputs.length === 0) {
    fecharModalNomearContatosImportados();
    return;
  }

  const contatosAgrupados = await buscarContatosAgrupados();

  const porSetor = new Map();
  inputs.forEach((input) => {
    const setor = input.getAttribute('data-setor') || '';
    const setor_normalizado = input.getAttribute('data-setor-normalizado') || '';
    const telefone = input.getAttribute('data-telefone') || '';
    if (!setor_normalizado || !telefone) return;

    const nomeNovo = (input.value || '').toString().trim();

    if (!porSetor.has(setor_normalizado)) porSetor.set(setor_normalizado, new Map());
    porSetor.get(setor_normalizado).set(String(telefone), {
      setor,
      setor_normalizado,
      telefone: String(telefone),
      nome_contato: nomeNovo
    });
  });

  // Merge com DB (para nao apagar contatos existentes)
  for (const [setorNorm, novosMap] of porSetor.entries()) {
    const existentes = contatosAgrupados.get(setorNorm) || [];
    const finalMap = new Map();

    existentes.forEach((c) => {
      if (!c?.telefone) return;
      finalMap.set(String(c.telefone), {
        setor: c.setor,
        setor_normalizado: setorNorm,
        telefone: String(c.telefone),
        nome_contato: c.nome_contato || ''
      });
    });

    for (const [tel, novo] of novosMap.entries()) {
      const atual = finalMap.get(tel);
      if (atual) {
        finalMap.set(tel, {
          ...atual,
          nome_contato: novo.nome_contato ? novo.nome_contato : atual.nome_contato
        });
      } else {
        finalMap.set(tel, {
          setor: novo.setor,
          setor_normalizado: setorNorm,
          telefone: tel,
          nome_contato: novo.nome_contato || ''
        });
      }
    }

    await salvarSetorCompleto(setorNorm, Array.from(finalMap.values()));
  }

  adicionarLog('success', 'Contatos importados salvos no banco.');
  // Depois de salvar no banco, para evitar duplicidade/reaparecer apos remover,
  // desabilita o uso da planilha carregada (o envio passa a usar apenas os salvos).
  state.dadosContatos = null;
  fecharModalNomearContatosImportados();
  await processarDados();
  refreshUI();
}

// ─── Modal de Gerenciamento (digitar / salvos) ────────────────────────────────

export async function abrirModalContatos(nomesDosSetores) {
  const setores = nomesDosSetores?.length
    ? [...new Set(nomesDosSetores)].sort()
    : _setoresAtuais;

  const contatosAgrupados = await buscarContatosAgrupados();

  const modal = document.getElementById('modalContatos');
  const lista = document.getElementById('listaContatosModal');
  if (!modal || !lista) return;

  lista.innerHTML = '';

  setores.forEach((nomeSetor) => {
    const normalizado = normalizarTexto(nomeSetor);
    const contatosSalvos = contatosAgrupados.get(normalizado) || [];

    const section = document.createElement('div');
    section.className = 'contato-setor-section';
    section.dataset.normalizado = normalizado;
    section.dataset.setor = nomeSetor;

    // Cabeçalho do setor
    section.innerHTML = `
      <div class="contato-setor-header">
        <span class="contato-setor-nome">${nomeSetor}</span>
        <button class="btn-add-contato" data-setor="${nomeSetor}" data-normalizado="${normalizado}" title="Adicionar contato">+ Adicionar</button>
      </div>
      <div class="contato-lista-chips" id="chips-${normalizado}"></div>
      <div class="contato-novo-form" id="form-${normalizado}" style="display:none;">
        <input type="text" class="contato-input-nome" placeholder="Nome (ex: Gerente, Diretor)" maxlength="60" autocomplete="off">
        <input type="tel" class="contato-input" placeholder="(DD) XXXXX-XXXX" maxlength="15" autocomplete="off">
        <button class="btn-confirmar-contato" data-normalizado="${normalizado}" data-setor="${nomeSetor}">✓ Ok</button>
        <button class="btn-cancelar-form">✕</button>
      </div>
    `;

    lista.appendChild(section);

    // Renderiza contatos já salvos como chips
    renderizarChips(normalizado, contatosSalvos);

    // Eventos
    const btnAdd = section.querySelector('.btn-add-contato');
    btnAdd.addEventListener('click', () => toggleFormNovoContato(normalizado));

    const inputTel = section.querySelector('.contato-input');
    inputTel.addEventListener('input', (e) => aplicarMascaraTelefone(e.target));

    const btnConfirmar = section.querySelector('.btn-confirmar-contato');
    btnConfirmar.addEventListener('click', () => confirmarNovoContato(normalizado, nomeSetor, section));

    const btnCancelar = section.querySelector('.btn-cancelar-form');
    btnCancelar.addEventListener('click', () => {
      const form = document.getElementById(`form-${normalizado}`);
      if (form) { form.style.display = 'none'; form.querySelector('.contato-input').value = ''; form.querySelector('.contato-input-nome').value = ''; }
    });
  });

  // Controle do botão de remover planilha
  const btnRemoverPlanilha = document.getElementById('btnRemoverPlanilhaModal');
  // Se existir arquivo carregado globalmente
  if (btnRemoverPlanilha) {
    const inputContatos = document.getElementById('fileContatos');
    if (inputContatos && inputContatos.files && inputContatos.files.length > 0) {
      btnRemoverPlanilha.style.display = 'inline-block';
    } else {
      btnRemoverPlanilha.style.display = 'none';
    }
  }

  fecharModalEscolha();
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function renderizarChips(normalizado, contatos) {
  const container = document.getElementById(`chips-${normalizado}`);
  if (!container) return;
  container.innerHTML = '';

  if (contatos.length === 0) {
    container.innerHTML = '<span class="contato-vazio-hint">Nenhum contato cadastrado</span>';
    return;
  }

  contatos.forEach((c) => {
    const chip = document.createElement('div');
    chip.className = 'contato-chip';
    chip.dataset.id = c.id;
    chip.dataset.telefone = c.telefone;
    chip.innerHTML = `
      <span class="chip-nome">${c.nome_contato || 'Sem nome'}</span>
      <span class="chip-tel">${telefoneParaMascara(c.telefone)}</span>
      <button class="chip-remover" data-id="${c.id}" data-normalizado="${normalizado}" title="Remover">✕</button>
    `;
    chip.querySelector('.chip-remover').addEventListener('click', () => removerContatoLocal(c.id, normalizado));
    container.appendChild(chip);
  });
}

function toggleFormNovoContato(normalizado) {
  const form = document.getElementById(`form-${normalizado}`);
  if (!form) return;
  const visivel = form.style.display !== 'none';
  form.style.display = visivel ? 'none' : 'flex';
  if (!visivel) form.querySelector('.contato-input').focus();
}

async function confirmarNovoContato(normalizado, nomeSetor, section) {
  const form = document.getElementById(`form-${normalizado}`);
  if (!form) return;

  const inputTel = form.querySelector('.contato-input');
  const inputNome = form.querySelector('.contato-input-nome');
  const valor = inputTel.value.trim();
  const nomeContato = inputNome.value.trim();

  if (!valor) { adicionarLog('warning', 'Preencha o número antes de adicionar.'); return; }

  const { telefone, warnings } = formatarTelefone(valor);
  warnings.forEach((w) => adicionarLog('warning', w));
  if (!telefone) return;

  try {
    // Busca contatos atuais do setor e adiciona o novo
    const resp = await fetch(`${API_BASE}/contatos`);
    const json = await resp.json();
    const existentes = (json.contatos || [])
      .filter((c) => normalizarTexto(c.setor) === normalizado)
      .map((c) => ({ setor: c.setor, setor_normalizado: normalizarTexto(c.setor), nome_contato: c.nome_contato || '', telefone: c.telefone }));

    const novos = [...existentes, { setor: nomeSetor, setor_normalizado: normalizado, nome_contato: nomeContato, telefone }];

    await salvarSetorCompleto(normalizado, novos);

    // Recarrega chips
    const respAtual = await fetch(`${API_BASE}/contatos`);
    const jsonAtual = await respAtual.json();
    const atualizados = (jsonAtual.contatos || [])
      .filter((c) => normalizarTexto(c.setor) === normalizado)
      .map((c) => ({ id: c.id, nome_contato: c.nome_contato || '', telefone: c.telefone }));
    renderizarChips(normalizado, atualizados);

    inputTel.value = '';
    inputNome.value = '';
    form.style.display = 'none';
    adicionarLog('success', `Contato adicionado para ${nomeSetor}.`);
    
    // Atualiza a tabela geral por baixo
    await processarDados();
    refreshUI();
  } catch (err) {
    adicionarLog('error', `Erro ao adicionar contato: ${err.message}`);
  }
}

async function removerContatoLocal(id, normalizado) {
  const container = document.getElementById(`chips-${normalizado}`);
  const chip = container?.querySelector(`[data-id="${id}"]`);
  const nomeChip = chip?.querySelector('.chip-nome')?.textContent?.trim() || '';
  const telChip = chip?.querySelector('.chip-tel')?.textContent?.trim() || '';
  const telefoneParaRemover = chip?.dataset?.telefone ? String(chip.dataset.telefone) : '';
  const descricao = [nomeChip, telChip].filter(Boolean).join(' - ');
  const ok = confirm(`Deseja realmente excluir este contato${descricao ? ` (${descricao})` : ''}?`);
  if (!ok) return;

  try {
    const resp = await fetch(`${API_BASE}/contatos/${id}`, { method: 'DELETE' });
    const json = await resp.json();
    if (!json.success) throw new Error(json.message);

    // Recarrega chips
    const respAtual = await fetch(`${API_BASE}/contatos`);
    const jsonAtual = await respAtual.json();
    const atualizados = (jsonAtual.contatos || [])
      .filter((c) => normalizarTexto(c.setor) === normalizado)
      .map((c) => ({ id: c.id, nome_contato: c.nome_contato || '', telefone: c.telefone }));
    renderizarChips(normalizado, atualizados);
    adicionarLog('success', 'Contato removido.');

    // Se existir planilha carregada (state.dadosContatos), remove o telefone tambem para nao reaparecer.
    if (state.dadosContatos && telefoneParaRemover) {
      state.dadosContatos = (state.dadosContatos || []).filter((c) => {
        const setorNorm = normalizarTexto(c.nome || c.setor || '');
        const tel = String(c.numero || c.telefone || '');
        if (setorNorm !== normalizado) return true;
        return String(telefoneParaRemover) !== tel;
      });
    }
    
    // Atualiza a tabela geral por baixo
    await processarDados();
    refreshUI();
  } catch (err) {
    adicionarLog('error', `Erro ao remover contato: ${err.message}`);
  }
}

async function salvarSetorCompleto(setorNormalizado, contatos) {
  const resp = await fetch(`${API_BASE}/contatos/setor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setor_normalizado: setorNormalizado, contatos })
  });
  const json = await resp.json();
  if (!json.success) throw new Error(json.message);
  return json;
}

/**
 * Importa contatos de uma planilha para o banco, ignorando numeros que ja existam salvos.
 * Retorna apenas os contatos realmente novos (para o usuario nomear).
 * @param {Array<{nome?:string,setor?:string,numero?:string,telefone?:string}>} registros
 * @returns {Promise<{contatosNovos:Array<{setor:string,setor_normalizado:string,telefone:string,nome?:string,numero?:string}>, setoresAfetados:string[]}>}
 */
export async function importarContatosDaPlanilha(registros) {
  if (!Array.isArray(registros) || registros.length === 0) {
    return { contatosNovos: [], setoresAfetados: [] };
  }

  const contatosAgrupados = await buscarContatosAgrupados();

  const existentesPorSetor = new Map();
  contatosAgrupados.forEach((arr, setorNorm) => {
    existentesPorSetor.set(setorNorm, new Set((arr || []).map((c) => String(c.telefone))));
  });

  const novosPorSetor = new Map(); // setorNorm -> { setor: string, novosMap: Map<telefone, contato> }

  registros.forEach((r) => {
    const setorNome = (r?.nome || r?.setor || '').toString().trim();
    const telefone = (r?.numero || r?.telefone || '').toString().trim();
    if (!setorNome || !telefone) return;

    const setorNorm = normalizarTexto(setorNome);
    if (!setorNorm) return;

    const jaExiste = existentesPorSetor.get(setorNorm)?.has(String(telefone));
    if (jaExiste) return;

    if (!novosPorSetor.has(setorNorm)) {
      novosPorSetor.set(setorNorm, { setor: setorNome, novosMap: new Map() });
    }

    novosPorSetor.get(setorNorm).novosMap.set(String(telefone), {
      setor: setorNome,
      setor_normalizado: setorNorm,
      telefone: String(telefone),
      nome_contato: ''
    });
  });

  if (novosPorSetor.size === 0) {
    return { contatosNovos: [], setoresAfetados: [] };
  }

  const contatosNovos = [];
  const setoresAfetados = [];

  for (const [setorNorm, info] of novosPorSetor.entries()) {
    const existentes = contatosAgrupados.get(setorNorm) || [];
    const listaFinal = [
      ...existentes.map((c) => ({
        setor: c.setor,
        setor_normalizado: setorNorm,
        nome_contato: c.nome_contato || '',
        telefone: String(c.telefone)
      })),
      ...Array.from(info.novosMap.values())
    ];

    await salvarSetorCompleto(setorNorm, listaFinal);

    setoresAfetados.push(info.setor);
    Array.from(info.novosMap.values()).forEach((c) => {
      contatosNovos.push({
        setor: c.setor,
        setor_normalizado: setorNorm,
        telefone: c.telefone,
        nome: c.setor,
        numero: c.telefone
      });
    });
  }

  return { contatosNovos, setoresAfetados: Array.from(new Set(setoresAfetados)).sort() };
}

export function fecharModalContatos() {
  const modal = document.getElementById('modalContatos');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

// ─── Upload de arquivo de contatos via modal ──────────────────────────────────

/**
 * Processado quando o usuário escolhe "Importar via Arquivo" no modal de escolha.
 * Aciona o input de arquivo oculto.
 */
export function acionarImportacaoArquivo() {
  fecharModalEscolha();
  const input = document.getElementById('fileContatos');
  if (input) input.click();
}

// ─── Helpers de máscara ───────────────────────────────────────────────────────

function telefoneParaMascara(numero) {
  if (!numero) return '';
  let digitos = numero.replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length >= 12) digitos = digitos.slice(2);
  return aplicarFormatoMascara(digitos);
}

function aplicarMascaraTelefone(input) {
  const digitos = input.value.replace(/\D/g, '').slice(0, 11);
  input.value = aplicarFormatoMascara(digitos);
}

function aplicarFormatoMascara(digitos) {
  if (!digitos.length) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
}
