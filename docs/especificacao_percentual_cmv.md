# Especificação: Exibir Percentual CMV no PDF

## Objetivo

Exibir o **Percentual CMV** (Custo das Mercadorias Vendidas sobre Faturamento Líquido) no PDF gerado, **logo após os valores monetários** (orçado e realizado) nas colunas da tabela, para a categoria e classificação de CMV.

---

## Definição dos Cálculos

### Percentual CMV sobre Realizado

```
percentual_cmv_realizado = (realizado_cmv / faturamento_liquido_realizado) × 100
```

### Percentual CMV sobre Orçado

```
percentual_cmv_orcado = (orcado_cmv / faturamento_liquido_orcado) × 100
```

Onde:
- **`realizado_cmv`** / **`orcado_cmv`** = valores `realizado` e `orcado` da classificação onde:
  - `classificacao` contém **"CUSTO DAS MERCADORIAS VENDIDAS"**
  - `categoria` == **"02.03 - CUSTO DAS MERCADORIAS VENDIDAS"**

- **`faturamento_liquido_realizado`** / **`faturamento_liquido_orcado`** = valores `realizado` e `orcado` da classificação onde:
  - `classificacao` == **"02 - FATURAMENTO LIQUIDO"**
  - `categoria` == **"01.02 - FATURAMENTO BRUTO"**

### Regra de Fallback

Se a classificação de Faturamento Líquido **não existir** nos dados do setor, os percentuais **não devem ser exibidos** (manter comportamento atual, só o valor monetário).

---

## Onde e Como será exibido

### Localização: Colunas Orçado e Realizado da TABELA

O percentual aparece **entre parênteses logo após o valor monetário**, nas colunas **Orçado** e **Realizado**, tanto na **linha da categoria** quanto na **linha da classificação** de CMV.

### NÃO afeta:
- Os boxes de **RESUMO ENTRADAS** e **RESUMO SAÍDAS** no topo do PDF — continuam calculando normalmente como já fazem hoje.
- As colunas **Diferença** e **%** — continuam com o cálculo padrão (orçado - realizado / percentual de execução).
- O **título/nome** da categoria e da classificação — permanecem inalterados.

---

## Exemplo Visual na Tabela do PDF

### Linha da Categoria `02.03 - CUSTO DAS MERCADORIAS VENDIDAS`:

| Descrição | Orçado | Realizado | Diferença | % |
|-----------|--------|-----------|-----------|---|
| 02.03 - CUSTO DAS MERCADORIAS VENDIDAS | 1.220.030,35 **(10,50%)** | 1.180.500,00 **(11,20%)** | 39.530,35 | 96,76% |

### Linha da Classificação `CUSTO DAS MERCADORIAS VENDIDAS` (dentro da categoria acima):

| Descrição | Orçado | Realizado | Diferença | % |
|-----------|--------|-----------|-----------|---|
| &nbsp;&nbsp;&nbsp;CUSTO DAS MERCADORIAS VENDIDAS | 1.220.030,35 **(10,50%)** | 1.180.500,00 **(11,20%)** | 39.530,35 | 96,76% |

### Todas as outras linhas continuam normais:

| Descrição | Orçado | Realizado | Diferença | % |
|-----------|--------|-----------|-----------|---|
| 01.01 - ALGUMA OUTRA CATEGORIA | 500.000,00 | 480.000,00 | 20.000,00 | 96,00% |

---

## Arquivo Impactado

### `services/pdf.service.js` — Geração do PDF (única alteração)

#### Alteração 1: Buscar Faturamento Líquido (antes do loop, dentro de `renderTabela()`)

Dentro da função `renderTabela()` (linha 275), **antes do loop de categorias** (linha 341):

```javascript
// Buscar valores de faturamento líquido no mesmo setor
let faturamentoLiquidoRealizado = null;
let faturamentoLiquidoOrcado = null;

categorias.forEach((cat) => {
  if (normalizarParaComparacao(cat.nome).includes('01.02') && 
      normalizarParaComparacao(cat.nome).includes('faturamento bruto')) {
    (cat.classificacoes || []).forEach((cls) => {
      if (normalizarParaComparacao(cls.nome).includes('02') &&
          normalizarParaComparacao(cls.nome).includes('faturamento liquido')) {
        faturamentoLiquidoRealizado = cls.realizado;
        faturamentoLiquidoOrcado = cls.orcado;
      }
    });
  }
});
```

#### Alteração 2: Valores da Categoria CMV (linhas ~386-393)

Quando a categoria for CMV, ao renderizar as colunas **Orçado** e **Realizado**, concatenar o percentual:

```javascript
// Ao renderizar o valor ORÇADO da categoria
let textoOrcadoCat = formatarMoedaDinamico(categoria.orcado || 0, doc);
let textoRealizadoCat = formatarMoedaDinamico(categoria.realizado || 0, doc);

if (isCMVCategoria(nomeCategoria)) {
  if (faturamentoLiquidoOrcado > 0) {
    const percOrc = ((categoria.orcado / faturamentoLiquidoOrcado) * 100)
      .toFixed(2).replace('.', ',');
    textoOrcadoCat += ` (${percOrc}%)`;
  }
  if (faturamentoLiquidoRealizado > 0) {
    const percReal = ((categoria.realizado / faturamentoLiquidoRealizado) * 100)
      .toFixed(2).replace('.', ',');
    textoRealizadoCat += ` (${percReal}%)`;
  }
}

doc.text(textoOrcadoCat, colOrcado, catY, { width: 90, align: 'right' });
doc.text(textoRealizadoCat, colRealizado, catY, { width: 90, align: 'right' });
```

#### Alteração 3: Valores da Classificação CMV (linhas ~457-469)

Quando a classificação contiver CMV e pertencer à categoria CMV, concatenar o percentual:

```javascript
// Ao renderizar o valor ORÇADO da classificação
let textoOrcadoCls = formatarMoedaDinamico(classificacao.orcado || 0, doc);
let textoRealizadoCls = formatarMoedaDinamico(classificacao.realizado || 0, doc);

if (isCMVClassificacao(nomeClassificacao) && isCMVCategoria(nomeCategoria)) {
  if (faturamentoLiquidoOrcado > 0) {
    const percOrc = ((classificacao.orcado / faturamentoLiquidoOrcado) * 100)
      .toFixed(2).replace('.', ',');
    textoOrcadoCls += ` (${percOrc}%)`;
  }
  if (faturamentoLiquidoRealizado > 0) {
    const percReal = ((classificacao.realizado / faturamentoLiquidoRealizado) * 100)
      .toFixed(2).replace('.', ',');
    textoRealizadoCls += ` (${percReal}%)`;
  }
}

doc.text(textoOrcadoCls, colOrcado, classY, { width: 90, align: 'right' });
doc.text(textoRealizadoCls, colRealizado, classY, { width: 90, align: 'right' });
```

---

## Funções Auxiliares a Criar

```javascript
/**
 * Normaliza texto removendo acentos e convertendo para minúsculas
 */
function normalizarParaComparacao(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Verifica se o nome da categoria é a de CMV
 */
function isCMVCategoria(nome) {
  const normalizado = normalizarParaComparacao(nome);
  return normalizado.includes('02.03') && 
         normalizado.includes('custo das mercadorias vendidas');
}

/**
 * Verifica se o nome da classificação é de CMV
 */
function isCMVClassificacao(nome) {
  return normalizarParaComparacao(nome).includes('custo das mercadorias vendidas');
}
```

---

## Observações Técnicas

| Aspecto | Detalhe |
|---------|---------|
| **Comparação de nomes** | Case-insensitive, tolerante a acentos. Usar `normalizarParaComparacao()` |
| **Formato do percentual** | `(XX,XX%)` — vírgula como separador decimal (padrão BR) |
| **Divisão por zero** | Se `faturamentoLiquido` (real ou orçado) for `0`/`null`/`undefined`, **não exibir** o percentual correspondente |
| **Largura da coluna** | O texto `1.220.030,35 (10,50%)` é mais largo do que o normal. Pode ser necessário ajustar o `formatarMoedaDinamico` para considerar o texto extra ou reduzir a fonte automaticamente |
| **Escopo** | Cálculo é **por setor** — cada setor tem seus próprios dados |
| **Resumos** | Boxes de RESUMO ENTRADAS e RESUMO SAÍDAS **NÃO são afetados** |
| **Frontend** | Nenhuma alteração necessária em `dataLoader.js` |
| **Mensagem WhatsApp** | Nenhuma alteração necessária em `messaging.js` |

---

## Checklist de Implementação

- [ ] Criar `normalizarParaComparacao()`, `isCMVCategoria()`, `isCMVClassificacao()` em `pdf.service.js`
- [ ] Buscar `faturamentoLiquidoRealizado` e `faturamentoLiquidoOrcado` antes do loop em `renderTabela()`
- [ ] Alterar renderização dos valores **orçado** e **realizado** na linha da **categoria** CMV
- [ ] Alterar renderização dos valores **orçado** e **realizado** na linha da **classificação** CMV
- [ ] Tratar divisão por zero / valor não encontrado
- [ ] Verificar se `formatarMoedaDinamico` lida bem com texto mais longo (ajuste de fonte)
- [ ] Testar com setor que **tem** Faturamento Líquido
- [ ] Testar com setor que **não tem** (fallback: só valor monetário, sem parênteses)
- [ ] Confirmar que RESUMO ENTRADAS e RESUMO SAÍDAS **não mudaram**
