export function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizarChave(chave) {
  if (!chave) return '';
  return normalizarTexto(chave).replace(/\s+/g, '_');
}

export function obterCampo(obj, ...possiveisChaves) {
  if (!obj) return undefined;

  if (!obj.__mapaChavesNormalizadas) {
    const mapa = {};
    Object.keys(obj).forEach((chaveOriginal) => {
      const chaveNormalizada = normalizarChave(chaveOriginal);
      if (!(chaveNormalizada in mapa)) {
        mapa[chaveNormalizada] = chaveOriginal;
      }
    });

    Object.defineProperty(obj, '__mapaChavesNormalizadas', {
      value: mapa,
      enumerable: false,
      configurable: false
    });
  }

  const mapa = obj.__mapaChavesNormalizadas;
  for (const chave of possiveisChaves) {
    const chaveNormalizada = normalizarChave(chave);
    const chaveOriginal = mapa[chaveNormalizada];
    if (chaveOriginal !== undefined) {
      return obj[chaveOriginal];
    }
  }

  return undefined;
}

export function parseNumero(valor) {
  if (typeof valor === 'number') return valor;
  if (!valor || typeof valor !== 'string') return 0;

  return (
    parseFloat(
      valor
        .replace(/[^\d,.-]/g, '')
        .replace(/\.(?=\d{3,})/g, '')
        .replace(/,/g, '.')
    ) || 0
  );
}

export function formatarTelefone(numero) {
  const warnings = [];

  if (!numero) {
    return { telefone: '', warnings };
  }

  let tel = numero.toString().replace(/\D/g, '');

  if (tel.startsWith('0')) {
    tel = tel.substring(1);
  }

  if (!tel.startsWith('55')) {
    tel = `55${tel}`;
  }

  if (tel.length < 13) {
    warnings.push(`Numero ${numero} pode estar incompleto: ${tel}`);
  } else if (tel.length > 13) {
    warnings.push(
      `Numero ${numero} foi truncado para 13 digitos: ${tel.substring(0, 13)}`
    );
    tel = tel.substring(0, 13);
  } else if (tel.length > 13) {
    tel = tel.substring(0, 13);
  }

  return { telefone: tel, warnings };
}



// Normaliza valores de movimento para 'entrada' ou 'saida'
export function normalizarMovimento(valor) {
  if (!valor) return 'saida';
  const texto = String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

  if (
    texto === 'entrada' ||
    texto === 'receita' ||
    texto === 'credito' ||
    texto === 'recebimento'
  ) {
    return 'entrada';
  }
  return 'saida';
}

// Capitaliza para exibição ao usuário
export function capitalizarMovimento(movimento) {
  const normalizado = normalizarMovimento(movimento);
  return normalizado === 'entrada' ? 'Entrada' : 'Saída';
}
