import { insertUserSchema } from '../../shared/schema';

describe('User Schema Validation', () => {
  it('should allow undefined isActive (db default true)', () => {
    const validUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    };

    const parsed = insertUserSchema.parse(validUser);
    expect(parsed.isActive).toBeUndefined();
  });

  it('should accept isActive as false', () => {
    const inactiveUser = {
      username: 'inactive',
      email: 'inactive@example.com',
      password: 'password123',
      isActive: false,
    };

    const parsed = insertUserSchema.parse(inactiveUser);
    expect(parsed.isActive).toBe(false);
  });
});
