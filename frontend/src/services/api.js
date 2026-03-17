import axios from "axios";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "http://localhost:5000/api",
  withCredentials:true,
  timeout:15000,
});
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if(token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// Auto-retry on network error (Edge case #4)
api.interceptors.response.use(
  res => res,
  async err => {
    const config = err.config;
    if (err.code === "ERR_NETWORK" && !config.__retried && config.method === "get") {
      config.__retried = true;
      await new Promise(r => setTimeout(r, 2000));
      return api(config);
    }
    return Promise.reject(err);
  }
);
export default api;
