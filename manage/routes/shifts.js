// manage/routes/shifts.js (poolを受け取る関数としてエクスポートされていることを想定)

const express = require('express');
const moment = require('moment'); // moment.js は EJS内でも使用するため、ここで利用

// 認証チェック middleware
const requireLogin = (req, res, next) => {
    // 既存の認証ミドルウェア (isLoggedIn を使用)
    if (!req.session.isLoggedIn) {
        return res.redirect('/'); 
    }
    next();
};

// ヘルパー関数: カレンダー表示の週計算に必要な日付を決定
const getCalendarDates = (currentDate) => {
    const startOfMonth = currentDate.clone().startOf('month');
    const endOfMonth = currentDate.clone().endOf('month');
    const calendarStartDay = startOfMonth.clone().startOf('week'); 
    const calendarEndDay = endOfMonth.clone().endOf('week'); 
    
    return {
        calendarStartDay: calendarStartDay,
        calendarEndDay: calendarEndDay,
        today: moment(),
    };
};


module.exports = (pool) => {
    const router = express.Router();

    // データベース初期化処理は維持
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

    // /shifts/home ルート (既存のロジックを維持)
    router.get('/home', requireLogin, async (req, res) => {
        // ... (省略: 既存の /shifts/home のロジック) ...
        try {
            const userId = req.session.userId; 
            
            if (!userId) {
                console.error("Home screen error: req.session.userId is missing. Redirecting to logout.");
                return res.redirect('/logout');
            }
            
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

    // /shifts/register ルート (既存のロジックを維持)
    router.get('/register', requireLogin, async (req, res) => {
        // ... (省略: 既存の /shifts/register のロジック) ...
        const userId = req.session.userId;
        const currentMonthStart = moment().startOf('month').format('YYYY-MM-DD');
        const nextMonthStart = moment().add(1, 'month').startOf('month').format('YYYY-MM-DD');

        try {
            const [currentHoursResult] = await pool.query(
                `SELECT 
                    SUM(TIME_TO_SEC(TIMEDIFF(end_time, start_time))) / 3600 AS total_hours
                 FROM shifts 
                 WHERE user_id = ? 
                 AND shift_date >= ? AND shift_date < ?`,
                [userId, currentMonthStart, nextMonthStart]
            );
            const currentHours = currentHoursResult[0].total_hours ? parseFloat(currentHoursResult[0].total_hours).toFixed(1) : 0;
            
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
                error: null,
                moment: moment
            });

        } catch (error) {
            console.error('Shift register screen error:', error);
            res.status(500).send('シフト登録画面でエラーが発生しました。');
        }
    });
    
    // /shifts/register POST (既存のロジックを維持)
    router.post('/register', requireLogin, async (req, res) => {
        // ... (省略: 既存の /shifts/register POST のロジック) ...
        const { date, start, end } = req.body;
        const userId = req.session.userId;

        if (!date || !start || !end) {
            return res.redirect('/shifts/register');
        }

        try {
            await pool.query(
                `INSERT INTO shifts (user_id, shift_date, start_time, end_time) VALUES (?, ?, ?, ?)`,
                [userId, date, start, end]
            );
            res.redirect('/shifts/register');
        } catch (error) {
            console.error('Shift submission error:', error);
            
            const errorMessage = error.code === 'ER_DUP_ENTRY' 
                                 ? '既にこの日のシフトは登録されています。'
                                 : 'シフトの登録に失敗しました。';
            
            res.render('shifts/register', { 
                currentHours: 0, 
                registeredShifts: [], 
                currentMonth: moment().startOf('month'),
                error: errorMessage,
                moment: moment
            });
        }
    });

    // ★ 1. 月間カレンダー表示ルート (/shifts/view) - 既存のDBロジックとカレンダーロジックを統合 ★
    router.get('/view', requireLogin, async (req, res) => {
        const currentMonth = moment().startOf('month');
        const currentMonthStart = currentMonth.format('YYYY-MM-DD');
        const nextMonthStart = currentMonth.clone().add(1, 'month').startOf('month').format('YYYY-MM-DD');
        
        try {
            // DBからデータを取得 (既存ロジックを流用)
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

            // データをカレンダー表示用に整形 (既存ロジックを流用)
            const shiftsByDay = {};
            allShifts.forEach(shift => {
                if (!shiftsByDay[shift.shift_date]) {
                    shiftsByDay[shift.shift_date] = [];
                }
                shiftsByDay[shift.shift_date].push(shift);
            });
            
            // カレンダーの日付計算ロジック
            const calendarDates = getCalendarDates(currentMonth);

            res.render('shifts/view', {
                currentMonth: currentMonth,
                shiftsByDay,
                totalHoursMap: totalHours.reduce((map, item) => {
                    map[item.username] = parseFloat(item.total_hours).toFixed(1);
                    return map;
                }, {}),
                
                // カレンダー表示に必要な日付データ
                calendarStartDay: calendarDates.calendarStartDay,
                calendarEndDay: calendarDates.calendarEndDay,
                today: calendarDates.today,
                
                moment: moment
            });

        } catch (error) {
            console.error('Shift view screen error:', error);
            res.status(500).send('全体シフト確認画面でエラーが発生しました。');
        }
    });

    // ★ 2. 個別日のシフト管理ルート (/shifts/day/:dateString) を新規追加 ★
    router.get('/day/:dateString', requireLogin, async (req, res) => {
        const dateString = req.params.dateString;
        const targetDate = moment(dateString, 'YYYY-MM-DD');

        try {
            // 1. その日の全ユーザーのシフトを取得
            const [dailyShiftsResult] = await pool.query(
                `SELECT 
                    u.username, 
                    TIME_FORMAT(s.start_time, '%H:%i') as start_time,
                    TIME_FORMAT(s.end_time, '%H:%i') as end_time
                 FROM shifts s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.shift_date = ?`,
                [dateString]
            );

            // 2. 全ユーザーのリストを取得 (シフトを登録していないユーザーも対象)
            const [allUsersResult] = await pool.query('SELECT username FROM users ORDER BY id');
            const allUsers = allUsersResult.map(row => row.username);

            // EJSでの処理を容易にするため、シフトデータをユーザー名でマップ化
            const dailyShiftsMap = dailyShiftsResult.reduce((map, shift) => {
                map[shift.username] = { start: shift.start_time, end: shift.end_time };
                return map;
            }, {});

            res.render('shifts/day_shifts', {
                targetDate: targetDate,
                allUsers: allUsers,
                dailyShiftsMap: dailyShiftsMap, // { '佐藤': { start: '10:00', end: '18:00' }, ... }
                moment: moment,
            });

        } catch (error) {
            console.error(`Shift day view error for ${dateString}:`, error);
            res.status(500).send('個別シフト管理画面でエラーが発生しました。');
        }
    });

    return router;
};