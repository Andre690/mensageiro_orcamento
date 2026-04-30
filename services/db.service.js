const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        inicializarTabelas(db);
    }
    return db;
}

function inicializarTabelas(database) {
    // Tabela com suporte a múltiplos contatos por setor
    database.exec(`
        CREATE TABLE IF NOT EXISTS contatos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setor TEXT NOT NULL,
            setor_normalizado TEXT NOT NULL,
            nome_contato TEXT NOT NULL DEFAULT '',
            telefone TEXT NOT NULL,
            atualizado_em TEXT NOT NULL
        )
    `);

    // Migração: se a tabela antiga existia com PK em setor, recria
    // (only applies if table was created without 'id')
    try {
        const cols = database.prepare("PRAGMA table_info(contatos)").all();
        const hasId = cols.some(c => c.name === 'id');
        const hasNome = cols.some(c => c.name === 'nome_contato');
        if (!hasId || !hasNome) {
            database.exec(`
                ALTER TABLE contatos RENAME TO contatos_old;
                CREATE TABLE contatos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    setor TEXT NOT NULL,
                    setor_normalizado TEXT NOT NULL,
                    nome_contato TEXT NOT NULL DEFAULT '',
                    telefone TEXT NOT NULL,
                    atualizado_em TEXT NOT NULL
                );
                INSERT INTO contatos (setor, setor_normalizado, nome_contato, telefone, atualizado_em)
                SELECT setor, setor_normalizado, '', telefone, atualizado_em FROM contatos_old;
                DROP TABLE contatos_old;
            `);
        }
    } catch (_) {
        // Tabela nova, sem necessidade de migração
    }
}

/**
 * Retorna todos os contatos salvos agrupados por setor.
 * @returns {Array<{ id, setor, nome_contato, telefone, atualizado_em }>}
 */
function listarContatos() {
    const database = getDb();
    return database
        .prepare('SELECT id, setor, nome_contato, telefone, atualizado_em FROM contatos ORDER BY setor, id')
        .all();
}

/**
 * Insere novos contatos (não faz upsert — cada chamada adiciona).
 * Para substituir todos os contatos de um setor, use substituirContatosDoSetor().
 * @param {Array<{ setor, setor_normalizado, nome_contato, telefone }>} contatos
 */
function salvarContatos(contatos) {
    const database = getDb();
    const stmt = database.prepare(`
        INSERT INTO contatos (setor, setor_normalizado, nome_contato, telefone, atualizado_em)
        VALUES (@setor, @setor_normalizado, @nome_contato, @telefone, @atualizado_em)
    `);

    const agora = new Date().toISOString();
    const inserirMuitos = database.transaction((lista) => {
        for (const contato of lista) {
            stmt.run({
                setor: contato.setor,
                setor_normalizado: contato.setor_normalizado,
                nome_contato: contato.nome_contato || '',
                telefone: contato.telefone,
                atualizado_em: agora
            });
        }
    });

    inserirMuitos(contatos);
}

/**
 * Substitui todos os contatos de um setor pelos novos.
 * @param {string} setorNormalizado
 * @param {Array<{ setor, setor_normalizado, nome_contato, telefone }>} contatos
 */
function substituirContatosDoSetor(setorNormalizado, contatos) {
    const database = getDb();
    const agora = new Date().toISOString();

    const deletar = database.prepare('DELETE FROM contatos WHERE setor_normalizado = ?');
    const inserir = database.prepare(`
        INSERT INTO contatos (setor, setor_normalizado, nome_contato, telefone, atualizado_em)
        VALUES (@setor, @setor_normalizado, @nome_contato, @telefone, @atualizado_em)
    `);

    database.transaction(() => {
        deletar.run(setorNormalizado);
        for (const c of contatos) {
            inserir.run({ ...c, nome_contato: c.nome_contato || '', atualizado_em: agora });
        }
    })();
}

/**
 * Remove um contato pelo ID.
 * @param {number} id
 */
function removerContato(id) {
    const database = getDb();
    database.prepare('DELETE FROM contatos WHERE id = ?').run(id);
}

module.exports = { listarContatos, salvarContatos, substituirContatosDoSetor, removerContato };
