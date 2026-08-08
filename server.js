require("dotenv").config();
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

    const pool = mysql.createPool({
        host: process.env.DB_host,
        user: process.env.DB_user,
        password: process.env.DB_password,
        database: process.env.DB_data_base_name,
        waitForConnections: true,
        connectionLimit: 10
    })
    

async function my_database(data) {
    let study = data.study === "true";
    let sport = data.sport === "true";
    try {
        const sql = 'INSERT INTO habits (study, sport , sleep , wakeup) VALUES (?, ?, ? , ?)';
        const values = [study, sport , data.sleep , data.wakeup];
        const [result] = await pool.execute(sql, values);

        console.log("good" , result.insertId);
  } catch (error) {
        console.log(error)
  }
}
const app = express();


app.use(express.json());

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "front-end", "index.html"));
});

app.get("/style.css" , (req,res) => {
    res.sendFile(path.join(__dirname,"front-end" , "style.css"))
})
app.post("/api", async (req, res) => {
    const data = req.body;
    
    
    if (data.sport === undefined || data.study === undefined || !data.sleep || !data.wakeup) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        await my_database(data);
        res.status(200).json({ message: "Saved successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = { app  , pool};

if (require.main === module) {
    app.listen(3000, () => console.log("Server running on port 3000"));
}