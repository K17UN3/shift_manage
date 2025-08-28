const express = require('express');
const router = express.Router();

// ログイン画面の表示
router.get('/', (req, res) => {
    res.render('login');
});

// ログイン処理
router.post('/login', (req, res) => {
    // フォームから送信されたユーザーIDをセッションに保存
    req.session.isLoggedIn = true;
    req.session.userid = req.body.userid; // 入力されたユーザーIDをセッションに保存

    // ログイン成功後、シフト管理のホーム画面へリダイレクト
    res.redirect('/shifts/home');
});

// ログアウト処理
router.get('/logout', (req, res) => {
    // セッションを破棄してログアウト
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;