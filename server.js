require("dotenv").config();
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const jwt = require('jsonwebtoken');
const cors = require('cors');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
})

function authenticateToken(req, res, next) {
  if (process.env.NODE_ENV === 'test') {
    req.user = { username: 'test_user' };
    return next();
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'authentication faild' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'authentication faild' });
    }

    req.user = user;
    next();
  });
}
    
const SECRET_KEY = process.env.SECRET_KEY;

async function my_database(data) {
    let study = data.study === "true";
    let sport = data.sport === "true";
    const sql = 'INSERT INTO habits (study, sport , sleep , wakeup) VALUES (?, ?, ? , ?)';
    const values = [study, sport , data.sleep , data.wakeup];
    const [result] = await pool.execute(sql, values);
}
const app = express();


app.use(express.json());
app.use(cors());

const users = [
  { username: 'ahmad', password: '123' },
  { username: 'ali', password: '456' }
];

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "front-end", "login.html"));
});

app.get("/index.html", (req, res) => {
    res.sendFile(path.join(__dirname, "front-end", "index.html"));
});
app.get("/style.css" , (req,res) => {
    res.sendFile(path.join(__dirname,"front-end" , "style.css"))
})

app.post('/login', (req, res) => {

  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    console.log("not found user")
    return res.status(401).json({ message: 'error in password or username' });
  }

  const token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});


app.post("/api", authenticateToken, async (req, res) => {
    const data = req.body; 
    if (data.sport === undefined || data.study === undefined || !data.sleep || !data.wakeup) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        await my_database(data);
        res.status(200).json({ message: "Saved successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.error("Database Error:", error.message);
    }
});

module.exports = { app  , pool};

if (require.main === module) {
    app.listen(3000, () => console.log("Server running on port 3000"));
}
