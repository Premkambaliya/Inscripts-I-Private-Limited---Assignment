require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

// CREATE TASK  -> Creates a Trello Card

app.post("/api/tasks", async (req, res) => {
  const { listId, name, desc } = req.body;
  try {
    const response = await axios.post(
      "https://api.trello.com/1/cards",
      null,
      {
        params: {
          idList: listId,
          name,
          desc,
          key: TRELLO_KEY,
          token: TRELLO_TOKEN,
        },
      }
    );

    io.emit("taskCreated", response.data);

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE TASK  -> Updates a Trello Card

app.put("/api/tasks/:cardId", async (req, res) => {
  const { cardId } = req.params;
  const { name, desc, idList } = req.body;

  try {
    const params = {
      key: TRELLO_KEY,
      token: TRELLO_TOKEN,
    };
    if (name !== undefined) params.name = name;
    if (desc !== undefined) params.desc = desc;
    if (idList !== undefined) params.idList = idList;

    const response = await axios.put(
      `https://api.trello.com/1/cards/${cardId}`,
      null,
      { params }
    );

    io.emit("taskUpdated", response.data);

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// DELETE TASK  -> Deletes a Trello Card

app.delete("/api/tasks/:cardId", async (req, res) => {
  const { cardId } = req.params;

  try {
    const response = await axios.put(
      `https://api.trello.com/1/cards/${cardId}`,
      null,
      {
        params: {
          closed: true,
          key: TRELLO_KEY,
          token: TRELLO_TOKEN,
        },
      }
    );

    io.emit("taskDeleted", { cardId });

    res.json({ message: "Card archived", cardId, data: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// CREATE BOARD -> Creates a Trello Board

app.post("/api/boards", async (req, res) => {
  const { name, defaultLists } = req.body;

  try {
    const response = await axios.post(
      "https://api.trello.com/1/boards/",
      null,
      {
        params: {
          name,
          defaultLists,
          key: TRELLO_KEY,
          token: TRELLO_TOKEN,
        },
      }
    );

    io.emit("boardCreated", response.data);

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/boards/:boardId/lists", async (req, res) => {
  const { boardId } = req.params;
  try {
    const response = await axios.get(
      `https://api.trello.com/1/boards/${boardId}/lists`,
      {
        params: {
          cards: "open",
          card_fields: "name,desc,idList",
          fields: "name",
          key: TRELLO_KEY,
          token: TRELLO_TOKEN,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WEBHOOK ENDPOINT
// Trello will send updates here

app.head("/webhook", (req, res) => {
  res.status(200).send("OK");
});

app.get("/webhook", (req, res) => {
  res.status(200).send("OK");
});

function normalizeWebhook(action) {
  try {
    const type = action?.type;
    const d = action?.data || {};
    const boardId = d.board?.id || d.card?.idBoard || d.list?.idBoard || null;
    const listId = d.list?.id || d.listAfter?.id || d.card?.idList || null;
    const card = d.card
      ? {
          id: d.card.id,
          name: d.card.name,
          desc: d.card.desc,
          idList: d.card.idList,
          closed: typeof d.card.closed === "boolean" ? d.card.closed : undefined,
        }
      : null;

    let eventType = type;
    if (type === "updateCard") {
      if (d?.old?.idList && d?.listAfter?.id) {
        eventType = "moveCard";
      } else if (d?.old?.closed === false && d?.card?.closed === true) {
        eventType = "archiveCard";
      } else if (d?.old?.name || d?.old?.desc) {
        eventType = "updateCardDetails";
      }
    }

    if (type === "deleteCard") {
      eventType = "deleteCard";
    }

    return {
      eventType,
      boardId,
      listId,
      card,
    };
  } catch {
    return { eventType: "unknown", card: null, boardId: null, listId: null };
  }
}

app.post("/webhook", (req, res) => {
  const payload = req.body;
  io.emit("webhookEvent", payload);
  const normalized = payload?.action ? normalizeWebhook(payload.action) : null;
  if (normalized) io.emit("trelloEvent", normalized);
  res.status(200).send("OK");
});

app.post("/api/webhooks", async (req, res) => {
  const { callbackURL, idModel, description } = req.body;
  try {
    const response = await axios.post(
      "https://api.trello.com/1/webhooks",
      null,
      {
        params: {
          callbackURL,
          idModel,
          description,
          key: TRELLO_KEY,
          token: TRELLO_TOKEN,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// START SERVER

const PORT = process.env.PORT || 5000;

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
