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
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const token = localStorage.getItem("mailboxToken") || "";
  const uid = localStorage.getItem("mailboxUid") || "";
  const accountEmail = email.trim();
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
        const response = await fetch(
          buildMessagesQueryUrl(fieldPath, fieldValue, token),
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(getDatabaseError(data, response.status));
        }

        const nextMessages = Object.entries(data || {})
          .map(([id, message]) => ({ id, ...message }))
          .sort((first, second) => second.sentAt - first.sentAt);
        if (isCurrent) setMessages(nextMessages);
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
              {view === "inbox" && messages.length > 0 && activeView === "inbox" && (
                <span className="folder-count">{messages.length}</span>
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
                      <button
                        className="message-row"
                        type="button"
                        onClick={() => setSelectedMessageId(message.id)}
                      >
                        <span className="message-row-sender">
                          {activeView === "inbox"
                            ? message.senderEmail
                            : `To: ${message.recipientEmail}`}
                        </span>
                        <span className="message-row-summary">
                          <strong>{message.subject || "(no subject)"}</strong>
                          <span>{message.bodyText || ""}</span>
                        </span>
                        <time dateTime={new Date(message.sentAt).toISOString()}>
                          {new Date(message.sentAt).toLocaleDateString()}
                        </time>
                      </button>
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
