module.exports = (pool) => {
    const express = require('express');
    const router = express.Router();

    // ログイン画面の表示
    router.get(['/', '/login'], (req, res) => {
        res.render('auth/login', { error: null }); 
    });

    // 新規ユーザー登録画面の表示
    router.get('/register', (req, res) => {
        res.render('auth/register', { error: null });
    });

    // ユーザー登録処理の実行
    router.post('/register', async (req, res) => {
        // username と user_roleを取得
        const { username, user_role } = req.body; 

        if (!username || !user_role) {
            return res.render('auth/register', { error: 'すべての項目を入力してください。' });
        }

        try {
            // 【重要】最新のテーブル構造 (id, username, user_role) で作成
            await pool.query(
                `CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY, 
                    username VARCHAR(255) UNIQUE, 
                    user_role VARCHAR(20) NOT NULL
                )`
            );

            // ユーザー名の重複チェック
            const [existingUser] = await pool.query(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );

            if (existingUser.length > 0) {
                return res.render('auth/register', { error: 'その個人識別番号は既に使われています。' });
            }

            // 【重要】user_roleも含めてデータベースに挿入
            await pool.query(
                'INSERT INTO users (username, user_role) VALUES (?, ?)',
                [username, user_role]
            );

            res.redirect('/'); 

        } catch (error) {
            console.error('ユーザー登録エラー:', error);
            res.status(500).send('サーバーエラーが発生しました');
        }
    });

    // ログイン処理
    router.post('/login', async (req, res) => {
        const { username } = req.body;

        try {
            // 認証は username の一致のみ
            const [rows] = await pool.query(
                'SELECT * FROM users WHERE username = ?', 
                [username]
            );

            if (rows.length > 0) {
                req.session.isLoggedIn = true;
                req.session.username = username;
                req.session.userId = rows[0].id; // ユーザーIDを保存
                req.session.user_role = rows[0].user_role; // 属性もセッションに入れておくと便利
                
                res.redirect('/shifts/home');
            } else {
                res.render('auth/login', { error: '個人識別番号が見つかりません。' });
            }
        } catch (error) {
            console.error('ログインエラー:', error);
            res.status(500).send('サーバーエラー');
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