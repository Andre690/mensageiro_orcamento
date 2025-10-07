require("dotenv").config();
const express = require("express");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 4000;

// Garante UTF-8 nas respostas JSON e adiciona cabeçalhos de segurança
app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        const ct = res.get('Content-Type') || '';
        if (!ct) {
            res.set('Content-Type', 'application/json; charset=utf-8');
        } else if (ct.startsWith('application/json') && !/charset=/i.test(ct)) {
            res.set('Content-Type', ct + '; charset=utf-8');
        }
        return originalJson(body);
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

// Middleware para JSON e arquivos estáticos
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Rota para servir o index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rota para enviar mensagens via backend
app.post("/api/send-message", async (req, res) => {
    const { number, text } = req.body;

    try {
        const response = await axios.post(
            `${process.env.API_URL}/message/sendText/${process.env.API_INSTANCE}`,
            {
                number: number,
                text: text
            },
            {
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Accept": "application/json; charset=utf-8",
                    "apikey": process.env.API_KEY
                }
            }
        );

        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: true,
            message: error.message || "Erro interno"
        });
    }
});

// Rota para testar conexão com a API (normalizada em data.state)
app.get("/api/testar-conexao", async (req, res) => {
    try {
        const response = await axios.get(`${process.env.API_URL}/instance/connectionState/${process.env.API_INSTANCE}`,
            {
                headers: { apikey: process.env.API_KEY, Accept: 'application/json; charset=utf-8' }
            }
        );

        const raw = response.data;
        let state = "UNKNOWN";

        if (raw?.instance?.state === "open") {
            state = "CONNECTED";
        } else if (raw?.instance?.status === "connected") {
            state = "CONNECTED";
        } else if (raw?.state === "open") {
            state = "CONNECTED";
        } else if (raw?.message && /já conectad/i.test(raw.message)) {
            state = "CONNECTED";
        }

        res.json({ state, raw });
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});
// Rota para obter QR Code (agora sem :instance)
app.get("/api/qrcode", async (req, res) => {
    const instance = process.env.API_INSTANCE;

    try {
        const response = await axios.get(`${process.env.API_URL}/instance/connect/${instance}`, {
            headers: {
                apikey: process.env.API_KEY,
                Accept: 'application/json; charset=utf-8'
            }
        });

        const data = response.data;
        if (data?.base64) {
            res.json({ qrcode: data.base64 });
        } else if (data?.instance?.status === "connected") {
            res.json({ message: "Instância já conectada." });
        } else {
            res.json({ message: "QR Code não disponível." });
        }
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}` );
});
