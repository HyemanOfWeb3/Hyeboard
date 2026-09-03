import { useState } from "react";
import { Link, useNavigate } from "react-router";
import api from "../lib/axios";
import { useAuth } from "../lib/useAuth";
import { AuthPage } from "./LoginPage";

const SignupPage = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < 8)
      return setError("Password must be at least 8 characters");
    setLoading(true);
    try {
      const response = await api.post("/auth/signup", { email, password });
      setUser(response.data.user);
      navigate("/", { replace: true });
    } catch (requestError) {
      const status = requestError.response?.status;
      setError(
        status === 409
          ? "An account with this email already exists."
          : status === 503
            ? "Sign-up is temporarily unavailable. Please try again later."
            : status === 400
              ? requestError.response?.data?.message || "Check your email and password."
              : "Unable to create your account right now. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthPage
      title="Make room for ideas."
      subtitle="A quieter place to think clearly."
      onSubmit={submit}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      loading={loading}
      error={error}
      footer={
        <span>
          Already have an account? <Link to="/login">Log in</Link>
        </span>
      }
    />
  );
};

export default SignupPage;
