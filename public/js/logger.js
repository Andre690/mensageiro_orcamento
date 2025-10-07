const MAX_LOGS = 100;

export function adicionarLog(tipo, mensagem, timestamp = new Date()) {
  const logContainer = document.getElementById('logContainer');
  if (!logContainer) return;

  const logItem = document.createElement('div');
  logItem.className = `log-item log-${tipo}`;

  const timeStr = timestamp.toLocaleTimeString('pt-BR');
  logItem.innerHTML = `<strong>[${timeStr}]</strong> ${mensagem}`;

  logContainer.appendChild(logItem);
  logContainer.scrollTop = logContainer.scrollHeight;

  const logs = logContainer.querySelectorAll('.log-item');
  if (logs.length > MAX_LOGS && logs[0]) {
    logs[0].remove();
  }
}
