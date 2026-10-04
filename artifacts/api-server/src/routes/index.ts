import { Router, type IRouter } from "express";
import healthRouter from "./health";
import signalxRouter from "./signalx";

const router: IRouter = Router();

router.use(healthRouter);
router.use(signalxRouter);

export default router;
