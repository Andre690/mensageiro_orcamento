export const state = {
  dadosSetor: null,
  dadosCategoria: null,
  dadosContatos: null,
  dadosProcessados: [],
  enviarPdfHabilitado: true
};

export function clearDadosProcessados() {
  state.dadosProcessados = [];
}

export function resetDadosCarregados() {
  state.dadosSetor = null;
  state.dadosCategoria = null;
  state.dadosContatos = null;
  clearDadosProcessados();
}
