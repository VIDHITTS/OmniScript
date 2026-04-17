/**
 * Integration test for AuthService with PostgreSQL token storage
 * 
 * **Validates: Requirements 2.2, 3.1, 3.2, 3.3, 3.4**
 * 
 * This test verifies that AuthService correctly stores and retrieves
 * refresh tokens from PostgreSQL instead of Redis.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthService } from './auth.service';
import { prisma } from '../../config/db';

describe('AuthService Integration - PostgreSQL Token Storage', () => {
  const authService = new AuthService();
  let testUserId: string;
  let testEmail: string;
  let refreshToken: string;

  beforeAll(async () => {
    // Clean up any existing test users
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-auth-' } },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  it('should register user and store refresh token in PostgreSQL', async () => {
    // **Validates: Requirements 3.1, 3.2**
    testEmail = `test-auth-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    const fullName = 'Test User';

    const result = await authService.registerUser(testEmail, password, fullName);

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(testEmail);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();

    testUserId = result.user.id;
    refreshToken = result.refreshToken;

    // Verify token is stored in PostgreSQL
    const storedTokens = await prisma.refreshToken.findMany({
      where: { userId: testUserId },
    });

    expect(storedTokens.length).toBe(1);
    expect(storedTokens[0].userId).toBe(testUserId);
    expect(storedTokens[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should login user and store refresh token in PostgreSQL', async () => {
    // **Validates: Requirements 3.1, 3.2**
    const password = 'TestPassword123!';

    const result = await authService.loginUser(testEmail, password);

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(testEmail);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();

    // Verify new token is stored (should have 2 tokens now)
    const storedTokens = await prisma.refreshToken.findMany({
      where: { userId: testUserId },
    });

    expect(storedTokens.length).toBe(2);
  });

  it('should refresh token using PostgreSQL storage', async () => {
    // **Validates: Requirements 3.3**
    const result = await authService.refreshUserToken(refreshToken);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();

    // Verify old token is deleted and new token is stored
    const storedTokens = await prisma.refreshToken.findMany({
      where: { userId: testUserId },
    });

    // Should still have 2 tokens (1 from login, 1 new from refresh - old refresh token deleted)
    expect(storedTokens.length).toBe(2);
    
    // Update refreshToken for subsequent tests
    refreshToken = result.refreshToken;
  });

  it('should reject expired or invalid refresh token', async () => {
    // **Validates: Requirements 3.3**
    const invalidToken = 'invalid-token-12345';

    await expect(authService.refreshUserToken(invalidToken)).rejects.toThrow(
      'Invalid or expired refresh token'
    );
  });

  it('should logout user and delete all refresh tokens from PostgreSQL', async () => {
    // **Validates: Requirements 3.4**
    await authService.logoutUser(testUserId);

    // Verify all tokens are deleted
    const storedTokens = await prisma.refreshToken.findMany({
      where: { userId: testUserId },
    });

    expect(storedTokens.length).toBe(0);
  });

  it('should reject refresh token after logout', async () => {
    // **Validates: Requirements 3.3, 3.4**
    // Try to use the refresh token after logout
    await expect(authService.refreshUserToken(refreshToken)).rejects.toThrow(
      'Invalid or expired refresh token'
    );
  });
});
