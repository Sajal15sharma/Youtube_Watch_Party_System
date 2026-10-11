import { randomUUID } from 'node:crypto';

export function cryptoRandomUUID(): string {
  return randomUUID();
}
