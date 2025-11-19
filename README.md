 # Trello Realtime Board (React + Node + Trello API)

 A Trello‑style board with real‑time synchronization using Trello’s REST API, webhooks, and WebSockets.

 > ⚠️ Important: Do **not** commit your real Trello API key or token. Use `.env` files locally and add them to `.gitignore`.

 ---

 ## Features

 - Trello‑like single board UI:
	 - View lists and cards from a real Trello board.
	 - Create new cards, rename cards, move cards between lists (by id), and archive cards.
 - Backend proxy to Trello:
	 - `POST /api/tasks` → create card.
	 - `PUT /api/tasks/:cardId` → update card (title, description, list).
	 - `DELETE /api/tasks/:cardId` → Delete card.
	 - `POST /api/boards` → create Trello board.
	 - `GET /api/boards/:boardId/lists` → fetch lists with open cards.
 - Real‑time updates:
	 - WebSocket events via Socket.IO for API actions.
	 - Trello webhooks push external changes into all connected clients.

 ---

 ## Project Structure

 ```
 .
 ├─ trello-frontend/ # React + Vite SPA
 │  ├─ src/
 │  │  ├─ api/
 │  │  │  └─ trelloApi.js # Axios wrapper for backend APIs
 │  │  ├─ App.jsx # Main Trello board UI, websocket client
 │  │  ├─ main.jsx # React entrypoint
 │  │  └─ index.css
 │  ├─ package.json
 │  └─ .env.example # Example frontend env vars
 └─ realtime-backend/ # Node.js + Express + Socket.IO
		├─ server.js # REST API, Trello proxy, webhooks, WebSockets
		├─ postman_collection.json # Postman collection with all core endpoints
		├─ package.json
		└─ .env.example # Example backend env vars (no real keys)
 ```

 ---

 ## Tech Stack

 - **Frontend**
	 - React (Vite)
	 - Axios
	 - Socket.IO client
 - **Backend**
	 - Node.js
	 - Express
	 - Socket.IO
	 - Axios
	 - dotenv, cors
 - **External services**
	 - Trello REST API (boards, lists, cards, webhooks)

 

 ### Getting Trello API Key & Token

 1. Log in to Trello.
 2. Go to the Trello developer/API key page.
 3. Copy your **API key**.
 4. Generate a **token** for your application.
 5. Keep both secret in local `.env` files, never commit them.

 ---

 ## Backend Setup (realtime-backend)

 1. Go to the backend folder:

 ```powershell
 cd realtime-backend
 ```

 2. Create a local env file from the example:

 ```powershell
 copy .env.example .env
 ```

 3. Edit `.env` and set your values:

 ```
 TRELLO_KEY=YOUR_TRELLO_KEY
 TRELLO_TOKEN=YOUR_TRELLO_TOKEN
 PORT=5000
 BOARD_ID=OPTIONAL_DEFAULT_BOARD_ID
 FRONTEND_ORIGIN=http://localhost:5173
 ```

 4. Install dependencies:

 ```powershell
 npm install
 ```

 5. Run the backend (development):

 ```powershell
 npm run dev
 # or
 npm start
 ```

 6. The backend runs at:

 ```
 http://localhost:5000
 ```

 > The backend proxies requests to Trello’s REST API using `TRELLO_KEY` and `TRELLO_TOKEN`, exposes required endpoints, and hosts a Socket.IO server for realtime events.

 ---

 ## Frontend Setup (trello-frontend)

 1. Go to the frontend folder:

 ```powershell
 cd trello-frontend
 ```

 2. Create a local env file from the example:

 ```powershell
 copy .env.example .env
 ```

 3. Edit `trello-frontend/.env`:

 ```
 VITE_API_BASE=http://localhost:5000
 VITE_BOARD_ID=YOUR_TRELLO_BOARD_ID
 ```

 4. Install dependencies:

 ```powershell
 npm install
 ```

 5. Run the frontend:

 ```powershell
 npm run dev
 ```

 6. Open the app in the browser:

 ```
 http://localhost:5173
 ```

 > The frontend loads lists and cards from `/api/boards/:boardId/lists`, uses the core task APIs, and connects to the backend websocket to receive realtime updates.

 ---

 ## Backend API Endpoints

 All endpoints are relative to `http://localhost:5000`.

 ### 1. Create Board

 - **Method**: `POST /api/boards`
 - **Body**:

 ```json
 {
	 "name": "Hiring Test Board",
	 "defaultLists": true
 }
 ```

 Creates a Trello board and emits `boardCreated`.

 ---

 ### 2. Get Board Lists + Cards

 - **Method**: `GET /api/boards/:boardId/lists`
 - **Description**: Fetch lists for a board with open cards.

 ---

 ### 3. Add New Task (Create Card)

 - **Method**: `POST /api/tasks`
 - **Body**:

 ```json
 {
	 "listId": "<LIST_ID>",
	 "name": "Task title",
	 "desc": "Task details"
 }
 ```

 Creates a card in the specified list and emits `taskCreated`.

 ---

 ### 4. Update Task (Update Card)

 - **Method**: `PUT /api/tasks/:cardId`
 - **Body** (any subset):

 ```json
 {
	 "name": "New title",
	 "desc": "Updated description",
	 "idList": "<NEW_LIST_ID>"
 }
 ```

 Updates a card and emits `taskUpdated`.

 ---

 ### 5. Delete Task (Archive Card)

 - **Method**: `DELETE /api/tasks/:cardId`

 Archives the Trello card (sets `closed=true`) and emits `taskDeleted`.

 ---

 ### 6. Create Webhook

 - **Method**: `POST /api/webhooks`
 - **Body**:

 ```json
 {
	 "callbackURL": "https://<your-public-host>/webhook",
	 "idModel": "<BOARD_ID>",
	 "description": "Trello RT webhook"
 }
 ```

 Registers a Trello webhook that calls `POST /webhook` on changes.

 ---

 ### 7. Webhook Callback

 - `HEAD /webhook` – Trello verification.
 - `GET /webhook` – Trello verification.
 - `POST /webhook` – receives webhook action payloads from Trello and emits `trelloEvent` & `webhookEvent` over websockets.

 ---

 ## WebSockets & Real‑Time Behavior

 - Backend: Socket.IO server emits `taskCreated`, `taskUpdated`, `taskDeleted`, `boardCreated`, `webhookEvent`, `trelloEvent`.
 - Frontend: connects with `socket.io-client` and reloads board on incoming events.

 ---

 ## Webhook Setup (public URL)

 1. Start the Frontend:

 ```powershell
 cd trello-frontend
 npm run dev
 ```
 our server is started and you go on this and i deploy my backend you directly checking on this site

 ---

 ## Postman Collection

 Import `realtime-backend/postman_collection.json` into Postman. Set variables `base_url`, `board_id`, `card_id` and run the requests. and you see my Postman Collection i give the link.

 Postman : https://documenter.getpostman.com/view/39187633/2sB3WyHvme

 ---

 ## How to Demo

 1. Start backend and frontend.
 2. Open two browser windows at `http://localhost:5173`.
 3. In window A: create, rename, move, and archive cards.
 4. Window B should update in real time via websockets and webhook events.

 ---

 ## Notes

 - API keys and tokens are sensitive. Keep them in `.env`, do not commit them.
 - This project is a simple demo and does not include advanced security (webhook signature verification).
