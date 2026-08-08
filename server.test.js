const request = require("supertest");
const request = require("supertest");
const { app, pool } = require("./server");

describe("POST /api Integration Tests", () => {

    afterAll(async () => {
        await pool.end();
    });

    it("should return status 400 when required fields are missing", async () => {
        const response = await request(app)
            .post("/api")
            .send({ sleep: "23:00" });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({ error: "Missing fields" });
    });

    it("should save habit data to database and return status 200", async () => {
        const response = await request(app)
            .post("/api")
            .send({
                study: true,
                sport: true,
                sleep: "22:30",
                wakeup: "06:30"
            });

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ message: "Saved successfully" });

        const [rows] = await pool.execute("SELECT * FROM habits WHERE sleep = ? AND wakeup = ?", ["22:30", "06:30"]);
        expect(rows.length).toBeGreaterThan(0);
    });
});