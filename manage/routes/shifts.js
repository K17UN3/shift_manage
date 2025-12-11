const express = require('express');
const moment = require('moment');

// 認証チェック middleware
const requireLogin = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/'); 
    }
    next();
};

module.exports = (pool) => {
    const router = express.Router();

    const initializeDatabase = async () => {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS shifts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    shift_date DATE NOT NULL,
                    start_time TIME NOT NULL,
                    end_time TIME NOT NULL,
                    UNIQUE KEY unique_shift (user_id, shift_date), 
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            console.log("Shifts table initialized successfully.");
        } catch (error) {
            console.error("Shifts table initialization failed:", error);
        }
    };
    initializeDatabase(); 

    router.get('/home', requireLogin, async (req, res) => {
        try {
            const userId = req.session.userId; 
            
            if (!userId) {
                console.error("Home screen error: req.session.userId is missing. Redirecting to logout.");
                return res.redirect('/logout');
            }
            
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
            // 結果がNULLの場合は0、そうでない場合は小数点第1位に丸める
            const prevHours = prevHoursResult[0].total_hours ? parseFloat(prevHoursResult[0].total_hours).toFixed(1) : 0;

            // 2. シフト提出期限 (仮に翌月5日と設定)
            const deadlineDate = moment().add(1, 'month').endOf('month').date(5);
            const deadline = deadlineDate.format('YYYY年MM月DD日');

            res.render('shifts/home', { 
                prevHours, 
                deadline, 
                currentDate: moment().format('YYYY-MM-DD'),
                dbError: null,
                moment: moment
            });
            
        } catch (error) {
            console.error('Home screen database error:', error);
            res.render('shifts/home', {
                prevHours: 'エラー', 
                deadline: 'エラー',
                currentDate: moment().format('YYYY-MM-DD'),
                dbError: 'データ取得中にエラーが発生しました。',
                moment: moment
            });
        }
    });

    router.get('/register', requireLogin, async (req, res) => {
        const userId = req.session.userId;
        const currentMonthStart = moment().startOf('month').format('YYYY-MM-DD');
        const nextMonthStart = moment().add(1, 'month').startOf('month').format('YYYY-MM-DD');

        try {
            // 今月のシフト時間を計算
            const [currentHoursResult] = await pool.query(
                `SELECT 
                    SUM(TIME_TO_SEC(TIMEDIFF(end_time, start_time))) / 3600 AS total_hours
                 FROM shifts 
                 WHERE user_id = ? 
                 AND shift_date >= ? AND shift_date < ?`,
                [userId, currentMonthStart, nextMonthStart]
            );
            const currentHours = currentHoursResult[0].total_hours ? parseFloat(currentHoursResult[0].total_hours).toFixed(1) : 0;
            
            // 登録済みのシフトを取得
            const [registeredShifts] = await pool.query(
                `SELECT DATE_FORMAT(shift_date, '%Y-%m-%d') as shift_date, 
                        TIME_FORMAT(start_time, '%H:%i') as start_time,
                        TIME_FORMAT(end_time, '%H:%i') as end_time
                 FROM shifts 
                 WHERE user_id = ? 
                 AND shift_date >= ? AND shift_date < ?
                 ORDER BY shift_date`,
                [userId, currentMonthStart, nextMonthStart]
            );

            res.render('shifts/register', { 
                currentHours, 
                registeredShifts,
                currentMonth: moment().startOf('month'),
                error: null
            });

        } catch (error) {
            console.error('Shift register screen error:', error);
            res.status(500).send('シフト登録画面でエラーが発生しました。');
        }
    });
    
    // シフト登録処理 (POST /shifts/register)
    router.post('/register', requireLogin, async (req, res) => {
        const { date, start, end } = req.body;
        const userId = req.session.userId;

        if (!date || !start || !end) {
            // 必須項目チェック
            return res.redirect('/shifts/register');
        }

        try {
            // シフトデータ挿入
            await pool.query(
                `INSERT INTO shifts (user_id, shift_date, start_time, end_time) VALUES (?, ?, ?, ?)`,
                [userId, date, start, end]
            );
            res.redirect('/shifts/register'); // 再度登録画面に戻る
        } catch (error) {
            console.error('Shift submission error:', error);
            
            // データベースエラー（例: UNIQUE制約違反）が発生した場合
            const errorMessage = error.code === 'ER_DUP_ENTRY' 
                               ? '既にこの日のシフトは登録されています。'
                               : 'シフトの登録に失敗しました。';
            
            // エラーメッセージと共に登録画面を再レンダリング (データ再取得は煩雑なため省略)
            res.render('shifts/register', { 
                currentHours: 0, 
                registeredShifts: [], 
                currentMonth: moment().startOf('month'),
                error: errorMessage
            });
        }
    });

    router.get('/view', requireLogin, async (req, res) => {
        const currentMonthStart = moment().startOf('month').format('YYYY-MM-DD');
        const nextMonthStart = moment().add(1, 'month').startOf('month').format('YYYY-MM-DD');

        try {
            // 全員の今月のシフトを取得（JOINしてユーザー名も取得）
            const [allShifts] = await pool.query(
                `SELECT 
                    u.username,
                    DATE_FORMAT(s.shift_date, '%Y-%m-%d') as shift_date,
                    TIME_FORMAT(s.start_time, '%H:%i') as start_time,
                    TIME_FORMAT(s.end_time, '%H:%i') as end_time,
                    TIME_TO_SEC(TIMEDIFF(s.end_time, s.start_time)) / 3600 AS duration
                 FROM shifts s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.shift_date >= ? AND s.shift_date < ?
                 ORDER BY s.shift_date, s.start_time`,
                [currentMonthStart, nextMonthStart]
            );

            // ユーザーごとの合計勤務時間も取得 (横棒表示と赤色表示に必要)
            const [totalHours] = await pool.query(
                `SELECT 
                    u.username,
                    SUM(TIME_TO_SEC(TIMEDIFF(s.end_time, s.start_time))) / 3600 AS total_hours
                 FROM shifts s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.shift_date >= ? AND s.shift_date < ?
                 GROUP BY u.username`,
                [currentMonthStart, nextMonthStart]
            );

            // データをカレンダー表示用に整形
            const shiftsByDay = {};
            allShifts.forEach(shift => {
                if (!shiftsByDay[shift.shift_date]) {
                    shiftsByDay[shift.shift_date] = [];
                }
                shiftsByDay[shift.shift_date].push(shift);
            });

            res.render('shifts/view', {
                currentMonth: moment().startOf('month'),
                shiftsByDay,
                totalHoursMap: totalHours.reduce((map, item) => {
                    map[item.username] = parseFloat(item.total_hours).toFixed(1);
                    return map;
                }, {})
            });

        } catch (error) {
            console.error('Shift view screen error:', error);
            res.status(500).send('全体シフト確認画面でエラーが発生しました。');
        }
    });
    
    return router;
};
