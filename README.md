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
   UPSTASH_REDIS_REST_URL=your_upstash_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_token
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