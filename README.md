# 🚀 Trello Realtime Board  
### *(React + Node.js + Socket.IO + Trello API)*

A real-time Trello board manager where you can create, update, move, and archive tasks with instant synchronization across all connected clients.  
This project demonstrates integration with the **Trello REST API**, a **Node.js backend**, and a **React (Vite) frontend** with **Socket.IO** for live updates.

---

## 📘 Postman API Documentation  
🔗 https://documenter.getpostman.com/view/39187633/2sB3WyHvme

---

## 🎥 Live Demo  
🔗 https://youtu.be/quXGM7toFuE

---

## 🌐 Frontend Deployment  
🔗 https://inscripts-i-private-limited-assignm.vercel.app/

---

## ⚡ Features

### 🔹 Trello-like Board Interface
- View lists and cards from a real Trello board  
- Create new cards  
- Rename cards  
- Move cards between lists (via Trello list IDs)  
- Archive (delete) cards  

### 🔹 Backend Trello API Proxy
- `POST /api/tasks` → create a card  
- `PUT /api/tasks/:cardId` → update/move a card  
- `DELETE /api/tasks/:cardId` → archive a card  
- `POST /api/boards` → create a Trello board  
- `GET /api/boards/:boardId/lists` → fetch lists with open cards  

### 🔹 Realtime Updates
- Socket.IO sends live events for:
  - `taskCreated`
  - `taskUpdated`
  - `taskDeleted`
  - `boardCreated`
- Trello Webhooks send external board updates → broadcast to all clients

---

## 📁 Project Structure

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

## 🛠 Tech Stack

### **Frontend**
- React (Vite)
- TailwindCSS
- Axios
- Socket.IO Client

### **Backend**
- Node.js + Express
- Socket.IO
- Axios, dotenv, cors

### **External Services**
- Trello REST API (Boards, Lists, Cards, Webhooks)

---

## 🔑 Getting Trello API Key & Token

1. Log in to Trello  
2. Visit: https://trello.com/app-key  
3. Copy your **API Key**  
4. Generate a **Token**  
5. Store them securely in `.env` — never commit them

---

 ## 🚀Backend Setup (realtime-backend)

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

 ## 💻Frontend Setup (trello-frontend)

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
 ---

 ## 📡Backend API Endpoints

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

 ## 🔌WebSockets & Real‑Time Behavior

 - Backend: Socket.IO server emits `taskCreated`, `taskUpdated`, `taskDeleted`, `boardCreated`, `webhookEvent`, `trelloEvent`.
 - Frontend: connects with `socket.io-client` and reloads board on incoming events.

## 🧪 Webhook / Realtime Testing

1. Start both the **backend** and **frontend** servers.
 
 ```powershell
 cd trello-frontend
 npm run dev
 
 ```
 our server is started and you go on this and i deploy my 
 backend you directly checking on this site

2. Open **two browser windows** showing the app.

3. In **Window A**, perform actions such as:
   - Create a card  
   - Rename a card  
   - Move a card between lists  
   - Archive a card  
4. **Window B** will update instantly using:
   - **Socket.IO realtime events**
   - **Trello Webhook events** pushed through the backend
   

---

## 📬 Postman Collection

You can test all API endpoints using the included Postman collection.

🔗Postman : **https://documenter.getpostman.com/view/39187633/2sB3WyHvme**

 ---

 ## 📝 Notes

- **Keep your Trello API key and token private.**  
  They must be stored in `.env` files and never committed to GitHub.
- This project is a simplified demonstration and **does not include webhook signature verification**.
- Built for showcasing **real-time API integrations** using:
  - Trello REST API  
  - Socket.IO  
  - React + Node.js  
  

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
