import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Highlight from "@tiptap/extension-highlight";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import { FIREBASE_DATABASE_URL } from "../../firebaseConfig";
import "./Mailbox.css";

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

const Mailbox = ({ email, onLogout }) => {
  const [activeView, setActiveView] = useState("inbox");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [inboxMessages, setInboxMessages] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [deletingMessageIds, setDeletingMessageIds] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const token = localStorage.getItem("mailboxToken") || "";
  const uid = localStorage.getItem("mailboxUid") || "";
  const accountEmail = email.trim();
  const messages = activeView === "sent" ? sentMessages : inboxMessages;
  const unreadCount = inboxMessages.filter((message) => message.read !== true).length;
  const editor = useEditor({
    extensions: [StarterKit, Highlight.configure({ multicolor: false })],
    content: "<p></p>",
  });

  useEffect(() => {
    if (activeView === "compose") return undefined;

    let isCurrent = true;
    const loadMessages = async () => {
      setIsLoading(true);
      setError("");

      const fieldPath = activeView === "inbox" ? "recipientEmail" : "senderUid";
      const fieldValue = activeView === "inbox" ? accountEmail : uid;

      try {
        let response = await fetch(buildMessagesQueryUrl(fieldPath, fieldValue, token));
        let data = await response.json();

        if (!response.ok) {
          throw new Error(getDatabaseError(data, response.status));
        }

        let nextMessages = Object.entries(data || {})
          .map(([id, message]) => ({ id, ...message }))
          .sort((first, second) => (second.sentAt || 0) - (first.sentAt || 0));

        if (
          activeView === "sent" &&
          nextMessages.length === 0 &&
          accountEmail
        ) {
          response = await fetch(buildMessagesQueryUrl("senderEmail", accountEmail, token));
          data = await response.json();
          if (!response.ok) {
            throw new Error(getDatabaseError(data, response.status));
          }

          nextMessages = Object.entries(data || {})
            .map(([id, message]) => ({ id, ...message }))
            .sort((first, second) => (second.sentAt || 0) - (first.sentAt || 0));
        }

        if (isCurrent) {
          if (activeView === "inbox") setInboxMessages(nextMessages);
          else setSentMessages(nextMessages);
        }
      } catch (loadError) {
        if (isCurrent) setError(loadError.message);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    loadMessages();
    return () => {
      isCurrent = false;
    };
  }, [activeView, accountEmail, refreshKey, token, uid]);

  const selectView = (view) => {
    setError("");
    setStatus("");
    setSelectedMessageId("");
    setActiveView(view);
  };

  const openMessage = async (message) => {
    setSelectedMessageId(message.id);
    setError("");

    if (activeView !== "inbox" || message.read === true) return;

    try {
      const response = await fetch(
        `${databaseMessagesUrl.replace(/\.json$/, `/${encodeURIComponent(message.id)}.json`)}?auth=${encodeURIComponent(token)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(getDatabaseError(data, response.status));
      }

      setInboxMessages((currentMessages) =>
        currentMessages.map((currentMessage) =>
          currentMessage.id === message.id
            ? { ...currentMessage, read: true }
            : currentMessage,
        ),
      );
    } catch (readError) {
      setError(`Could not save read status: ${readError.message}`);
    }
  };

  const deleteMessage = async (event, message) => {
    event.stopPropagation();
    setError("");
    setStatus("");
    setDeletingMessageIds((currentIds) => [...currentIds, message.id]);

    try {
      const response = await fetch(
        `${databaseMessagesUrl.replace(/\.json$/, `/${encodeURIComponent(message.id)}.json`)}?auth=${encodeURIComponent(token)}`,
        { method: "DELETE" },
      );
      const data = await response.text();
      if (!response.ok) {
        let responseData = null;
        try {
          responseData = data ? JSON.parse(data) : null;
        } catch {
          responseData = data;
        }
        throw new Error(getDatabaseError(responseData, response.status));
      }

      setInboxMessages((currentMessages) =>
        currentMessages.filter((currentMessage) => currentMessage.id !== message.id),
      );
      setSentMessages((currentMessages) =>
        currentMessages.filter((currentMessage) => currentMessage.id !== message.id),
      );
      if (selectedMessageId === message.id) setSelectedMessageId("");
      setStatus("Message deleted.");
    } catch (deleteError) {
      setError(`Could not delete message: ${deleteError.message}`);
    } finally {
      setDeletingMessageIds((currentIds) =>
        currentIds.filter((messageId) => messageId !== message.id),
      );
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!editor || !editor.getText().trim()) {
      setError("Write a message before sending.");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(
        `${databaseMessagesUrl}?auth=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderUid: uid,
            senderEmail: accountEmail,
            recipientEmail: recipientEmail.trim(),
            subject: subject.trim(),
            bodyHtml: editor.getHTML(),
            bodyText: editor.getText(),
            sentAt: Date.now(),
            read: false,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(getDatabaseError(data, response.status));
      }

      setRecipientEmail("");
      setSubject("");
      editor.commands.clearContent();
      setStatus("Message sent.");
      setActiveView("sent");
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setIsSending(false);
    }
  };

  const renderToolbarButton = (label, active, onClick, content) => (
    <button
      className={`editor-tool${active ? " is-active" : ""}`}
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {content}
    </button>
  );

  const selectedMessage = messages.find(
    (message) => message.id === selectedMessageId,
  );
  const searchQuery = searchTerm.trim().toLowerCase();
  const visibleMessages = messages.filter((message) =>
    [message.senderEmail, message.recipientEmail, message.subject, message.bodyText]
      .some((value) => value?.toLowerCase().includes(searchQuery)),
  );

  return (
    <main className="mailbox-app">
      <header className="mailbox-header">
        <div className="mailbox-brand">
          <span className="mailbox-mark" aria-hidden="true">M</span>
          <div>
            <p className="mailbox-welcome">Mail Box</p>
            <span className="mailbox-account">{email}</span>
          </div>
        </div>
        <label className="mailbox-search">
          <span className="visually-hidden">Search messages</span>
          <input
            type="search"
            placeholder="Search messages"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <span aria-hidden="true">⌕</span>
        </label>
        <button className="mailbox-logout" type="button" onClick={onLogout}>
          Log out
        </button>
      </header>

      <div className="mailbox-layout">
        <aside className="mailbox-sidebar" aria-label="Folders">
          <button
            className="compose-navigation"
            type="button"
            onClick={() => selectView("compose")}
          >
            <span aria-hidden="true">+</span> Compose
          </button>
          {[
            ["inbox", "Inbox"],
            ["sent", "Sent"],
          ].map(([view, label]) => (
            <button
              key={view}
              className={`folder-navigation${activeView === view ? " is-selected" : ""}`}
              type="button"
              aria-current={activeView === view ? "page" : undefined}
              onClick={() => selectView(view)}
            >
              <span aria-hidden="true">{view === "inbox" ? "▣" : "↗"}</span>
              {label}
              {view === "inbox" && unreadCount > 0 && (
                <span
                  className="folder-count"
                  aria-label={`${unreadCount} unread messages`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </aside>

        <div className="mailbox-content">
          {error && <p className="mailbox-message mailbox-error" role="alert">{error}</p>}
          {status && <p className="mailbox-message mailbox-status" role="status">{status}</p>}

          {activeView === "compose" ? (
            <section className="compose-card" aria-label="Compose email">
              <form onSubmit={sendMessage}>
                <label className="compose-row">
                  <span>To</span>
                  <input
                    type="email"
                    name="recipientEmail"
                    placeholder="Recipient email registered with Firebase"
                    autoComplete="email"
                    required
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                  />
                </label>
                <label className="compose-subject">
                  <span className="visually-hidden">Subject</span>
                  <input
                    type="text"
                    name="subject"
                    placeholder="Subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </label>

                <div className="rich-editor">
                  {editor && (
                    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
                      {renderToolbarButton(
                        "Bold",
                        editor.isActive("bold"),
                        () => editor.chain().focus().toggleBold().run(),
                        <strong>B</strong>,
                      )}
                      {renderToolbarButton(
                        "Italic",
                        editor.isActive("italic"),
                        () => editor.chain().focus().toggleItalic().run(),
                        <em>I</em>,
                      )}
                      {renderToolbarButton(
                        "Highlight",
                        editor.isActive("highlight"),
                        () => editor.chain().focus().toggleHighlight().run(),
                        <span className="highlight-tool">A</span>,
                      )}
                      {renderToolbarButton(
                        "Bulleted list",
                        editor.isActive("bulletList"),
                        () => editor.chain().focus().toggleBulletList().run(),
                        "• List",
                      )}
                      {renderToolbarButton(
                        "Numbered list",
                        editor.isActive("orderedList"),
                        () => editor.chain().focus().toggleOrderedList().run(),
                        "1. List",
                      )}
                    </div>
                  )}
                  <EditorContent editor={editor} className="editor-content" />
                </div>

                <footer className="compose-footer">
                  <button className="send-button" type="submit" disabled={isSending}>
                    {isSending ? "Sending..." : "Send"}
                  </button>
                  <span className="compose-sender">From {email}</span>
                </footer>
              </form>
            </section>
          ) : selectedMessage ? (
            <article className="message-reader">
              <div className="reader-toolbar">
                <button
                  type="button"
                  onClick={() => setSelectedMessageId("")}
                >
                  ← Back to {activeView === "inbox" ? "Inbox" : "Sent"}
                </button>
              </div>
              <h1>{selectedMessage.subject || "(no subject)"}</h1>
              <div className="reader-details">
                <strong>
                  {activeView === "inbox"
                    ? selectedMessage.senderEmail
                    : `To: ${selectedMessage.recipientEmail}`}
                </strong>
                {activeView === "inbox" && <span>to {email}</span>}
                <time dateTime={new Date(selectedMessage.sentAt).toISOString()}>
                  {new Date(selectedMessage.sentAt).toLocaleString()}
                </time>
              </div>
              <div
                className="mail-body reader-body"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(selectedMessage.bodyHtml),
                }}
              />
            </article>
          ) : (
            <section className="message-list" aria-label={activeView === "inbox" ? "Inbox messages" : "Sent messages"}>
              <div className="message-list-heading">
                <h1>{activeView === "inbox" ? "Inbox" : "Sent"}</h1>
                <button
                  type="button"
                  onClick={() => setRefreshKey((key) => key + 1)}
                  disabled={isLoading}
                >
                  Refresh
                </button>
              </div>
              {isLoading ? (
                <p className="empty-mailbox">Loading messages...</p>
              ) : visibleMessages.length === 0 ? (
                <p className="empty-mailbox">
                  {searchQuery ? "No messages match your search." : "No messages yet."}
                </p>
              ) : (
                <ul className="message-rows">
                  {visibleMessages.map((message) => (
                    <li key={message.id}>
                      <div className="message-row-container">
                        <button
                          className="message-row"
                          data-unread={activeView === "inbox" && message.read !== true}
                          type="button"
                          onClick={() => openMessage(message)}
                        >
                          <span className="message-row-sender">
                            {activeView === "inbox" && message.read !== true && (
                              <span className="unread-dot" aria-label="Unread" />
                            )}
                            <span>
                              {activeView === "inbox"
                                ? message.senderEmail
                                : `To: ${message.recipientEmail}`}
                            </span>
                          </span>
                          <span className="message-row-summary">
                            <strong>{message.subject || "(no subject)"}</strong>
                            <span>{message.bodyText || ""}</span>
                          </span>
                          <time dateTime={new Date(message.sentAt).toISOString()}>
                            {new Date(message.sentAt).toLocaleDateString()}
                          </time>
                        </button>
                        <button
                          className="delete-message-button"
                          type="button"
                          aria-label={`Delete ${message.subject || "(no subject)"}`}
                          disabled={deletingMessageIds.includes(message.id)}
                          onClick={(event) => deleteMessage(event, message)}
                        >
                          {deletingMessageIds.includes(message.id) ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
};

export default Mailbox;
