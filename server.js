const express = require("express");
const path = require("path");
const { MongoClient } = require('mongodb');

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
    
    
    if (!data.sport || !data.study || !data.sleep || !data.wakeup) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        await database(data);
        res.status(200).json({ message: "Saved successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
async function database(data) {
    const url = process.env.MONGO_URI || 'mongodb://localhost:27017';
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db("habit");
    const collection = db.collection("day");
    await collection.insertOne({
        sport: data.sport,
        sleep: data.sleep,
        study: data.study,
        wakeup: data.wakeup
    });
}

module.exports = { app };

if (require.main === module) {
    app.listen(3000, () => console.log("Server running on port 3000"));
}