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

    // ユーザー登録処理の実行 (POST /register)
    router.post('/register', async (req, res) => {
        // パスワードは不要なため、usernameのみを取得
        const { username } = req.body; 

        if (!username) {
            // usernameが空の場合はエラーを返す
            return res.render('auth/register', { error: '個人識別番号を入力してください。' });
        }

        try {
            // usersテーブル作成（passwordカラムは残すが、今回は使用しない）
            await pool.query(
                'CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) UNIQUE, password VARCHAR(255))'
            );

            // ユーザー名の重複をチェック
            const [existingUser] = await pool.query(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );

            if (existingUser.length > 0) {
                return res.render('auth/register', { error: 'その個人識別番号は既に使われています。' });
            }

            // データベースに新しいユーザーを挿入
            // パスワードには空文字列を設定 ('')
            await pool.query(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                [username, ''] // パスワードとして空文字列を挿入
            );
            res.redirect('/'); 

        } catch (error) {
            console.error('ユーザー登録エラー:', error);
            res.status(500).send('サーバーエラーが発生しました');
        }
    });

    // ログイン処理 (POST /login)
    router.post('/login', async (req, res) => {
        // パスワードは不要なため、usernameのみを取得
        const { username } = req.body;

        try {
            await pool.query(
                'CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) UNIQUE, password VARCHAR(255))'
            );
            
            // 修正: 認証は username の一致のみで行う
            const [rows] = await pool.query(
                'SELECT * FROM users WHERE username = ?', 
                [username]
            );

            if (rows.length > 0) {
                // 認証成功
                req.session.isLoggedIn = true;
                req.session.username = username;
                // ログイン成功時にユーザーIDもセッションに保存（シフト登録時に必要）
                req.session.userId = rows[0].id; 
                
                console.log(`User ${username} logged in successfully.`);
                res.redirect('/shifts/home');
            } else {
                // 認証失敗
                res.render('auth/login', { error: '個人識別番号が正しくありません。' }); // ビュー名を 'auth/login' に修正
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
