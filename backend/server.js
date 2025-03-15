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
        quantidade, 
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
        genero: ['Masculino', 'Feminino', 'Unissex'],
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
            (nome, quantidade, tipo, categoria, genero, tamanho, data_entrada, doador, descricao) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING *`;

    pool.query(sql, [
        nome,
        quantidade,
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

// Rotas para saídas (a implementar)
app.post('/saidas', (req, res) => {
    // Lógica para registrar saídas
});

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});


app.delete('/itens', (req, res) => {
    const { id, quantidade } = req.body;
    
    const sql = `
        UPDATE itens 
        SET quantidade = GREATEST(quantidade - $1, 0)
        WHERE id = $2
        RETURNING *`;
    
    pool.query(sql, [quantidade, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (result.rows[0].quantidade === 0) {
            // Remove o item se a quantidade chegar a zero
            pool.query('DELETE FROM itens WHERE id = $1', [id]);
        }
        
        res.json({ message: 'Item atualizado com sucesso' });
    });
});