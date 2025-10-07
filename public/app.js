// Definir todas as variáveis e funções no escopo global (window)
window.dadosSetor = null;
window.dadosCategoria = null;
window.dadosContatos = null;
window.dadosProcessados = [];

window.normalizarTexto = function (texto) {
    if (!texto) return '';
    return texto
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toLowerCase();
};

window.normalizarChave = function (chave) {
    if (!chave) return '';
    return window.normalizarTexto(chave).replace(/\s+/g, '_');
};

window.obterCampo = function (obj, ...possiveisChaves) {
    if (!obj) return undefined;

    if (!obj.__mapaChavesNormalizadas) {
        const mapa = {};
        Object.keys(obj).forEach((chaveOriginal) => {
            const chaveNormalizada = window.normalizarChave(chaveOriginal);
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
        const chaveNormalizada = window.normalizarChave(chave);
        const chaveOriginal = mapa[chaveNormalizada];
        if (chaveOriginal !== undefined) {
            return obj[chaveOriginal];
        }
    }

    return undefined;
};

// Função para parse de número
window.parseNumero = function (valor) {
    if (typeof valor === 'number') return valor;
    if (!valor || typeof valor !== 'string') return 0;

    return parseFloat(
        valor
            .replace(/[^\d,.-]/g, '')     // Remove R$, espaços, etc
            .replace(/\.(?=\d{3,})/g, '') // Remove pontos de milhar
            .replace(/,/g, '.')             // Troca vírgula por ponto decimal
    ) || 0;
};

// Função para adicionar logs
window.adicionarLog = function(tipo, mensagem, timestamp = new Date()) {
    const logContainer = document.getElementById('logContainer');
    const logItem = document.createElement('div');
    logItem.className = `log-item log-${tipo}`;
    
    const timeStr = timestamp.toLocaleTimeString('pt-BR');
    logItem.innerHTML = `<strong>[${timeStr}]</strong> ${mensagem}`;
    
    logContainer.appendChild(logItem);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Limita o número de logs exibidos (máximo 100)
    const logs = logContainer.querySelectorAll('.log-item');
    if (logs.length > 100) {
        logs[0].remove();
    }
};

// Função para testar a API
window.testarAPI = async function () {
    try {
        const response = await fetch('/api/testar-conexao', { headers: { 'Accept': 'application/json; charset=utf-8' } });
        const data = await response.json();

        console.log('Resposta da API:', data);

        const estado = data.raw?.instance?.state || data.state || 'desconhecido';

        if (estado === 'open' || estado === 'CONNECTED')  {
            document.getElementById('apiStatus').textContent = 'ONLINE';
            document.getElementById('apiStatus').className = 'api-status online';
            window.adicionarLog('success', '✅ API conectada com sucesso.');
        } else {
            window.adicionarLog('warning', `⚠️ API respondeu, mas o estado é: ${estado}`);
        }
    } catch (error) {
        window.adicionarLog('error', `❌ Erro ao testar API: ${error.message}`);
    }
};

// Função para formatar número de telefone
window.formatarTelefone = function(numero) {
    if (!numero) return '';
    
    // Remove todos os caracteres não numéricos
    let tel = numero.toString().replace(/\D/g, '');
    
    // Se começar com 0, remove
    if (tel.startsWith('0')) {
        tel = tel.substring(1);
    }
    
    // Se não começar com 55 (código do Brasil), adiciona
    if (!tel.startsWith('55')) {
        tel = '55' + tel;
    }
    
    // Garante que tem pelo menos 13 dígitos (55 + DDD + 9 dígitos)
    if (tel.length < 13) {
        window.adicionarLog("warning", `⚠️ Número ${numero} pode estar incompleto: ${tel}`);
    } else if (tel.length > 13) {
        tel = tel.substring(0, 13);
        window.adicionarLog("warning", `⚠️ Número ${numero} foi truncado para 13 dígitos: ${tel}`);
    }
    
    return tel;
};

// Função auxiliar para processar CSV
window.csvParaJSON = function(csvText) {
    const linhas = csvText.split('\n');
    if (linhas.length === 0) return [];
    
    const headers = linhas[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dados = [];

    for (let i = 1; i < linhas.length; i++) {
        if (linhas[i].trim() === '') continue;
        
        const valores = linhas[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const objeto = {};
        
        headers.forEach((header, index) => {
            let valor = valores[index] || '';
            
            // Tenta converter números
            if (!isNaN(valor) && valor !== '' && valor !== '-') {
                valor = parseFloat(valor.replace(',', '.'));
            }
            
            objeto[header] = valor;
        });
        
        dados.push(objeto);
    }

    return dados;
};

// Função para processar qualquer tipo de arquivo
window.processarArquivo = function(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let dados;
            
            if (file.name.toLowerCase().endsWith('.csv')) {
                // Processamento CSV
                const csvText = e.target.result;
                dados = window.csvParaJSON(csvText);
            } else {
                // Processamento Excel
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                dados = XLSX.utils.sheet_to_json(worksheet);
            }
            
            // Validação básica
            if (!dados || dados.length === 0) {
                throw new Error('Arquivo vazio ou sem dados válidos');
            }
            
            callback(null, dados);
        } catch (error) {
            callback(error, null);
        }
    };
    
    reader.onerror = function(error) {
        callback(new Error('Erro ao ler o arquivo'), null);
    };
    
    if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file, 'UTF-8');
    } else {
        reader.readAsArrayBuffer(file);
    }
};

// Funções de carregamento de arquivos
window.carregarArquivoSetor = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    window.processarArquivo(file, (error, dadosBrutos) => {
        if (error) {
            window.adicionarLog('error', `Erro ao carregar arquivo de orçamento geral: ${error.message}`);
            document.getElementById('statusSetor').innerHTML = '❌ Erro';
            document.getElementById('statusSetor').style.color = '#dc3545';
            return;
        }

        const registros = [];

        dadosBrutos.forEach((linhaOriginal) => {
            const setorNome = window.obterCampo(linhaOriginal, 'setor', 'nome_setor');
            const orcadoBruto = window.obterCampo(linhaOriginal, 'orcamento_total', 'orcado_total', 'orcado_mensal', 'orcado');
            const realizadoBruto = window.obterCampo(linhaOriginal, 'realizado');

            if (!setorNome || (orcadoBruto === undefined && realizadoBruto === undefined)) {
                return;
            }

            registros.push({
                setor: setorNome,
                orcado: window.parseNumero(orcadoBruto),
                realizado: window.parseNumero(realizadoBruto),
                original: linhaOriginal
            });
        });

        if (registros.length === 0) {
            window.adicionarLog('error', 'Arquivo de orçamento geral precisa conter colunas de Setor e valores de orçamento/realizado.');
            document.getElementById('statusSetor').innerHTML = '❌ Formato Inválido';
            document.getElementById('statusSetor').style.color = '#dc3545';
            return;
        }

        window.dadosSetor = registros;
        document.getElementById('statusSetor').innerHTML = '✅ Carregado';
        document.getElementById('statusSetor').style.color = '#28a745';
        document.getElementById('uploadCard1').classList.add('loaded');

        window.adicionarLog('success', `Arquivo de orçamento geral carregado: ${window.dadosSetor.length} registros`);
        window.processarDados();
    });
};

window.carregarArquivoCategoria = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    window.processarArquivo(file, (error, dadosBrutos) => {
        if (error) {
            window.adicionarLog('error', `Erro ao carregar arquivo de categoria: ${error.message}`);
            document.getElementById('statusCategoria').innerHTML = '❌ Erro';
            document.getElementById('statusCategoria').style.color = '#dc3545';
            return;
        }

        const registros = [];

        dadosBrutos.forEach((linhaOriginal) => {
            const setorNome = window.obterCampo(linhaOriginal, 'setor', 'nome_setor');
            const grupoNome = window.obterCampo(linhaOriginal, 'grupo');
            const categoriaNome = window.obterCampo(linhaOriginal, 'categoria');
            const classificacaoNome = window.obterCampo(linhaOriginal, 'classificacao');
            const descricao = window.obterCampo(linhaOriginal, 'descricao');
            const orcadoBruto = window.obterCampo(linhaOriginal, 'orcado_mensal', 'orcado', 'orcamento_total');
            const realizadoBruto = window.obterCampo(linhaOriginal, 'realizado');

            if (!setorNome) {
                return;
            }

            registros.push({
                setor: setorNome,
                grupo: grupoNome || 'Sem grupo',
                categoria: categoriaNome || 'Sem categoria',
                classificacao: classificacaoNome || descricao || 'Sem classificacao',
                descricao: descricao || '',
                orcado: window.parseNumero(orcadoBruto),
                realizado: window.parseNumero(realizadoBruto),
                original: linhaOriginal
            });
        });

        if (registros.length === 0) {
            window.adicionarLog('error', 'Arquivo de categoria deve conter as colunas "Setor", "Grupo", "Categoria" e "Classificação".');
            document.getElementById('statusCategoria').innerHTML = '❌ Formato Inválido';
            document.getElementById('statusCategoria').style.color = '#dc3545';
            return;
        }

        window.dadosCategoria = registros;
        document.getElementById('statusCategoria').innerHTML = '✅ Carregado';
        document.getElementById('statusCategoria').style.color = '#28a745';
        document.getElementById('uploadCard2').classList.add('loaded');

        window.adicionarLog('success', `Arquivo de orçamento por categoria carregado: ${window.dadosCategoria.length} registros`);
        window.processarDados();
    });
};

window.carregarArquivoContatos = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    window.processarArquivo(file, (error, dadosBrutos) => {
        if (error) {
            window.adicionarLog('error', `Erro ao carregar arquivo de contatos: ${error.message}`);
            document.getElementById('statusContatos').innerHTML = '❌ Erro';
            document.getElementById('statusContatos').style.color = '#dc3545';
            return;
        }

        const registros = [];

        dadosBrutos.forEach((linhaOriginal) => {
            const nomeSetor = window.obterCampo(linhaOriginal, 'nome_setor', 'setor', 'nome');
            const numeroBruto = window.obterCampo(linhaOriginal, 'numero', 'telefone', 'contato');

            if (!nomeSetor || !numeroBruto) {
                return;
            }

            registros.push({
                nome: nomeSetor,
                numero: window.formatarTelefone(numeroBruto),
                original: linhaOriginal
            });
        });

        if (registros.length === 0) {
            window.adicionarLog('error', 'Arquivo de contatos deve conter as colunas "nome_setor" e "numero".');
            document.getElementById('statusContatos').innerHTML = '❌ Formato Inválido';
            document.getElementById('statusContatos').style.color = '#dc3545';
            return;
        }

        window.dadosContatos = registros;
        document.getElementById('statusContatos').innerHTML = '✅ Carregado';
        document.getElementById('statusContatos').style.color = '#28a745';
        document.getElementById('uploadCard3').classList.add('loaded');

        window.adicionarLog('success', `Arquivo de contatos carregado: ${window.dadosContatos.length} registros`);
        window.processarDados();
    });
};

window.processarDados = function() {
    if (!window.dadosSetor || !window.dadosCategoria || !window.dadosContatos) return;

    try {
        window.dadosProcessados = [];
        let setoresEncontrados = 0;
        const setoresNaoEncontrados = [];
        const setoresSemDetalhes = [];

        window.dadosContatos.forEach((contato) => {
            const nomeSetor = contato.nome || window.obterCampo(contato, 'nome_setor', 'setor', 'nome');
            const telefone = contato.numero;
            const nomeNormalizado = window.normalizarTexto(nomeSetor);

            if (!nomeNormalizado) {
                return;
            }

            const setorDados = window.dadosSetor.find((registro) => window.normalizarTexto(registro.setor) === nomeNormalizado);
            const registrosDetalhe = window.dadosCategoria.filter((registro) => window.normalizarTexto(registro.setor) === nomeNormalizado);

            if (!setorDados && registrosDetalhe.length === 0) {
                setoresNaoEncontrados.push(nomeSetor);
                return;
            }

            setoresEncontrados++;

            const gruposMap = new Map();
            const classificacoesEstouradas = [];

            registrosDetalhe.forEach((registro) => {
                const grupoNome = registro.grupo || 'Sem grupo';
                if (!gruposMap.has(grupoNome)) {
                    gruposMap.set(grupoNome, {
                        nome: grupoNome,
                        orcado: 0,
                        realizado: 0,
                        categoriasMap: new Map()
                    });
                }

                const grupo = gruposMap.get(grupoNome);
                const categoriaNome = registro.categoria || 'Sem categoria';

                if (!grupo.categoriasMap.has(categoriaNome)) {
                    grupo.categoriasMap.set(categoriaNome, {
                        nome: categoriaNome,
                        orcado: 0,
                        realizado: 0,
                        classificacoes: []
                    });
                }

                const categoria = grupo.categoriasMap.get(categoriaNome);
                const classificacaoNome = registro.classificacao || registro.descricao || 'Sem classificacao';
                const orcadoClassificacao = Number.isFinite(registro.orcado) ? registro.orcado : 0;
                const realizadoClassificacao = Number.isFinite(registro.realizado) ? registro.realizado : 0;

                categoria.classificacoes.push({
                    nome: classificacaoNome,
                    descricao: registro.descricao || '',
                    orcado: orcadoClassificacao,
                    realizado: realizadoClassificacao
                });

                categoria.orcado += orcadoClassificacao;
                categoria.realizado += realizadoClassificacao;
                grupo.orcado += orcadoClassificacao;
                grupo.realizado += realizadoClassificacao;

                if (orcadoClassificacao > 0 && realizadoClassificacao > orcadoClassificacao) {
                    classificacoesEstouradas.push({
                        nome: classificacaoNome,
                        categoria: categoriaNome,
                        grupo: grupoNome,
                        orcado: orcadoClassificacao,
                        realizado: realizadoClassificacao
                    });
                }
            });

            const grupos = Array.from(gruposMap.values()).map((grupo) => {
                const categorias = Array.from(grupo.categoriasMap.values()).map((categoria) => ({
                    nome: categoria.nome,
                    orcado: categoria.orcado,
                    realizado: categoria.realizado,
                    classificacoes: categoria.classificacoes
                }));

                return {
                    nome: grupo.nome,
                    orcado: grupo.orcado,
                    realizado: grupo.realizado,
                    categorias: categorias
                };
            });

            if (grupos.length === 0) {
                setoresSemDetalhes.push(nomeSetor);
            }

            const totalDetalheOrcado = grupos.reduce((soma, grupo) => soma + (grupo.orcado || 0), 0);
            const totalDetalheRealizado = grupos.reduce((soma, grupo) => soma + (grupo.realizado || 0), 0);

            let totalOrcado = setorDados ? setorDados.orcado : 0;
            let totalRealizado = setorDados ? setorDados.realizado : 0;

            if (!totalOrcado) totalOrcado = totalDetalheOrcado;
            if (!totalRealizado) totalRealizado = totalDetalheRealizado;

            window.dadosProcessados.push({
                nome: nomeSetor,
                telefone: telefone,
                orcado: totalOrcado,
                realizado: totalRealizado,
                grupos: grupos,
                classificacoes: classificacoesEstouradas,
                totalGrupos: grupos.length
            });
        });

        if (setoresNaoEncontrados.length > 0) {
            window.adicionarLog('warning', `⚠️ ${setoresNaoEncontrados.length} setores não encontrados no orçamento: ${setoresNaoEncontrados.join(', ')}`);
        }

        if (setoresSemDetalhes.length > 0) {
            window.adicionarLog('warning', `⚠️ ${setoresSemDetalhes.length} setores sem detalhes de grupo/categoria: ${setoresSemDetalhes.join(', ')}`);
        }

        window.adicionarLog('success', `✅ ${setoresEncontrados} setores processados com sucesso`);
        window.atualizarEstatisticas();
        window.renderizarSetores();
        document.getElementById('disparadorBtn').disabled = window.dadosProcessados.length === 0;

        if (window.dadosProcessados.length > 0) {
            window.adicionarLog('success', `Dados processados com sucesso! ${window.dadosProcessados.length} setores prontos para disparo.`);
        }

    } catch (error) {
        window.adicionarLog('error', `Erro ao processar dados: ${error.message}`);
        console.error('Erro detalhado:', error);
    }
};

window.calcularPercentual = function(realizado, orcado) {
    return orcado > 0 ? (realizado / orcado) * 100 : 0;
};

window.getStatusClass = function(percentual) {
    if (percentual >= 100) return 'danger';
    if (percentual >= 90) return 'warning';
    return 'success';
};

window.getStatusText = function(percentual) {
    if (percentual >= 100) return '🚨 Ultrapassou';
    if (percentual >= 90) return '⚠️ Próximo';
    return '✅ Controlado';
};

window.atualizarEstatisticas = function() {
    let ultrapassados = 0;
    let proximos = 0;
    let controlados = 0;

    window.dadosProcessados.forEach(setor => {
        const percentual = window.calcularPercentual(setor.realizado, setor.orcado);
        if (percentual >= 100) ultrapassados++;
        else if (percentual >= 90) proximos++;
        else controlados++;
    });

    document.getElementById('setoresUltrapassados').textContent = ultrapassados;
    document.getElementById('setoresProximos').textContent = proximos;
    document.getElementById('setoresControlados').textContent = controlados;
    document.getElementById('totalSetores').textContent = window.dadosProcessados.length;
};

window.renderizarSetores = function() {
    const container = document.getElementById('setoresList');
    container.innerHTML = '';

    if (window.dadosProcessados.length === 0) {
        container.innerHTML = `
            <div class="alert alert-warning">
                <strong>⚠️ Atenção:</strong> Nenhum setor encontrado. Verifique se os arquivos foram carregados corretamente e se os nomes dos setores coincidem entre os arquivos.
            </div>
        `;
        return;
    }

    // Ordena setores por percentual (maiores primeiro)
    const setoresOrdenados = [...window.dadosProcessados].sort((a, b) => {
        const percA = window.calcularPercentual(a.realizado, a.orcado);
        const percB = window.calcularPercentual(b.realizado, b.orcado);
        return percB - percA;
    });

    setoresOrdenados.forEach(setor => {
        const percentual = window.calcularPercentual(setor.realizado, setor.orcado);
        const statusClass = window.getStatusClass(percentual);
        const statusText = window.getStatusText(percentual);

        const setorElement = document.createElement('div');
        setorElement.className = `setor-item ${statusClass}`;
        
        setorElement.innerHTML = `
            <div class="setor-header">
                <div class="setor-name">${setor.nome}</div>
                <div class="setor-status status-${statusClass}">${statusText}</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill progress-${statusClass}" style="width: ${Math.min(percentual, 100)}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #666; margin-bottom: 5px;">
                <span>Orçado: R$ ${setor.orcado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                <span>Realizado: R$ ${setor.realizado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                <span>${percentual.toFixed(1)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #888;">
                <span>📞 ${setor.telefone}</span>
                <span>${(setor.classificacoes && setor.classificacoes.length) || 0} classificação(ões) estourada(s)</span>
            </div>
        `;

        container.appendChild(setorElement);
    });
};

window.gerarMensagem = function(setor) {
    const percentual = window.calcularPercentual(setor.realizado, setor.orcado);
    const IND1 = '  '; // 2 espaços
    const IND2 = IND1 + IND1; // 4 espaços
    const IND3 = IND2 + IND1; // 6 espaços

    const linhas = [];

    // Cabeçalho
    linhas.push('📊 *RELATÓRIO ORÇAMENTÁRIO*');
    linhas.push(`🏢 *Setor:* ${setor.nome}`);
    linhas.push(`💰 *Orçado:* R$ ${setor.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    linhas.push(`💳 *Realizado:* R$ ${setor.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    linhas.push(`📈 *Percentual Atingido:* ${percentual.toFixed(2)}%`);
    linhas.push('');

    if (percentual >= 100) {
        linhas.push('🚨 *ATENÇÃO*: _Setor ultrapassou o orçamento!_');
    } else if (percentual >= 90) {
        linhas.push('⚠️ *ALERTA*: _Setor próximo de atingir o orçamento!_');
    } else {
        linhas.push('✅ *Status*: _Situação controlada._');
    }

    // Separador
    linhas.push('');
    linhas.push('---');
    linhas.push('');

    // Grupos, Categorias, Classificações
    if (setor.grupos && setor.grupos.length > 0) {
        setor.grupos.forEach((grupo) => {
            linhas.push(`*${grupo.nome}*`);

            if (grupo.categorias && grupo.categorias.length > 0) {
                grupo.categorias.forEach((categoria) => {
                    linhas.push(`${IND1}- ${categoria.nome}`);

                    if (categoria.classificacoes && categoria.classificacoes.length > 0) {
                        categoria.classificacoes.forEach((classificacao) => {
                            const percClass = window.calcularPercentual(classificacao.realizado, classificacao.orcado);
                            const alert = (classificacao.orcado > 0 && classificacao.realizado > classificacao.orcado) ? ' *ATENÇÃO*' : '';
                            linhas.push(`${IND2}- ${classificacao.nome}${alert}`);
                            linhas.push(`${IND3}- _Orçado_: R$ ${classificacao.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
                            linhas.push(`${IND3}- _Realizado_: R$ ${classificacao.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
                            linhas.push(`${IND3}- _Percentual_: ${percClass.toFixed(1)}%`);
                        });
                    }
                });
            }

            // Linha em branco entre grupos
            linhas.push('');
        });
    }

    // Rodapé
    linhas.push('---');
    linhas.push('');
    linhas.push(`📅 *Relatório gerado em:* ${new Date().toLocaleString('pt-BR')}`);
    linhas.push('💼 *Sistema de Controle Orçamentário*');

    return linhas.join('\n');
};

// Enviar mensagem via backend local
window.enviarMensagemWhatsApp = async function(mensagem, telefone) {
    try {
        const resp = await fetch('/api/send-message', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json; charset=utf-8', 
                'Accept': 'application/json; charset=utf-8' 
            },
            body: JSON.stringify({ number: telefone, text: mensagem })
        });

        let body = null;
        try { body = await resp.json(); } catch {}

        if (!resp.ok) {
            const msg = body?.message || body?.provider?.message || `Falha HTTP ${resp.status}`;
            return { success: false, status: resp.status, response: body, error: msg };
        }
        return { success: true, status: resp.status, response: body };

    } catch (e) {
        return { success: false, error: 'Backend indisponível (porta 3000) ou bloqueado.' };
    }
};

// Retry automático de envio
window.enviarMensagemWhatsAppComRetry = async function(mensagem, telefone, tentativas = 3) {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    let ultimaResposta = null;

    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
        try {
            const resposta = await window.enviarMensagemWhatsApp(mensagem, telefone);
            if (resposta.success) return resposta;

            ultimaResposta = resposta;
            window.adicionarLog('warning', `⚠️ ${telefone} - Tentativa ${tentativa} falhou: ${resposta.response?.message || resposta.rawResponse}`);
        } catch (error) {
            ultimaResposta = { error: error.message };
            window.adicionarLog('warning', `⚠️ ${telefone} - Erro na tentativa ${tentativa}: ${error.message}`);
        }

        if (tentativa < tentativas) {
            window.adicionarLog('info', `⏳ ${telefone} - Aguardando ${tentativa * 3}s para próxima tentativa...`);
            await delay(tentativa * 3000);
        }
    }

    return ultimaResposta;
};

window.numeroValido = function(numero) {
    return /^55\d{10,11}$/.test(numero);
};

window.dispararMensagens = async function() {
    if (window.dadosProcessados.length === 0) {
        window.adicionarLog('error', '❌ Nenhum setor carregado para disparo!');
        return;
    }

    const apiStatus = document.getElementById('apiStatus');
    if (apiStatus.textContent === 'OFFLINE') {
        window.adicionarLog('warning', '⚠️ Teste a conexão com a API antes de disparar mensagens');
        return;
    }

    const btn = document.getElementById('disparadorBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px;"></div> Enviando mensagens...';

    window.adicionarLog('info', `🚀 Iniciando disparo para ${window.dadosProcessados.length} setores...`);

    let sucessos = 0;
    let erros = 0;
    const logDetalhado = [];

    for (const [index, setor] of window.dadosProcessados.entries()) {
        try {
            window.adicionarLog('info', `📤 Enviando para ${setor.nome} (${index + 1}/${window.dadosProcessados.length})...`);
            
            const mensagem = window.gerarMensagem(setor);
            const resultado = await window.enviarMensagemWhatsAppComRetry(mensagem, setor.telefone);

            if (resultado.success) {
                window.adicionarLog('success', `✅ ${setor.nome} - Mensagem enviada com sucesso`);
                sucessos++;
                logDetalhado.push(`✅ ${setor.nome}: Sucesso`);
            } else {
                const errorMsg = resultado.response?.message || resultado.rawResponse || 'Erro desconhecido';
                window.adicionarLog('error', `❌ ${setor.nome} - Erro: ${errorMsg}`);
                erros++;
                logDetalhado.push(`❌ ${setor.nome}: ${errorMsg}`);
            }

            // Aguarda 2 segundos entre envios
            if (index < window.dadosProcessados.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
        } catch (error) {
            window.adicionarLog('error', `❌ ${setor.nome} - Erro: ${error.message}`);
            erros++;
            logDetalhado.push(`❌ ${setor.nome}: ${error.message}`);
            
            // Em caso de erro de rede, aguarda mais tempo
            if (error.message.includes('rede') || error.message.includes('timeout')) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    // Log final detalhado
    window.adicionarLog('info', `🏁 Disparo finalizado! ${sucessos} sucessos, ${erros} erros.`);
    
    if (sucessos > 0) {
        window.adicionarLog('success', `✅ Mensagens enviadas com sucesso: ${sucessos}`);
    }
    
    if (erros > 0) {
        window.adicionarLog('error', `❌ Falhas no envio: ${erros}`);
    }

    btn.disabled = false;
    btn.innerHTML = '<span>📤</span> Disparar Mensagens para Setores';
};

window.recarregarDados = function() {
    // Reset dos dados
    window.dadosSetor = null;
    window.dadosCategoria = null;
    window.dadosContatos = null;
    window.dadosProcessados = [];

    // Reset da interface
    document.getElementById('statusSetor').innerHTML = 'Aguardando arquivo...';
    document.getElementById('statusSetor').style.color = '#666';
    document.getElementById('uploadCard1').classList.remove('loaded');

    document.getElementById('statusCategoria').innerHTML = 'Aguardando arquivo...';
    document.getElementById('statusCategoria').style.color = '#666';
    document.getElementById('uploadCard2').classList.remove('loaded');

    document.getElementById('statusContatos').innerHTML = 'Aguardando arquivo...';
    document.getElementById('statusContatos').style.color = '#666';
    document.getElementById('uploadCard3').classList.remove('loaded');

    // Reset das estatísticas
    document.getElementById('setoresUltrapassados').textContent = '-';
    document.getElementById('setoresProximos').textContent = '-';
    document.getElementById('setoresControlados').textContent = '-';
    document.getElementById('totalSetores').textContent = '-';

    // Reset da lista de setores
    document.getElementById('setoresList').innerHTML = `
        <div class="alert alert-warning">
            <strong>⚠️ Atenção:</strong> Carregue os arquivos Excel acima para visualizar os dados dos setores.
        </div>
    `;

    // Desabilita o botão
    document.getElementById('disparadorBtn').disabled = true;

    // Limpa os inputs de arquivo
    document.getElementById('fileSetor').value = '';
    document.getElementById('fileCategoria').value = '';
    document.getElementById('fileContatos').value = '';

    window.adicionarLog('info', '🔄 Dados recarregados. Carregue os arquivos novamente.');
};

// Função para validar entrada de dados
window.validarDados = function() {
    const problemas = [];
    
    if (!window.dadosSetor || window.dadosSetor.length === 0) {
        problemas.push('Arquivo de orçamento geral não carregado');
    }
    
    if (!window.dadosCategoria || window.dadosCategoria.length === 0) {
        problemas.push('Arquivo de orçamento por categoria não carregado');
    }
    
    if (!window.dadosContatos || window.dadosContatos.length === 0) {
        problemas.push('Arquivo de contatos não carregado');
    }
    
    if (problemas.length > 0) {
        window.adicionarLog('warning', `⚠️ Problemas encontrados: ${problemas.join(', ')}`);
        return false;
    }
    
    return true;
};

// Inicialização quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
    window.adicionarLog('success', '🎉 Sistema inicializado com sucesso!');
    window.adicionarLog('info', '📋 Configure a API WhatsApp e carregue os 3 arquivos para começar.');
    
    // Testa automaticamente a API na inicialização
    setTimeout(() => {
        window.testarAPI();
    }, 1000);
});

// Exibir QR Code
window.exibirQRCode = async function () {
    const qrImg = document.getElementById('qrCodeImage');
    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.style.display = 'block';
    qrImg.src = '';
    qrImg.alt = 'Carregando...';

    try {
        const response = await fetch('/api/qrcode', { headers: { 'Accept': 'application/json; charset=utf-8' } });
        const data = await response.json();

        if (data.qrcode) {
            qrImg.src = data.qrcode;
            qrImg.alt = 'QR Code';
            window.adicionarLog('info', '📱 QR Code carregado com sucesso.');
        } else {
            qrImg.alt = 'Nenhum QR Code necessário';
            window.adicionarLog('warning', `ℹ️ ${data.message || 'Instância já conectada'}`);
        }
    } catch (err) {
        qrImg.alt = 'Erro ao carregar QR Code';
        window.adicionarLog('error', `❌ Erro ao buscar QR Code: ${err.message}`);
    }
};

// Adiciona listener para mudanças nos campos da API
['apiUrl','apiInstance','apiKey'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
        const s = document.getElementById('apiStatus');
        s.textContent = 'OFFLINE';
        s.className = 'api-status offline';
    });
});