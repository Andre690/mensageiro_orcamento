export const state = {
  dadosCategoria: null,
  dadosContatos: null,
  dadosProcessados: [],
  enviarPdfHabilitado: true
};

export function clearDadosProcessados() {
  state.dadosProcessados = [];
}

export function resetDadosCarregados() {
  state.dadosCategoria = null;
  state.dadosContatos = null;
  clearDadosProcessados();
}
