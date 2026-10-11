import assert from 'node:assert';
import { roomService } from '../services/roomService.js';
import { participantService } from '../services/participantService.js';
import { roomStateStore } from '../services/roomStateStore.js';
import { hasPermission } from '../utils/rbac.js';
import { extractYouTubeVideoId } from '../utils/youtube.js';

export async function runSyncAndIsolationTests(): Promise<void> {
  console.log('🧪 Starting Full YouTube URL Extraction, Sync & Room Isolation Test Suite...\n');

  // Test 1: YouTube URL Extraction Parsing (Standard, Short, Shorts, Embed, Raw ID)
  console.log('Test 1: YouTube URL Video ID Extraction Validation');
  const sampleVideoId = 'dQw4w9WgXcQ';
  const testUrls = [
    `https://www.youtube.com/watch?v=${sampleVideoId}`,
    `https://youtu.be/${sampleVideoId}`,
    `https://www.youtube.com/shorts/${sampleVideoId}`,
    `https://www.youtube.com/embed/${sampleVideoId}`,
    `https://m.youtube.com/watch?v=${sampleVideoId}`,
    `https://music.youtube.com/watch?v=${sampleVideoId}`,
    sampleVideoId,
  ];

  for (const url of testUrls) {
    const extracted = extractYouTubeVideoId(url);
    assert.strictEqual(extracted, sampleVideoId, `Extracted ID from '${url}' must equal '${sampleVideoId}'`);
  }
  console.log('✅ Test 1 Passed: All representative YouTube URL formats produce expected Video ID.\n');

  // Test 2: Room Creation Persists Exact Submitted Video ID
  console.log('Test 2: Room Creation Persists Submitted Video ID');
  const customVideoUrl = 'https://www.youtube.com/watch?v=L_LUpnjgPso';
  const customVideoId = extractYouTubeVideoId(customVideoUrl);
  assert.ok(customVideoId, 'Extracted video ID should not be null');

  const { room: roomA } = await roomService.createRoom('Host Alex', customVideoId);
  assert.strictEqual(roomA.currentVideoId, customVideoId, 'Room creation must persist exact submitted video ID');

  const hostPartA = await participantService.joinRoom(roomA.roomCode, 'Host Alex', roomA.hostUserId);
  assert.strictEqual(hostPartA.participant.role, 'HOST', 'Room creator must be assigned HOST role');
  console.log('✅ Test 2 Passed: Room created with exact submitted YouTube video ID.\n');

  // Test 3: Initial Room State Payload Contains Exact Submitted ID
  console.log('Test 3: Initial Room State Payload Validation');
  const roomStatePayload = roomStateStore.getRoomState(roomA.roomCode);
  assert.ok(roomStatePayload, 'Room state payload must exist');
  assert.strictEqual(roomStatePayload?.currentVideoId, customVideoId, 'Initial room state must match host submitted video ID');
  console.log('✅ Test 3 Passed: Authoritative room state contains exact submitted video ID.\n');

  // Test 4: Joining Guest Receives Exact Same Video ID & Playback State
  console.log('Test 4: Guest Joining Receives Exact Host State');
  await roomService.updatePlayback(roomA.roomCode, {
    videoId: customVideoId,
    playState: 'playing',
    currentTime: 75.0,
  });

  const guestPartA = await participantService.joinRoom(roomA.roomCode, 'Guest Sam');
  assert.strictEqual(guestPartA.participant.role, 'PARTICIPANT', 'Guest must be assigned PARTICIPANT role');

  const guestState = roomStateStore.getRoomState(roomA.roomCode);
  assert.strictEqual(guestState?.currentVideoId, customVideoId, 'Guest must receive exact host video ID');
  assert.strictEqual(guestState?.currentPlaybackState, 'playing', 'Guest must receive exact playback state');
  assert.ok((guestState?.currentPlaybackTime ?? 0) >= 75.0, 'Guest must receive updated playback time');
  console.log('✅ Test 4 Passed: Guest receives authoritative video ID and playback state upon joining.\n');

  // Test 5: Viewer Playback Controls Rejected by Server RBAC
  console.log('Test 5: Viewer Playback Command Authorization Rejection');
  const viewerRole = guestPartA.participant.role;
  assert.strictEqual(viewerRole, 'PARTICIPANT');

  assert.strictEqual(hasPermission(viewerRole, 'play'), false, 'Server must reject PARTICIPANT play');
  assert.strictEqual(hasPermission(viewerRole, 'pause'), false, 'Server must reject PARTICIPANT pause');
  assert.strictEqual(hasPermission(viewerRole, 'seek'), false, 'Server must reject PARTICIPANT seek');
  assert.strictEqual(hasPermission(viewerRole, 'change_video'), false, 'Server must reject PARTICIPANT change_video');
  console.log('✅ Test 5 Passed: Server RBAC rejects all unauthorized viewer commands.\n');

  // Test 6: Host Video Change Propagation
  console.log('Test 6: Host Changing Video Updates Room Participants');
  const newVideoUrl = 'https://youtu.be/jNQXAC9IVRw';
  const newVideoId = extractYouTubeVideoId(newVideoUrl);
  assert.strictEqual(newVideoId, 'jNQXAC9IVRw');

  const updatedState = await roomService.updatePlayback(roomA.roomCode, {
    videoId: newVideoId!,
    currentTime: 0,
    playState: 'paused',
  });
  assert.strictEqual(updatedState?.currentVideoId, 'jNQXAC9IVRw');
  assert.strictEqual(updatedState?.currentPlaybackState, 'paused');
  assert.strictEqual(updatedState?.currentPlaybackTime, 0);

  const stateForGuests = roomStateStore.getRoomState(roomA.roomCode);
  assert.strictEqual(stateForGuests?.currentVideoId, 'jNQXAC9IVRw', 'New video ID reaches guests');
  console.log('✅ Test 6 Passed: Video change successfully updates authoritative room state.\n');

  // Test 7: Play, Pause, and Seek Propagation
  console.log('Test 7: Play, Pause, and Seek State Propagation');
  // Seek to 30.0s
  const seekedState = await roomService.updatePlayback(roomA.roomCode, { currentTime: 30.0 });
  assert.strictEqual(seekedState?.currentPlaybackTime, 30.0);

  // Play
  const playState = await roomService.updatePlayback(roomA.roomCode, { playState: 'playing', currentTime: 30.0 });
  assert.strictEqual(playState?.currentPlaybackState, 'playing');

  // Pause
  const pauseState = await roomService.updatePlayback(roomA.roomCode, { playState: 'paused', currentTime: 45.0 });
  assert.strictEqual(pauseState?.currentPlaybackState, 'paused');
  assert.strictEqual(pauseState?.currentPlaybackTime, 45.0);
  console.log('✅ Test 7 Passed: Play, pause, and seek updates propagate correctly.\n');

  // Test 8: Room Isolation Between Two Distinct Rooms
  console.log('Test 8: Room Isolation Between Room A and Room B');
  const { room: roomB } = await roomService.createRoom('Host User 2', 'v1234567890');
  await participantService.joinRoom(roomB.roomCode, 'Host User 2', roomB.hostUserId);

  await roomService.updatePlayback(roomB.roomCode, {
    videoId: 'v1234567890',
    playState: 'playing',
    currentTime: 10.0,
  });

  const finalStateRoomA = roomStateStore.getRoomState(roomA.roomCode);
  const finalStateRoomB = roomStateStore.getRoomState(roomB.roomCode);

  assert.notStrictEqual(finalStateRoomA?.roomCode, finalStateRoomB?.roomCode);
  assert.strictEqual(finalStateRoomA?.currentVideoId, 'jNQXAC9IVRw');
  assert.strictEqual(finalStateRoomB?.currentVideoId, 'v1234567890');
  assert.strictEqual(finalStateRoomA?.currentPlaybackState, 'paused');
  assert.strictEqual(finalStateRoomB?.currentPlaybackState, 'playing');
  console.log('✅ Test 8 Passed: Room A and Room B remain strictly isolated.\n');

  console.log('🎉 ALL 8 REGRESSION AND ISOLATION TESTS PASSED SUCCESSFULLY!\n');
}

// Execute if run directly
runSyncAndIsolationTests().catch((err) => {
  console.error('❌ Test Execution Failure:', err);
  process.exit(1);
});
