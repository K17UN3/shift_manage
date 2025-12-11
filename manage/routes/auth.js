module.exports = (pool) => {
    const express = require('express');
    const router = express.Router();

    // ログイン画面の表示
    router.get(['/', '/login'], (req, res) => {
        // 修正: 'login' ではなく 'auth/login' を指定する
        res.render('auth/login', { error: null }); 
    });

    // 新規ユーザー登録画面の表示
    router.get('/register', (req, res) => {
        res.render('auth/register', { error: null });
    });

    // ユーザー登録処理の実行
    router.post('/register', async (req, res) => {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.render('auth/register', { error: 'ユーザー名とパスワードを入力してください。' });
        }

        try {
            await pool.query(
                'CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) UNIQUE, password VARCHAR(255))'
            );

            // ユーザー名の重複をチェック
            const [existingUser] = await pool.query(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );

            if (existingUser.length > 0) {
                return res.render('auth/register', { error: 'そのユーザー名は既に使われています。' });
            }

            await pool.query(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                [username, password]
            );
            res.redirect('/'); 

        } catch (error) {
            console.error('ユーザー登録エラー:', error);
            res.status(500).send('サーバーエラーが発生しました');
        }
    });

    // ログイン処理
    router.post('/login', async (req, res) => {
        const { username, password } = req.body;

        try {
            await pool.query(
                'CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) UNIQUE, password VARCHAR(255))'
            );
            
            const [rows] = await pool.query(
                'SELECT * FROM users WHERE username = ? AND password = ?', 
                [username, password]
            );

            if (rows.length > 0) {
                // 認証成功
                req.session.isLoggedIn = true;
                req.session.username = username;
                console.log(`User ${username} logged in successfully.`);
                res.redirect('/shifts/home');
            } else {
                // 認証失敗
                res.render('login', { error: 'ユーザー名またはパスワードが正しくありません' });
            }
        } catch (error) {
            console.error('ログインエラー:', error);
            res.status(500).send('サーバーエラーが発生しました');
        }
    });

    // ログアウト処理
    router.get('/logout', (req, res) => {
        req.session.destroy(() => {
            res.redirect('/');
        });
    });

    return router;
};