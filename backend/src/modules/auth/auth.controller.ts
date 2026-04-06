import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.validation";
import { env } from "../../config/env";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Post /api/auth/register
   * Creates a user and sets a secure JWT cookie.
   */
  public register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password, fullName } = registerSchema.parse(req.body);

      // Execute business logic via service
      const { user, accessToken, refreshToken } =
        await this.authService.registerUser(email, password, fullName);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      });

      res.status(201).json({
        message: "User registered successfully",
        user,
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Post /api/auth/login
   * Authenticates a user and sets a secure JWT cookie.
   */
  public login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Execute login logic via service
      const { user, accessToken, refreshToken } =
        await this.authService.loginUser(email, password);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      });

      res.status(200).json({
        message: "Login successful",
        user,
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const oldRefreshToken = req.cookies?.refreshToken;
      if (!oldRefreshToken) {
        res.status(401).json({ error: "No refresh token provided" });
        return;
      }

      const { accessToken, refreshToken } =
        await this.authService.refreshUserToken(oldRefreshToken);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      });

      res.status(200).json({ accessToken });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Post /api/auth/logout
   * Clears the HTTP-Only JWT cookie to sign the user out.
   */
  public logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Attempt to clear from redis using service if token provided? Actually we need userId, can use req.user.id if available.
      // But for now, just clear the cookie

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  };
}
