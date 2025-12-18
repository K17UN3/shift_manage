const express = require('express');

// 管理者チェック用ミドルウェア
// ログイン済み かつ ユーザー名が 'admin' であることを確認します
const requireAdmin = (req, res, next) => {
    if (req.session.isLoggedIn && req.session.username === 'admin') {
        next();
    } else {
        res.status(403).send('管理権限が必要です');
    }
};

module.exports = (pool) => {
    const router = express.Router();

    // --- [GET] 従業員一覧表示 ---
    router.get('/users', requireAdmin, async (req, res) => {
        try {
            // ID順に従業員を取得（パスワードは取得しないのが安全ですが、一覧表示用にid, username, user_roleを取得）
            const [users] = await pool.query('SELECT id, username, user_role FROM users ORDER BY id ASC');
            
            // manage/views/admin/users.ejs を描画
            res.render('admin/users', { users });
        } catch (e) {
            console.error(e);
            res.status(500).send('エラーが発生しました');
        }
    });

    // --- [POST] 従業員追加 ---
    router.post('/users/add', requireAdmin, async (req, res) => {
        const { new_username, new_role } = req.body;
        
        try {
            // データベースに新しいユーザーを挿入
            // 注意: 実運用ではbcryptなどでパスワードをハッシュ化することを強く推奨します
            await pool.query(
                'INSERT INTO users (username, user_role) VALUES (?, ?)',
                [new_username, new_role]
            );
            res.redirect('/admin/users');
        } catch (e) {
            console.error(e);
            // ユーザー名の重複などでエラーになる可能性があります
            res.status(500).send('登録に失敗しました（名前が重複している可能性があります）');
        }
    });

    // --- [POST] 従業員削除 ---
    router.post('/users/delete/:id', requireAdmin, async (req, res) => {
        const userId = req.params.id;
        
        try {
            // トランザクションを考慮するか、順番に削除します
            // 1. そのユーザーに紐付いているシフトを先に削除（制約エラー回避）
            await pool.query('DELETE FROM shifts WHERE user_id = ?', [userId]);
            
            // 2. ユーザー本体を削除
            await pool.query('DELETE FROM users WHERE id = ?', [userId]);
            
            res.redirect('/admin/users');
        } catch (e) {
            console.error(e);
            res.status(500).send('削除に失敗しました');
        }
    });

    return router;
};