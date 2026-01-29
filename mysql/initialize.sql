SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;
SET CHARACTER_SET_CONNECTION = utf8mb4;
SET CHARACTER_SET_RESULTS = utf8mb4;

DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY, 
    username VARCHAR(255) UNIQUE, 
    user_role VARCHAR(20) NOT NULL
);

INSERT INTO users (username, user_role) VALUES ('admin', 'admin');

CREATE TABLE shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    shift_date DATE,
    start_time TIME,
    end_time TIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
