import { useEffect, useState } from "react";
import Login from "./pages/login/Login";
import Signup from "./pages/signup/Signup";
import "./App.css";

const hasActiveSession = () =>
  Boolean(
    localStorage.getItem("mailboxToken") &&
      Number(localStorage.getItem("mailboxTokenExpiresAt")) > Date.now(),
  );

const App = () => {
  const [page, setPage] = useState(() => {
    if (hasActiveSession()) return "welcome";
    return window.location.hash === "#login" ? "login" : "signup";
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === "#welcome" && hasActiveSession()) {
        setPage("welcome");
      } else {
        setPage(window.location.hash === "#login" ? "login" : "signup");
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (page === "welcome" && hasActiveSession()) {
    const handleLogout = () => {
      localStorage.removeItem("mailboxToken");
      localStorage.removeItem("mailboxTokenExpiresAt");
      localStorage.removeItem("mailboxEmail");
      window.location.hash = "#login";
    };

    return (
      <main className="welcome-screen">
        <p>Welcome to your mail box</p>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </main>
    );
  }

  return page === "login" ? <Login /> : <Signup />;
};

export default App;
