import { Request, Response } from "express";
import { AuthService } from "./auth.service";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Post /api/auth/register
   * Creates a user and sets a secure JWT cookie.
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, fullName } = req.body;

      // Validate inputs
      if (!email || !password || !fullName) {
        res
          .status(400)
          .json({
            message:
              "Missing required fields: email, password, and fullName are required.",
          });
        return;
      }

      // Execute business logic via service
      const { user, token } = await this.authService.registerUser(
        email,
        password,
        fullName,
      );

      // Set JWT in HTTP-Only Cookie
      res.cookie("jwt", token, {
        httpOnly: true, // Prevents XSS picking up the token
        secure: process.env.NODE_ENV === "production", // Requires HTTPS in production
        sameSite: "strict", // Protects against CSRF
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      });

      // Respond to client (excluding the password hash)
      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      });
    } catch (error: any) {
      if (error.message === "User already exists with this email.") {
        res.status(409).json({ message: error.message });
      } else {
        res
          .status(500)
          .json({ message: "Internal server error", error: error.message });
      }
    }
  };
}
