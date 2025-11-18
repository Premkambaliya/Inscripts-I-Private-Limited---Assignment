import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

export const api = axios.create({
  baseURL: API_BASE,
})

export async function getBoardListsWithCards(boardId) {
  const { data } = await api.get(`/api/boards/${boardId}/lists`)
  return data
}

export async function createTask({ listId, name, desc }) {
  const { data } = await api.post('/api/tasks', { listId, name, desc })
  return data
}

export async function updateTask(cardId, payload) {
  const { data } = await api.put(`/api/tasks/${cardId}`, payload)
  return data
}

export async function deleteTask(cardId) {
  const { data } = await api.delete(`/api/tasks/${cardId}`)
  return data
}

export async function createBoard({ name, defaultLists = true }) {
  const { data } = await api.post('/api/boards', { name, defaultLists })
  return data
}

