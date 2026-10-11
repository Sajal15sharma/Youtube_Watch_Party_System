import assert from 'node:assert';
import { hasPermission } from './rbac.js';
import { generateRoomCode, normalizeRoomCode } from './roomCodeGenerator.js';

export function runRbacVerification(): void {
  console.log('Running RBAC & Host Permission Verification...');

  // HOST Permissions
  assert.strictEqual(hasPermission('HOST', 'play'), true);
  assert.strictEqual(hasPermission('HOST', 'pause'), true);
  assert.strictEqual(hasPermission('HOST', 'seek'), true);
  assert.strictEqual(hasPermission('HOST', 'change_video'), true);
  assert.strictEqual(hasPermission('HOST', 'assign_role'), true);
  assert.strictEqual(hasPermission('HOST', 'remove_participant'), true);
  assert.strictEqual(hasPermission('HOST', 'transfer_host'), true);

  // MODERATOR Permissions (Playback control permitted; role management HOST-only)
  assert.strictEqual(hasPermission('MODERATOR', 'play'), true);
  assert.strictEqual(hasPermission('MODERATOR', 'pause'), true);
  assert.strictEqual(hasPermission('MODERATOR', 'seek'), true);
  assert.strictEqual(hasPermission('MODERATOR', 'change_video'), true);
  assert.strictEqual(hasPermission('MODERATOR', 'assign_role'), false);
  assert.strictEqual(hasPermission('MODERATOR', 'remove_participant'), false);
  assert.strictEqual(hasPermission('MODERATOR', 'transfer_host'), false);

  // PARTICIPANT Permissions
  assert.strictEqual(hasPermission('PARTICIPANT', 'play'), false);
  assert.strictEqual(hasPermission('PARTICIPANT', 'pause'), false);
  assert.strictEqual(hasPermission('PARTICIPANT', 'seek'), false);
  assert.strictEqual(hasPermission('PARTICIPANT', 'change_video'), false);
  assert.strictEqual(hasPermission('PARTICIPANT', 'assign_role'), false);
  assert.strictEqual(hasPermission('PARTICIPANT', 'remove_participant'), false);
  assert.strictEqual(hasPermission('PARTICIPANT', 'transfer_host'), false);

  // Room code generator
  const code = generateRoomCode(6);
  assert.strictEqual(code.length, 6);
  assert.strictEqual(normalizeRoomCode(' abc123 '), 'ABC123');

  console.log('✅ All RBAC & Host permission checks passed successfully!');
}
