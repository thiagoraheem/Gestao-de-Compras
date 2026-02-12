
// @ts-nocheck
import { isAdmin } from '../routes/middleware';
import { storage } from '../storage';

// Mock storage
jest.mock('../storage', () => ({
  storage: {
    getUser: jest.fn(),
  },
}));

describe('Middleware: isAdmin', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      session: { userId: 1 },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should call next() if user is admin', async () => {
    (storage.getUser as jest.Mock).mockResolvedValue({ id: 1, isAdmin: true });

    await isAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 if user is not admin', async () => {
    (storage.getUser as jest.Mock).mockResolvedValue({ id: 1, isAdmin: false });

    await isAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/access required/i) }));
  });

  it('should return 401 if not authenticated (no userId)', async () => {
    req.session.userId = undefined;

    await isAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 404 if user not found', async () => {
    (storage.getUser as jest.Mock).mockResolvedValue(null);

    await isAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
