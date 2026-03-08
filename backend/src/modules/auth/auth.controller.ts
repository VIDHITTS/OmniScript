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

  /**
   * Post /api/auth/login
   * Authenticates a user and sets a secure JWT cookie.
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Validate inputs
      if (!email || !password) {
        res.status(400).json({ message: "Missing required fields: email and password are required." });
        return;
      }

      // Execute login logic via service
      const { user, token } = await this.authService.loginUser(email, password);

      // Set JWT in HTTP-Only Cookie
      res.cookie("jwt", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, 
      });

      // Respond to client
      res.status(200).json({
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      });
    } catch (error: any) {
      if (error.message === "Invalid email or password.") {
        res.status(401).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error", error: error.message });
      }
    }
  };

  /**
   * Post /api/auth/logout
   * Clears the HTTP-Only JWT cookie to sign the user out.
   */
  public logout = async (req: Request, res: Response): Promise<void> => {
    try {
      res.clearCookie("jwt", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
      
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };
}
