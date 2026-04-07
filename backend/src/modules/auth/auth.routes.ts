import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { registerSchema, loginSchema } from "./auth.validation";

const router = Router();
const authController = new AuthController();

// Public routes — validation middleware handles Zod parsing
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", authController.refresh);

// Protected routes — require authentication
router.post("/logout", authenticateToken, authController.logout);

export default router;
