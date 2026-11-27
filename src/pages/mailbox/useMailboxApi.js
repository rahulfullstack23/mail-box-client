import { useCallback, useMemo } from "react";
import { FIREBASE_DATABASE_URL } from "../../firebaseConfig";
import useApi from "../../hooks/useApi";

const databaseMessagesUrl =
  `${FIREBASE_DATABASE_URL.replace(/\/+$/, "")}/messages.json`;

const getDatabaseError = (data, status) =>
  (typeof data === "string" && data) ||
  data?.error ||
  `Realtime Database request failed (${status}).`;

const buildMessagesQueryUrl = (field, value, token) => {
  const query = new URLSearchParams({
    auth: token,
    orderBy: JSON.stringify(field),
    equalTo: JSON.stringify(value),
  });
  return `${databaseMessagesUrl}?${query}`;
};

const sortMessages = (data) =>
  Object.entries(data || {})
    .map(([id, message]) => ({ id, ...message }))
    .sort((first, second) => (second.sentAt || 0) - (first.sentAt || 0));

const useMailboxApi = (token) => {
  const { request } = useApi();
  const requestMailbox = useCallback(
    (url, options, responseType = "json") =>
      request(url, options, {
        responseType,
        getError: getDatabaseError,
      }),
    [request],
  );

  const getMessages = useCallback(
    async (field, value) =>
      sortMessages(
        await requestMailbox(buildMessagesQueryUrl(field, value, token)),
      ),
    [requestMailbox, token],
  );

  const fetchInboxMessages = useCallback(
    (email) => getMessages("recipientEmail", email),
    [getMessages],
  );

  const fetchSentMessages = useCallback(
    async (uid, email) => {
      let messages = await getMessages("senderUid", uid);
      if (messages.length === 0 && email) {
        messages = await getMessages("senderEmail", email);
      }
      return messages;
    },
    [getMessages],
  );

  const markMessageAsRead = useCallback(
    async (messageId) => {
      await requestMailbox(
        `${databaseMessagesUrl.replace(/\.json$/, `/${encodeURIComponent(messageId)}.json`)}?auth=${encodeURIComponent(token)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        },
      );
    },
    [requestMailbox, token],
  );

  const deleteMessage = useCallback(
    (messageId) =>
      requestMailbox(
        `${databaseMessagesUrl.replace(/\.json$/, `/${encodeURIComponent(messageId)}.json`)}?auth=${encodeURIComponent(token)}`,
        { method: "DELETE" },
        "text",
      ),
    [requestMailbox, token],
  );

  const sendMessage = useCallback(
    (message) =>
      requestMailbox(
        `${databaseMessagesUrl}?auth=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message),
        },
      ),
    [requestMailbox, token],
  );

  return useMemo(
    () => ({
      fetchInboxMessages,
      fetchSentMessages,
      markMessageAsRead,
      deleteMessage,
      sendMessage,
    }),
    [
      fetchInboxMessages,
      fetchSentMessages,
      markMessageAsRead,
      deleteMessage,
      sendMessage,
    ],
  );
};

export default useMailboxApi;
