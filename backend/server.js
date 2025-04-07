const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configuração do PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'doacoes_db',
    password: 's3d54gr8',
    port: 5432
});

// Testar conexão com o banco
pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error('Erro ao conectar ao PostgreSQL:', err);
    else console.log('Conectado ao PostgreSQL em:', res.rows[0].now);
});

// Rotas

// Cadastrar novo item
app.post('/itens', (req, res) => {
    const { 
        item: nome,  
        tipo, 
        genero, 
        tamanho, 
        dataEntrada, 
        doador, 
        descricao 
    } = req.body;

    // Validação da data
    const hoje = new Date().toISOString().split('T')[0]; // Data atual no formato YYYY-MM-DD
    if (dataEntrada > hoje) {
        return res.status(400).json({ error: 'A data de entrada não pode ser futura.' });
    }

    // Validação dos campos
    const validacoes = {
        tipo: [
            'Calça', 'Camiseta', 'Tênis', 'Bota', 'Chinelo',
            'Camisa', 'Shorts', 'Casaco', 'Moletom', 'Roupa Íntima',
            'Pijama', 'Luva', 'Chapéu', 'Sapato' 
        ],
        genero: ['Masculino', 'Feminino', 'Unissex', 'Infantil'],
        tamanho: ['P', 'M', 'G', 'GG', 'N/A']
    };

    try {
        // Verificar valores válidos
        for (const [campo, valores] of Object.entries(validacoes)) {
            if (!valores.includes(req.body[campo])) {
                throw new Error(`Valor inválido para ${campo}: ${req.body[campo]}`);
            }
        }
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    // Query SQL
    const sql = `
        INSERT INTO itens 
            (nome, tipo, genero, tamanho, data_entrada, doador, descricao) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *`;

    pool.query(sql, [
        nome,
        tipo,
        genero,
        tamanho, 
        dataEntrada,
        doador,
        descricao || null
    ], (err, result) => {
        if (err) {
            console.error('Erro no PostgreSQL:', err);
            return res.status(500).json({ 
                error: err.message,
                detail: err.detail
            });
        }
        res.status(201).json(result.rows[0]);
    });
});

// Listar todos os itens com filtros
app.get('/itens', async (req, res) => {
    const { tamanhos, generos, tipos, doador } = req.query;

    // Corrige parâmetros vazios
    const tamanhosArray = tamanhos ? tamanhos.split(',').filter(t => t) : null;
    const generosArray = generos ? generos.split(',').filter(g => g) : null;
    const tiposArray = tipos ? tipos.split(',').filter(t => t) : null;

    // Construção Dinâmica da Query
    let query = 'SELECT * FROM itens';
    const conditions = [];
    const params = [];

    // Filtro por Tipo
    if (tiposArray && tiposArray.length > 0) {
        conditions.push(`tipo = ANY($${params.length + 1})`);
        params.push(tiposArray);
    }

    // Filtro por Tamanho
    if (tamanhosArray && tamanhosArray.length > 0) {
        conditions.push(`tamanho = ANY($${params.length + 1})`);
        params.push(tamanhosArray);
    }

    // Filtro por Gênero
    if (generosArray && generosArray.length > 0) {
        conditions.push(`genero = ANY($${params.length + 1})`);
        params.push(generosArray);
    }

    // Filtro por Doador (novo)
    if (doador) {
        conditions.push(`doador ILIKE $${params.length + 1}`);
        params.push(`%${doador}%`); // Busca parcial (case-insensitive)
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY data_entrada DESC';

    // Logs para depuração
    console.log('Query Final:', query);
    console.log('Parâmetros:', params);

    try {
        const resultItens = await pool.query(query, params);
        res.json({ itens: resultItens.rows });
    } catch (err) {
        console.error('Erro no servidor:', err);
        res.status(500).json({ 
            error: "Erro interno ao processar a requisição",
            details: err.message 
        });
    }
});

// Remover um item (movendo para itens_removidos)
app.delete('/itens/:id', async (req, res) => {
    const itemId = req.params.id;
    const { destino } = req.body;

    if (!destino) {
        return res.status(400).json({ error: "Destino da doação é obrigatório" });
    }

    try {
        // Mover para itens_removidos
        await pool.query(`
            INSERT INTO itens_removidos (nome, tipo, data_entrada, data_saida, doador, descricao, destino)
            SELECT nome, tipo, data_entrada, CURRENT_DATE, doador, descricao, $1
            FROM itens 
            WHERE id = $2
        `, [destino, itemId]);

        // Remover da tabela principal
        await pool.query('DELETE FROM itens WHERE id = $1', [itemId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao remover item:', error);
        res.status(500).json({ error: "Erro ao processar a remoção" });
    }
});

// Rota para gerar relatório
app.get('/relatorio', async (req, res) => {
    const { dataInicio, dataFim } = req.query;

    try {
        // Doações recebidas (itens ainda no sistema)
        const recebidas = await pool.query(`
            SELECT COUNT(*) as total 
            FROM itens 
            WHERE data_entrada BETWEEN $1 AND $2
        `, [dataInicio, dataFim]);

        // Doações realizadas (itens removidos)
        const realizadas = await pool.query(`
            SELECT COUNT(*) as total 
            FROM itens_removidos 
            WHERE data_saida BETWEEN $1 AND $2
        `, [dataInicio, dataFim]);

        // Detalhes combinados
        const detalhes = await pool.query(`
            SELECT 
                nome, tipo, data_entrada, 
                NULL as data_saida, 
                NULL as destino, 
                'Recebido' as status 
            FROM itens 
            WHERE data_entrada BETWEEN $1 AND $2
            UNION ALL
            SELECT 
                nome, tipo, data_entrada, 
                data_saida, destino, 
                'Doado' as status 
            FROM itens_removidos 
            WHERE data_saida BETWEEN $1 AND $2
            ORDER BY data_entrada DESC
        `, [dataInicio, dataFim]);

        res.json({
            totalRecebidas: recebidas.rows[0].total,
            totalRealizadas: realizadas.rows[0].total,
            itens: detalhes.rows
        });

    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

// Iniciar o servidor
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});