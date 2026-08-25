import { Router } from "express";
import { healthRouter } from "./health.js";
import { conversationRouter } from "./conversation.routes.js";
import { customerRouter } from "./customer.routes.js";
import { followupRouter } from "./followup.routes.js";
import { notificationRouter } from "./notification.routes.js";
import { recordingRouter } from "./recording.routes.js";
import { rulesRouter } from "./rules.routes.js";
import { salesmanRouter } from "./salesman.routes.js";

export const router = Router();

router.use(healthRouter);
router.use("/recordings", recordingRouter);
router.use("/conversations", conversationRouter);
router.use("/rules", rulesRouter);
router.use("/salesmen", salesmanRouter);
router.use("/followups", followupRouter);
router.use("/customers", customerRouter);
router.use("/notifications", notificationRouter);
