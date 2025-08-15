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

// Nova rota para enviar mensagens via backend
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

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
