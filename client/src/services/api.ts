import { Participant, Room } from '../types/index';

const API_BASE_URL = '/api';

export interface CreateRoomResponse {
  message: string;
  room: Room;
  hostParticipant: Participant;
}

export interface GetRoomResponse {
  room: Room;
}

export interface GetParticipantsResponse {
  participants: Participant[];
}

export async function createRoom(username: string, videoId?: string): Promise<CreateRoomResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, videoId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to create room.');
  }

  return data;
}

export async function getRoom(roomCode: string): Promise<GetRoomResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms/${roomCode}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch room.');
  }

  return data;
}

export async function getParticipants(roomCode: string): Promise<GetParticipantsResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms/${roomCode}/participants`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch participants.');
  }

  return data;
}
