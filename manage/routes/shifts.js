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

            // adminならプルダウン用に全ユーザー取得
            let allUsers = [];
            if (isAdmin) {
                const [users] = await pool.query('SELECT id, username FROM users ORDER BY username ASC');
                allUsers = users;
            }

            // シフト一覧取得
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

            const totalHours = shifts.reduce((acc, s) => {
                const start = moment(s.start_time, 'HH:mm');
                const end = moment(s.end_time, 'HH:mm');
                return acc + end.diff(start, 'hours', true);
            }, 0);

            res.render('shifts/register', { 
                registeredShifts: shifts, 
                currentHours: totalHours.toFixed(1), 
                moment, 
                isAdmin,
                allUsers, // admin用スタッフリスト
                userId: req.session.userId,     // 自分のID
                username: req.session.username, // 自分の名前
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
        
        // adminなら選択されたID、一般なら自分のID
        const targetUserId = (isAdmin && employee_id) ? employee_id : req.session.userId;

        try {
            await pool.query(
                'INSERT INTO shifts (user_id, shift_date, start_time, end_time) VALUES (?, ?, ?, ?)', 
                [targetUserId, date, start, end]
            );
            res.redirect('/shifts/register');
        } catch (e) { 
            res.redirect('/shifts/register?error=登録失敗'); 
        }
    });

    // --- [POST] シフト削除（重要：必ずreturn routerより前に書く） ---
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
            res.render('shifts/view', { currentMonth, shiftsByDay, moment, calendarStartDay: currentMonth.clone().startOf('month').startOf('week'), calendarEndDay: currentMonth.clone().endOf('month').endOf('week'), today: moment() });
        } catch (e) { res.status(500).send('エラー'); }
    });

    // --- [GET] 1日詳細 ---
    router.get('/day/:dateString', requireLogin, async (req, res) => {
        const dateString = req.params.dateString;
        const isAdmin = (req.session.username === 'admin');
        try {
            const [dailyShiftsResult] = await pool.query(`SELECT u.username, TIME_FORMAT(s.start_time, '%H:%i') as start_time, TIME_FORMAT(s.end_time, '%H:%i') as end_time FROM shifts s JOIN users u ON s.user_id = u.id WHERE s.shift_date = ?`, [dateString]);
            const [allUsersResult] = await pool.query(`SELECT id, username, user_role FROM users ORDER BY FIELD(user_role, '社員', 'パート', 'アルバイト'), id ASC`);
            const dailyShiftsMap = dailyShiftsResult.reduce((map, s) => { map[s.username] = { start: s.start_time, end: s.end_time }; return map; }, {});
            res.render('shifts/day_shifts', { targetDate: moment(dateString), allUsers: allUsersResult, dailyShiftsMap, moment, isAdmin, currentUsername: req.session.username });
        } catch (e) { res.status(500).send('エラー'); }
    });

    return router;
};