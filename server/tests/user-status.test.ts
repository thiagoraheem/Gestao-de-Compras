// @ts-ignore
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { registerAuthRoutes } from '../routes/auth';
import { storage } from '../storage';
import bcrypt from 'bcryptjs';

// Mock storage
jest.mock('../storage', () => ({
  storage: {
    getUserByUsername: jest.fn(),
    getUser: jest.fn(),
    getCompanyById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
  },
}));

// Mock config
jest.mock('../config', () => ({
  isEmailEnabled: jest.fn().mockReturnValue(false),
}));

// Mock file storage service
jest.mock('../services/file-storage-service', () => ({
  fileStorageService: {
    buildCompanyLogoProxyUrl: jest.fn(),
  }
}));

const app = express();
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
}));
registerAuthRoutes(app);

describe('User Status Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should block login for inactive users', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const inactiveUser = {
      id: 1,
      username: 'inactive_user',
      password: hashedPassword,
      isActive: false,
    };

    (storage.getUserByUsername as jest.Mock).mockResolvedValue(inactiveUser);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'inactive_user', password: 'password123' });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/Usuário inativo/i);
  });

  it('should allow login for active users', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const activeUser = {
      id: 2,
      username: 'active_user',
      password: hashedPassword,
      isActive: true,
    };

    (storage.getUserByUsername as jest.Mock).mockResolvedValue(activeUser);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'active_user', password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body.username).toBe('active_user');
    expect(response.body.isActive).toBe(true);
  });
});
