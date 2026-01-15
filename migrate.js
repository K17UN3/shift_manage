const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'shift_db',
        charset: 'utf8mb4',
        multipleStatements: true
    });

    try {
        // SQLファイルを読み込む
        const sqlPath = path.join(__dirname, 'mysql', 'initialize.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('SQL実行中...');
        await connection.query(sql);
        console.log('マイグレーションが完了しました。');
    } catch (err) {
        console.error('エラーが発生しました:', err);
        process.exit(1); // 後続のapp.jsを動かさない
    } finally {
        await connection.end();
    }
}

migrate();
