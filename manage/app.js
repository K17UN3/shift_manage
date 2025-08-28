const express = require('express');
const session = require('express-session');
const path = require('path');

const authRouter = require('./routes/auth');
const shiftsRouter = require('./routes/shifts');

const app = express();
const PORT = 3000;

// ミドルウェアの設定
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your_super_secret_key',
    resave: false,
    saveUninitialized: true
}));

// EJSをテンプレートエンジンとして設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ルーティングの設定
app.use('/', authRouter);
app.use('/shifts', shiftsRouter);

// サーバー起動
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});