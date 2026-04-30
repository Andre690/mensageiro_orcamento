import { normalizarTexto, formatarTelefone } from './utils.js';
import { adicionarLog } from './logger.js';

const API_BASE = '/api';

// Setores do orçamento atual — preenchido ao abrir o modal de escolha
let _setoresAtuais = [];

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
  } catch (err) {
    adicionarLog('error', `Erro ao adicionar contato: ${err.message}`);
  }
}

async function removerContatoLocal(id, normalizado) {
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
