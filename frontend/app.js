// Função para exibir mensagens flutuantes
function exibirMensagem(texto, tipo = 'sucesso') {
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = `mensagem ${tipo}`;
    mensagemDiv.textContent = texto;
    
    const container = document.getElementById('mensagens');
    container.appendChild(mensagemDiv);
    
    setTimeout(() => {
        mensagemDiv.remove();
    }, 3000);
}

// Função para controlar as abas
function abrirAba(evt, nomeAba) {
    document.querySelectorAll('.aba-conteudo').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.aba-link').forEach(link => link.classList.remove('active'));
    
    document.getElementById(nomeAba).classList.add('active');
    evt.currentTarget.classList.add('active');

    if (nomeAba === 'estoque') carregarItens();
    if (nomeAba === 'remocao') carregarItensRemocao();
}

// Evento de cadastro simplificado
document.getElementById('formDoacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const novoItem = {
        item: document.getElementById('item').value,
        tipo: document.getElementById('tipo').value,
        genero: document.getElementById('genero').value,
        tamanho: document.getElementById('tamanho').value,
        dataEntrada: document.getElementById('dataEntrada').value,
        doador: document.getElementById('doador').value,
        descricao: document.getElementById('descricao').value
    };

    try {
        const response = await fetch('http://localhost:3000/itens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoItem)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha no cadastro');
        }
        
        exibirMensagem('Item cadastrado com sucesso!');
        document.getElementById('formDoacao').reset();
        await carregarItens();
        
    } catch(error) {
        exibirMensagem(`Erro: ${error.message}`, 'erro');
    }
});

// Carregamento do estoque com filtros
async function carregarItens(tamanhos = [], generos = [], tipos = [], doador = '') {
    mostrarCarregamento();
    try {
        const params = new URLSearchParams();
        if (tamanhos.length > 0) params.append('tamanhos', tamanhos.join(','));
        if (generos.length > 0) params.append('generos', generos.join(','));
        if (tipos.length > 0) params.append('tipos', tipos.join(','));
        if (doador) params.append('doador', doador); // Novo filtro

        const response = await fetch(`http://localhost:3000/itens?${params}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao carregar estoque');
        }

        const dados = await response.json();
        const itens = dados.itens || [];
        atualizarTabela(itens);

    } catch(error) {
        console.error('Erro ao carregar estoque:', error);
        exibirMensagem('Falha ao carregar estoque', 'erro');
        atualizarTabela([]);
    } finally {
        esconderCarregamento();
    }
}

// Atualização da tabela
function atualizarTabela(itens) {
    const tbody = document.getElementById('corpoTabela');
    tbody.innerHTML = '';

    // Atualizar o contador de itens
    const contadorElement = document.getElementById('totalItensEstoque');
    if (contadorElement) {
        contadorElement.textContent = itens.length.toString();
    }

    if (!itens || itens.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="sem-itens">Nenhum item encontrado</td>
            </tr>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    itens.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.tipo}</td>
            <td>${item.genero}</td>
            <td>${item.tamanho}</td>
            <td>${item.descricao || '-'}</td>
            <td>${new Date(item.data_entrada).toLocaleDateString('pt-BR')}</td>
            <td>${item.doador}</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}


// Remoção simplificada
document.getElementById('formRemocao').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const select = document.getElementById('itemRemover');
    const selectedItems = Array.from(select.selectedOptions).map(option => ({
        id: option.value,
        nome: option.textContent
    }));

    if (selectedItems.length === 0) {
        return exibirMensagem('Selecione pelo menos um item', 'erro');
    }

    const destino = prompt('Para onde estes itens serão doados?');
    if (!destino) {
        return exibirMensagem('É necessário informar o destino da doação', 'erro');
    }

    const itemsText = selectedItems.map(item => `- ${item.nome}`).join('\n');
    const confirmacao = confirm(
        `⚠️ ATENÇÃO!\n\n` +
        `Tem certeza que deseja doar os seguintes itens para "${destino}"?\n\n` +
        `${itemsText}\n\n` +
        `Esta ação não pode ser desfeita!`
    );
    
    if (!confirmacao) {
        return exibirMensagem('❌ Itens NÃO doados: Ação cancelada pelo usuário', 'aviso');
    }

    try {
        // Processar cada item selecionado
        const promises = selectedItems.map(item => 
            fetch(`http://localhost:3000/itens/${item.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destino })
            })
        );

        await Promise.all(promises);
        
        exibirMensagem(`✅ ${selectedItems.length} itens doados com sucesso!`);
        carregarItensRemocao();
        carregarItens();
        
    } catch(error) {
        exibirMensagem(`❌ Erro crítico: ${error.message}`, 'erro');
    }
});

let todosItensRemocao = [];
// Carregar itens para remoção
async function carregarItensRemocao() {
    try {
        const response = await fetch('http://localhost:3000/itens');
        const dados = await response.json();
        todosItensRemocao = dados.itens || [];
        filtrarItensRemocao(); // Carrega todos inicialmente
    } catch(error) {
        exibirMensagem('Erro ao carregar itens', 'erro');
    }
}

// Filtrar itens para remoção
function filtrarItensRemocao() {
    const termoBusca = document.getElementById('buscaItem').value.toLowerCase();
    const select = document.getElementById('itemRemover');
    
    // Limpa o select (sem adicionar a opção padrão)
    select.innerHTML = '';

    // Filtra os itens
    const itensFiltrados = todosItensRemocao.filter(item => 
        item.nome.toLowerCase().includes(termoBusca)
    );

    // Preenche o select com os itens filtrados
    itensFiltrados.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.nome} (${item.tipo} - ${item.tamanho})`;
        select.appendChild(option);
    });

    // Se não houver itens, exibe uma mensagem
    if (itensFiltrados.length === 0) {
        const option = document.createElement('option');
        option.textContent = "Nenhum item encontrado";
        option.disabled = true;
        select.appendChild(option);
    }
}

// Evento de input na busca
document.getElementById('buscaItem').addEventListener('input', filtrarItensRemocao);

// Configuração inicial
document.addEventListener('DOMContentLoaded', () => {
    const dataEntrada = document.getElementById('dataEntrada');
    const hoje = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    dataEntrada.value = hoje; // Define o valor padrão como hoje
    dataEntrada.max = hoje; // Define a data máxima como hoje

    carregarItens();
});

// Função para aplicar os filtros selecionados
function aplicarFiltros() {
    // Coleta os valores selecionados nos filtros
    const tamanhos = Array.from(document.getElementById('filtroTamanho').selectedOptions)
        .map(option => option.value)
        .filter(v => v);

    const generos = Array.from(document.getElementById('filtroGenero').selectedOptions)
        .map(option => option.value)
        .filter(v => v);

    const tipos = Array.from(document.getElementById('filtroTipo').selectedOptions)
        .map(option => option.value)
        .filter(v => v);

    const doador = document.getElementById('filtroDoador').value.trim(); // Novo filtro

    // Exibe os filtros selecionados no console para depuração
    console.log('Filtros aplicados:', { tamanhos, generos, tipos, doador });

    // Chama a função para carregar os itens com os filtros aplicados
    carregarItens(tamanhos, generos, tipos, doador);
}

// Função para limpar os filtros
function limparFiltros() {
    // Desmarca todas as opções selecionadas nos filtros
    document.getElementById('filtroTamanho').selectedIndex = -1;
    document.getElementById('filtroGenero').selectedIndex = -1;
    document.getElementById('filtroTipo').selectedIndex = -1;

    // Recarrega os itens sem filtros
    carregarItens();
}

// Função para mostrar o spinner de carregamento
function mostrarCarregamento() {
    document.getElementById('loading').style.display = 'flex';
}

// Função para esconder o spinner de carregamento
function esconderCarregamento() {
    document.getElementById('loading').style.display = 'none';
}
let dadosRelatorio = {
    recebidas: [],
    realizadas: []
};
// Função para gerar relatório
async function gerarRelatorio(event) {
    event.preventDefault();
    mostrarCarregamento();

    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    try {
        const response = await fetch(`http://localhost:3000/relatorio?dataInicio=${dataInicio}&dataFim=${dataFim}`);
        
        if (!response.ok) {
            throw new Error('Erro ao gerar relatório');
        }

        const dados = await response.json();
        
        // Armazenar dados separadamente
        dadosRelatorio = {
            recebidas: dados.itens.filter(item => item.status === 'Recebido'),
            realizadas: dados.itens.filter(item => item.status === 'Doado')
        };
        
        // Atualizar cards de resumo
        document.getElementById('totalRecebidas').textContent = dados.totalRecebidas;
        document.getElementById('totalRealizadas').textContent = dados.totalRealizadas;

        // Mostrar todos os dados inicialmente
        atualizarTabelaRelatorio([...dadosRelatorio.recebidas, ...dadosRelatorio.realizadas]);
        
        // Ativar botão "Todos"
        ativarBotaoFiltro('btnTodos');

    } catch (error) {
        console.error('Erro:', error);
        exibirMensagem('Erro ao gerar relatório', 'erro');
    } finally {
        esconderCarregamento();
    }
}
function atualizarTabelaRelatorio(itens) {
    const tbody = document.getElementById('corpoTabelaRelatorio');
    tbody.innerHTML = '';

    if (!itens || itens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="sem-itens">Nenhum item encontrado</td></tr>';
        return;
    }

    itens.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.tipo}</td>
            <td>${new Date(item.data_entrada).toLocaleDateString('pt-BR')}</td>
            <td>${item.data_saida ? new Date(item.data_saida).toLocaleDateString('pt-BR') : '-'}</td>
            <td>${item.destino || '-'}</td>
            <td>${item.status}</td>
        `;
        tbody.appendChild(tr);
    });
}

function ativarBotaoFiltro(btnId) {
    document.querySelectorAll('.btn-filtro').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(btnId).classList.add('active');
}
// Event Listeners para os botões de filtro
document.getElementById('btnTodos').addEventListener('click', () => {
    atualizarTabelaRelatorio([...dadosRelatorio.recebidas, ...dadosRelatorio.realizadas]);
    ativarBotaoFiltro('btnTodos');
});

document.getElementById('btnRecebidas').addEventListener('click', () => {
    atualizarTabelaRelatorio(dadosRelatorio.recebidas);
    ativarBotaoFiltro('btnRecebidas');
});

document.getElementById('btnRealizadas').addEventListener('click', () => {
    atualizarTabelaRelatorio(dadosRelatorio.realizadas);
    ativarBotaoFiltro('btnRealizadas');
});


async function gerarPDFEstruturado() {
    try {
        // Obter dados da tabela
        const tabela = document.getElementById('corpoTabelaRelatorio');
        const linhas = Array.from(tabela.getElementsByTagName('tr'));

        // Preparar dados para o PDF
        const dadosTabela = linhas.map(linha => {
            return Array.from(linha.getElementsByTagName('td')).map(celula => celula.textContent);
        });

        // Obter totais
        const totalRecebidas = document.getElementById('totalRecebidas').textContent;
        const totalRealizadas = document.getElementById('totalRealizadas').textContent;

        // Definir colunas da tabela
        const colunas = ['Item', 'Tipo', 'Data Entrada', 'Data Saída', 'Destino', 'Status'];

        // Configurar documento PDF
        const docDefinition = {
            pageSize: 'A4',
            pageOrientation: 'landscape',
            pageMargins: [40, 60, 40, 60],
            header: {
                text: 'Relatório de Doações - Garimpando o Amor',
                alignment: 'center',
                margin: [0, 20],
                fontSize: 16,
                bold: true
            },
            footer: function(currentPage, pageCount) {
                return {
                    text: `Página ${currentPage} de ${pageCount}`,
                    alignment: 'center',
                    margin: [0, 20]
                };
            },
            content: [
                // Data do relatório
                {
                    text: `Data de geração: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
                    alignment: 'right',
                    margin: [0, 0, 0, 20]
                },
                // Resumo
                {
                    columns: [
                        {
                            width: '*',
                            text: [
                                { text: 'Total de Doações Recebidas\n', bold: true },
                                { text: totalRecebidas, fontSize: 20 }
                            ],
                            alignment: 'center',
                            margin: [0, 0, 10, 20]
                        },
                        {
                            width: '*',
                            text: [
                                { text: 'Total de Doações Realizadas\n', bold: true },
                                { text: totalRealizadas, fontSize: 20 }
                            ],
                            alignment: 'center',
                            margin: [0, 0, 0, 20]
                        }
                    ]
                },
                // Título da tabela
                {
                    text: 'Detalhamento das Doações',
                    fontSize: 14,
                    bold: true,
                    margin: [0, 20, 0, 10]
                },
                // Tabela de dados
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', '*', 'auto', 'auto', '*', 'auto'],
                        body: [
                            // Cabeçalho
                            colunas.map(coluna => ({
                                text: coluna,
                                bold: true,
                                fillColor: '#4CAF50',
                                color: '#FFFFFF'
                            })),
                            // Dados
                            ...dadosTabela
                        ]
                    },
                    layout: {
                        hLineWidth: function() { return 1; },
                        vLineWidth: function() { return 1; },
                        hLineColor: function() { return '#ddd'; },
                        vLineColor: function() { return '#ddd'; },
                        fillColor: function(i) {
                            return (i % 2 === 0) ? '#f9f9f9' : null;
                        }
                    }
                }
            ],
            styles: {
                header: {
                    fontSize: 18,
                    bold: true,
                    margin: [0, 0, 0, 10]
                }
            },
            defaultStyle: {
                fontSize: 10
            }
        };

        // Gerar e baixar o PDF
        pdfMake.createPdf(docDefinition).download('relatorio-doacoes.pdf');
        exibirMensagem('PDF gerado com sucesso!');

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        exibirMensagem('Erro ao gerar PDF', 'erro');
    }
}
// Adicionar event listener para o formulário de relatório
document.getElementById('formRelatorio').addEventListener('submit', gerarRelatorio);
document.getElementById('btnExportarPDF').addEventListener('click', gerarPDFEstruturado);
// Adicionar event listener para o formulário de relatório
//document.getElementById('formRelatorio')?.addEventListener('submit', gerarRelatorio);