import { normalizarTexto, formatarTelefone } from './utils.js';
import { adicionarLog } from './logger.js';

const API_BASE = '/api';

/**
 * Busca todos os contatos salvos no banco SQLite do backend.
 * @returns {Promise<Map<string, string>>} Mapa de setor_normalizado → telefone
 */
export async function buscarContatosSalvos() {
  try {
    const resp = await fetch(`${API_BASE}/contatos`);
    const json = await resp.json();
    if (!json.success) throw new Error(json.message);

    const mapa = new Map();
    (json.contatos || []).forEach((c) => {
      mapa.set(normalizarTexto(c.setor), c.telefone);
    });
    return mapa;
  } catch (err) {
    adicionarLog('warning', `Não foi possível carregar contatos salvos: ${err.message}`);
    return new Map();
  }
}

/**
 * Salva/atualiza lista de contatos no backend.
 * @param {Array<{ setor: string, telefone: string }>} contatos
 */
export async function salvarContatosNoBanco(contatos) {
  const payload = contatos.map((c) => ({
    setor: c.setor,
    setor_normalizado: normalizarTexto(c.setor),
    telefone: c.telefone
  }));

  const resp = await fetch(`${API_BASE}/contatos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contatos: payload })
  });

  const json = await resp.json();
  if (!json.success) throw new Error(json.message);
  return json;
}

// ─── Modal de Gerenciamento de Contatos ───────────────────────────────────────

let setoresModal = [];

/**
 * Abre o modal de contatos exibindo os setores do orçamento.
 * @param {string[]} nomesDosSetores - Nomes únicos de setores extraídos do arquivo de categorias
 */
export async function abrirModalContatos(nomesDosSetores) {
  setoresModal = [...new Set(nomesDosSetores)].sort();

  // Busca contatos já salvos no banco
  const contatosSalvos = await buscarContatosSalvos();

  const modal = document.getElementById('modalContatos');
  const lista = document.getElementById('listaContatosModal');
  if (!modal || !lista) return;

  lista.innerHTML = '';

  setoresModal.forEach((nomeSetor) => {
    const normalizado = normalizarTexto(nomeSetor);
    const telefoneSalvo = contatosSalvos.get(normalizado) || '';
    const mascarado = telefoneParaMascara(telefoneSalvo);

    const row = document.createElement('div');
    row.className = 'contato-row';
    row.innerHTML = `
      <div class="contato-setor-nome">${nomeSetor}</div>
      <div class="contato-input-wrapper">
        <input
          type="tel"
          class="contato-input"
          id="tel-${normalizado}"
          data-setor="${nomeSetor}"
          data-normalizado="${normalizado}"
          placeholder="(DD) XXXXX-XXXX"
          maxlength="15"
          value="${mascarado}"
          autocomplete="off"
        >
        ${telefoneSalvo ? '<span class="contato-saved-badge">💾 Salvo</span>' : ''}
      </div>
    `;
    lista.appendChild(row);
  });

  // Aplica máscara nos inputs ao digitar
  lista.querySelectorAll('.contato-input').forEach((input) => {
    input.addEventListener('input', (e) => aplicarMascaraTelefone(e.target));
  });

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function fecharModalContatos() {
  const modal = document.getElementById('modalContatos');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Lê os inputs do modal, formata os telefones e salva no backend.
 */
export async function salvarContatosDoModal() {
  const inputs = document.querySelectorAll('#listaContatosModal .contato-input');
  const contatos = [];
  const erros = [];

  inputs.forEach((input) => {
    const setor = input.dataset.setor;
    const valor = input.value.trim();
    if (!valor) return; // Ignora setores sem número preenchido

    // Remove máscara e adiciona DDI 55
    const { telefone, warnings } = formatarTelefone(valor);
    warnings.forEach((w) => erros.push(w));

    if (telefone) {
      contatos.push({ setor, telefone });
    }
  });

  if (contatos.length === 0) {
    adicionarLog('warning', 'Nenhum número preenchido para salvar.');
    return;
  }

  const btnSalvar = document.getElementById('btnSalvarContatos');
  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.textContent = '⏳ Salvando...';
  }

  try {
    const resultado = await salvarContatosNoBanco(contatos);
    adicionarLog('success', resultado.message || `${contatos.length} contato(s) salvos.`);
    erros.forEach((e) => adicionarLog('warning', e));

    // Atualiza badges no modal
    contatos.forEach(({ setor }) => {
      const normalizado = normalizarTexto(setor);
      const input = document.getElementById(`tel-${normalizado}`);
      if (input) {
        const wrapper = input.closest('.contato-input-wrapper');
        if (wrapper && !wrapper.querySelector('.contato-saved-badge')) {
          const badge = document.createElement('span');
          badge.className = 'contato-saved-badge';
          badge.textContent = '💾 Salvo';
          wrapper.appendChild(badge);
        }
      }
    });

    fecharModalContatos();
  } catch (err) {
    adicionarLog('error', `Erro ao salvar contatos: ${err.message}`);
  } finally {
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = '💾 Salvar Contatos';
    }
  }
}

// ─── Helpers de Máscara ───────────────────────────────────────────────────────

/**
 * Converte número limpo (ex: "5511999999999") para formato de exibição "(11) 99999-9999"
 */
function telefoneParaMascara(numero) {
  if (!numero) return '';
  // Remove DDI 55 se presente
  let digitos = numero.replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length >= 12) {
    digitos = digitos.slice(2);
  }
  return aplicarFormatoMascara(digitos);
}

/**
 * Aplica máscara visual enquanto o usuário digita no input.
 */
function aplicarMascaraTelefone(input) {
  let digitos = input.value.replace(/\D/g, '').slice(0, 11);
  input.value = aplicarFormatoMascara(digitos);
}

function aplicarFormatoMascara(digitos) {
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  // Celular com 9 dígitos: (DD) 9XXXX-XXXX
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
}
