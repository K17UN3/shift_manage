const express = require('express');
const session = require('express-session');
const path = require('path');
const mysql = require('mysql2/promise');

const authRouter = require('./manage/routes/auth');
const shiftsRouter = require('./manage/routes/shifts');

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

// ミドルウェアの設定
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your_super_secret_key',
    resave: false,
    saveUninitialized: true
}));

// EJSをテンプレートエンジンとして設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'manage', 'views'));

// DB保存テスト用のルーティング
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

// ルーティングの設定
app.use('/', authRouter);
app.use('/shifts', shiftsRouter);

// サーバー起動
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
