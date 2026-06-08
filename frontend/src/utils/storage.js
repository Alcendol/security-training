// Secure storage utilities — only store non-sensitive display data

// Store minimal, non-sensitive user data for UI display purposes only
export const setUserData = (user) => {
  // Only store non-sensitive fields needed for UI
  const safeData = {
    id: user.id,
    name: user.name,
    role: user.role,
  };
  localStorage.setItem("user", JSON.stringify(safeData));
};

export const getUserData = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

export const clearUserData = () => {
  // Clear all stored data to prevent data leakage
  localStorage.clear();
  sessionStorage.clear();
};
