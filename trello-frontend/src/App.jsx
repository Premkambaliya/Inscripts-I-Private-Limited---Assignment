import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import './index.css';
import {
  getBoardListsWithCards,
  createTask,
  updateTask,
  deleteTask,
  createBoard,
} from './api/trelloApi';

// Configuration
const BOARD_ID = import.meta.env.VITE_BOARD_ID;
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export default function App() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newCard, setNewCard] = useState({ name: '', desc: '', listId: '' });
  const [newBoard, setNewBoard] = useState({ name: '', defaultLists: true });

  // --- MOBILE: which list is currently open
  const [activeMobileList, setActiveMobileList] = useState(null);
  // --- end MOBILE

  // SOCKET
  const socket = useMemo(
    () =>
      io(API_BASE, {
        transports: ["websocket", "polling"],
        upgrade: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000,
        withCredentials: false,
      }),
    []
  );

  async function load() {
    if (!BOARD_ID || BOARD_ID === 'your-board-id') {
      setError('BOARD_ID is not configured. Please set your Trello board ID.');
      setLists([
        {
          id: '1',
          name: 'To Do',
          cards: [
            { id: 'c1', name: 'Setup development environment', desc: 'Install Node.js and dependencies' },
            { id: 'c2', name: 'Design database schema', desc: '' }
          ]
        },
        {
          id: '2',
          name: 'In Progress',
          cards: [
            { id: 'c3', name: 'Build API endpoints', desc: 'Create REST API for task management' }
          ]
        },
        {
          id: '3',
          name: 'Done',
          cards: [
            { id: 'c4', name: 'Project kickoff meeting', desc: 'Completed successfully' }
          ]
        }
      ]);
      if (!newCard.listId) setNewCard((c) => ({ ...c, listId: '1' }));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await getBoardListsWithCards(BOARD_ID);
      setLists(data);
      if (!newCard.listId && data[0]?.id) setNewCard((c) => ({ ...c, listId: data[0].id }));
    } catch (e) {
      setError(e?.message || 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    const addCardToList = (card) => {
      if (!card || !card.id || !card.idList) return;
      setLists((prev) =>
        prev.map((l) =>
          l.id === card.idList
            ? { ...l, cards: [...(l.cards || []).filter((c) => c.id !== card.id), card] }
            : l
        )
      );
    };

    const updateCardInLists = (card) => {
      if (!card || !card.id) return;
      setLists((prev) =>
        prev.map((l) => {
          const exists = (l.cards || []).some((c) => c.id === card.id);
          if (exists) {
            if (card.idList && l.id !== card.idList)
              return { ...l, cards: (l.cards || []).filter((c) => c.id !== card.id) };
            return {
              ...l,
              cards: (l.cards || []).map((c) => (c.id === card.id ? { ...c, ...card } : c)),
            };
          }
          if (card.idList && l.id === card.idList)
            return { ...l, cards: [...(l.cards || []), card] };
          return l;
        })
      );
    };

    const removeCardById = (cardId) => {
      if (!cardId) return;
      setLists((prev) =>
        prev.map((l) => ({ ...l, cards: (l.cards || []).filter((c) => c.id !== cardId) }))
      );
    };

    socket.on('taskCreated', addCardToList);
    socket.on('taskUpdated', updateCardInLists);
    socket.on('taskDeleted', ({ cardId }) => removeCardById(cardId));
    socket.on('boardCreated', () => { });
    socket.on('trelloEvent', (ev) => {
      try {
        if (!ev) return;
        if (ev.eventType === 'moveCard' && ev.card) updateCardInLists(ev.card);
        if (ev.eventType === 'archiveCard' && ev.card) removeCardById(ev.card.id);
        if (ev.eventType === 'updateCardDetails' && ev.card) updateCardInLists(ev.card);
      } catch { }
    });

    return () => {
      socket.off('taskCreated');
      socket.off('taskUpdated');
      socket.off('taskDeleted');
      socket.off('trelloEvent');
      socket.off('boardCreated');
      socket.disconnect();
    };
  }, [socket]);

  async function handleCreate() {
    if (!newCard.name || !newCard.listId) return;
    try {
      const card = await createTask({
        listId: newCard.listId,
        name: newCard.name,
        desc: newCard.desc,
      });
      if (card && card.id) {
        setLists((prev) =>
          prev.map((l) =>
            l.id === card.idList
              ? { ...l, cards: [...(l.cards || []), card] }
              : l
          )
        );
      }
      setNewCard({ name: '', desc: '', listId: newCard.listId });
    } catch (e) {
      alert(e?.message || 'Create failed');
    }
  }

  async function handleDelete(cardId) {
    if (!confirm('Archive this card?')) return;
    try {
      await deleteTask(cardId);
      setLists((prev) =>
        prev.map((l) => ({ ...l, cards: (l.cards || []).filter((c) => c.id !== cardId) }))
      );
    } catch (e) {
      alert(e?.message || 'Delete failed');
    }
  }

  async function handleRename(cardId) {
    const name = prompt('New title?');
    if (!name) return;
    try {
      const updated = await updateTask(cardId, { name });
      if (updated && updated.id) {
        setLists((prev) =>
          prev.map((l) => ({
            ...l,
            cards: (l.cards || []).map((c) =>
              c.id === updated.id ? { ...c, ...updated } : c
            ),
          }))
        );
      }
    } catch (e) {
      alert(e?.message || 'Update failed');
    }
  }

  async function handleMove(cardId) {
    const listId = prompt('Move to listId?');
    if (!listId) return;
    try {
      const updated = await updateTask(cardId, { idList: listId });
      if (updated && updated.id) {
        setLists((prev) =>
          prev.map((l) => {
            const has = (l.cards || []).some((c) => c.id === updated.id);
            if (has)
              return {
                ...l,
                cards: (l.cards || []).filter((c) => c.id !== updated.id),
              };
            if (l.id === updated.idList)
              return { ...l, cards: [...(l.cards || []), updated] };
            return l;
          })
        );
      }
    } catch (e) {
      alert(e?.message || 'Move failed');
    }
  }

  function handleDragStart(e, cardId, fromListId) {
    try {
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({ cardId, fromListId })
      );
    } catch {
      e.dataTransfer.setData('text/plain', `${cardId}|${fromListId}`);
    }
  }

  async function handleListDrop(e, targetListId) {
    e.preventDefault();
    let raw =
      e.dataTransfer.getData('application/json') ||
      e.dataTransfer.getData('text/plain');
    if (!raw) return;

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      const [cardId, fromListId] = raw.split('|');
      payload = { cardId, fromListId };
    }

    const { cardId, fromListId } = payload;
    if (!cardId || !fromListId || fromListId === targetListId) return;

    let movedCard = null;

    setLists((prev) =>
      prev.map((l) => {
        if (l.id === fromListId) {
          const remaining = l.cards.filter((c) => {
            if (c.id === cardId) {
              movedCard = c;
              return false;
            }
            return true;
          });
          return { ...l, cards: remaining };
        }
        if (l.id === targetListId && movedCard) {
          return {
            ...l,
            cards: [...l.cards, { ...movedCard, idList: targetListId }],
          };
        }
        return l;
      })
    );

    try {
      await updateTask(cardId, { idList: targetListId });
      load();
    } catch {
      load();
      alert('Move failed');
    }
  }

  async function handleCreateBoard() {
    if (!newBoard.name) return;
    try {
      const board = await createBoard({
        name: newBoard.name,
        defaultLists: newBoard.defaultLists,
      });
      setNewBoard({ name: '', defaultLists: true });
      alert(`Board created: ${board?.name} (${board?.id})`);
    } catch (e) {
      alert(e?.message || 'Create board failed');
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6">

      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Trello Board Manager
          </h1>
          <p className="text-white/90">Manage cards and create boards</p>
        </header>

        {/* ERROR */}
        {error && (
          <div className="bg-red-500 text-white px-6 py-4 rounded-xl mb-6 shadow-lg">
            {error}
          </div>
        )}

        {/* Board Creation Panel */}
        <div className="bg-white/95 rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              placeholder=" New board name"
              value={newBoard.name}
              onChange={(e) =>
                setNewBoard((b) => ({ ...b, name: e.target.value }))
              }
              className="flex-1 min-w-[220px] px-4 py-3 border-2 border-gray-200 rounded-xl"
            />
            <label className="flex items-center gap-2 text-white/90">
              <input
                type="checkbox"
                checked={newBoard.defaultLists}
                onChange={(e) =>
                  setNewBoard((b) => ({ ...b, defaultLists: e.target.checked }))
                }
                className="w-5 h-5 accent-indigo-600"
              />
              <span className="text-gray-800">Create default lists</span>
            </label>
            <button
              onClick={handleCreateBoard}
              className="px-6 py-3 bg-teal-600 text-white rounded-xl shadow-lg"
            >
              Create Board
            </button>
          </div>
        </div>

        {/* Add Card Panel */}
        <div className="bg-white/95 rounded-2xl shadow-2xl p-6 mb-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={newCard.listId}
              onChange={(e) =>
                setNewCard((c) => ({ ...c, listId: e.target.value }))
              }
              className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
            >
              {lists.map((l) => (
                <option value={l.id} key={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <input
              placeholder=" Card title"
              value={newCard.name}
              onChange={(e) =>
                setNewCard((c) => ({ ...c, name: e.target.value }))
              }
              onKeyPress={handleKeyPress}
              className="flex-1 min-w-[200px] px-4 py-3 border-2 border-gray-200 rounded-xl"
            />

            <input
              placeholder=" Description"
              value={newCard.desc}
              onChange={(e) =>
                setNewCard((c) => ({ ...c, desc: e.target.value }))
              }
              onKeyPress={handleKeyPress}
              className="flex-1 min-w-[200px] px-4 py-3 border-2 border-gray-200 rounded-xl"
            />

            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-8 py-3 bg-purple-600 text-white rounded-xl shadow-lg disabled:opacity-50"
            >
              {loading ? ' Adding...' : ' Add Card'}
            </button>
          </div>
        </div>

        {/* --- MOBILE LIST BUTTONS SECTION --- */}
        <div className="md:hidden mb-4">
          <div className="
      flex 
      flex-row 
      justify-center 
      items-center 
      gap-3 
      overflow-x-auto 
      w-full 
      pb-2
    "
          >
            {lists.slice(0, 3).map((list) => (
              <button
                key={list.id}
                onClick={() => setActiveMobileList(list.id)}
                className={`px-4 py-3 rounded-xl font-semibold text-center whitespace-nowrap shadow-md ${activeMobileList === list.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-100 text-indigo-700'
                  }`}
              >
                {list.name}
              </button>
            ))}
          </div>
        </div>
        {/* --- END MOBILE LIST BUTTONS SECTION --- */}

        {/* --- DESKTOP LIST VIEW (unchanged) --- */}
        <div className="hidden md:flex gap-6 overflow-x-auto pb-6">
          {lists.map((list) => (
            <div
              key={list.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleListDrop(e, list.id)}
              className="w-80 bg-white/90 rounded-2xl shadow-xl p-5 flex-shrink-0"
            >
              {/* Desktop list header */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 flex-1">
                  {list.name}
                </h3>
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm">
                  {(list.cards || []).length}
                </span>
              </div>

              {/* Desktop list cards */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {(list.cards || []).map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id, list.id)}
                    className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-md"
                  >
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <h4 className="font-bold text-gray-800 flex-1 text-sm">
                        {card.name}
                      </h4>
                    </div>

                    {card.desc && (
                      <p className="text-gray-600 text-sm mb-3">{card.desc}</p>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleRename(card.id)}
                        className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg"
                      >
                        Rename
                      </button>

                      <button
                        onClick={() => handleMove(card.id)}
                        className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg"
                      >
                        Move
                      </button>

                      <button
                        onClick={() => handleDelete(card.id)}
                        className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ))}

                {(list.cards || []).length === 0 && (
                  <div className="text-center py-8 text-gray-400">No cards yet</div>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* --- END DESKTOP LIST VIEW --- */}

        {/* --- MOBILE LIST CONTENT --- */}
        <div className="md:hidden">
          {lists
            .filter((list) => list.id === activeMobileList)
            .map((list) => (
              <div
                key={list.id}
                className="bg-white/95 rounded-2xl shadow-xl p-5 mt-4"
              >
                <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800 flex-1">
                    {list.name}
                  </h3>
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm">
                    {(list.cards || []).length}
                  </span>
                </div>

                <div className="space-y-3">
                  {(list.cards || []).map((card) => (
                    <div
                      key={card.id}
                      className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-md"
                    >
                      <h4 className="font-bold text-gray-800 text-sm mb-1">
                        {card.name}
                      </h4>

                      {card.desc && (
                        <p className="text-gray-600 text-sm mb-3">
                          {card.desc}
                        </p>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleRename(card.id)}
                          className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleMove(card.id)}
                          className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg"
                        >
                          Move
                        </button>
                        <button
                          onClick={() => handleDelete(card.id)}
                          className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  ))}

                  {(list.cards || []).length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      No cards yet
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
        {/* --- END MOBILE LIST CONTENT --- */}
      </div>
    </div>
  );
}
