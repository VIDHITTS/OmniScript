import { Router } from "express";
import { AuthController } from "./auth.controller";

const router = Router();
const authController = new AuthController();

// Map route to controller action
router.post("/signup", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);

export default router;
