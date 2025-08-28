const express = require('express');
const router = express.Router();

// ログイン画面の表示 (正しいパスを指定)
router.get(['/', '/login'], (req, res) => {
    res.render('auth/login');
});

// ログイン処理
router.post('/login', (req, res) => {
    req.session.isLoggedIn = true;
    req.session.userid = req.body.userid; 
    res.redirect('/shifts/home');
});

// ログアウト処理
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;