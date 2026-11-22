import { useEffect, useState } from "react";
import Login from "./pages/login/Login";
import Signup from "./pages/signup/Signup";

const App = () => {
  const [page, setPage] = useState(
    window.location.hash === "#login" ? "login" : "signup",
  );

  useEffect(() => {
    const handleHashChange = () => {
      setPage(window.location.hash === "#login" ? "login" : "signup");
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return page === "login" ? <Login /> : <Signup />;
};

export default App;
