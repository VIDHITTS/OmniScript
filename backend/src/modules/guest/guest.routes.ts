import { Router } from "express";
import { GuestController } from "./guest.controller";
import {
  handleGuestSession,
  checkGuestDocumentLimit,
  checkGuestQueryLimit,
} from "../../middleware/guest.middleware";
import multer from "multer";
import path from "path";

const router = Router();
const guestController = new GuestController();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// All guest routes use guest session middleware
router.use(handleGuestSession);

// Get guest session info
router.get("/session", guestController.getSession);

// Upload document (with limit check)
router.post(
  "/upload",
  checkGuestDocumentLimit,
  upload.single("file"),
  guestController.uploadDocument
);

// Send chat message (with limit check)
router.post("/chat", checkGuestQueryLimit, guestController.sendMessage);

// Get chat messages
router.get("/messages/:chatSessionId", guestController.getMessages);

export default router;
