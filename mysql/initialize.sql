-- テーブル作成
DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    user_role VARCHAR(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS shifts;
CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    shift_date DATE,
    start_time TIME,
    end_time TIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- user内容
INSERT INTO users (username, user_role) 
SELECT 'アルバイト', 'テストアルバイト' FROM DUAL 
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'アルバイト');

INSERT INTO users (username, user_role) 
SELECT 'パート', 'テストパート' FROM DUAL 
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'パート');

INSERT INTO users (username, user_role) 
SELECT '社員', 'テスト社員' FROM DUAL 
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = '社員');


-- shift内容
INSERT INTO shifts (user_id, shift_date, start_time, end_time)
SELECT id, '2026-01-15', '08:00:00', '14:00:00'
FROM users WHERE username = 'アルバイト'
AND NOT EXISTS (
    SELECT 1 FROM shifts WHERE user_id = (SELECT id FROM users WHERE username = 'アルバイト') 
    AND shift_date = '2026-01-15'
);

INSERT INTO shifts (user_id, shift_date, start_time, end_time)
SELECT id, '2026-01-15', '10:00:00', '17:00:00'
FROM users WHERE username = 'パート'
AND NOT EXISTS (
    SELECT 1 FROM shifts WHERE user_id = (SELECT id FROM users WHERE username = 'パート') 
    AND shift_date = '2026-01-15'
);

INSERT INTO shifts (user_id, shift_date, start_time, end_time)
SELECT id, '2026-01-15', '14:00:00', '19:30:00'
FROM users WHERE username = '社員'
AND NOT EXISTS (
    SELECT 1 FROM shifts WHERE user_id = (SELECT id FROM users WHERE username = '社員') 
    AND shift_date = '2026-01-15'
);
