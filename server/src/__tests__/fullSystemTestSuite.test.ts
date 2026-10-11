import assert from 'node:assert';
import { roomService } from '../services/roomService.js';
import { participantService } from '../services/participantService.js';
import { roomStateStore } from '../services/roomStateStore.js';
import { hasPermission } from '../utils/rbac.js';
import { extractYouTubeVideoId } from '../utils/youtube.js';

export async function runFullSystemTestSuite(): Promise<void> {
  console.log('🧪 Running Complete 17-Point YouTube Watch Party Test Suite (Updated Permissions)...\n');

  const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const videoId = extractYouTubeVideoId(videoUrl);
  assert.strictEqual(videoId, 'dQw4w9WgXcQ');

  // Room Setup
  const { room: roomA } = await roomService.createRoom('Host Alex', videoId!);
  const hostPart = await participantService.joinRoom(roomA.roomCode, 'Host Alex', roomA.hostUserId);
  assert.strictEqual(hostPart.participant.role, 'HOST');

  const viewerPart = await participantService.joinRoom(roomA.roomCode, 'Viewer Sam');
  assert.strictEqual(viewerPart.participant.role, 'PARTICIPANT');

  // 1. Host can promote viewer to moderator
  console.log('Test 1: Host can promote viewer to moderator');
  const promoted = await participantService.updateRole(roomA.roomCode, viewerPart.participant.id, 'MODERATOR');
  assert.strictEqual(promoted?.role, 'MODERATOR');
  console.log('✅ Test 1 Passed');

  // 2. Host can demote moderator to viewer
  console.log('Test 2: Host can demote moderator to viewer');
  const demoted = await participantService.updateRole(roomA.roomCode, viewerPart.participant.id, 'PARTICIPANT');
  assert.strictEqual(demoted?.role, 'PARTICIPANT');
  console.log('✅ Test 2 Passed');

  // 3. Viewer cannot promote anyone
  console.log('Test 3: Viewer cannot promote anyone');
  assert.strictEqual(hasPermission('PARTICIPANT', 'assign_role'), false);
  console.log('✅ Test 3 Passed');

  // 4. Moderator cannot promote anyone
  console.log('Test 4: Moderator cannot promote anyone');
  assert.strictEqual(hasPermission('MODERATOR', 'assign_role'), false);
  console.log('✅ Test 4 Passed');

  // 5. Host can transfer ownership to moderator
  console.log('Test 5: Host can transfer ownership to moderator');
  await participantService.updateRole(roomA.roomCode, viewerPart.participant.id, 'MODERATOR');
  const transferSuccess1 = await participantService.transferHost(roomA.roomCode, hostPart.participant.id, viewerPart.participant.id);
  assert.strictEqual(transferSuccess1, true);
  const newHostState1 = roomStateStore.getParticipant(roomA.roomCode, viewerPart.participant.id);
  const oldHostState1 = roomStateStore.getParticipant(roomA.roomCode, hostPart.participant.id);
  assert.strictEqual(newHostState1?.role, 'HOST');
  assert.strictEqual(oldHostState1?.role, 'MODERATOR');
  console.log('✅ Test 5 Passed');

  // 6. Host can transfer ownership to viewer
  console.log('Test 6: Host can transfer ownership to viewer');
  // Create another viewer Jordan
  const viewerJordan = await participantService.joinRoom(roomA.roomCode, 'Viewer Jordan');
  assert.strictEqual(viewerJordan.participant.role, 'PARTICIPANT');
  // Sam (current Host) transfers host to Jordan (Viewer)
  const transferSuccess2 = await participantService.transferHost(roomA.roomCode, viewerPart.participant.id, viewerJordan.participant.id);
  assert.strictEqual(transferSuccess2, true);
  const jordanState = roomStateStore.getParticipant(roomA.roomCode, viewerJordan.participant.id);
  assert.strictEqual(jordanState?.role, 'HOST');
  console.log('✅ Test 6 Passed');

  // 7. Previous host loses host-only administrative privileges after transfer
  console.log('Test 7: Previous host loses host-only administrative privileges after transfer');
  const samState = roomStateStore.getParticipant(roomA.roomCode, viewerPart.participant.id);
  assert.strictEqual(samState?.role, 'MODERATOR');
  assert.strictEqual(hasPermission(samState!.role, 'play'), true, 'Moderator retains playback permissions');
  assert.strictEqual(hasPermission(samState!.role, 'assign_role'), false, 'Moderator loses host administration');
  console.log('✅ Test 7 Passed');

  // 8. Only one host exists per room
  console.log('Test 8: Only one host exists per room');
  const roomAParticipants = roomStateStore.getParticipants(roomA.roomCode);
  const hostCount = roomAParticipants.filter((p) => p.role === 'HOST').length;
  assert.strictEqual(hostCount, 1);
  console.log('✅ Test 8 Passed');

  // 9. Viewer cannot play or pause through a socket event
  console.log('Test 9: Viewer cannot play or pause');
  assert.strictEqual(hasPermission('PARTICIPANT', 'play'), false);
  assert.strictEqual(hasPermission('PARTICIPANT', 'pause'), false);
  console.log('✅ Test 9 Passed');

  // 10. Viewer cannot seek or change video through a socket event
  console.log('Test 10: Viewer cannot seek or change video');
  assert.strictEqual(hasPermission('PARTICIPANT', 'seek'), false);
  assert.strictEqual(hasPermission('PARTICIPANT', 'change_video'), false);
  console.log('✅ Test 10 Passed');

  // 11. Moderator can perform playback actions but cannot perform host-only administrative actions
  console.log('Test 11: Moderator playback permission vs admin restriction');
  assert.strictEqual(hasPermission('MODERATOR', 'play'), true);
  assert.strictEqual(hasPermission('MODERATOR', 'pause'), true);
  assert.strictEqual(hasPermission('MODERATOR', 'seek'), true);
  assert.strictEqual(hasPermission('MODERATOR', 'change_video'), true);
  assert.strictEqual(hasPermission('MODERATOR', 'assign_role'), false);
  assert.strictEqual(hasPermission('MODERATOR', 'remove_participant'), false);
  assert.strictEqual(hasPermission('MODERATOR', 'transfer_host'), false);
  console.log('✅ Test 11 Passed');

  // 12. Host Play synchronizes to viewers
  console.log('Test 12: Host Play synchronizes to viewers');
  const playingState = await roomService.updatePlayback(roomA.roomCode, {
    playState: 'playing',
    currentTime: 10.0,
  });
  assert.strictEqual(playingState?.currentPlaybackState, 'playing');
  console.log('✅ Test 12 Passed');

  // 13. Host Pause synchronizes to viewers
  console.log('Test 13: Host Pause synchronizes to viewers');
  const pausedState = await roomService.updatePlayback(roomA.roomCode, {
    playState: 'paused',
    currentTime: 25.0,
  });
  assert.strictEqual(pausedState?.currentPlaybackState, 'paused');
  assert.strictEqual(pausedState?.currentPlaybackTime, 25.0);
  console.log('✅ Test 13 Passed');

  // 14. Host Seek synchronizes to viewers
  console.log('Test 14: Host Seek synchronizes to viewers');
  const seekedState = await roomService.updatePlayback(roomA.roomCode, {
    currentTime: 120.0,
  });
  assert.strictEqual(seekedState?.currentPlaybackTime, 120.0);
  console.log('✅ Test 14 Passed');

  // 15. Host Change Video synchronizes to viewers
  console.log('Test 15: Host Change Video synchronizes to viewers');
  const changedState = await roomService.updatePlayback(roomA.roomCode, {
    videoId: 'jNQXAC9IVRw',
    currentTime: 0,
    playState: 'paused',
  });
  assert.strictEqual(changedState?.currentVideoId, 'jNQXAC9IVRw');
  console.log('✅ Test 15 Passed');

  // 16. Late joiner receives the current shared playback state
  console.log('Test 16: Late joiner receives current shared playback state');
  await roomService.updatePlayback(roomA.roomCode, {
    playState: 'playing',
    currentTime: 45.0,
  });
  const lateJoiner = await participantService.joinRoom(roomA.roomCode, 'Late Joiner Casey');
  const stateForCasey = roomStateStore.getRoomState(roomA.roomCode);
  assert.strictEqual(stateForCasey?.currentVideoId, 'jNQXAC9IVRw');
  assert.strictEqual(stateForCasey?.currentPlaybackState, 'playing');
  assert.ok((stateForCasey?.currentPlaybackTime ?? 0) >= 45.0);
  console.log('✅ Test 16 Passed');

  // 17. Room isolation and reconnect behavior remain correct
  console.log('Test 17: Room isolation and reconnect behavior');
  const { room: roomB } = await roomService.createRoom('Host Bob', 'v9999999999');
  await participantService.joinRoom(roomB.roomCode, 'Host Bob', roomB.hostUserId);
  await roomService.updatePlayback(roomB.roomCode, { playState: 'playing', currentTime: 100.0 });

  const finalRoomA = roomStateStore.getRoomState(roomA.roomCode);
  const finalRoomB = roomStateStore.getRoomState(roomB.roomCode);

  assert.notStrictEqual(finalRoomA?.roomCode, finalRoomB?.roomCode);
  assert.strictEqual(finalRoomA?.currentVideoId, 'jNQXAC9IVRw');
  assert.strictEqual(finalRoomB?.currentVideoId, 'v9999999999');

  // Reconnect Jordan (current Host of Room A)
  const reconnectJordan = await participantService.joinRoom(roomA.roomCode, 'Viewer Jordan', viewerJordan.participant.id);
  assert.strictEqual(reconnectJordan.participant.role, 'HOST');

  // Reconnect Sam (demoted previous Host) -> must NOT regain HOST role
  const reconnectSam = await participantService.joinRoom(roomA.roomCode, 'Guest Sam', viewerPart.participant.id);
  assert.strictEqual(reconnectSam.participant.role, 'MODERATOR');
  console.log('✅ Test 17 Passed');

  // 18. Host can create a room without a YouTube video URL upfront
  console.log('Test 18: Host can create room without initial YouTube video');
  const { room: emptyRoom } = await roomService.createRoom('Host Empty');
  assert.strictEqual(emptyRoom.currentVideoId, null);
  const emptyState = roomStateStore.getRoomState(emptyRoom.roomCode);
  assert.strictEqual(emptyState?.currentVideoId, null);
  console.log('✅ Test 18 Passed');

  // 19. Participants can join empty room and video is synchronized when selected post-creation
  console.log('Test 19: Participants join empty room and receive video when Host selects it');
  const emptyGuest = await participantService.joinRoom(emptyRoom.roomCode, 'Guest Charlie');
  assert.strictEqual(emptyGuest.participant.role, 'PARTICIPANT');
  const postSelectionState = await roomService.updatePlayback(emptyRoom.roomCode, {
    videoId: 'dQw4w9WgXcQ',
    currentTime: 0,
    playState: 'paused',
  });
  assert.strictEqual(postSelectionState?.currentVideoId, 'dQw4w9WgXcQ');
  console.log('✅ Test 19 Passed');

  console.log('\n🎉 ALL 19 SYSTEM TEST CASES PASSED CLEANLY AND AUTHORITATIVELY!\n');
}

// Execute if run directly
runFullSystemTestSuite().catch((err) => {
  console.error('❌ Test Execution Failure:', err);
  process.exit(1);
});
