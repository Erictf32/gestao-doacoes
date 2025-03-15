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

    if(nomeAba === 'estoque') carregarItens();
    if(nomeAba === 'remocao') carregarItensRemocao();
}

// Evento de cadastro simplificado
document.getElementById('formDoacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const novoItem = {
        item: document.getElementById('item').value,
        tipo: document.getElementById('tipo').value,
        categoria: document.getElementById('categoria').value,
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
        
        if(!response.ok) throw new Error('Falha no cadastro');
        
        exibirMensagem('Item cadastrado com sucesso!');
        document.getElementById('formDoacao').reset();
        await carregarItens();
        
    } catch(error) {
        exibirMensagem(`Erro: ${error.message}`, 'erro');
    }
});

// Carregamento do estoque
async function carregarItens() {
    try {
        const response = await fetch('http://localhost:3000/itens');
        const itens = await response.json();
        atualizarTabela(itens);
    } catch(error) {
        exibirMensagem('Falha ao carregar estoque', 'erro');
    }
}

// Atualização da tabela sem quantidade
function atualizarTabela(itens) {
    const tbody = document.getElementById('corpoTabela');
    tbody.innerHTML = '';

    itens.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td>${item.nome}</td>
                <td>${item.tipo}</td>
                <td>${item.categoria}</td>
                <td>${item.genero}</td>
                <td>${item.tamanho}</td>
                <td>${item.descricao || '-'}</td>
                <td>${new Date(item.data_entrada).toLocaleDateString('pt-BR')}</td>
                <td>${item.doador}</td>
            </tr>
        `;
    });
}

// Remoção simplificada
document.getElementById('formRemocao').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const itemId = document.getElementById('itemRemover').value;
    if(!itemId) return exibirMensagem('Selecione um item', 'erro');

    const itemSelecionado = document.getElementById('itemRemover').selectedOptions[0].textContent;
    
    // Confirmação reforçada
    const confirmacao = confirm(`⚠️ ATENÇÃO!\n\nTem certeza que deseja remover permanentemente:\n"${itemSelecionado}"?\n\nEsta ação não pode ser desfeita!`);
    
    if(!confirmacao) {
        return exibirMensagem('❌ Item NÃO removido: Ação cancelada pelo usuário', 'aviso');
    }

    try {
        const response = await fetch(`http://localhost:3000/itens/${itemId}`, {
            method: 'DELETE'
        });

        if(!response.ok) throw new Error('Falha na comunicação com o servidor');
        
        exibirMensagem('✅ Item removido com sucesso!');
        carregarItensRemocao();
        carregarItens();
        
    } catch(error) {
        exibirMensagem(`❌ Erro crítico: ${error.message}`, 'erro');
    }
});

// Carregar itens para remoção
async function carregarItensRemocao() {
    try {
        const response = await fetch('http://localhost:3000/itens');
        const itens = await response.json();
        
        const select = document.getElementById('itemRemover');
        select.innerHTML = '<option value="">Selecione um item</option>';
        
        itens.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.nome} (${item.tipo} - ${item.tamanho})`;
            select.appendChild(option);
        });
    } catch(error) {
        exibirMensagem('Erro ao carregar itens', 'erro');
    }
}

// Configuração inicial
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('dataEntrada').value = new Date().toISOString().split('T')[0];
    carregarItens();
});