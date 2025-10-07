export function calcularPercentual(realizado, orcado) {
  return orcado > 0 ? (realizado / orcado) * 100 : 0;
}

export function getStatusClass(percentual) {
  if (percentual >= 100) return 'danger';
  if (percentual >= 90) return 'warning';
  return 'success';
}

export function getStatusText(percentual) {
  if (percentual >= 100) return 'Ultrapassou';
  if (percentual >= 90) return 'Proximo';
  return 'Controlado';
}
