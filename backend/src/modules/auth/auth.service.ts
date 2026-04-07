import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { redis } from "../../lib/redis";

export class AuthService {
  /**
   * Registers a new user and returns the user payload alongside a JWT.
   */
  public async registerUser(email: string, password: string, fullName: string) {
    // 1. Check if the user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError(409, "User already exists with this email.");
    }

    // 2. Hash the password before saving
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Create the user in the database
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
      },
      select: { id: true, email: true, fullName: true, createdAt: true },
    });

    // 4. Generate JWT
    const { accessToken, refreshToken } = this.generateTokens(
      newUser.id,
      newUser.email,
    );
    await this.storeRefreshToken(newUser.id, refreshToken);

    return { user: newUser, accessToken, refreshToken };
  }

  /**
   * Authenticates a user and returns the user payload alongside a JWT.
   */
  public async loginUser(email: string, password: string) {
    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new AppError(401, "Invalid email or password.");
    }

    // 2. Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError(401, "Invalid email or password.");
    }

    // 3. Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // 4. Generate JWT
    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      user.email,
    );
    await this.storeRefreshToken(user.id, refreshToken);

    const safeUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
    };
    return { user: safeUser, accessToken, refreshToken };
  }

  public async refreshUserToken(oldRefreshToken: string) {
    try {
      const decoded = jwt.verify(oldRefreshToken, env.JWT_REFRESH_SECRET) as {
        userId: string;
        email: string;
      };

      const storedToken = await redis.get(`refresh_token:${decoded.userId}`);
      if (storedToken !== oldRefreshToken) {
        throw new AppError(401, "Invalid or expired refresh token");
      }

      const { accessToken, refreshToken } = this.generateTokens(
        decoded.userId,
        decoded.email,
      );
      await this.storeRefreshToken(decoded.userId, refreshToken);

      return { accessToken, refreshToken };
    } catch (error) {
      throw new AppError(401, "Invalid or expired refresh token");
    }
  }

  public async logoutUser(userId: string) {
    await redis.del(`refresh_token:${userId}`);
  }

  private generateTokens(userId: string, email: string) {
    const accessToken = jwt.sign({ userId, email }, env.JWT_SECRET, {
      expiresIn: "15m",
    });
    const refreshToken = jwt.sign({ userId, email }, env.JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string) {
    await redis.set(`refresh_token:${userId}`, token, "EX", 7 * 24 * 60 * 60);
  }
}
