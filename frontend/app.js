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

// Função para resetar o formulário
function resetarFormulario() {
    document.getElementById('formDoacao').reset();
    document.getElementById('dataEntrada').value = new Date().toISOString().split('T')[0];
}

// Evento de submit do formulário
document.getElementById('formDoacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const novoItem = {
        item: document.getElementById('item').value,
        quantidade: parseInt(document.getElementById('quantidade').value),
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
        
        if (!response.ok) throw new Error('Falha ao cadastrar');
        
        exibirMensagem('Item cadastrado com sucesso!');
        resetarFormulario();
        await carregarItens(); // Atualiza a tabela
        
    } catch (error) {
        exibirMensagem('Erro ao cadastrar item!', 'erro');
        console.error('Erro:', error);
    }
});

// Função para carregar itens do estoque
async function carregarItens() {
    try {
        const response = await fetch('http://localhost:3000/itens');
        if (!response.ok) throw new Error('Erro ao carregar dados');
        
        const itens = await response.json();
        atualizarTabela(itens);
        
    } catch (error) {
        exibirMensagem('Falha ao carregar estoque', 'erro');
        console.error('Erro:', error);
    }
}

// Função para atualizar a tabela de estoque
function atualizarTabela(itens) {
    const tbody = document.getElementById('corpoTabela');
    tbody.innerHTML = '';

    itens.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.quantidade}</td>
            <td>${item.tipo}</td>
            <td>${item.categoria}</td>
            <td>${item.genero}</td>
            <td>${item.tamanho}</td>
            <td>${item.descricao || '-'}</td>
            <td>${new Date(item.data_entrada).toLocaleDateString('pt-BR')}</td>
            <td>${item.doador}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Validações em tempo real
document.querySelectorAll('#formDoacao input, #formDoacao select').forEach(input => {
    input.addEventListener('input', () => {
        input.setCustomValidity('');
    });
});

// Validação específica para quantidade
document.getElementById('quantidade').addEventListener('input', (e) => {
    if (e.target.value < 1) {
        e.target.setCustomValidity('A quantidade deve ser pelo menos 1');
    } else {
        e.target.setCustomValidity('');
    }
});

// Validação para selects
document.querySelectorAll('#formDoacao select').forEach(select => {
    select.addEventListener('change', () => {
        if (select.value === '') {
            select.setCustomValidity('Selecione uma opção válida');
        } else {
            select.setCustomValidity('');
        }
    });
});

// Carregar dados iniciais
document.addEventListener('DOMContentLoaded', () => {
    // Configurar data atual
    document.getElementById('dataEntrada').value = new Date().toISOString().split('T')[0];
    
    // Carregar estoque inicial
    carregarItens();
});

function abrirAba(evt, nomeAba) {
    // Remove classe active de todas as abas e links
    document.querySelectorAll('.aba-conteudo').forEach(aba => {
        aba.classList.remove('active');
    });
    document.querySelectorAll('.aba-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Adiciona classe active na aba e link selecionados
    document.getElementById(nomeAba).classList.add('active');
    evt.currentTarget.classList.add('active');

    // Se for a aba de estoque, atualiza a tabela
    if(nomeAba === 'estoque') carregarItens();
    
    // Se for a aba de remoção, carrega os itens no select
    if(nomeAba === 'remocao') carregarItensRemocao();
}

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
            option.textContent = `${item.nome} (${item.tamanho}) - ${item.quantidade} unid.`;
            select.appendChild(option);
        });
    } catch (error) {
        exibirMensagem('Erro ao carregar itens para remoção', 'erro');
    }
}

// Evento de remoção
document.getElementById('formRemocao').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const dados = {
        id: document.getElementById('itemRemover').value,
        quantidade: parseInt(document.getElementById('quantidadeRemover').value)
    };

    try {
        const response = await fetch('http://localhost:3000/itens', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!response.ok) throw new Error('Falha na remoção');
        
        exibirMensagem('Item removido com sucesso!');
        carregarItensRemocao();
        abrirAba({ currentTarget: document.querySelector('[onclick*="estoque"]') }, 'estoque');
    } catch (error) {
        exibirMensagem(error.message, 'erro');
    }
});