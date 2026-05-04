import { state } from './state.js';
import { normalizarTexto } from './utils.js';
import { adicionarLog } from './logger.js';
import { buscarContatosAgrupados } from './contatos.js';
import { dispararMensagensComSelecao } from './messaging.js';

function getEl(id) {
  return document.getElementById(id);
}

function abrirModal(id) {
  const modal = getEl(id);
  if (!modal) return false;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  return true;
}

function fecharModal(id) {
  const modal = getEl(id);
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function formatarTelefoneMascara(numero) {
  if (!numero) return '';
  let digitos = String(numero).replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length >= 12) digitos = digitos.slice(2);
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
}

function atualizarResumoSelecao() {
  const resumo = getEl('envioResumoSelecao');
  if (!resumo) return;

  const inputs = Array.from(document.querySelectorAll('#listaSelecaoEnvio input[type="checkbox"]'));
  const total = inputs.length;
  const marcados = inputs.filter(i => i.checked).length;
  resumo.textContent = `${marcados} selecionado(s) de ${total}`;
}

function montarLinhaContato({ setorNorm, setorNome, telefone, contatoId, nomeContato, checked }) {
  const row = document.createElement('label');
  row.className = 'envio-contato-row';
  row.htmlFor = `envio-${contatoId}`;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `envio-${contatoId}`;
  checkbox.dataset.setorNorm = setorNorm;
  checkbox.dataset.setorNome = setorNome;
  checkbox.dataset.telefone = telefone;
  checkbox.dataset.contatoId = String(contatoId);
  checkbox.checked = Boolean(checked);
  checkbox.addEventListener('change', atualizarResumoSelecao);

  const info = document.createElement('div');
  info.className = 'envio-contato-info';
  info.innerHTML = `
    <div class="envio-contato-nome">${nomeContato || 'Sem nome'}</div>
    <div class="envio-contato-tel">${formatarTelefoneMascara(telefone)}</div>
  `;

  row.appendChild(checkbox);
  row.appendChild(info);
  return row;
}

export async function abrirModalSelecaoEnvio() {
  if (!state.dadosProcessados || state.dadosProcessados.length === 0) {
    adicionarLog('error', 'Nenhum setor carregado para disparo.');
    return;
  }

  const apiStatus = getEl('apiStatus');
  if (apiStatus && apiStatus.textContent === 'OFFLINE') {
    adicionarLog('warning', 'Teste a conexão com a API antes de iniciar o disparo.');
    return;
  }

  const lista = getEl('listaSelecaoEnvio');
  if (!lista) {
    adicionarLog('error', 'UI de seleção de envio não encontrada.');
    return;
  }

  lista.innerHTML = '';

  const contatosAgrupados = await buscarContatosAgrupados();

  const setoresOrdenados = [...state.dadosProcessados].sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

  setoresOrdenados.forEach((setor) => {
    const setorNome = setor.nome;
    const setorNorm = normalizarTexto(setorNome);

    const contatosDb = contatosAgrupados.get(setorNorm) || [];
    const telefones = Array.isArray(setor.telefones) ? setor.telefones : [];

    const contatosPorTelefone = new Map();
    contatosDb.forEach((c) => {
      if (c?.telefone) contatosPorTelefone.set(String(c.telefone), c);
    });

    const telefonesUnicos = Array.from(new Set([
      ...telefones.map(t => String(t)),
      ...contatosDb.map(c => String(c.telefone))
    ])).filter(Boolean);

    const bloco = document.createElement('div');
    bloco.className = 'envio-setor-block';

    const header = document.createElement('div');
    header.className = 'envio-setor-header';
    header.innerHTML = `
      <div class="envio-setor-titulo">${setorNome}</div>
      <button type="button" class="envio-btn-todos" data-setor="${setorNorm}">Marcar todos</button>
    `;

    const body = document.createElement('div');
    body.className = 'envio-setor-body';

    if (telefonesUnicos.length === 0) {
      const vazio = document.createElement('div');
      vazio.className = 'envio-vazio';
      vazio.textContent = 'Nenhum contato disponível para este setor.';
      body.appendChild(vazio);
    } else {
      telefonesUnicos.forEach((telefone) => {
        const db = contatosPorTelefone.get(String(telefone));
        const contatoId = db?.id ?? `${setorNorm}-${telefone}`;
        const nomeContato = db?.nome_contato || '';
        body.appendChild(
          montarLinhaContato({
            setorNorm,
            setorNome,
            telefone,
            contatoId,
            nomeContato,
            checked: false
          })
        );
      });
    }

    bloco.appendChild(header);
    bloco.appendChild(body);
    lista.appendChild(bloco);
  });

  // Eventos internos: marcar todos por setor
  lista.querySelectorAll('.envio-btn-todos').forEach((btn) => {
    btn.addEventListener('click', () => {
      const setorNorm = btn.dataset.setor;
      const checks = Array.from(lista.querySelectorAll('input[type="checkbox"]'))
        .filter((c) => c.dataset.setorNorm === setorNorm);
      const algumDesmarcado = checks.some(c => !c.checked);
      checks.forEach(c => { c.checked = algumDesmarcado; });
      atualizarResumoSelecao();
    });
  });

  atualizarResumoSelecao();
  abrirModal('modalSelecaoEnvio');
}

export function fecharModalSelecaoEnvio() {
  fecharModal('modalSelecaoEnvio');
}

export async function confirmarEnvioSelecionado() {
  const lista = getEl('listaSelecaoEnvio');
  if (!lista) return;

  const checks = Array.from(lista.querySelectorAll('input[type="checkbox"]'));
  const selecionados = checks.filter(c => c.checked);

  if (selecionados.length === 0) {
    adicionarLog('warning', 'Selecione pelo menos um contato para enviar.');
    return;
  }

  const selecaoPorSetor = new Map();
  selecionados.forEach((c) => {
    const setorNorm = c.dataset.setorNorm || '';
    const telefone = c.dataset.telefone;
    if (!setorNorm || !telefone) return;
    if (!selecaoPorSetor.has(setorNorm)) selecaoPorSetor.set(setorNorm, new Set());
    selecaoPorSetor.get(setorNorm).add(String(telefone));
  });

  fecharModalSelecaoEnvio();
  await dispararMensagensComSelecao(selecaoPorSetor);
}
