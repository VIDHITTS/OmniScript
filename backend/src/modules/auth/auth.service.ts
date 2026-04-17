import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import crypto from "crypto";

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

      // Hash the token to compare with stored hash
      const hashedToken = crypto
        .createHash("sha256")
        .update(oldRefreshToken)
        .digest("hex");

      // Find the stored token in PostgreSQL
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          userId: decoded.userId,
          token: hashedToken,
          expiresAt: { gte: new Date() },
        },
      });

      if (!storedToken) {
        throw new AppError(401, "Invalid or expired refresh token");
      }

      // Delete the old token
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      // Generate and store new tokens
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
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  private generateTokens(userId: string, email: string) {
    const accessToken = jwt.sign({ userId, email }, env.JWT_SECRET, {
      expiresIn: "2h",
    });
    const refreshToken = jwt.sign({ userId, email }, env.JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string) {
    // Hash the token before storing
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Store in PostgreSQL with 7-day expiration
    await prisma.refreshToken.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }
}
