import { useCallback, useMemo } from "react";
import { FIREBASE_API_KEY } from "../firebaseConfig";
import useApi from "./useApi";

const authUrl = "https://identitytoolkit.googleapis.com/v1/accounts";

const useFirebaseAuth = () => {
  const { request } = useApi();

  const postAuthRequest = useCallback(
    (action, payload, fallbackError) =>
      request(
        `${authUrl}:${action}?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        {
          getError: (data) => data.error?.message || fallbackError,
        },
      ),
    [request],
  );

  const signIn = useCallback(
    (credentials) =>
      postAuthRequest("signInWithPassword", credentials, "LOGIN_FAILED"),
    [postAuthRequest],
  );

  const signUp = useCallback(
    (credentials) => postAuthRequest("signUp", credentials, "SIGN_UP_FAILED"),
    [postAuthRequest],
  );

  const sendPasswordReset = useCallback(
    (email) =>
      postAuthRequest(
        "sendOobCode",
        { requestType: "PASSWORD_RESET", email },
        "PASSWORD_RESET_FAILED",
      ),
    [postAuthRequest],
  );

  return useMemo(
    () => ({ signIn, signUp, sendPasswordReset }),
    [signIn, signUp, sendPasswordReset],
  );
};

export default useFirebaseAuth;
