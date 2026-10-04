import { Router, type IRouter } from "express";
import {
  GetSignalxStateResponse,
  TriggerSignalxScanResponse,
} from "@workspace/api-zod";
import {
  getRecentSignalxSignals,
  getScannerStatus,
  scannerConfig,
  startSignalxScan,
} from "../lib/signalx-scanner";

const router: IRouter = Router();

router.get("/signalx/state", async (_req, res): Promise<void> => {
  const signals = await getRecentSignalxSignals();
  const response = GetSignalxStateResponse.parse({
    state: getScannerStatus(),
    config: scannerConfig,
    signals: signals.map((signal) => ({
      ...signal,
      createdAt: signal.createdAt.toISOString(),
      reasons: signal.reasons,
    })),
  });
  res.json(response);
});

router.post("/signalx/scan", (_req, res): void => {
  const started = startSignalxScan();
  const response = TriggerSignalxScanResponse.parse({
    accepted: started,
    scanInProgress: true,
    message: started ? "Market scan started." : "A market scan is already running.",
  });
  res.status(202).json(response);
});

export default router;