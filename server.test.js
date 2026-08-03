const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;
let app;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGO_URI = uri;
    
    app = require("./server.js").app;
});

afterAll(async () => {
    if (mongoServer) {
        await mongoServer.stop({ cleanup: true }); 
    }
});

describe("Habit Tracker API Tests", () => {
    test("GET / - Should return 200 OK", async () => {
        const response = await request(app).get("/");
        expect(response.statusCode).toBe(200);
    });

    test("POST /api - Should save habit data successfully", async () => {
        const habitData = {
            sport: "yes",
            study: "no",
            sleep: "23:00",
            wakeup: "07:00"
        };

        const response = await request(app)
            .post("/api")
            .send(habitData);

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe("Saved successfully");
    });

    test("POST /api - Should fail if data is missing", async () => {
        const incompleteData = { sport: "yes" };

        const response = await request(app)
            .post("/api")
            .send(incompleteData);

        expect(response.statusCode).toBe(400);
    });
});