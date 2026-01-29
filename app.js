const express = require('express');
const session = require('express-session');
const path = require('path');
const mysql = require('mysql2/promise');

// 各ルーターの読み込み
const authRouter = require('./manage/routes/auth');
const shiftsRouter = require('./manage/routes/shifts');
const adminRouter = require('./manage/routes/admin'); // ★追加

const app = express();
const PORT = 3000;

// DB接続設定
const pool = mysql.createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// --- ミドルウェアの設定 ---
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'manage', 'public')));

// セッション設定 (ルーティングより前に記述)
app.use(session({
    secret: 'your_super_secret_key',
    resave: false,
    saveUninitialized: true
}));

// EJSをテンプレートエンジンとして設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'manage', 'views'));

// --- ルーティングの設定 ---

// 認証 (ログイン・ログアウト)
app.use('/', authRouter(pool));

// シフト管理 (登録・表示・削除)
app.use('/shifts', shiftsRouter(pool));

// 管理者機能 (従業員管理) ★追加
app.use('/admin', adminRouter(pool)); 

app.get('/test', async (req, res) => {
    res.render('test', { message: null });
});

app.post('/save', async (req, res) => {
    const { name } = req.body;
    try {
        await pool.query('CREATE TABLE IF NOT EXISTS test_users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255))');
        await pool.query('INSERT INTO test_users (name) VALUES (?)', [name]);
        res.redirect('/test');
    } catch (err) {
        console.error(err);
    }
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
