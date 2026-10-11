/**
 * Generates a clean, readable, unique room code.
 * Format: 6 uppercase letters/digits (e.g. 'PARTY9', 'A7X92B')
 */
export function generateRoomCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing 0/O, 1/I
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Normalizes user room code input by trimming and converting to uppercase.
 */
export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}
