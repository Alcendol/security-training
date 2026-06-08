// API configuration — uses environment variable with fallback for local dev
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

export const APP_CONFIG = {
  name: "SecureTask",
  version: "1.0.0",
};
