# YouTube Watch Party System

A complete full-stack real-time watch party platform that enables multiple users to watch YouTube videos together in frame-perfect synchronized playback with server-enforced role permissions.

---

## 🌟 Key Features

- **Authoritative Video Synchronization**: Server maintains a single source of truth for playback state (`videoId`, `playState`, `currentTime`) and calculates live elapsed drift across network latency.
- **Echo-Loop Prevention**: Client-side source tracking suppresses redundant socket event loops when YouTube player state changes programmatically.
- **Role-Based Access Control (RBAC)**:
  - **HOST**: Full control over video playback, role promotion/demotion, user removal (kick), and host privilege transfer.
  - **MODERATOR**: Full playback control (play, pause, seek, change video).
  - **PARTICIPANT / VIEWER**: Synchronized viewing experience with playback controls locked to prevent unauthorized tampering.
- **Instant Room Creation & Link Sharing**: Generates readable 6-character room codes (`/room/:roomCode`) with one-click URL sharing.
- **Real-Time Participant Management**: Active member list with role badges updating in real time on join, leave, role promotion, and host transfer.
- **Live Party Chat**: Instant text messaging within the watch party room.
- **PostgreSQL & Drizzle ORM**: Persistent storage for rooms and participants, with automated in-memory state store fallback for local development simplicity.

---

## 🛠️ Required Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router DOM, Socket.IO Client, Lucide React, Vanilla CSS.
- **Backend**: Node.js, Express, TypeScript, Socket.IO Server.
- **Database & ORM**: PostgreSQL, Drizzle ORM, Drizzle Kit.
- **Video**: YouTube IFrame Player API.

---

## 📐 Architecture & Flow

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Client (React)                    │
│                                                             │
│  [HomePage] ──► [RoomPage] ──► [YouTube Player (IFrame)]     │
│                                 ▲                           │
└─────────────────────────────────┼───────────────────────────┘
                                  │ Socket.IO Events
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Node.js Express + Socket.IO                │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   RBAC Permission     │       │  In-Memory Realtime   │  │
│  │   Validation Engine   │ ◄───► │  Playback State Store │  │
│  └───────────────────────┘       └───────────────────────┘  │
│              │                                              │
└──────────────┼──────────────────────────────────────────────┘
               │ Drizzle ORM
               ▼
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                      │
│                                                             │
│  [rooms Table]  ◄───────────────────────────► [participants] │
└─────────────────────────────────────────────────────────────┘
```

### Event Flow (Playback Control Action)

```
User Action (Host/Mod clicks Play/Pause/Seek)
  │
  ├─► Client emits Socket Event: 'play' / 'pause' / 'seek'
  │
  ├─► Server receives event & retrieves Socket Context
  │     │
  │     ├─► RBAC Authorization Check: validate user role
  │     │     ├─► [DENIED]: Emit 'error' event to caller
  │     │     └─► [AUTHORIZED]: Proceed
  │     │
  │     ├─► Update Server Authoritative Room State & DB
  │     │
  │     └─► Broadcast Socket Event ('play' / 'pause' / 'seek') to all room members
  │
  └─► Clients receive broadcast event
        │
        ├─► Set `isRemoteActionRef.current = true` (Suppression Flag)
        ├─► Update YouTube Player API (`player.playVideo()`, `seekTo()`)
        └─► YouTube player `onStateChange` fires ──► Suppressed! (No duplicate emit)
```

---

## 📁 Project Structure

```
youtube-watch-party/
│
├── client/                     # Frontend React + Vite app
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── YouTubePlayer.tsx
│   │   │   ├── PlaybackControls.tsx
│   │   │   ├── VideoSelector.tsx
│   │   │   ├── ParticipantList.tsx
│   │   │   ├── RoleBadge.tsx
│   │   │   ├── Chat.tsx
│   │   │   └── Header.tsx
│   │   ├── pages/              # Router pages
│   │   │   ├── HomePage.tsx
│   │   │   └── RoomPage.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   └── useSocket.ts
│   │   ├── services/           # REST API fetch service
│   │   │   └── api.ts
│   │   ├── socket/             # Socket.IO client instance
│   │   │   └── socket.ts
│   │   ├── types/              # Frontend TypeScript definitions
│   │   │   └── index.ts
│   │   ├── utils/              # YouTube URL parser & helpers
│   │   │   └── youtube.ts
│   │   ├── App.tsx             # Main App & Router setup
│   │   ├── index.css           # Glassmorphism dark CSS design system
│   │   └── main.tsx            # Entry point
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                     # Backend Express + Socket.IO app
│   ├── src/
│   │   ├── controllers/        # REST Route controllers
│   │   │   └── roomController.ts
│   │   ├── services/           # Business logic & DB integration
│   │   │   ├── roomService.ts
│   │   │   ├── participantService.ts
│   │   │   └── roomStateStore.ts
│   │   ├── routes/             # API routes
│   │   │   └── roomRoutes.ts
│   │   ├── socket/             # Socket.IO event handlers
│   │   │   └── socketHandler.ts
│   │   ├── db/                 # Drizzle ORM schema & connection
│   │   │   ├── schema.ts
│   │   │   ├── index.ts
│   │   │   └── migrate.ts
│   │   ├── middleware/         # Error & validation middlewares
│   │   │   ├── errorHandler.ts
│   │   │   └── validateRequest.ts
│   │   ├── types/              # Server TypeScript interfaces
│   │   │   └── index.ts
│   │   ├── utils/              # Room code generator & RBAC rules
│   │   │   ├── roomCodeGenerator.ts
│   │   │   └── rbac.ts
│   │   ├── app.ts              # Express application setup
│   │   └── server.ts           # HTTP & Socket.IO server startup
│   ├── drizzle/                # Drizzle migration files
│   │   └── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── .env.example                # Sample environment variables
├── .gitignore
├── README.md
└── package.json                # Monorepo root scripts
```

---

## 🗄️ Database Schema

Designed with **PostgreSQL** and **Drizzle ORM**.

### `rooms` Table

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | Primary Key, Default Random | Unique internal room ID |
| `room_code` | `VARCHAR(16)` | Unique, Not Null | Shareable room identifier (e.g., `A7X92B`) |
| `host_user_id` | `UUID` | Not Null | UUID of the participant holding HOST role |
| `current_video_id` | `TEXT` | Default `'dQw4w9WgXcQ'` | Current loaded YouTube video ID |
| `current_playback_state` | `TEXT` | Default `'paused'` | Playback status (`'playing'` or `'paused'`) |
| `current_playback_time` | `DOUBLE PRECISION` | Default `0` | Current player seek timestamp in seconds |
| `created_at` | `TIMESTAMP` | Default Now | Creation timestamp |
| `updated_at` | `TIMESTAMP` | Default Now | Last update timestamp |

### `participants` Table

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | Primary Key, Default Random | Unique participant ID |
| `room_id` | `UUID` | Foreign Key -> `rooms.id` (CASCADE) | Associated room |
| `username` | `VARCHAR(50)` | Not Null | Display name |
| `role` | `TEXT` | Default `'PARTICIPANT'` | Role (`'HOST'`, `'MODERATOR'`, `'PARTICIPANT'`) |
| `socket_id` | `TEXT` | Nullable | Active Socket.IO connection ID |
| `joined_at` | `TIMESTAMP` | Default Now | Join timestamp |

---

## 🔒 Role-Based Access Control (RBAC) Matrix

| Action | HOST | MODERATOR | PARTICIPANT |
| --- | :---: | :---: | :---: |
| Play Video (`play`) | ✅ | ✅ | ❌ |
| Pause Video (`pause`) | ✅ | ✅ | ❌ |
| Seek Position (`seek`) | ✅ | ✅ | ❌ |
| Change Video (`change_video`) | ✅ | ✅ | ❌ |
| Assign Role (`assign_role`) | ✅ | ❌ | ❌ |
| Remove User (`remove_participant`) | ✅ | ❌ | ❌ |
| Transfer Host (`transfer_host`) | ✅ | ❌ | ❌ |
| Watch Synchronized Video | ✅ | ✅ | ✅ |
| Send Chat Message | ✅ | ✅ | ✅ |

*Note: RBAC permissions are strictly validated on the backend inside Socket.IO event handlers. Any unauthorized event attempt receives an error payload.*

---

## 📡 Socket.IO Real-Time Events

### Client ──► Server

| Event | Payload | Description |
| --- | --- | --- |
| `join_room` | `{ roomCode, username, participantId? }` | Join room session |
| `leave_room` | `{ roomCode }` | Leave active room |
| `play` | `{ roomCode, time? }` | Trigger playback play |
| `pause` | `{ roomCode, time? }` | Trigger playback pause |
| `seek` | `{ roomCode, time }` | Seek to timestamp |
| `change_video` | `{ roomCode, videoId }` | Change YouTube video |
| `assign_role` | `{ roomCode, targetUserId, role }` | Promote/demote user |
| `remove_participant` | `{ roomCode, targetUserId }` | Kick user from room |
| `transfer_host` | `{ roomCode, newHostUserId }` | Transfer HOST privileges |
| `send_chat_message` | `{ roomCode, message }` | Send live chat text |

### Server ──► Client

| Event | Payload | Description |
| --- | --- | --- |
| `room_state` | `{ room, participants, currentUser }` | Initial authoritative state |
| `user_joined` | `{ participant }` | Broadcast new member joined |
| `user_left` | `{ participantId, username }` | Broadcast member left |
| `play` | `{ time, videoId, updatedBy }` | Broadcast play command |
| `pause` | `{ time, videoId, updatedBy }` | Broadcast pause command |
| `seek` | `{ time, updatedBy }` | Broadcast seek position |
| `video_changed` | `{ videoId, time, updatedBy }` | Broadcast video changed |
| `role_assigned` | `{ targetUserId, newRole, updatedBy }` | Broadcast role update |
| `participant_removed` | `{ targetUserId, removedBy }` | Broadcast user kicked |
| `host_transferred` | `{ oldHostId, newHostId, updatedBy }` | Broadcast host transferred |
| `error` | `{ message }` | Emit validation or permission error |

---

## ⚙️ Environment Variables

Create `.env` file in the root directory (or use `.env.example` as a template):

```env
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# PostgreSQL Database URL for Drizzle ORM
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/youtube_watch_party
```

---

## 🚀 Quick Start / Local Setup

### 1. Prerequisites
- Node.js v18+ installed
- PostgreSQL database (optional for local testing as fallback store is active)

### 2. Installation

Install dependencies for monorepo root, server, and client:

```bash
npm run install:all
```

### 3. Database Migration (Optional if PostgreSQL is running)

Generate and push Drizzle schema to PostgreSQL:

```bash
npm --prefix server run db:push
```

### 4. Run Development Server

Start both backend server (`http://localhost:5000`) and frontend Vite client (`http://localhost:5173`) concurrently:

```bash
npm run dev
```

Or run separately in two terminal tabs:

```bash
# Terminal 1: Backend Server
npm run dev:server

# Terminal 2: Frontend Client
npm run dev:client
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Manual Testing Checklist

1. **Create Room**:
   - Go to `http://localhost:5173`, enter username "Sajal", click **Create Watch Party**.
   - Redirected to `/room/:roomCode`. Verify HOST badge next to username.
2. **Join Room**:
   - Open a second browser tab (or Incognito mode).
   - Enter room code and name "Rahul". Verify "Rahul" joins with VIEWER (PARTICIPANT) badge.
3. **Playback Control Sync (Host)**:
   - Sajal (Host) clicks **Play** ──► Rahul's player starts playing simultaneously.
   - Sajal clicks **Pause** ──► Rahul's player pauses.
   - Sajal seeks to 02:00 ──► Rahul's player seeks to 02:00.
4. **RBAC Enforcement**:
   - In Rahul's tab (Participant), verify play/pause/seek controls are disabled and locked banner is displayed.
5. **Change Video**:
   - Sajal pastes a new YouTube link (`https://www.youtube.com/watch?v=L_LUpnjgPso`) and clicks Change Video.
   - Both tabs load the new video synchronously.
6. **Assign Role (Promote)**:
   - Sajal (Host) opens participant dropdown menu on Rahul ──► clicks **Make Moderator**.
   - Rahul's badge updates to MODERATOR in real time, and playback controls unlock for Rahul.
7. **Transfer Host**:
   - Sajal selects **Transfer Host** to Rahul.
   - Rahul becomes HOST; Sajal becomes MODERATOR.
8. **Remove Participant**:
   - Rahul (New Host) selects **Remove Participant** on Sajal.
   - Sajal is removed from room.

---

## 📝 Known Assumptions & Future Scalability

- **Scaling active socket connections**: For horizontal scaling across multiple Node.js server instances, a Redis Pub/Sub adapter (`@socket.io/redis-adapter`) can be attached to Socket.IO.
- **Persistent Chat History**: Chat messages are currently broadcast live in real time to connected room members; a `messages` table can be added to PostgreSQL to persist chat history.
