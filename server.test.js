const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// 1. Mocking the database module to avoid requiring a running MySQL server during testing
const mockExecute = jest.fn();
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => ({
    execute: mockExecute,
  })),
}));

// Set environment variable for testing
process.env.SECRET_KEY = 'test_secret_key';
const { app } = require('./server');

describe('API Integration Tests (Authentication & Habits System)', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------
  // Sign-Up / User Registration Tests
  // ----------------------------------------------------
  describe('POST /api/sign-in', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/sign-in')
        .send({ username: 'user_only' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Username and password are required');
    });

    it('should create a new account successfully and return 201', async () => {
      mockExecute.mockResolvedValueOnce([{ insertId: 1 }]);

      const res = await request(app)
        .post('/api/sign-in')
        .send({ username: 'newuser', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User registered successfully');
    });
  });

  // ----------------------------------------------------
  // Login Tests
  // ----------------------------------------------------
  describe('POST /api/login', () => {
    it('should return 401 if the username does not exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]); // Database returns an empty array

      const res = await request(app)
        .post('/api/login')
        .send({ username: 'unknown_user', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should return 200 and a JWT token given valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockExecute.mockResolvedValueOnce([
        [{ id: 1, username: 'testuser', password_hash: hashedPassword }]
      ]);

      const res = await request(app)
        .post('/api/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });
  });

  // ----------------------------------------------------
  // Protected Routes Tests
  // ----------------------------------------------------
  describe('GET /api/habits2', () => {
    it('should reject request and return 401 if no token is provided', async () => {
      const res = await request(app).get('/api/habits2');
      expect(res.status).toBe(401);
    });

    it('should reject request and return 403 if the token is invalid', async () => {
      const res = await request(app)
        .get('/api/habits2')
        .set('Authorization', 'Bearer invalid_token_123');

      expect(res.status).toBe(403);
    });

    it('should authorize request and return data when a valid test token is provided', async () => {
      // Create a valid JWT token specifically for this test run
      const testToken = jwt.sign({ id: 1, username: 'testuser' }, process.env.SECRET_KEY);
      
      const mockHabits = [
        { habit_id: 1, title: 'Exercise', log_date: '2026-03-01', is_completed: 1 }
      ];
      mockExecute.mockResolvedValueOnce([mockHabits]);

      const res = await request(app)
        .get('/api/habits2')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockHabits);
    });
  });

});