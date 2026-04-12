import { Router } from "express";
import { GuestController } from "./guest.controller";
import { handleGuestSession } from "../../middleware/guest.middleware";

const router = Router();
const guestController = new GuestController();

// All guest routes use guest session middleware
router.use(handleGuestSession);

// Get guest session info
router.get("/session", guestController.getSession);

export default router;
