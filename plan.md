📝 Exact Prompt to Give Codex
Here's the prompt you paste into Codex:


Build a TikTok Niche Research Tool with the following stack: React + Vite (frontend), Node.js + Express (backend), Clerk (auth), MySQL (database), Apify (TikTok scraping), Gemini API (AI video analysis).
Project structure: Monorepo with /client (Vite React) and /server (Express) folders.
Backend tasks:

Set up Express server with CORS, dotenv, and JSON body parser
Connect to MySQL using mysql2 package
Create schema.sql with users, bookmarks, search_history tables
Add Clerk JWT middleware to protect bookmark routes
Build POST /api/search → calls Apify clockworks/tiktok-scraper actor with a keyword, returns 20 video results
Build POST /api/analyze → takes a TikTok video URL, sends to Gemini 1.5 Pro API, returns structured JSON analysis with hook, structure, cta, viral_factor, content_angle, replication_tips
Build GET/POST/DELETE /api/bookmarks → protected routes, CRUD operations on MySQL bookmarks table

Frontend tasks:

Set up Vite React app with React Router, Axios, Tailwind CSS
Wrap app in Clerk ClerkProvider using publishable key from .env
Home page with search bar, video results grid (VideoCard components showing thumbnail, author, views, likes, analyze button, bookmark button)
AnalysisModal component that opens on "Analyze" click, calls /api/analyze, displays results in clean sections
Bookmarks page showing all user saved videos with full AI analysis expandable, delete button
Send Clerk session token in Axios request headers for all protected routes

Use these env variables: (list both .env files above)
Generate all files in full — no placeholders.


-- Users table (synced from Clerk)
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,  -- Clerk user ID
  email VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookmarks table
CREATE TABLE bookmarks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tiktok_url TEXT NOT NULL,
  thumbnail TEXT,
  caption TEXT,
  author VARCHAR(255),
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  ai_analysis JSON,
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Search history table (optional but useful)
CREATE TABLE search_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  results_count INT DEFAULT 0,
  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 🔌 Backend API Endpoints
```
POST   /api/search
  - Body: { keyword, limit (default 20) }
  - Calls Apify TikTok scraper
  - Returns: array of video objects

POST   /api/analyze
  - Body: { videoUrl, caption, author }
  - Sends video to Gemini API
  - Returns: AI analysis JSON object

GET    /api/bookmarks
  - Headers: Clerk auth token
  - Returns: all bookmarks for logged in user

POST   /api/bookmarks
  - Headers: Clerk auth token
  - Body: { videoData, aiAnalysis }
  - Saves bookmark to MySQL

DELETE /api/bookmarks/:id
  - Headers: Clerk auth token
  - Deletes bookmark by ID
```

---

## 🔐 Clerk Auth Flow
```
Frontend:
- Wrap App in <ClerkProvider>
- Use useUser() hook to get current user
- Send Clerk session token in every API request header

Backend:
- clerkAuth.js middleware verifies the JWT token on every protected route
- Extracts user ID from token
- Attaches to req.user for use in controllers


tiktok-research-tool/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx
│   │   │   ├── VideoGrid.jsx
│   │   │   ├── VideoCard.jsx
│   │   │   ├── AnalysisModal.jsx
│   │   │   └── BookmarkLibrary.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── Bookmarks.jsx
│   │   ├── hooks/
│   │   │   ├── useSearch.js
│   │   │   └── useBookmarks.js
│   │   ├── lib/
│   │   │   └── api.js          # axios calls to backend
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   └── package.json
│
├── server/                  # Node.js + Express backend
│   ├── routes/
│   │   ├── search.js         # POST /api/search
│   │   ├── analyze.js        # POST /api/analyze
│   │   └── bookmarks.js      # GET/POST/DELETE /api/bookmarks
│   ├── controllers/
│   │   ├── searchController.js
│   │   ├── analyzeController.js
│   │   └── bookmarksController.js
│   ├── middleware/
│   │   └── clerkAuth.js      # Clerk JWT verification middleware
│   ├── db/
│   │   ├── connection.js     # MySQL connection
│   │   └── schema.sql        # DB schema
│   ├── .env
│   ├── index.js
│   └── package.json