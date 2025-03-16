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
        categoria, 
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
        tipo: ['Calça', 'Camiseta', 'Blusa', 'Vestido', 'Tênis', 'Bota', 'Chinelo'],
        categoria: ['Frio', 'Calor'],
        genero: ['Masculino', 'Feminino', 'Unissex', 'Infantil'],
        tamanho: ['P', 'M', 'G', 'GG']
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
            (nome, tipo, categoria, genero, tamanho, data_entrada, doador, descricao) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`;

    pool.query(sql, [
        nome,
        tipo,
        categoria,
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
    const { tamanhos, generos } = req.query;

    // Corrige parâmetros vazios
    const tamanhosArray = tamanhos ? tamanhos.split(',').filter(t => t) : null;
    const generosArray = generos ? generos.split(',').filter(g => g) : null;

    // Construção Dinâmica da Query
    let query = 'SELECT * FROM itens';
    const conditions = [];
    const params = [];

    if (tamanhosArray && tamanhosArray.length > 0) {
        conditions.push(`tamanho = ANY($${params.length + 1})`);
        params.push(tamanhosArray);
    }

    if (generosArray && generosArray.length > 0) {
        conditions.push(`genero = ANY($${params.length + 1})`);
        params.push(generosArray);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY data_entrada DESC';

    try {
        // Executar consulta principal
        const resultItens = await pool.query(query, params);
        
        res.json({
            itens: resultItens.rows
        });

    } catch (err) {
        console.error('Erro no servidor:', err);
        res.status(500).json({ 
            error: "Erro interno ao processar a requisição",
            details: err.message 
        });
    }
});

// Remover um item (remoção total)
app.delete('/itens/:id', (req, res) => {
    const itemId = req.params.id;
    
    const sql = 'DELETE FROM itens WHERE id = $1 RETURNING *';
    
    pool.query(sql, [itemId], (err, result) => {
        if (err) return res.status(500).json({ error: "Erro ao remover item" });
        if (result.rowCount === 0) return res.status(404).json({ error: "Item não encontrado" });
        res.json({ success: true, removedItem: result.rows[0] });
    });
});

// Iniciar o servidor
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});