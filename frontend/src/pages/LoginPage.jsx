import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import api from "../lib/axios";
import { useAuth } from "../lib/useAuth";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password)
      return setError("Email and password are required");
    setLoading(true);
    try {
      const response = await api.post("/auth/login", { email, password });
      setUser(response.data.user);
      navigate(location.state?.from || "/", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not log in. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthPage
      title="Welcome back."
      subtitle="Your ideas are waiting."
      onSubmit={submit}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      loading={loading}
      error={error}
      footer={
        <span>
          New to HyeBoard? <Link to="/signup">Create an account</Link>
        </span>
      }
    />
  );
};

export function AuthPage({
  title,
  subtitle,
  onSubmit,
  email,
  setEmail,
  password,
  setPassword,
  loading,
  error,
  footer,
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          HyeBoard<span>.</span>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">Personal workspace</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              minLength="8"
              required
            />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button auth-submit" disabled={loading}>
            {loading ? "Please wait..." : "Continue"}
          </button>
        </form>
        <div className="auth-footer">{footer}</div>
      </section>
    </main>
  );
}

export default LoginPage;
