const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
    let connection;
    const maxAttempts = 10; // 最大10回試行
    const retryInterval = 5000; // 5秒おきに再試行

    // --- 接続できるまでリトライするループ ---
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || 'password',
                database: process.env.DB_NAME || 'shift_db',
                charset: 'utf8mb4',
                multipleStatements: true
            });
            break; // 接続できたらループを抜ける
        } catch (err) {
            if (i === maxAttempts) {
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }

    // --- SQLの実行 ---
    try {
        const sqlPath = path.join(__dirname, 'mysql', 'initialize.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await connection.query(sql);
    } catch (err) {
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
