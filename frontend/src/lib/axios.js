import axios from "axios";

const BASE_URL =
  import.meta.env.MODE === "production" ? "/api" : "http://localhost:5001/api";
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

api.interceptors.response.use(undefined, (error) => {
  if (
    error.response?.status === 401 &&
    !error.config?.url?.includes("/auth/")
  ) {
    window.location.assign("/login");
  }
  return Promise.reject(error);
});

export default api;
