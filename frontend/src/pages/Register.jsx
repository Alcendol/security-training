import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/api';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'Contains uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Contains lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Contains a number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'Contains special character (!@#$%^&*)', test: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
];

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Compute which rules pass and overall validity
  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(formData.password) })),
    [formData.password],
  );
  const isPasswordValid = passwordChecks.every((r) => r.passed);
  const passedCount = passwordChecks.filter((r) => r.passed).length;

  // Strength label
  const strengthLabel = passedCount <= 1 ? 'Weak' : passedCount <= 3 ? 'Fair' : passedCount <= 4 ? 'Good' : 'Strong';
  const strengthColor = passedCount <= 1 ? 'bg-red-500' : passedCount <= 3 ? 'bg-yellow-500' : passedCount <= 4 ? 'bg-blue-500' : 'bg-green-500';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isPasswordValid) {
      setError('Password does not meet the requirements.');
      return;
    }

    try {
      await register(formData.email, formData.password, formData.name);
      setSuccess('Registration successful! Redirecting to login...');
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError('Registration failed');
      if (process.env.NODE_ENV === "development") {
        console.error('Registration error:', err);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SecureTask</h1>
        </div>

        <h2 className="text-2xl font-semibold mb-6 text-center">Register</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
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
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              required
              minLength={8}
            />

            {/* Password strength indicator */}
            {formData.password.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Strength:</span>
                  <span className={`text-xs font-semibold ${passedCount <= 1 ? 'text-red-600' : passedCount <= 3 ? 'text-yellow-600' : passedCount <= 4 ? 'text-blue-600' : 'text-green-600'}`}>
                    {strengthLabel}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${strengthColor}`}
                    style={{ width: `${(passedCount / PASSWORD_RULES.length) * 100}%` }}
                  />
                </div>
                <ul className="mt-2 space-y-1">
                  {passwordChecks.map((rule, i) => (
                    <li key={i} className={`text-xs flex items-center gap-1 ${rule.passed ? 'text-green-600' : 'text-gray-400'}`}>
                      <span>{rule.passed ? '✓' : '○'}</span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!isPasswordValid && formData.password.length > 0}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Register
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/login" className="text-blue-500 hover:underline">
            Already have an account? Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
