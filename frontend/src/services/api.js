import axios from "axios";
import { API_BASE_URL } from "../config";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor — only log in development
api.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV === "development") {
      console.log("API Request:", config.method, config.url);
    }
    return config;
  },
  (error) => {
    if (process.env.NODE_ENV === "development") {
      console.error("Request Error:", error);
    }
    return Promise.reject(error);
  },
);

// Response interceptor — only log in development
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (process.env.NODE_ENV === "development") {
      console.error("Response Error:", error.response?.status);
    }
    return Promise.reject(error);
  },
);

// Auth APIs
export const register = (email, password, name) => {
  return api.post("/auth/register", { email, password, name });
};

export const login = (email, password) => {
  return api.post("/auth/login", { email, password });
};

// Task APIs
export const getTasks = () => {
  return api.get("/tasks");
};

export const createTask = (taskData) => {
  return api.post("/tasks", taskData);
};

export const updateTask = (id, taskData) => {
  return api.put(`/tasks/${id}`, taskData);
};

export const deleteTask = (id) => {
  return api.delete(`/tasks/${id}`);
};

// Search with parameterized query (safe from injection)
export const searchTasks = (searchTerm) => {
  return api.get("/tasks/search", {
    params: { q: searchTerm },
  });
};

// User APIs
export const getCurrentUser = () => {
  return api.get("/users/me");
};

export const updateProfile = (userId, profileData) => {
  return api.put(`/users/${userId}/profile`, profileData);
};

// Admin endpoint — server-side authorization enforced
export const getAllUsers = () => {
  return api.get("/admin/users");
};

export default api;
