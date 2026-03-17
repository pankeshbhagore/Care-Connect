import { io } from "socket.io-client";
const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";
const socket = io(BACKEND, {
  transports:["websocket","polling"],
  withCredentials:true,
  autoConnect:true,
  reconnection:true,
  reconnectionAttempts:Infinity,
  reconnectionDelay:1000,
  reconnectionDelayMax:10000,
  timeout:20000,
});
socket.on("connect", () => console.log("[Socket] Connected:", socket.id));
socket.on("disconnect", reason => { console.log("[Socket] Disconnected:", reason); });
socket.on("reconnect", attempt => { console.log("[Socket] Reconnected after", attempt, "attempts"); });
socket.on("reconnect_attempt", attempt => { if(attempt===1) console.log("[Socket] Reconnecting…"); });
socket.on("connect_error", err => { console.warn("[Socket] Connection error:", err.message); });
export default socket;
