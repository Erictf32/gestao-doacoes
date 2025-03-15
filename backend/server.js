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

    // Validação dos campos
    const validacoes = {
        tipo: ['Calça', 'Camiseta', 'Tênis', 'Blusa', 'Luvas', 'Gorro'],
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

// Listar todos os itens
app.get('/itens', (req, res) => {
    const sql = "SELECT * FROM itens ORDER BY data_entrada DESC";
    pool.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result.rows);
    });
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

// Reduzir a quantidade de um item (e remover se chegar a zero)
app.put('/itens/reduzir/:id', (req, res) => {
    const itemId = req.params.id;
    const { quantidade } = req.body;

    // Query para reduzir a quantidade
    const sql = `
        UPDATE itens 
        SET quantidade = GREATEST(quantidade - $1, 0)
        WHERE id = $2
        RETURNING *`;

    pool.query(sql, [quantidade, itemId], (err, result) => {
        if (err) {
            console.error('Erro ao reduzir quantidade:', err);
            return res.status(500).json({ error: 'Erro ao reduzir quantidade' });
        }

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }

        const itemAtualizado = result.rows[0];

        // Se a quantidade chegou a zero, remove o item
        if (itemAtualizado.quantidade === 0) {
            pool.query('DELETE FROM itens WHERE id = $1', [itemId], (err) => {
                if (err) {
                    console.error('Erro ao remover item:', err);
                    return res.status(500).json({ error: 'Erro ao remover item' });
                }
                res.json({ message: 'Item removido com sucesso (quantidade zerada)', item: itemAtualizado });
            });
        } else {
            res.json({ message: 'Quantidade reduzida com sucesso', item: itemAtualizado });
        }
    });
});

// Iniciar o servidor
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});