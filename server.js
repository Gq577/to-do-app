require("dotenv").config();
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "v2",
    waitForConnections: true,
    connectionLimit: 10
});

const SECRET_KEY = process.env.SECRET_KEY;

// ميدلوير التوثيق محمي وبدون الثغرة الأمنية
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

async function my_database(user_id, data) {
    const sql = 'INSERT IGNORE INTO habits (user_id, title) VALUES (?, ?)';
    const [result] = await pool.execute(sql, [user_id, data]);
    return result;
}

async function get_user(username) {
    const sql = 'SELECT id, username, password_hash FROM users WHERE username = ?';
    const [result] = await pool.execute(sql, [username]);
    return result;
}

async function insert_user(username, passwordHash) {
    const sql = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';
    const [result] = await pool.execute(sql, [username, passwordHash]);
    return result;
}

async function get_habit_id(user_id, habit) {
    const sql = 'SELECT id FROM habits WHERE title = ? AND user_id = ?';
    const [result] = await pool.execute(sql, [habit, user_id]);
    return result;
}

async function insert_into_habits_log(habit_id, log_date, is_completed) {
    const sql = `
        INSERT INTO habit_logs (habit_id, log_date, is_completed) 
        VALUES (?, ?, ?) 
        ON DUPLICATE KEY UPDATE is_completed = VALUES(is_completed)
    `;
    const [result] = await pool.execute(sql, [habit_id, log_date, is_completed]);
    return result;
}

async function get_habits_with_logs(user_id) {
    const query = `
        SELECT h.id as habit_id, h.title, l.log_date, l.is_completed 
        FROM habits h 
        LEFT JOIN habit_logs l ON h.id = l.habit_id 
        WHERE h.user_id = ? 
    `;
    const [result] = await pool.execute(query, [user_id]);
    return result;
}

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "front-end")));

app.get("/api/habits2", authenticateToken, async (req, res) => {
    try {
        const data = await get_habits_with_logs(req.user.id);
        res.status(200).json(data);
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const users = await get_user(username);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/sign-in", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        await insert_user(username, passwordHash);
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/habits", authenticateToken, async (req, res) => {
    const data = req.body;
    try {
        if (data.habits) {
            for (const element of data.habits) {
                await my_database(req.user.id, element.name);
                const habit_id = await get_habit_id(req.user.id, element.name);
                if (habit_id.length > 0) {
                    const currentDate = new Date().toISOString().split("T")[0];
                    await insert_into_habits_log(habit_id[0].id, currentDate, element.completed);
                }
            }
        }

        if (data.logsHistory) {
            for (const [dateKey, habitsObj] of Object.entries(data.logsHistory)) {
                for (const [habitName, isCompleted] of Object.entries(habitsObj)) {
                    await my_database(req.user.id, habitName);
                    const habit_id = await get_habit_id(req.user.id, habitName);
                    if (habit_id.length > 0) {
                        await insert_into_habits_log(habit_id[0].id, dateKey, isCompleted);
                    }
                }
            }
        }

        res.status(200).json({ message: "Saved successfully" });
    } catch (error) {
        console.error("Save Habits Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = { app, pool };

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}