
import { useState } from "react";
import { FIREBASE_API_KEY } from "../../firebaseConfig";
import "./Signup.css";

const Signup = () => {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const form = e.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const confirmPassword = form.elements.confirmPassword.value;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "SIGN_UP_FAILED");
      }

      setSuccess(true);
      form.reset();
    } catch (err) {
      const errorMessages = {
        EMAIL_EXISTS: "Email already registered. Please log in.",
        OPERATION_NOT_ALLOWED:
          "Email/password sign-up is disabled in Firebase. Enable it in Firebase Authentication settings.",
        CONFIGURATION_NOT_FOUND:
          "Firebase Authentication is not configured for this project. Enable the Email/Password provider.",
        WEAK_PASSWORD: "Choose a stronger password with at least 6 characters.",
        INVALID_EMAIL: "Enter a valid email address.",
        TOO_MANY_ATTEMPTS_TRY_LATER:
          "Too many attempts. Please wait a while and try again.",
        API_KEY_INVALID: "Firebase configuration is invalid. Check your API key.",
        INVALID_API_KEY: "Firebase configuration is invalid. Check your API key.",
      };
      const errorCode = err.message.includes(" : ")
        ? err.message.split(" : ")[0]
        : err.message;
      setError(
        errorMessages[errorCode] ||
          (err instanceof TypeError
            ? "Unable to connect to Firebase. Check your internet connection and try again."
            : err.message.replaceAll("_", " ")),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <h1>Sign Up</h1>

      {success && (
        <p role="status">
          Account created successfully. <a href="#login">Log in</a>
        </p>
      )}

      <form className="signup-form" onSubmit={handleSubmit}>
        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
        />
        <br /><br />

        <input
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="new-password"
          minLength={6}
          required
        />
        <br /><br />

        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm password"
          autoComplete="new-password"
          required
        />
        <br /><br />

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Sign Up"}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      <p>
        Already have an account? <a href="#login">Login</a>
      </p>
    </div>
  );
};

export default Signup;
