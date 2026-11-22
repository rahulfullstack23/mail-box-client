# Firebase Realtime Database setup

1. Copy `.env.example` to `.env`. The Realtime Database URL is already set to the URL provided for this project.
2. Enable Realtime Database and Email/Password sign-in in the Firebase console.
3. Deploy the included database rules with the Firebase CLI: `firebase deploy --only database`.
4. Restart the Vite dev server after changing environment variables.

The app stores each message once under `/messages/{messageId}` with the sender UID, sender email, recipient email, subject, rich-text HTML, and timestamp. Inbox queries filter by the signed-in email; Sent queries filter by the sender UID. The rules require those bounded queries and restrict direct message reads to its sender or recipient.

The compose editor uses Tiptap for bold, italic, lists, and highlighting. Messages are stored in this app's mailbox; sending does not deliver email through an external email provider. The recipient should use the same email address registered in Firebase Authentication.
