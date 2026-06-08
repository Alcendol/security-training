import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../services/api";
import { setUserData } from "../utils/storage";

function Login({ setAuth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await login(email, password);

      // VULNERABILITY #5: Storing token in localStorage (vulnerable to XSS)
      // setToken(response.data.token);

      // VULNERABILITY #5: Storing full user object including password
      const user = response.data.user;
      setUserData({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
      // setUserData(response.data.user);

      // VULNERABILITY: Storing sensitive debug info
      // saveDebugInfo({
      //   action: 'login',
      //   email: email,
      //   timestamp: new Date(),
      //   userAgent: navigator.userAgent
      // });

      setAuth(true);
      navigate("/dashboard");
    } catch (err) {
      // VULNERABILITY: Exposing detailed error messages
      // setError(err.response?.data?.error || "Login failed");
      // console.error("Login error:", err.response?.data);
      setError("Login failed")
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SecureTask</h1>
        </div>

        <h2 className="text-2xl font-semibold mb-6 text-center">Login</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200"
          >
            Login
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/register" className="text-blue-500 hover:underline">
            Don't have an account? Register
          </Link>
        </div>


      </div>
    </div>
  );
}

export default Login;
