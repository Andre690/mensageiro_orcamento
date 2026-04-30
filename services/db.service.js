const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        inicializarTabelas();
    }
    return db;
}

function inicializarTabelas() {
    const database = db;
    database.exec(`
        CREATE TABLE IF NOT EXISTS contatos (
            setor TEXT PRIMARY KEY,
            setor_normalizado TEXT NOT NULL,
            telefone TEXT NOT NULL,
            atualizado_em TEXT NOT NULL
        )
    `);
}

/**
 * Retorna todos os contatos salvos no banco.
 * @returns {Array<{ setor: string, telefone: string, atualizado_em: string }>}
 */
function listarContatos() {
    const database = getDb();
    return database.prepare('SELECT setor, telefone, atualizado_em FROM contatos ORDER BY setor').all();
}

/**
 * Faz upsert de um array de contatos.
 * @param {Array<{ setor: string, setor_normalizado: string, telefone: string }>} contatos
 */
function salvarContatos(contatos) {
    const database = getDb();
    const stmt = database.prepare(`
        INSERT INTO contatos (setor, setor_normalizado, telefone, atualizado_em)
        VALUES (@setor, @setor_normalizado, @telefone, @atualizado_em)
        ON CONFLICT(setor) DO UPDATE SET
            setor_normalizado = excluded.setor_normalizado,
            telefone = excluded.telefone,
            atualizado_em = excluded.atualizado_em
    `);

    const agora = new Date().toISOString();
    const inserirMuitos = database.transaction((lista) => {
        for (const contato of lista) {
            stmt.run({
                setor: contato.setor,
                setor_normalizado: contato.setor_normalizado,
                telefone: contato.telefone,
                atualizado_em: agora
            });
        }
    });

    inserirMuitos(contatos);
}

/**
 * Busca o telefone de um setor específico pelo nome normalizado.
 * @param {string} setorNormalizado
 * @returns {{ setor: string, telefone: string } | undefined}
 */
function buscarContatoPorSetor(setorNormalizado) {
    const database = getDb();
    return database
        .prepare('SELECT setor, telefone FROM contatos WHERE setor_normalizado = ?')
        .get(setorNormalizado);
}

module.exports = { listarContatos, salvarContatos, buscarContatoPorSetor };
