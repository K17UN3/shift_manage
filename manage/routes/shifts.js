const express = require('express');
const moment = require('moment');

// ログインチェック用ミドルウェア
const requireLogin = (req, res, next) => {
    if (!req.session.isLoggedIn) return res.redirect('/');
    next();
};

module.exports = (pool) => {
    const router = express.Router();

    // --- [GET] シフト管理ホーム画面 ---
    router.get('/home', requireLogin, (req, res) => {
        const isAdmin = (req.session.username === 'admin');
        res.render('shifts/home', {
            username: req.session.username,
            isAdmin: isAdmin,
            moment: moment
        });
    });

    // --- [GET] シフト登録画面 ---
    router.get('/register', requireLogin, async (req, res) => {
        try {
            const isAdmin = (req.session.username === 'admin');
            const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
            const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

            let allUsers = [];
            if (isAdmin) {
                const [users] = await pool.query('SELECT id, username FROM users ORDER BY username ASC');
                allUsers = users;
            }

            let query = `
                SELECT s.id, u.username, u.user_role, u.id as user_id,
                       DATE_FORMAT(s.shift_date, '%Y-%m-%d') as shift_date,
                       TIME_FORMAT(s.start_time, '%H:%i') as start_time,
                       TIME_FORMAT(s.end_time, '%H:%i') as end_time
                FROM shifts s JOIN users u ON s.user_id = u.id
                WHERE s.shift_date BETWEEN ? AND ? `;
            
            const params = [startOfMonth, endOfMonth];
            if (!isAdmin) {
                query += ` AND s.user_id = ? `;
                params.push(req.session.userId);
            }
            query += ` ORDER BY FIELD(u.user_role, '社員', 'パート', 'アルバイト') ASC, s.shift_date DESC`;

            const [shifts] = await pool.query(query, params);

            // 【修正】日またぎ対応の合計時間計算
            const totalHours = shifts.reduce((acc, s) => {
                const start = moment(s.start_time, 'HH:mm');
                let end = moment(s.end_time, 'HH:mm');
                if (end.isBefore(start)) {
                    end.add(1, 'day'); // 終了が開始より前なら翌日とする
                }
                return acc + end.diff(start, 'hours', true);
            }, 0);

            res.render('shifts/register', { 
                registeredShifts: shifts, 
                currentHours: totalHours.toFixed(1), 
                moment, 
                isAdmin,
                allUsers, 
                userId: req.session.userId,     
                username: req.session.username, 
                error: req.query.error || null 
            });
        } catch (e) { 
            console.error(e);
            res.status(500).send('エラー'); 
        }
    });

    // --- [POST] シフト登録 ---
    router.post('/register', requireLogin, async (req, res) => {
        const { date, start, end, employee_id } = req.body;
        const isAdmin = (req.session.username === 'admin');
        const targetUserId = (isAdmin && employee_id) ? employee_id : req.session.userId;

        if (start === end) {
            return res.redirect('/shifts/register?error=開始と終了を同じにはできません');
        }

        try {
            await pool.query(
                'INSERT INTO shifts (user_id, shift_date, start_time, end_time) VALUES (?, ?, ?, ?)', 
                [targetUserId, date, start, end]
            );
            res.redirect('/shifts/register');
        } catch (e) { 
            console.error("DB登録エラー:", e);
            res.redirect('/shifts/register?error=登録失敗'); 
        }
    });

    // --- [POST] シフト削除 ---
    router.post('/delete/:id', requireLogin, async (req, res) => {
        if (req.session.username !== 'admin') {
            return res.status(403).send('権限がありません');
        }
        try {
            await pool.query('DELETE FROM shifts WHERE id = ?', [req.params.id]);
            res.redirect('/shifts/register');
        } catch (e) {
            res.redirect('/shifts/register?error=削除失敗');
        }
    });

    // --- [GET] 月間カレンダー ---
    router.get('/view', requireLogin, async (req, res) => {
        const monthQuery = req.query.month;
        const currentMonth = monthQuery ? moment(monthQuery, 'YYYY-MM').startOf('month') : moment().startOf('month');
        const start = currentMonth.clone().startOf('month').format('YYYY-MM-DD');
        const end = currentMonth.clone().add(1, 'month').startOf('month').format('YYYY-MM-DD');
        try {
            const [allShifts] = await pool.query(
                `SELECT u.username, u.user_role, DATE_FORMAT(s.shift_date, '%Y-%m-%d') as shift_date,
                 TIME_FORMAT(s.start_time, '%H:%i') as start_time, TIME_FORMAT(s.end_time, '%H:%i') as end_time
                 FROM shifts s JOIN users u ON s.user_id = u.id 
                 WHERE s.shift_date >= ? AND s.shift_date < ?
                 ORDER BY FIELD(u.user_role, '社員', 'パート', 'アルバイト')`, [start, end]);
            const shiftsByDay = {};
            allShifts.forEach(s => { 
                if (!shiftsByDay[s.shift_date]) shiftsByDay[s.shift_date] = []; 
                shiftsByDay[s.shift_date].push(s); 
            });
            res.render('shifts/view', { 
                currentMonth, 
                shiftsByDay, 
                moment, 
                calendarStartDay: currentMonth.clone().startOf('month').startOf('week'), 
                calendarEndDay: currentMonth.clone().endOf('month').endOf('week'), 
                today: moment() 
            });
        } catch (e) { res.status(500).send('エラー'); }
    });

    // --- [GET] 1日詳細 (丸一日チャート & 跨ぎ対応版) ---
    router.get('/day/:date', requireLogin, async (req, res) => {
        const dateString = req.params.date;
        const yesterdayString = moment(dateString).subtract(1, 'day').format('YYYY-MM-DD');
        const isAdmin = (req.session.username === 'admin');

        try {
            // 「当日のシフト」と「前日から跨いでいるシフト」を両方取得
            const [rows] = await pool.query(
                `SELECT s.*, u.username, 
                        TIME_FORMAT(s.start_time, '%H:%i') as start_time, 
                        TIME_FORMAT(s.end_time, '%H:%i') as end_time
                 FROM shifts s 
                 JOIN users u ON s.user_id = u.id 
                 WHERE s.shift_date = ? 
                 OR (s.shift_date = ? AND s.end_time < s.start_time)`,
                [dateString, yesterdayString]
            );

            // データの加工：前日からの継続かどうかをフラグ化
            const processedRows = rows.map(shift => {
                const isFromYesterday = moment(shift.shift_date).format('YYYY-MM-DD') !== dateString;
                return {
                    ...shift,
                    isFromYesterday: isFromYesterday
                };
            });

            res.render('shifts/day_shifts', { 
                shifts: processedRows, 
                date: dateString,
                isAdmin: isAdmin,
                moment: moment 
            });
        } catch (e) {
            console.error(e);
            res.status(500).send("エラーが発生しました");
        }
    });

    // --- [GET] 年間全体表 ---
    router.get('/year/:year?', requireLogin, async (req, res) => {
        try {
            const targetYear = parseInt(req.params.year) || new Date().getFullYear();
            const isAdmin = (req.session.username === 'admin');
            const userId = req.session.userId;

            // 【修正】日またぎシフトの労働時間を正しく計算するSQL
            // end_time < start_time の場合は24時間を加算して計算
            let query = `
                SELECT 
                    MONTH(shift_date) as month,
                    COUNT(DISTINCT shift_date) as total_days,
                    SUM(
                        CASE 
                            WHEN end_time >= start_time THEN TIME_TO_SEC(TIMEDIFF(end_time, start_time)) / 3600
                            ELSE (TIME_TO_SEC(TIMEDIFF('24:00:00', start_time)) + TIME_TO_SEC(end_time)) / 3600
                        END
                    ) as total_hours
                FROM shifts
                WHERE YEAR(shift_date) = ?
            `;
            
            const params = [targetYear];
            if (!isAdmin) {
                query += ` AND user_id = ?`;
                params.push(userId);
            }
            query += ` GROUP BY MONTH(shift_date) ORDER BY month ASC`;

            const [stats] = await pool.query(query, params);

            const monthlyData = Array.from({ length: 12 }, (_, i) => ({
                month: i + 1, days: 0, hours: 0
            }));

            let yearlyTotalDays = 0;
            let yearlyTotalHours = 0;

            stats.forEach(s => {
                const idx = s.month - 1;
                if (monthlyData[idx]) {
                    const days = s.total_days || 0;
                    const hours = Math.round((s.total_hours || 0) * 10) / 10;
                    monthlyData[idx].days = days;
                    monthlyData[idx].hours = hours;
                    yearlyTotalDays += days;
                    yearlyTotalHours += hours;
                }
            });

            res.render('shifts/year', {
                targetYear,
                monthlyData,
                yearlyTotalDays,
                yearlyTotalHours: yearlyTotalHours.toFixed(1),
                isAdmin,
                username: req.session.username || 'スタッフ'
            });

        } catch (err) {
            console.error(err);
            res.status(500).send("エラーが発生しました");
        }
    });

    return router;
};