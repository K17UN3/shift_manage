// routes/shifts.js

const express = require('express');
const moment = require('moment'); // 日付・時刻操作ライブラリ

// 認証チェック middleware
// ログインしていない場合はログイン画面へリダイレクト
const requireLogin = (req, res, next) => {
    // セッションの isLoggedIn が true でなければリダイレクト
    if (!req.session.isLoggedIn) {
        return res.redirect('/'); 
    }
    next();
};

// -------------------------------------------------------------------
// module.exports を関数化し、app.js から pool を受け取れるようにする
// -------------------------------------------------------------------
module.exports = (pool) => {
    const router = express.Router();
    
    // DB: shiftsテーブルの初期化（usersテーブルはauth.jsで作成済み）
    const initializeDatabase = async () => {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS shifts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    shift_date DATE NOT NULL,
                    start_time TIME NOT NULL,
                    end_time TIME NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            console.log("Shifts table initialized successfully.");
        } catch (error) {
            console.error("Shifts table initialization failed:", error);
        }
    };
    initializeDatabase(); // サーバー起動時に実行

    // -------------------------------------------------------------------
    // HOME画面 (GET /shifts/home)
    // -------------------------------------------------------------------
    router.get('/home', requireLogin, async (req, res) => {
        try {
            // 注意: ログイン時に req.session.userId が設定されている必要があります
            const userId = req.session.userId; 
            
            // 1. 前の月の勤務時間を計算
            const currentMonth = moment().format('YYYY-MM-01');
            const prevMonth = moment().subtract(1, 'month').format('YYYY-MM-01');

            const [prevHoursResult] = await pool.query(
                `SELECT 
                    SUM(TIME_TO_SEC(TIMEDIFF(end_time, start_time))) / 3600 AS total_hours
                 FROM shifts 
                 WHERE user_id = ? 
                 AND shift_date >= ? AND shift_date < ?`,
                [userId, prevMonth, currentMonth]
            );
            const prevHours = prevHoursResult[0].total_hours ? parseFloat(prevHoursResult[0].total_hours).toFixed(1) : 0;

            // 2. シフト提出期限 (例: 翌月5日)
            const deadlineDate = moment().add(1, 'month').endOf('month').date(5);
            const deadline = deadlineDate.format('YYYY年MM月DD日');

            res.render('shifts/home', { 
                prevHours, 
                deadline, 
                currentDate: moment().format('YYYY-MM-DD')
            });
        } catch (error) {
            console.error('Home screen error:', error);
            res.status(500).send('HOME画面でエラーが発生しました。');
        }
    });

    // -------------------------------------------------------------------
    // シフト登録画面 (GET /shifts/register)
    // -------------------------------------------------------------------
    router.get('/register', requireLogin, async (req, res) => {
        try {
            // ここに、今月の合計時間と登録済みシフトを取得するロジックを実装
            // ... (前回の回答のロジックを参照)

            res.render('shifts/register', { 
                currentHours: 0, // 仮の値
                registeredShifts: [], // 仮の値
                currentMonth: moment().startOf('month')
            });
        } catch (error) {
             console.error('Shift register screen error:', error);
             res.status(500).send('シフト登録画面でエラーが発生しました。');
        }
    });
    
    // シフト登録処理 (POST /shifts/register)
    router.post('/register', requireLogin, async (req, res) => {
        // DB登録ロジックを実装
        // ... (前回の回答のロジックを参照)

        res.redirect('/shifts/register');
    });


    // -------------------------------------------------------------------
    // 全体シフト確認画面 (GET /shifts/view)
    // -------------------------------------------------------------------
    router.get('/view', requireLogin, async (req, res) => {
        try {
            // ここに、全ユーザーのシフト、合計時間などを取得するロジックを実装
            // ... (前回の回答のロジックを参照)
            
            const shiftsByDay = {}; // DBから取得した整形済みデータ
            const totalHoursMap = {}; // DBから取得した合計時間データ

            res.render('shifts/view', { 
                currentMonth: moment().startOf('month'),
                shiftsByDay,
                totalHoursMap
            });
        } catch (error) {
            console.error('Shift view screen error:', error);
            res.status(500).send('全体シフト確認画面でエラーが発生しました。');
        }
    });
    
    return router;
};