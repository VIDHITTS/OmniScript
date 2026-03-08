import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/db";

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
      throw new Error("User already exists with this email.");
    }

    // 2. Hash the password before saving
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Create the user in the database
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
      },
    });

    // 4. Generate JWT
    const secret = process.env.JWT_SECRET || "fallback_super_secret_dev_key";
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      secret,
      { expiresIn: "7d" }, // Token lifespan
    );

    return { user: newUser, token };
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
      throw new Error('Invalid email or password.');
    }

    // 2. Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      throw new Error('Invalid email or password.');
    }

    // 3. Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // 4. Generate JWT
    const secret = process.env.JWT_SECRET || 'fallback_super_secret_dev_key';
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      secret,
      { expiresIn: '7d' } // Token lifespan
    );

    return { user, token };
  }
}
