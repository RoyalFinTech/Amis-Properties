import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { env } from "./config/env";
import { createApp } from "./app";

// Ensure the local uploads directory exists (used until Cloudinary is configured).
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: env.CLIENT_ORIGIN, credentials: true },
});
app.set("io", io);

io.on("connection", (socket) => {
  socket.on("join", (conversationId: string) => socket.join(conversationId));

  socket.on("message:send", (payload: { conversationId: string; body: string }) => {
    io.to(payload.conversationId).emit("message:new", payload);
  });

  socket.on("typing", (payload: { conversationId: string; userId: string }) => {
    socket.to(payload.conversationId).emit("typing", payload);
  });
});

httpServer.listen(env.PORT, () => {
  console.log(`🏡 AMI'S PROPERTIES API running on http://localhost:${env.PORT}`);
  console.log(`📖 API docs at http://localhost:${env.PORT}/api/docs`);
});
