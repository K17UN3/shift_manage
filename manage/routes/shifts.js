const express = require('express');
const moment = require('moment');

const requireLogin = (req, res, next) => {
    if (!req.session.isLoggedIn) return res.redirect('/');
    next();
};

module.exports = (pool) => {
    const router = express.Router();

    // --- [GET] シフト登録画面（全データ表示） ---
    router.get('/register', requireLogin, async (req, res) => {
        try {
            const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
            const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');
            const [shifts] = await pool.query(
                `SELECT s.id, u.username, u.role, u.id as user_id,
                        DATE_FORMAT(s.shift_date, '%Y-%m-%d') as shift_date,
                        TIME_FORMAT(s.start_time, '%H:%i') as start_time,
                        TIME_FORMAT(s.end_time, '%H:%i') as end_time
                 FROM shifts s JOIN users u ON s.user_id = u.id
                 WHERE s.shift_date BETWEEN ? AND ?
                 ORDER BY s.shift_date DESC, FIELD(u.role, 'パート', 'アルバイト', '社員')`,
                [startOfMonth, endOfMonth]
            );
            const totalHours = shifts.reduce((acc, s) => {
                const start = moment(s.start_time, 'HH:mm');
                const end = moment(s.end_time, 'HH:mm');
                return acc + end.diff(start, 'hours', true);
            }, 0);
            res.render('shifts/register', { registeredShifts: shifts, currentHours: totalHours.toFixed(1), moment, error: req.query.error || null });
        } catch (e) { res.status(500).send('エラー'); }
    });

    // --- [POST] シフト登録 ---
    router.post('/register', requireLogin, async (req, res) => {
        const { date, start, end, employee_id } = req.body;
        const targetUserId = employee_id || req.session.userId;
        try {
            await pool.query('INSERT INTO shifts (user_id, shift_date, start_time, end_time) VALUES (?, ?, ?, ?)', [targetUserId, date, start, end]);
            res.redirect('/shifts/register');
        } catch (e) { res.redirect('/shifts/register?error=登録失敗'); }
    });

    // --- [GET] 月間カレンダー ---
    router.get('/view', requireLogin, async (req, res) => {
        const monthQuery = req.query.month;
        const currentMonth = monthQuery ? moment(monthQuery, 'YYYY-MM').startOf('month') : moment().startOf('month');
        const start = currentMonth.clone().startOf('month').format('YYYY-MM-DD');
        const end = currentMonth.clone().add(1, 'month').startOf('month').format('YYYY-MM-DD');
        try {
            const [allShifts] = await pool.query(
                `SELECT u.username, DATE_FORMAT(s.shift_date, '%Y-%m-%d') as shift_date,
                 TIME_FORMAT(s.start_time, '%H:%i') as start_time, TIME_FORMAT(s.end_time, '%H:%i') as end_time
                 FROM shifts s JOIN users u ON s.user_id = u.id WHERE s.shift_date >= ? AND s.shift_date < ?`, [start, end]);
            const shiftsByDay = {};
            allShifts.forEach(s => { if (!shiftsByDay[s.shift_date]) shiftsByDay[s.shift_date] = []; shiftsByDay[s.shift_date].push(s); });
            res.render('shifts/view', { currentMonth, shiftsByDay, moment, calendarStartDay: currentMonth.clone().startOf('month').startOf('week'), calendarEndDay: currentMonth.clone().endOf('month').endOf('week'), today: moment() });
        } catch (e) { res.status(500).send('エラー'); }
    });

    // --- [GET] 1日詳細（並び替え機能付き） ---
    router.get('/day/:dateString', requireLogin, async (req, res) => {
        const dateString = req.params.dateString;
        try {
            const [dailyShiftsResult] = await pool.query(
                `SELECT u.username, TIME_FORMAT(s.start_time, '%H:%i') as start_time, TIME_FORMAT(s.end_time, '%H:%i') as end_time
                 FROM shifts s JOIN users u ON s.user_id = u.id WHERE s.shift_date = ?`, [dateString]);
            
            // 重要：パート ＞ アルバイト ＞ 社員の順でユーザーを取得
            const [allUsersResult] = await pool.query(
                `SELECT username, role FROM users ORDER BY FIELD(role, 'パート', 'アルバイト', '社員'), id ASC`);

            const dailyShiftsMap = dailyShiftsResult.reduce((map, s) => {
                map[s.username] = { start: s.start_time, end: s.end_time };
                return map;
            }, {});
            res.render('shifts/day_shifts', { targetDate: moment(dateString), allUsers: allUsersResult, dailyShiftsMap, moment });
        } catch (e) { res.status(500).send('エラー'); }
    });

    return router;
};