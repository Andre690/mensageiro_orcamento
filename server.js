require("dotenv").config();
const express = require("express");
const path = require("path");
const axios = require("axios");
const { gerarPDFOrcamento } = require("./services/pdf.service");

const app = express();
const PORT = process.env.PORT || 4000;
const JSON_LIMIT = process.env.JSON_LIMIT || "10mb";

// Garante UTF-8 em todas as respostas
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
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_LIMIT }));
app.use(express.static(path.join(__dirname, "public")));

// Rota para servir o index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

function buildApiHeaders() {
    return {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json; charset=utf-8",
        apikey: process.env.API_KEY
    };
}

function gerarNomeArquivoPDF(nomeSetor) {
    const base = (nomeSetor || "extrato")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .toLowerCase();

    return `${base || "extrato"}_${Date.now()}.pdf`;
}

async function enviarPdfParaApi(number, dadosSetor) {
    const pdfBuffer = await gerarPDFOrcamento(dadosSetor);
    const base64 = pdfBuffer.toString("base64");
    const fileName = gerarNomeArquivoPDF(dadosSetor?.nome);

    const payload = {
        mediatype: "document",
        media: base64,
        number,
        fileName,
        caption: `Extrato orçamentário - ${dadosSetor?.nome || "Setor"}`
    };

    try {
        const response = await axios.post(
            `${process.env.API_URL}/message/sendMedia/${process.env.API_INSTANCE}`,
            payload,
            { headers: buildApiHeaders() }
        );

        return {
            success: true,
            status: response.status,
            data: response.data,
            buffer: pdfBuffer
        };
    } catch (error) {
        error.pdfBuffer = pdfBuffer;
        throw error;
    }
}

// Rota para enviar mensagens via backend
app.post("/api/send-message", async (req, res) => {
    const { number, text, enviarPdf = true, dadosSetor } = req.body;

    if (!number || !text) {
        return res.status(400).json({
            error: true,
            message: "Campos 'number' e 'text' são obrigatórios."
        });
    }

    try {
        const response = await axios.post(
            `${process.env.API_URL}/message/sendText/${process.env.API_INSTANCE}`,
            { number, text },
            { headers: buildApiHeaders() }
        );

        let pdfResult = null;

        if (enviarPdf && dadosSetor) {
            try {
                const envio = await enviarPdfParaApi(number, dadosSetor);
                pdfResult = {
                    success: true,
                    status: envio.status,
                    data: envio.data
                };
            } catch (pdfError) {
                pdfResult = {
                    success: false,
                    status: pdfError.response?.status || 500,
                    message: pdfError.response?.data?.message || pdfError.message,
                    data: pdfError.response?.data
                };
            }
        }

        res.status(response.status).json({
            success: true,
            message: {
                status: response.status,
                data: response.data
            },
            pdf: pdfResult
        });
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data?.message || error.message,
            provider: error.response?.data
        });
    }
});

// Rota para gerar preview do PDF
app.post("/api/gerar-pdf-preview", async (req, res) => {
    const { dadosSetor } = req.body || {};

    if (!dadosSetor) {
        return res.status(400).json({
            error: true,
            message: "dadosSetor é obrigatório para gerar o PDF."
        });
    }

    try {
        const pdfBuffer = await gerarPDFOrcamento(dadosSetor);
        const fileName = gerarNomeArquivoPDF(dadosSetor?.nome);

        res.setHeader("Content-Type", "application/pdf; charset=utf-8");
        res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({
            error: true,
            message: error.message || "Erro ao gerar PDF"
        });
    }
});

// Rota para testar conexão com a API
app.get("/api/testar-conexao", async (req, res) => {
    try {
        const response = await axios.get(
            `${process.env.API_URL}/instance/connectionState/${process.env.API_INSTANCE}`,
            {
                headers: { 
                    apikey: process.env.API_KEY, 
                    Accept: 'application/json; charset=utf-8' 
                }
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
        res.status(500).json({ 
            error: true, 
            message: error.message 
        });
    }
});

// Rota para obter QR Code
app.get("/api/qrcode", async (req, res) => {
    const instance = process.env.API_INSTANCE;

    try {
        const response = await axios.get(
            `${process.env.API_URL}/instance/connect/${instance}`, 
            {
                headers: {
                    apikey: process.env.API_KEY,
                    Accept: 'application/json; charset=utf-8'
                }
            }
        );

        const data = response.data;
        if (data?.base64) {
            res.json({ qrcode: data.base64 });
        } else if (data?.instance?.status === "connected") {
            res.json({ message: "Instância já conectada." });
        } else {
            res.json({ message: "QR Code não disponível." });
        }
    } catch (error) {
        res.status(500).json({ 
            error: true, 
            message: error.message 
        });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});