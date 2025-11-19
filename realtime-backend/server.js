require("dotenv").config();
const express = require("express");
const axios = require("axios");
const crypto = require('crypto');
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

// Simple in-memory cache for board lists to reduce Trello API calls
// stores { [boardId]: { ts: number, data: any, etag: string } }
const listsCache = {};
// Default TTL: 30 seconds (better for first-load latency). Keep it reasonably small
// so webhooks and writes will refresh near-real-time.
const CACHE_TTL = parseInt(process.env.LISTS_CACHE_TTL_MS || '30000', 10); // milliseconds

function getCachedLists(boardId) {
  const entry = listsCache[boardId];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    delete listsCache[boardId];
    return null;
  }
  return entry;
}

function setCachedLists(boardId, data) {
  const ts = Date.now();
  const etag = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  listsCache[boardId] = { ts, data, etag };
}

// clear cache entirely or for a specific boardId
function clearListsCache(boardId) {
  if (boardId) {
    delete listsCache[boardId];
    return;
  }
  for (const k of Object.keys(listsCache)) delete listsCache[k];
}

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
    // clear cached lists so subsequent GET returns fresh data
    clearListsCache();
    res.json(response.data);
    // console.log("Task created:", response.data);
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
    clearListsCache();
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
    clearListsCache();
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
    clearListsCache();
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/boards/:boardId/lists", async (req, res) => {
  const { boardId } = req.params;
  try {
    const cachedEntry = getCachedLists(boardId);
    if (cachedEntry) {
      // handle conditional requests
      const ifNone = req.headers['if-none-match'];
      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifNone && ifNone === cachedEntry.etag) return res.status(304).end();
      if (ifModifiedSince && new Date(ifModifiedSince).getTime() >= cachedEntry.ts) return res.status(304).end();

      // set caching headers (allow CDNs and browsers to cache short-term)
      res.set('Cache-Control', 'public, max-age=5, s-maxage=30, stale-while-revalidate=60');
      res.set('ETag', cachedEntry.etag);
      res.set('Last-Modified', new Date(cachedEntry.ts).toUTCString());
      return res.json(cachedEntry.data);
    }

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
    setCachedLists(boardId, response.data);
    const entry = getCachedLists(boardId);
    if (entry) {
      res.set('Cache-Control', 'public, max-age=5, s-maxage=30, stale-while-revalidate=60');
      res.set('ETag', entry.etag);
      res.set('Last-Modified', new Date(entry.ts).toUTCString());
    }
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lightweight summary for faster initial render: id, name, cardCount
app.get('/api/boards/:boardId/lists/summary', async (req, res) => {
  const { boardId } = req.params;
  try {
    const cachedEntry = getCachedLists(boardId);
    let data = null;
    if (cachedEntry) data = cachedEntry.data;
    else {
      const response = await axios.get(
        `https://api.trello.com/1/boards/${boardId}/lists`,
        {
          params: {
            cards: 'open',
            card_fields: 'name',
            fields: 'name',
            key: TRELLO_KEY,
            token: TRELLO_TOKEN,
          }
        }
      );
      data = response.data;
      setCachedLists(boardId, data);
    }

    const summary = (data || []).map(l => ({ id: l.id, name: l.name, cardCount: (l.cards||[]).length }));
    const entry = getCachedLists(boardId);
    if (entry) {
      res.set('Cache-Control', 'public, max-age=5, s-maxage=30');
      res.set('ETag', entry.etag);
      res.set('Last-Modified', new Date(entry.ts).toUTCString());
    }
    res.json(summary);
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
  // clear cache when webhook arrives so clients can get fresh data
  clearListsCache();
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

// Pre-warm cache for boards listed in PREWARM_BOARD_IDS (comma separated)
const PREWARM = (process.env.PREWARM_BOARD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
if (PREWARM.length > 0) {
  console.log('Pre-warming lists cache for boards:', PREWARM);
  PREWARM.forEach(async (bid) => {
    try {
      const response = await axios.get(
        `https://api.trello.com/1/boards/${bid}/lists`,
        { params: { cards: 'open', card_fields: 'name,desc,idList', fields: 'name', key: TRELLO_KEY, token: TRELLO_TOKEN } }
      );
      setCachedLists(bid, response.data);
      console.log(`Prewarmed board ${bid} — ${response.data.length} lists`);
    } catch (err) {
      console.warn(`Prewarm failed for board ${bid}:`, err.message || err);
    }
  });
}
