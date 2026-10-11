const { io } = require('./client/node_modules/socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:5000';

async function runSimulation() {
  console.log('====================================================');
  console.log('🔄 STARTING PHASE 2(a) SOCKET.IO REAL-SERVER TEST');
  console.log(`📡 Connecting to real server: ${SERVER_URL}`);
  console.log('====================================================\n');

  // Step 1: Create room via HTTP POST /api/rooms
  console.log('[STEP 1] Creating a room via HTTP POST /api/rooms...');
  const createRes = await fetch(`${SERVER_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'SimulatedHost',
      videoId: 'dQw4w9WgXcQ'
    })
  });

  assert.strictEqual(createRes.status, 201, `Room creation failed with HTTP ${createRes.status}`);
  const createData = await createRes.json();
  const roomCode = createData.room.roomCode;
  const hostParticipantId = createData.hostParticipant.id;

  console.log(`[SYNC Hop 0] Room created successfully!`);
  console.log(`   Room Code: ${roomCode}`);
  console.log(`   Host User: ${createData.hostParticipant.username} (${hostParticipantId})`);
  console.log(`   Initial Video: ${createData.room.currentVideoId}\n`);

  // Step 2: Connect Host socket and join room
  console.log('[STEP 2] Connecting Host socket to server...');
  const hostSocket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    forceNew: true
  });

  const hostJoinedPromise = new Promise((resolve, reject) => {
    hostSocket.on('connect', () => {
      console.log(`[SYNC Hop 1a] Host socket connected (socket.id=${hostSocket.id}). Emitting 'join_room'...`);
      hostSocket.emit('join_room', {
        roomCode,
        username: 'SimulatedHost',
        participantId: hostParticipantId
      });
    });

    hostSocket.on('room_state', (state) => {
      console.log(`[SYNC Hop 1b] Host received initial 'room_state':`, {
        roomCode: state.room.roomCode,
        video: state.room.currentVideoId,
        playState: state.room.currentPlaybackState,
        currentUserRole: state.currentUser.role
      });
      assert.strictEqual(state.currentUser.role, 'HOST', 'Room creator must be assigned HOST');
      resolve(state);
    });

    hostSocket.on('error', (err) => reject(new Error('Host socket error: ' + JSON.stringify(err))));
  });

  await hostJoinedPromise;
  console.log('✅ Host joined successfully with HOST role.\n');

  // Step 3: Connect Viewer socket and join room
  console.log('[STEP 3] Connecting Viewer socket to server...');
  const viewerSocket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    forceNew: true
  });

  const viewerJoinedPromise = new Promise((resolve, reject) => {
    viewerSocket.on('connect', () => {
      console.log(`[SYNC Hop 2a] Viewer socket connected (socket.id=${viewerSocket.id}). Emitting 'join_room'...`);
      viewerSocket.emit('join_room', {
        roomCode,
        username: 'SimulatedViewer'
      });
    });

    viewerSocket.on('room_state', (state) => {
      console.log(`[SYNC Hop 2b] Viewer received initial 'room_state':`, {
        roomCode: state.room.roomCode,
        video: state.room.currentVideoId,
        playState: state.room.currentPlaybackState,
        currentUserRole: state.currentUser.role
      });
      assert.strictEqual(state.currentUser.role, 'PARTICIPANT', 'Joiner must be assigned PARTICIPANT');
      resolve(state);
    });

    viewerSocket.on('error', (err) => reject(new Error('Viewer socket error: ' + JSON.stringify(err))));
  });

  await viewerJoinedPromise;
  console.log('✅ Viewer joined successfully with PARTICIPANT role.\n');

  // Helper to wait for viewer event
  function waitForViewerEvent(eventName, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for viewer event '${eventName}' after ${timeoutMs}ms`));
      }, timeoutMs);

      viewerSocket.once(eventName, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  // Step 4: Host emits 'play' -> Assert Viewer receives 'play'
  console.log('[STEP 4] Testing PLAY event synchronization...');
  const playReceivedPromise = waitForViewerEvent('play');
  console.log(`[SYNC Hop 3 - Host Emit] Host emitting 'play' { roomCode: '${roomCode}', time: 10.5 }`);
  hostSocket.emit('play', { roomCode, time: 10.5 });

  const playPayload = await playReceivedPromise;
  console.log(`[SYNC Hop 4 - Viewer Receive] Viewer received 'play' broadcast:`, playPayload);
  assert.strictEqual(playPayload.time, 10.5, 'Viewer play time must match Host play time');
  assert.strictEqual(playPayload.videoId, 'dQw4w9WgXcQ', 'Viewer play videoId must match');
  assert.strictEqual(playPayload.updatedBy, 'SimulatedHost', 'Viewer play updatedBy must match');
  assert.ok(typeof playPayload.updatedAtServerTime === 'number', 'Server must attach timestamp');
  console.log('✅ PLAY event verified!\n');

  // Step 5: Host emits 'seek' -> Assert Viewer receives 'seek'
  console.log('[STEP 5] Testing SEEK event synchronization...');
  const seekReceivedPromise = waitForViewerEvent('seek');
  console.log(`[SYNC - Host Emit] Host emitting 'seek' { roomCode: '${roomCode}', time: 42.0 }`);
  hostSocket.emit('seek', { roomCode, time: 42.0 });

  const seekPayload = await seekReceivedPromise;
  console.log(`[SYNC - Viewer Receive] Viewer received 'seek' broadcast:`, seekPayload);
  assert.strictEqual(seekPayload.time, 42.0, 'Viewer seek time must match Host seek time');
  assert.strictEqual(seekPayload.updatedBy, 'SimulatedHost', 'Viewer seek updatedBy must match');
  assert.ok(typeof seekPayload.updatedAtServerTime === 'number', 'Server must attach timestamp');
  console.log('✅ SEEK event verified!\n');

  // Step 6: Host emits 'pause' -> Assert Viewer receives 'pause'
  console.log('[STEP 6] Testing PAUSE event synchronization...');
  const pauseReceivedPromise = waitForViewerEvent('pause');
  console.log(`[SYNC - Host Emit] Host emitting 'pause' { roomCode: '${roomCode}', time: 42.0 }`);
  hostSocket.emit('pause', { roomCode, time: 42.0 });

  const pausePayload = await pauseReceivedPromise;
  console.log(`[SYNC - Viewer Receive] Viewer received 'pause' broadcast:`, pausePayload);
  assert.strictEqual(pausePayload.time, 42.0, 'Viewer pause time must match Host pause time');
  assert.strictEqual(pausePayload.updatedBy, 'SimulatedHost', 'Viewer pause updatedBy must match');
  assert.ok(typeof pausePayload.updatedAtServerTime === 'number', 'Server must attach timestamp');
  console.log('✅ PAUSE event verified!\n');

  // Step 7: Host emits 'change_video' -> Assert Viewer receives 'video_changed'
  console.log('[STEP 7] Testing CHANGE_VIDEO event synchronization...');
  const changeReceivedPromise = waitForViewerEvent('video_changed');
  console.log(`[SYNC - Host Emit] Host emitting 'change_video' { roomCode: '${roomCode}', videoId: 'jNQXAC9IVRw' }`);
  hostSocket.emit('change_video', { roomCode, videoId: 'jNQXAC9IVRw' });

  const changePayload = await changeReceivedPromise;
  console.log(`[SYNC - Viewer Receive] Viewer received 'video_changed' broadcast:`, changePayload);
  assert.strictEqual(changePayload.videoId, 'jNQXAC9IVRw', 'Viewer videoId must match new video');
  assert.strictEqual(changePayload.time, 0, 'New video must start at time 0');
  assert.strictEqual(changePayload.updatedBy, 'SimulatedHost', 'Viewer change updatedBy must match');
  console.log('✅ CHANGE_VIDEO event verified!\n');

  // Step 8: Assert that PARTICIPANT/Viewer emitting 'play' is REJECTED by server
  console.log('[STEP 8] Testing Server RBAC Rejection of Viewer Play Command...');
  const viewerErrorPromise = new Promise((resolve) => {
    viewerSocket.once('error', (err) => {
      resolve(err);
    });
  });

  console.log(`[SYNC RBAC Test] Viewer attempting unauthorized 'play' { roomCode: '${roomCode}', time: 50 }`);
  viewerSocket.emit('play', { roomCode, time: 50 });

  const errorPayload = await viewerErrorPromise;
  console.log(`[SYNC RBAC Test] Server successfully REJECTED viewer play with error:`, errorPayload);
  assert.ok(errorPayload.message.includes('Unauthorized'), 'Error message must specify Unauthorized');
  console.log('✅ Viewer RBAC rejection verified!\n');

  // Clean up sockets
  hostSocket.disconnect();
  viewerSocket.disconnect();

  console.log('====================================================');
  console.log('🎉 ALL PHASE 2(a) REAL-SERVER TESTS PASSED 100%!');
  console.log('====================================================');
}

runSimulation().catch((err) => {
  console.error('❌ PHASE 2(a) TEST FAILED:', err);
  process.exit(1);
});
