import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

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

    // 4. Generate JWT with 7-day expiry
    const accessToken = this.generateToken(newUser.id, newUser.email);

    return { user: newUser, accessToken };
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

    // 4. Generate JWT with 7-day expiry
    const accessToken = this.generateToken(user.id, user.email);

    const safeUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
    };
    return { user: safeUser, accessToken };
  }

  public async logoutUser(userId: string) {
    // No-op: JWT is stateless, logout is handled client-side by removing the token
    // This method exists for API compatibility and future audit logging
    return { success: true };
  }

  private generateToken(userId: string, email: string) {
    return jwt.sign({ userId, email }, env.JWT_SECRET, {
      expiresIn: "7d",
    });
  }
}
