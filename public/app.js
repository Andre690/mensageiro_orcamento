
        // Definir todas as variáveis e funções no escopo global (window)
        window.dadosSetor = null;
        window.dadosCategoria = null;
        window.dadosContatos = null;
        window.dadosProcessados = [];

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
        const response = await fetch('/api/testar-conexao');
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

        window.processarArquivo(file, (error, dados) => {
            if (error) {
                window.adicionarLog('error', `Erro ao carregar arquivo de orçamento geral: ${error.message}`);
                document.getElementById('statusSetor').innerHTML = '❌ Erro';
                document.getElementById('statusSetor').style.color = '#dc3545';
                return;
            }

            // Filtrar linhas com Setor vazio
            dados = dados.filter(item => item.Setor && item["ORÇAMENTO TOTAL"]);

            const primeiroItem = dados[0];
            if (!primeiroItem?.Setor || !primeiroItem["ORÇAMENTO TOTAL"]) {
                window.adicionarLog('error', 'Arquivo de orçamento geral deve conter as colunas "Setor" e "ORÇAMENTO TOTAL"');
                document.getElementById('statusSetor').innerHTML = '❌ Formato Inválido';
                document.getElementById('statusSetor').style.color = '#dc3545';
                return;
            }

            dados.forEach(d => {
                d["ORÇAMENTO TOTAL"] = window.parseNumero(d["ORÇAMENTO TOTAL"]);
                d.REALIZADO = window.parseNumero(d.REALIZADO);
            });

            window.dadosSetor = dados;
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

            window.processarArquivo(file, (error, dados) => {
                if (error) {
                    window.adicionarLog('error', `Erro ao carregar arquivo de categoria: ${error.message}`);
                    document.getElementById('statusCategoria').innerHTML = '❌ Erro';
                    document.getElementById('statusCategoria').style.color = '#dc3545';
                    return;
                }

            dados = dados.filter(item => item.Setor && item.Classificação);

            const primeiroItem = dados[0];
            if (!primeiroItem?.Setor || !primeiroItem.Classificação) {
                window.adicionarLog('error', 'Arquivo de categoria deve conter as colunas "Setor" e "Classificação"');
                document.getElementById('statusCategoria').innerHTML = '❌ Formato Inválido';
                document.getElementById('statusCategoria').style.color = '#dc3545';
                return;
            }

            dados.forEach(d => {
                d["ORÇAMENTO TOTAL"] = window.parseNumero(d["ORÇAMENTO TOTAL"]);
                d.REALIZADO = window.parseNumero(d.REALIZADO);
            });

            window.dadosCategoria = dados;
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

            window.processarArquivo(file, (error, dados) => {
                if (error) {
                    window.adicionarLog('error', `Erro ao carregar arquivo de contatos: ${error.message}`);
                    document.getElementById('statusContatos').innerHTML = '❌ Erro';
                    document.getElementById('statusContatos').style.color = '#dc3545';
                    return;
                }

        const primeiroItem = dados[0];
        if (!primeiroItem?.nome_setor || !primeiroItem.numero) {
            window.adicionarLog('error', 'Arquivo de contatos deve conter as colunas "nome_setor" e "numero"');
            document.getElementById('statusContatos').innerHTML = '❌ Formato Inválido';
            document.getElementById('statusContatos').style.color = '#dc3545';
            return;
        }

        dados.forEach(contato => {
            contato.numero = window.formatarTelefone(contato.numero);
        });

        window.dadosContatos = dados;
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
        let setoresNaoEncontrados = [];

        window.dadosContatos.forEach(contato => {
            const nomeSetorNormalizado = contato.nome_setor?.trim().toLowerCase();

            const setorData = window.dadosSetor.find(s => 
                s.Setor?.trim().toLowerCase() === nomeSetorNormalizado ||
                s.Setor?.trim().toLowerCase().includes(nomeSetorNormalizado) ||
                nomeSetorNormalizado?.includes(s.Setor?.trim().toLowerCase())
            );

            if (!setorData) {
                setoresNaoEncontrados.push(contato.nome_setor);
                return;
            }

            setoresEncontrados++;

            const classificacoesEstouradas = window.dadosCategoria.filter(c => {
                const setorCategoria = c.Setor?.trim().toLowerCase();
                return setorCategoria === nomeSetorNormalizado && 
                       (window.parseNumero(c.REALIZADO) || 0) > (window.parseNumero(c["ORÇAMENTO TOTAL"]) || 0);
            });

            const orcado = window.parseNumero(setorData["ORÇAMENTO TOTAL"]);
            const realizado = window.parseNumero(setorData.REALIZADO);

            window.dadosProcessados.push({
                nome: contato.nome_setor,
                telefone: contato.numero,
                orcado: orcado,
                realizado: realizado,
                classificacoes: classificacoesEstouradas.map(c => ({
                    nome: c.Classificação || 'Não informado',
                    orcado: window.parseNumero(c["ORÇAMENTO TOTAL"]),
                    realizado: window.parseNumero(c.REALIZADO)
                }))
            });
        });

        if (setoresNaoEncontrados.length > 0) {
            window.adicionarLog('warning', `⚠️ ${setoresNaoEncontrados.length} setores não encontrados no orçamento: ${setoresNaoEncontrados.join(', ')}`);
        }

        window.adicionarLog('success', `✅ ${setoresEncontrados} setores processados com sucesso`);
        window.atualizarEstatisticas();
        window.renderizarSetores();
        document.getElementById('disparadorBtn').disabled = false;
        window.adicionarLog('success', `Dados processados com sucesso! ${window.dadosProcessados.length} setores prontos para disparo.`);

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
                        <span>${setor.classificacoes.length} classificação(ões) estourada(s)</span>
                    </div>
                `;

                container.appendChild(setorElement);
            });
        };

        window.gerarMensagem = function(setor) {
            const percentual = window.calcularPercentual(setor.realizado, setor.orcado);
            let status;
            
            if (percentual >= 100) {
                status = "🚨 *ATENÇÃO: Setor ultrapassou o orçamento!*";
            } else if (percentual >= 90) {
                status = "⚠️ *ALERTA: Setor próximo de atingir o orçamento!*";
            } else {
                status = "✅ Situação controlada.";
            }

            let mensagem = `📊 *RELATÓRIO ORÇAMENTÁRIO*\n`;
            mensagem += `🏢 *Setor:* ${setor.nome}\n`;
            mensagem += `💰 *Orçado:* R$ ${setor.orcado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;
            mensagem += `💸 *Realizado:* R$ ${setor.realizado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;
            mensagem += `📈 *Percentual Atingido:* ${percentual.toFixed(2)}%\n\n`;
            mensagem += `${status}\n`;

            if (setor.classificacoes && setor.classificacoes.length > 0) {
                mensagem += "\n🔍 *CLASSIFICAÇÕES QUE ULTRAPASSARAM O ORÇAMENTO:*\n";
                setor.classificacoes.forEach((c, index) => {
                    const percClassif = window.calcularPercentual(c.realizado, c.orcado);
                    mensagem += `\n${index + 1}. *${c.nome}*\n`;
                    mensagem += `   • Orçado: R$ ${c.orcado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;
                    mensagem += `   • Realizado: R$ ${c.realizado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;
                    mensagem += `   • Ultrapassou: ${percClassif.toFixed(1)}%\n`;
                });
            }

            mensagem += `\n📅 *Relatório gerado em:* ${new Date().toLocaleString('pt-BR')}\n`;
            mensagem += `🤖 *Sistema de Controle Orçamentário*`;

            return mensagem;
        };

// Nova versão que envia mensagem via backend local, ocultando a chave da API
window.enviarMensagemWhatsApp = async function(mensagem, telefone) {
  try {
    const resp = await fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

// Retry automático de envio em caso de falha (máximo 3 tentativas)
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

       // window.enviarMensagemWhatsAppComRetry = async function(mensagem, telefone, tentativas = 3) {
   // const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
//    let ultimaResposta = null;

  //  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
     //   try {
       //     const resposta = await window.enviarMensagemWhatsApp(mensagem, telefone);
       //     if (resposta.success) return resposta;

        //    ultimaResposta = resposta;
      //      window.adicionarLog('warning', `⚠️ ${telefone} - Tentativa ${tentativa} falhou: ${resposta.response?.message || resposta.rawResponse}`);
      //  } catch (error) {
     //       ultimaResposta = { error: error.message };
      //      window.adicionarLog('warning', `⚠️ ${telefone} - Erro na tentativa ${tentativa}: ${error.message}`);
     //   }

    //    if (tentativa < tentativas) {
           // window.adicionarLog('info', `⏳ ${telefone} - Aguardando ${tentativa * 3}s para próxima tentativa...`);
          //  await delay(tentativa * 3000);
      //  }
   // }

   // return ultimaResposta;
//};

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

                    // Aguarda 2 segundos entre envios para não sobrecarregar a API
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
        //Exibir QR Code
window.exibirQRCode = async function () {
    const qrImg = document.getElementById('qrCodeImage');
    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.style.display = 'block';
    qrImg.src = '';
    qrImg.alt = 'Carregando...';

    try {
        const response = await fetch('/api/qrcode');
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
  