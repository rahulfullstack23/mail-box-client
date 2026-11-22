import { lazy, Suspense, useEffect, useState } from "react";
import Login from "./pages/login/Login";
import Signup from "./pages/signup/Signup";

const Mailbox = lazy(() => import("./pages/mailbox/Mailbox"));

const hasUnexpiredToken = () =>
  Boolean(
    localStorage.getItem("mailboxToken") &&
      Number(localStorage.getItem("mailboxTokenExpiresAt")) > Date.now(),
  );

const hasActiveSession = () =>
  hasUnexpiredToken() && Boolean(localStorage.getItem("mailboxUid"));

const App = () => {
  const [page, setPage] = useState(() => {
    if (hasActiveSession()) return "welcome";
    if (hasUnexpiredToken()) return "login";
    return window.location.hash === "#login" ? "login" : "signup";
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === "#welcome" && hasActiveSession()) {
        setPage("welcome");
      } else if (hasUnexpiredToken()) {
        setPage("login");
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
      localStorage.removeItem("mailboxUid");
      window.location.hash = "#login";
    };

    return (
      <Suspense fallback={<main aria-busy="true">Loading mailbox...</main>}>
        <Mailbox
          email={localStorage.getItem("mailboxEmail") || ""}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  return page === "login" ? <Login /> : <Signup />;
};

export default App;
