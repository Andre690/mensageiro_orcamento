// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Middleware para JSON e arquivos estáticos
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota para servir o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para enviar mensagens via backend
app.post('/api/send-message', async (req, res) => {
    const { number, text } = req.body;

    try {
        const response = await axios.post(
            `${process.env.API_URL}/message/sendText/${process.env.API_INSTANCE}`,
            {
                number,
                textMessage: { text }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.API_KEY
                }
            }
        );

        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: true,
            message: error.message || 'Erro interno'
        });
    }
});

// Rota para testar conexão com a API
app.get('/api/testar-conexao', async (req, res) => {
    try {
        const response = await axios.get(`${process.env.API_URL}/instance/${process.env.API_INSTANCE}`, {
            headers: {
                apikey: process.env.API_KEY
            }
        });

        res.json({ instance: response.data });
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

// Rota para obter QR Code (agora sem :instance)
app.get('/api/qrcode', async (req, res) => {
    const instance = process.env.API_INSTANCE;

    try {
        const response = await axios.get(`${process.env.API_URL}/instance/connect/${instance}`, {
            headers: {
                apikey: process.env.API_KEY
            }
        });

        const data = response.data;
        if (data?.base64) {
            res.json({ qrcode: data.base64 });
        } else {
            res.json({ message: 'Instância já conectada ou QR Code não disponível.' });
        }
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
