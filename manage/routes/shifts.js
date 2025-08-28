const express = require('express');
const router = express.Router();

// 認証チェックのミドルウェア
const requireLogin = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/');
    }
    next();
};

// ホーム画面（ログイン後）
router.get('/home', requireLogin, (req, res) => {
    res.render('home');
});

// シフト登録画面
router.get('/register', requireLogin, (req, res) => {
    res.render('register');
});

// 全体シフト確認画面
router.get('/view', requireLogin, (req, res) => {
    // DBからシフトデータを取得
    const shifts = [
        { date: '2025-09-01', user: 'Aさん', time: '9:00 - 17:00' },
        { date: '2025-09-02', user: 'Bさん', time: '13:00 - 21:00' }
    ];
    res.render('view', { shifts: shifts });
});

module.exports = router;