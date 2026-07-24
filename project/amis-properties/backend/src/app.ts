import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import path from "path";

import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { notFoundHandler, errorHandler } from "./middleware/error";

import authRoutes from "./routes/auth.routes";
import propertyRoutes from "./routes/property.routes";
import bookingRoutes from "./routes/booking.routes";
import favoriteRoutes from "./routes/favorite.routes";
import userRoutes from "./routes/user.routes";
import mediaRoutes from "./routes/media.routes";
import adminRoutes from "./routes/admin.routes";
import agentRoutes from "./routes/agent.routes";
import messageRoutes from "./routes/message.routes";
import contactRoutes from "./routes/contact.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  // Global rate limit — individual sensitive routes add their own tighter limits.
  app.use(rateLimit({ windowMs: 15 * 60_000, max: 300 }));

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/properties", propertyRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/favorites", favoriteRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/media", mediaRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/agent", agentRoutes);
  app.use("/api/conversations", messageRoutes);
  app.use("/api/contact", contactRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
