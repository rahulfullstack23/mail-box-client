import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Mailbox from "./Mailbox";

vi.mock("@tiptap/react", () => {
  const chain = () => ({
    focus: () => ({
      toggleBold: () => ({ run: () => true }),
      toggleItalic: () => ({ run: () => true }),
      toggleHighlight: () => ({ run: () => true }),
      toggleBulletList: () => ({ run: () => true }),
      toggleOrderedList: () => ({ run: () => true }),
    }),
  });

  const editor = {
    getText: () => "",
    getHTML: () => "<p></p>",
    commands: { clearContent: vi.fn() },
    isActive: () => false,
    chain,
  };

  return {
    EditorContent: () => <div aria-label="Message editor" />,
    useEditor: () => editor,
  };
});

vi.mock("@tiptap/starter-kit", () => ({ default: {} }));
vi.mock("@tiptap/extension-highlight", () => ({ default: { configure: () => ({}) } }));

const unreadMessage = {
  id: "message-1",
  senderEmail: "sender@example.com",
  recipientEmail: "me@example.com",
  subject: "Quarterly report",
  bodyText: "Please review the report.",
  bodyHtml: "<p>Please review the <strong>report</strong>.</p>",
  sentAt: 1700000000000,
  read: false,
};

const readMessage = {
  ...unreadMessage,
  id: "message-2",
  senderEmail: "reader@example.com",
  subject: "Already read",
  read: true,
};

const jsonResponse = (body, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

describe("Mailbox message reader", () => {
  beforeEach(() => {
    localStorage.setItem("mailboxToken", "test-token");
    localStorage.setItem("mailboxUid", "test-user");
  });

  it("renders the selected message subject and sender", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      jsonResponse({ [unreadMessage.id]: unreadMessage }),
    ));
    render(<Mailbox email="me@example.com" onLogout={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /Quarterly report/i }));

    expect(screen.getByRole("heading", { name: "Quarterly report" })).toBeInTheDocument();
    expect(screen.getByText("sender@example.com")).toBeInTheDocument();
  });

  it("sanitizes and renders the message body", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      jsonResponse({ [unreadMessage.id]: unreadMessage }),
    ));
    render(<Mailbox email="me@example.com" onLogout={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /Quarterly report/i }));

    expect(screen.getByText("report").tagName).toBe("STRONG");
  });

  it("returns from the reader to the Inbox list", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      jsonResponse({ [unreadMessage.id]: unreadMessage }),
    ));
    render(<Mailbox email="me@example.com" onLogout={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /Quarterly report/i }));
    fireEvent.click(screen.getByRole("button", { name: "← Back to Inbox" }));

    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });
});

describe("Inbox unread blue-dot logic", () => {
  beforeEach(() => {
    localStorage.setItem("mailboxToken", "test-token");
    localStorage.setItem("mailboxUid", "test-user");
  });

  it("shows an unread dot for a message whose read flag is false", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      jsonResponse({ [unreadMessage.id]: unreadMessage }),
    ));
    render(<Mailbox email="me@example.com" onLogout={vi.fn()} />);

    expect(await screen.findByLabelText("Unread")).toBeInTheDocument();
  });

  it("does not show an unread dot for a message marked read", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      jsonResponse({ [readMessage.id]: readMessage }),
    ));
    render(<Mailbox email="me@example.com" onLogout={vi.fn()} />);

    await screen.findByText("Already read");
    expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
  });

  it("removes the unread dot and updates the folder count after opening", async () => {
    vi.stubGlobal("fetch", vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({ [unreadMessage.id]: unreadMessage }),
      )
      .mockImplementationOnce(() => jsonResponse({ read: true })));

    render(<Mailbox email="me@example.com" onLogout={vi.fn()} />);

    expect(await screen.findByLabelText("1 unread messages")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Quarterly report/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/unread messages/)).not.toBeInTheDocument();
  });

  it("does not send a read PATCH again for an already-read message", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      jsonResponse({ [readMessage.id]: readMessage }),
    ));
    render(<Mailbox email="me@example.com" onLogout={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /Already read/i }));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("counts both missing and false read values as unread", async () => {
    const missingReadFlag = {
      ...unreadMessage,
      id: "message-3",
      subject: "Legacy unread",
      read: undefined,
    };
    vi.stubGlobal("fetch", vi.fn(() =>
      jsonResponse({
        [unreadMessage.id]: unreadMessage,
        [missingReadFlag.id]: missingReadFlag,
      }),
    ));
    render(<Mailbox email="me@example.com" onLogout={vi.fn()} />);

    expect(await screen.findByLabelText("2 unread messages")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Unread")).toHaveLength(2);
  });

  it("does not show unread dots or unread counts in Sent", async () => {
    vi.stubGlobal("fetch", vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({ [unreadMessage.id]: unreadMessage }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({ [unreadMessage.id]: unreadMessage }),
      ));
    render(<Mailbox email="me@example.com" onLogout={vi.fn()} />);

    await screen.findByText("Quarterly report");
    fireEvent.click(screen.getByRole("button", { name: /Sent/i }));

    await screen.findByText("To: me@example.com");
    expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
  });
});
