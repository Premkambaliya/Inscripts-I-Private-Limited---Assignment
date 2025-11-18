import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import './index.css';
import dotenv from 'dotenv';

// Mock API functions - replace these with your actual API imports
const createTask = async (data) => {
  const response = await fetch(`${API_BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to create task');
  return response.json();
};

const deleteTask = async (cardId) => {
  const response = await fetch(`${API_BASE}/api/tasks/${cardId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete task');
  return response.json();
};

const getBoardListsWithCards = async (boardId) => {
  const response = await fetch(`${API_BASE}/api/boards/${boardId}/lists`);
  if (!response.ok) throw new Error('Failed to fetch board');
  return response.json();
};

const updateTask = async (cardId, data) => {
  const response = await fetch(`${API_BASE}/api/tasks/${cardId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update task');
  return response.json();
};

// Configuration - Replace with your actual values
const BOARD_ID = import.meta.env.VITE_BOARD_ID;
const API_BASE = 'http://localhost:5000';

export default function App() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newCard, setNewCard] = useState({ name: '', desc: '', listId: '' });

  const socket = useMemo(() => io(API_BASE, { transports: ['websocket'] }), []);

  async function load() {
    if (!BOARD_ID || BOARD_ID === 'your-board-id') {
      setError('BOARD_ID is not configured. Please set your Trello board ID.');
      // Demo data for preview
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
    socket.on('taskCreated', () => load());
    socket.on('taskUpdated', () => load());
    socket.on('taskDeleted', () => load());
    socket.on('trelloEvent', () => load());
    socket.on('webhookEvent', () => load());
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  async function handleCreate() {
    if (!newCard.name || !newCard.listId) return;
    try {
      await createTask({ listId: newCard.listId, name: newCard.name, desc: newCard.desc });
      setNewCard({ name: '', desc: '', listId: newCard.listId });
      await load();
    } catch (e) {
      alert(e?.message || 'Create failed');
    }
  }

  async function handleDelete(cardId) {
    if (!confirm('Archive this card?')) return;
    try {
      await deleteTask(cardId);
      await load();
    } catch (e) {
      alert(e?.message || 'Delete failed');
    }
  }

  async function handleRename(cardId) {
    const name = prompt('New title?');
    if (!name) return;
    try {
      await updateTask(cardId, { name });
      await load();
    } catch (e) {
      alert(e?.message || 'Update failed');
    }
  }

  async function handleMove(cardId) {
    const listId = prompt('Move to listId?');
    if (!listId) return;
    try {
      await updateTask(cardId, { idList: listId });
      await load();
    } catch (e) {
      alert(e?.message || 'Move failed');
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
      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        .animate-fadeInDown {
          animation: fadeInDown 0.6s ease-out;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideIn {
          animation: slideIn 0.5s ease-out;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .card-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
        }

        .btn-hover {
          transition: all 0.3s ease;
        }

        .btn-hover:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .btn-hover:active:not(:disabled) {
          transform: scale(0.95);
        }

        .list-column {
          animation: slideIn 0.5s ease-out;
          animation-fill-mode: both;
        }

        .list-column:nth-child(1) { animation-delay: 0.1s; }
        .list-column:nth-child(2) { animation-delay: 0.2s; }
        .list-column:nth-child(3) { animation-delay: 0.3s; }
        .list-column:nth-child(4) { animation-delay: 0.4s; }

        .scrollbar-custom::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .scrollbar-custom::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }

        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.5);
          border-radius: 10px;
        }

        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.7);
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-10 animate-fadeInDown">
          <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
            🎯 Trello Board Manager
          </h1>
          <p className="text-white/90 text-sm bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 inline-block">
            API: {API_BASE}
          </p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500 text-white px-6 py-4 rounded-xl mb-6 shadow-lg animate-shake">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Card Creation Panel */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-8 animate-fadeInUp">
          <div className="flex flex-wrap gap-3">
            <select
              value={newCard.listId}
              onChange={(e) => setNewCard((c) => ({ ...c, listId: e.target.value }))}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 outline-none transition-all bg-white"
            >
              {lists.map((l) => (
                <option value={l.id} key={l.id}>
                  📋 {l.name}
                </option>
              ))}
            </select>
            
            <input
              placeholder="✏️ Card title"
              value={newCard.name}
              onChange={(e) => setNewCard((c) => ({ ...c, name: e.target.value }))}
              onKeyPress={handleKeyPress}
              className="flex-1 min-w-[200px] px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 outline-none transition-all"
            />
            
            <input
              placeholder="📝 Description"
              value={newCard.desc}
              onChange={(e) => setNewCard((c) => ({ ...c, desc: e.target.value }))}
              onKeyPress={handleKeyPress}
              className="flex-1 min-w-[200px] px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 outline-none transition-all"
            />
            
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl btn-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Adding...' : '➕ Add Card'}
            </button>
          </div>
        </div>

        {/* Lists Container */}
        <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-custom">
          {lists.map((list, idx) => (
            <div
              key={list.id}
              className="list-column flex-shrink-0 w-80 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-5"
            >
              <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 flex-1">
                  {list.name}
                </h3>
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
                  {(list.cards || []).length}
                </span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-custom">
                {(list.cards || []).map((card) => (
                  <div
                    key={card.id}
                    className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-4 card-hover shadow-md"
                  >
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <h4 className="font-bold text-gray-800 flex-1 text-sm leading-tight">
                        {card.name}
                      </h4>
                    </div>
                    
                    {card.desc && (
                      <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                        {card.desc}
                      </p>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleRename(card.id)}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg btn-hover shadow-sm"
                      >
                        ✏️ Rename
                      </button>
                      <button
                        onClick={() => handleMove(card.id)}
                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg btn-hover shadow-sm"
                      >
                        🔄 Move
                      </button>
                      <button
                        onClick={() => handleDelete(card.id)}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg btn-hover shadow-sm"
                      >
                        🗑️ Archive
                      </button>
                    </div>
                  </div>
                ))}

                {(list.cards || []).length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm">No cards yet</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {lists.length === 0 && !loading && (
          <div className="text-center py-20 text-white animate-fadeInUp">
            <p className="text-6xl mb-4">🎨</p>
            <p className="text-2xl font-semibold">No lists found</p>
            <p className="text-white/80 mt-2">Configure your BOARD_ID to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}