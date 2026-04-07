import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { env } from "../../config/env";

/**
 * AuthController — HTTP layer for authentication endpoints.
 *
 * Design: Controllers handle HTTP concerns only (parse request, call service,
 * format response). All business logic lives in AuthService.
 * Validation is handled by middleware, so req.body is already typed.
 */
export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /** Cookie options for refresh tokens. */
  private readonly cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  };

  /**
   * POST /api/auth/register
   * Creates a user and sets a secure refresh token cookie.
   */
  public register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password, fullName } = req.body;

      const { user, accessToken, refreshToken } =
        await this.authService.registerUser(email, password, fullName);

      res.cookie("refreshToken", refreshToken, this.cookieOptions);

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
   * POST /api/auth/login
   * Authenticates a user and sets a secure refresh token cookie.
   */
  public login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password } = req.body;

      const { user, accessToken, refreshToken } =
        await this.authService.loginUser(email, password);

      res.cookie("refreshToken", refreshToken, this.cookieOptions);

      res.status(200).json({
        message: "Login successful",
        user,
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/refresh
   * Rotates the refresh token and returns a new access token.
   */
  public refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const oldRefreshToken = req.cookies?.refreshToken;
      if (!oldRefreshToken) {
        res.status(401).json({ error: "No refresh token provided", statusCode: 401 });
        return;
      }

      const { accessToken, refreshToken } =
        await this.authService.refreshUserToken(oldRefreshToken);

      res.cookie("refreshToken", refreshToken, this.cookieOptions);

      res.status(200).json({ accessToken });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/logout
   * Invalidates the refresh token in Redis and clears the cookie.
   */
  public logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Use the authenticated user's ID to invalidate the Redis token
      const userId = req.user?.userId;
      if (userId) {
        await this.authService.logoutUser(userId);
      }

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
