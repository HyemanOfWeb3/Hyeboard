# MERN Notebook

A full-stack web application for creating, reading, updating, and deleting notes. Built with the MERN stack (MongoDB, Express.js, React, Node.js).

## Features

- Create, edit, and delete notes
- Responsive UI with Tailwind CSS
- Rate limiting for API requests
- Real-time note management
- Deployed on Vercel

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Deployment**: Vercel
- **Other**: Axios for API calls, Upstash for Redis (rate limiting)

## Installation

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/HyemanOfWeb3/Hyeboard.git
   cd Mern-Notebook
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd ../frontend
   npm install
   ```

4. Set up environment variables:

   Create a `.env` file in the `backend` directory with:
   ```
   MONGO_URI=your_mongodb_connection_string
   AUTH_SECRET=generate-a-long-random-secret
   CLIENT_URL=http://localhost:5173
   UPSTASH_REDIS_REST_URL=your_upstash_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_token
   # S3-compatible object storage for note attachments
   S3_REGION=your_storage_region
   S3_ACCESS_KEY_ID=your_storage_access_key
   S3_SECRET_ACCESS_KEY=your_storage_secret_key
   S3_BUCKET=your_private_bucket_name
   # Optional for non-AWS S3-compatible providers
   S3_ENDPOINT=https://your-storage-endpoint
   S3_FORCE_PATH_STYLE=false
      # Optional server-side AI provider configuration
      GEMINI_API_KEY=server_only_gemini_key
      GEMINI_MODEL=gemini-3.6-flash
      AI_TIMEOUT_MS=15000
   PORT=5000
   ```

5. Start the backend server:
   ```bash
   cd backend
   npm start
   ```

6. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

7. Open your browser to `http://localhost:5173` (or the port shown by Vite).

## API Endpoints

- `GET /api/notes` - Get all notes
- `POST /api/notes` - Create a new note
- `GET /api/notes/:id` - Get a specific note
- `PUT /api/notes/:id` - Update a note
- `DELETE /api/notes/:id` - Delete a note

### Attachments

Attachments use private S3-compatible object storage and are never stored in MongoDB
or the Vercel filesystem. The server accepts images (`jpeg`, `png`, `gif`, `webp`),
PDFs, and plain text formats up to 4 MB, with a maximum of 10 attachments per note.
Upload bytes are checked against their declared type before storage. Access uses
short-lived signed URLs and requires ownership of the note. Trashed notes retain
their attachments until permanent deletion; emptying trash removes their objects.
Attachment binaries are independent assets: note version restores do not roll them
back, and Markdown/JSON note exports explicitly exclude binary content.

### Optional AI insights

AI actions are explicit and note-scoped: summarize, key points, suggested tags, and
possible related existing notes. The browser never receives `GEMINI_API_KEY`. When an
action runs, only the selected note's title, tags, and up to 12,000 characters of
content are sent to the configured provider. Related-note analysis sends at most 20
same-user candidate titles, tags, and short excerpts using opaque candidate labels.
HyeBoard does not persist prompts or provider responses; a short in-memory cache is
used only to prevent duplicate requests on one server instance. Note content is
treated as untrusted data, and AI suggestions never create links or edit tags
automatically. AI is limited to five requests per user per five minutes, is
unavailable offline, and the rest of the note app continues to work when no
provider key is configured. The default provider is Google's Gemini API through the
`@google/genai` SDK, using `gemini-3.6-flash`. Set `GEMINI_MODEL` when selecting a
different Gemini model.

### Collaboration foundation

Collaboration currently provides the control plane only; rich-text collaborative
editing is intentionally not enabled. Notes can have owner-managed editor/viewer
members, expiring invitations, revocation, owner-only audit history, and
permission-filtered persisted mutation events. The event stream uses authenticated
Server-Sent Events with database polling because the current Vercel deployment does
not provide a durable WebSocket process. Offline edits remain subject to server
authorization when they reconnect. Editors may read and edit shared notes; viewers
are read-only; only owners may invite, revoke, delete, or inspect audit logs.

### Authentication and migration

Authentication uses an HTTP-only, seven-day cookie signed with `AUTH_SECRET` (or the
legacy-compatible `JWT_SECRET` name). Configure exactly one of these in Vercel. The
frontend never receives the token. `GET /api/auth/me` restores the session after a
refresh, and all note endpoints require that session.

Keep deployment credentials out of source control and rotate any credential that
has been exposed outside the deployment secret store. The hardening tests use only
the `TEST_*` variables documented in `tests/README.md`; they never fall back to
production `MONGO_URI`, auth secrets, or storage credentials.

The production database was inspected before this change: it contains four legacy
notes with no owner. They are intentionally preserved but are not made visible to
new accounts. Do not assign them automatically. For development, the safest option
is to archive/reset those test records after confirming they are disposable. For
real data, export the records and perform an explicit owner-approved migration before
adding each note's `user` reference.

## Project Structure

```
Mern-Notebook/
├── api/                 # Vercel API routes
├── backend/             # Express.js server
│   ├── src/
│   │   ├── config/      # Database and Redis config
│   │   ├── controllers/ # Note controllers
│   │   ├── middleware/  # Rate limiting middleware
│   │   ├── models/      # MongoDB models
│   │   ├── routes/      # API routes
│   │   └── server.js    # Main server file
│   └── package.json
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── lib/         # Utilities and Axios config
│   │   ├── pages/       # Page components
│   │   └── App.jsx      # Main app component
│   ├── public/          # Static assets
│   └── package.json
├── package.json         # Root package.json
└── vercel.json          # Vercel deployment config
```

## Deployment

The app is configured for deployment on Vercel. The `api/` directory contains serverless functions for the backend.

To deploy:
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License