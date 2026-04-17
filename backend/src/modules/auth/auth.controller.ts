import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";

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

  /**
   * POST /api/auth/register
   * Creates a user and returns a JWT token with 7-day expiry.
   */
  public register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password, fullName } = req.body;

      const { user, accessToken } =
        await this.authService.registerUser(email, password, fullName);

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
   * Authenticates a user and returns a JWT token with 7-day expiry.
   */
  public login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password } = req.body;

      const { user, accessToken } =
        await this.authService.loginUser(email, password);

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
   * POST /api/auth/logout
   * Logout is handled client-side by removing the JWT token.
   * This endpoint exists for API compatibility and future audit logging.
   */
  public logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (userId) {
        await this.authService.logoutUser(userId);
      }

      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  };
}
