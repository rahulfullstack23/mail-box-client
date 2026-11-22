import { useState } from "react";
import { FIREBASE_API_KEY } from "../../firebaseConfig";
import "./Login.css";

const Login = () => {
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsLoading(true);

    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "LOGIN_FAILED");
      }

      localStorage.setItem("mailboxToken", data.idToken);
      localStorage.setItem("mailboxUid", data.localId);
      localStorage.setItem(
        "mailboxTokenExpiresAt",
        String(Date.now() + Number(data.expiresIn) * 1000),
      );
      localStorage.setItem("mailboxEmail", data.email);
      window.location.hash = "#welcome";
    } catch (err) {
      const errorMessages = {
        EMAIL_NOT_FOUND: "No account was found with that email address.",
        INVALID_PASSWORD: "Incorrect email or password.",
        INVALID_LOGIN_CREDENTIALS: "Incorrect email or password.",
        USER_DISABLED: "This account has been disabled.",
        TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Please try again later.",
        OPERATION_NOT_ALLOWED: "Email/password sign-in is disabled in Firebase.",
        API_KEY_INVALID: "Firebase configuration is invalid. Check the API key.",
      };
      setError(
        errorMessages[err.message] ||
          (err instanceof TypeError
            ? "Unable to connect. Check your internet connection and try again."
            : err.message.replaceAll("_", " ")),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    const email = event.currentTarget.form.elements.email.value.trim();
    if (!email) {
      setError("Enter your email address first to reset your password.");
      return;
    }

    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "PASSWORD_RESET_FAILED");
      }
      setStatus("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Unable to connect. Check your internet connection and try again."
          : err.message.replaceAll("_", " "),
      );
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Login</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
          />

          <div className="password-field">
            <label className="visually-hidden" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              autoComplete="current-password"
              required
            />
            <button
              className="password-toggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? "◉" : "◉̸"}
            </button>
          </div>

          <button className="login-submit" type="submit" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>
          <button className="forgot-password" type="button" onClick={handlePasswordReset}>
            Forgot password
          </button>
        </form>
        {error && <p className="login-error" role="alert">{error}</p>}
        {status && <p className="login-status" role="status">{status}</p>}
      </section>
      <p className="signup-prompt">
        Don&apos;t have an account? <a href="#signup">Sign up</a>
      </p>
    </main>
  );
};

export default Login;
