import { io } from "socket.io-client";
const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";
const socket = io(BACKEND, { transports:["websocket","polling"], withCredentials:true, autoConnect:true, reconnection:true, reconnectionAttempts:10, reconnectionDelay:1000 });
export default socket;
