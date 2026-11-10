# ChatNest API: Complete Reference for Frontend Agents

> **Who this is for:** an AI agent (or a developer) building a frontend for this backend.
> **How to read it:** everything here matches the current code exactly. When something isn't listed,
> the backend doesn't support it, so don't build UI for it. Section 12 lists what is missing on purpose.
> **Machine-readable spec:** `GET /api-docs.json` (OpenAPI 3.0.3). **Interactive docs:** `GET /api-docs`.

---

## 0. Quick facts (read first)

| Fact | Value |
|---|---|
| App type | One-to-one direct messaging (like WhatsApp or Instagram DMs). **No group chats.** |
| Message kinds | `text` or `image` (an image can have an optional text caption). Nothing else. |
| API base URL | `http://localhost:5000/api/v1` (port comes from `PORT` in `.env`) |
| Server origin | `http://localhost:5000`, used for images, Socket.IO, `/health` and `/api-docs` |
| Auth | JWT in the header `Authorization: Bearer <token>`. Default lifetime is 1 day. **No refresh endpoint.** |
| Roles | `user`, `admin` |
| Body formats | `application/json`, plus `multipart/form-data` for image uploads |
| Realtime | Socket.IO 4 on the server origin. **Receive-only**: all writes go through REST. |
| IDs | MongoDB ObjectIds: 24-character hex strings, e.g. `"665f1c2a9b1e8a3d4c5b6a71"` |
| Dates | ISO 8601 strings in UTC, e.g. `"2026-11-10T09:15:00.000Z"` |
| Image URLs | **Relative** paths like `/uploads/messages/<uuid>.png`. Prefix the server origin to display them. |
| CORS | Controlled by `CORS_ORIGIN` (default `*`). Auth uses headers, not cookies, so no `credentials` setting is needed. |

---

## 1. What the application does

ChatNest lets users:

1. **Register and log in** (email + password). The backend returns a JWT.
2. **Edit their profile**: name, bio and a profile picture (avatar).
3. **Search other users** by username or name and view public profiles, including online status and last seen.
4. **Start a one-to-one conversation.** It is idempotent: the same pair of users always gets the same conversation.
5. **Send text messages, or images with an optional caption.**
6. **See unread counts and read receipts.** Your own messages have `status: "sent" | "read"`.
7. **Scroll back through message history** (cursor pagination), **filter by type** (only images) and **search text**.
8. **Delete a message for themselves**, or **for everyone** (sender only, within 15 minutes of sending).
9. **Delete a whole chat for themselves.** It hides the chat and clears their history; the other user is not affected.
10. **Block and unblock users.** A block works both ways: neither side can message the other.
11. **Receive live updates**: new messages, deletions, read receipts, and online/offline status.
12. **Admins** can list all users and ban or unban them. A ban works immediately: every request returns 403 and the user's sockets are disconnected.

---

## 2. Conventions every request follows

### 2.1 Headers

| Situation | Headers |
|---|---|
| Public endpoints (`/auth/register`, `/auth/login`) | `Content-Type: application/json` |
| Authenticated JSON endpoints | `Authorization: Bearer <token>` and `Content-Type: application/json` |
| File uploads | `Authorization: Bearer <token>`. **Do not set `Content-Type` yourself** when sending `FormData`; the browser adds the multipart boundary. |

### 2.2 Success envelope

```jsonc
// Single resource
{ "success": true, "data": { /* resource */ } }

// Page-number list (users, conversations, blocks, admin users)
{ "success": true, "data": [ /* items */ ], "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }

// Cursor list (message history only)
{ "success": true, "data": [ /* messages, newest first */ ], "meta": { "limit": 30, "hasMore": true, "nextCursor": "665f..." } }
```

`204 No Content` responses have **no body**, so don't call `response.json()` on them.

### 2.3 Error envelope

```jsonc
{
  "success": false,
  "error": {
    "status": 400,
    "message": "Validation failed",
    "details": [                      // only present for validation errors
      { "location": "body", "field": "email", "message": "email must be a valid email" }
    ]
  }
}
```

- `location` is one of `"body" | "query" | "params"`.
- `field` is the input name. It is an empty string `""` for whole-object rules, such as "provide at least one field".
- **Show `error.message` to users.** For forms, map `details[].field` to the input that should show `details[].message`.

### 2.4 Status codes

| Code | Meaning | Recommended frontend reaction |
|---|---|---|
| 200 | OK | — |
| 201 | Created | — |
| 204 | Done, no body | — |
| 400 | Invalid input, bad id, empty message, wrong file type | Show field errors or a toast |
| 401 | Missing, invalid or expired token; wrong email or password | On login: show the error. Elsewhere: **clear the token and go to login.** |
| 403 | Not allowed: banned, blocked, wrong role, delete window passed | If the message is `"Your account has been banned"`: **log out** and show a banned screen. Otherwise show a toast. |
| 404 | Not found, **or you aren't a participant** | Show "not found" and go back |
| 409 | Duplicate email or username, already blocked, already deleted | Show the message |
| 413 | Image larger than 5 MB, or JSON body over 100 KB | Show "file too large" |
| 500 | Server bug; the message is always `"Internal server error"` | Generic error toast |

### 2.5 Input handling rules

- **Unknown fields are silently dropped**, not rejected. For example, sending `role: "admin"` on register does nothing.
- Strings are **trimmed**. `username` and `email` are **lowercased** automatically, so `"Aisha_K"` becomes `"aisha_k"`.
- Query parameters are strings in the URL. Booleans must be `true` or `false` (e.g. `?unread=true`); numbers are converted automatically.
- Any path `:id` must be a 24-character hex ObjectId. Otherwise you get **400** with the detail `"id must be a valid id"`.
- A `limit` above the maximum returns **400**. It is not clamped.
- There are **no `sort` parameters**: each list has a fixed order, documented per endpoint.

---

## 3. TypeScript types (copy into the frontend)

```ts
export type ObjectId = string;   // 24-char hex
export type ISODate = string;    // ISO 8601, UTC

export type Role = 'user' | 'admin';
export type MessageType = 'text' | 'image';
export type MessageStatus = 'sent' | 'read';
export type DeleteScope = 'me' | 'everyone';

/** Safe-to-show profile of any user. */
export interface PublicUser {
  _id: ObjectId;
  name: string;
  username: string;            // lowercase, 3–30 chars, [a-z0-9_.]
  bio: string;                 // '' when empty
  avatarUrl: string | null;    // relative path, e.g. "/uploads/avatars/<uuid>.jpg"
  lastSeenAt: ISODate;
}

/** Returned by GET /users/:id and inside Conversation.otherUser. */
export interface PublicUserWithPresence extends PublicUser {
  isOnline: boolean;           // true while the user has at least one open socket
}

/** The logged-in user (auth endpoints, PATCH /users/me) and admin listings. Never includes a password. */
export interface User extends PublicUser {
  email: string;
  role: Role;
  isBanned: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface AuthResult {
  user: User;
  token: string;               // JWT
}

/** Preview of the newest message, shown in the chat list. */
export interface LastMessagePreview {
  messageId: ObjectId;
  sender: ObjectId;            // compare with the current user's _id to show "You: ..."
  type: MessageType;
  text: string;                // '' for an image without a caption, or a deleted message
  isDeleted: boolean;          // true if deleted for everyone
  createdAt: ISODate;
}

/** A conversation as seen by the current user. */
export interface Conversation {
  _id: ObjectId;
  otherUser: PublicUserWithPresence;
  lastMessage: LastMessagePreview | null;   // null when there are no messages yet (or you cleared the chat)
  lastMessageAt: ISODate;                   // the list is sorted by this, newest first
  unreadCount: number;                      // messages from otherUser you haven't read
  lastReadAt: ISODate;                      // when YOU last read this chat
  otherLastReadAt: ISODate;                 // when THE OTHER USER last read it (for read ticks)
  createdAt: ISODate;
}

export interface Message {
  _id: ObjectId;
  conversation: ObjectId;
  sender: ObjectId;            // a plain id (not populated); match it with the current user or Conversation.otherUser
  type: MessageType;
  text: string;                // message text, or the image caption ('' if none)
  imageUrl: string | null;     // relative path when type === 'image' and not deleted
  isDeletedForEveryone: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
  status?: MessageStatus;      // ONLY on your own messages, in REST responses (not in socket events)
}

export interface Block {
  _id: ObjectId;
  blocker: ObjectId;
  blocked: ObjectId;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface BlockedUserEntry {
  user: PublicUser;
  blockedAt: ISODate;
}

export interface PageMeta { page: number; limit: number; total: number; totalPages: number; }
export interface CursorMeta { limit: number; hasMore: boolean; nextCursor: ObjectId | null; }

export interface ApiSuccess<T> { success: true; data: T; }
export interface ApiPage<T> { success: true; data: T[]; meta: PageMeta; }
export interface ApiCursorPage<T> { success: true; data: T[]; meta: CursorMeta; }

export interface ValidationDetail { location: 'body' | 'query' | 'params'; field: string; message: string; }
export interface ApiError {
  success: false;
  error: { status: number; message: string; details?: ValidationDetail[] };
}

/* ---------- Socket.IO event payloads (server → client only) ---------- */
export interface SocketEvents {
  'message:new': Omit<Message, 'status'>;
  'message:deleted': { conversationId: ObjectId; messageId: ObjectId };
  'conversation:read': { conversationId: ObjectId; readerId: ObjectId; readAt: ISODate };
  'user:online': { userId: ObjectId };
  'user:offline': { userId: ObjectId; lastSeenAt: ISODate };
}
```

---

## 4. Limits and enums (mirror these in client-side validation)

| Field | Rule |
|---|---|
| `name` | Required on register; 1–50 characters after trimming |
| `username` | 3–30 characters; only `a-z 0-9 _ .` (lowercased automatically); unique |
| `email` | Valid email; lowercased; unique |
| `password` | 8–72 characters (no other complexity rules) |
| `bio` | 0–150 characters |
| Message `text` | 0–2000 characters after trimming. **A message needs text, an image, or both.** |
| Image file | MIME `image/jpeg`, `image/png` or `image/webp`; **max 5 MB**; exactly one file |
| Search strings (`search`, `q`) | Max 50 characters |
| `page` | Integer ≥ 1, default 1 |
| `limit` (users, conversations, blocks, admin) | 1–50, default 20 |
| `limit` (messages) | 1–100, default 30 |
| Delete for everyone | Sender only, within **15 minutes** of `createdAt` |
| JSON body size | Max 100 KB |

---

## 5. Endpoints

**Legend:** 🔓 public · 🔒 needs a token · 👑 admin only. All paths below are relative to `/api/v1` unless shown otherwise.

**Errors on every 🔒 endpoint** (not repeated below):

| Status | `error.message` |
|---|---|
| 401 | `Authentication required` (no `Bearer` header) |
| 401 | `Invalid or expired token` |
| 401 | `User no longer exists` |
| 403 | `Your account has been banned` |

**Extra error on 👑 endpoints:** `403 You do not have permission to perform this action`.

**Side effect of every 🔒 request:** the user's `lastSeenAt` is refreshed (at most once per minute).

---

### 5.1 Auth

#### `POST /auth/register` 🔓
Creates an account and logs the user in. The role is always `user`.

Request body:
```json
{ "name": "Aisha Khan", "username": "aisha_k", "email": "aisha@example.com", "password": "Password123!" }
```
Response **201** → `ApiSuccess<AuthResult>`:
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "665f1c2a9b1e8a3d4c5b6a71", "name": "Aisha Khan", "username": "aisha_k",
      "email": "aisha@example.com", "role": "user", "bio": "", "avatarUrl": null,
      "lastSeenAt": "2026-11-10T09:00:00.000Z", "isBanned": false,
      "createdAt": "2026-11-10T09:00:00.000Z", "updatedAt": "2026-11-10T09:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```
Errors: **400** `Validation failed` (with details) · **409** `That email is already registered` · **409** `That username is already registered`.

#### `POST /auth/login` 🔓
Request body: `{ "email": "aisha@example.com", "password": "Password123!" }`
Response **200** → `ApiSuccess<AuthResult>`, same shape as register.
Errors: **400** `Validation failed` · **401** `Invalid email or password` (the same message whether the email or the password is wrong) · **403** `Your account has been banned`.

#### `GET /auth/me` 🔒
Returns the logged-in user. Use it on app start to check whether a stored token is still valid.
Response **200** → `ApiSuccess<User>`.

---

### 5.2 Users and profile

#### `GET /users` 🔒
Search for people to chat with.

| Query | Type | Notes |
|---|---|---|
| `search` | string, optional | Matches a **username prefix** OR a **name substring**, case-insensitive. Empty or missing returns everyone. |
| `page`, `limit` | int | See section 4 |

- Excludes **yourself** and **banned users**. Sorted by `username` A→Z.
- Response **200** → `ApiPage<PublicUser>`. This endpoint does **not** include `isOnline`.

#### `GET /users/:id` 🔒
A public profile with presence. You can request your own id.
Response **200** → `ApiSuccess<PublicUserWithPresence>`.
Errors: **400** invalid id · **404** `User not found` (also returned for banned users).

#### `PATCH /users/me` 🔒
Update your own name and/or bio. Send at least one of them.
Request body: `{ "name": "Aisha K.", "bio": "Coffee & code" }`. Send `"bio": ""` to clear the bio.
Response **200** → `ApiSuccess<User>`.
Errors: **400** `Validation failed`. An empty body returns the detail `{ "field": "", "message": "Provide at least one of: name, bio" }`.

#### `PUT /users/me/avatar` 🔒 (multipart)
Upload or replace your profile picture. The previous file is deleted from the server.

| Form field | Type |
|---|---|
| `avatar` | file (jpeg/png/webp, ≤ 5 MB) |

```js
const form = new FormData();
form.append('avatar', file);
await fetch(`${API}/users/me/avatar`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
```
Response **200** → `ApiSuccess<User>`, with the new `avatarUrl`.
Errors: **400** `An image file is required in the "avatar" field` · **400** `Only JPG, PNG and WEBP images are allowed` · **400** `Unexpected file field: <name>` (wrong field name) · **413** `Image must be 5 MB or smaller`.

---

### 5.3 Blocking

#### `GET /users/me/blocks` 🔒
Users **you** have blocked, most recent first. You can't see who has blocked you.
Query: `page`, `limit`.
Response **200** → `ApiPage<BlockedUserEntry>`.

#### `POST /users/:id/block` 🔒
Response **201** → `ApiSuccess<Block>`.
Errors: **400** `You cannot block yourself` · **404** `User not found` · **409** `User is already blocked`.
**Effect:** from now on, neither user can send messages to the other or start a conversation with them (**403** `You cannot message this user`). The existing conversation and its history stay visible to both users.

#### `DELETE /users/:id/block` 🔒
Response **204**.
Errors: **404** `User is not blocked`.

---

### 5.4 Conversations

#### `POST /conversations` 🔒
Opens the chat with another user. It **creates the chat only if none exists**, so call it whenever the user clicks "Message" on a profile or search result.
If you had deleted (hidden) this chat earlier, it reappears in your list, but your old history stays cleared.

Request body: `{ "participantId": "665f1c2a9b1e8a3d4c5b6a72" }`
Response **201** (new) or **200** (existing) → `ApiSuccess<Conversation>`.
Errors: **400** `You cannot start a conversation with yourself` · **400** invalid id · **404** `User not found` · **403** `You cannot message this user` (the user is banned, or there is a block in either direction).

#### `GET /conversations` 🔒
The chat list, **sorted by `lastMessageAt`, newest first**.

| Query | Type | Notes |
|---|---|---|
| `unread` | boolean, default `false` | `true` → only chats where `unreadCount > 0` |
| `page`, `limit` | int | See section 4 |

- Excludes chats you deleted (hidden). Includes newly started chats with no messages yet (`lastMessage: null`).
- Response **200** → `ApiPage<Conversation>`.

#### `GET /conversations/:id` 🔒
Response **200** → `ApiSuccess<Conversation>`.
Errors: **404** `Conversation not found` (it doesn't exist, **or you're not a participant**).

#### `PATCH /conversations/:id/read` 🔒
Marks everything in the chat as read: your `unreadCount` becomes 0 and `lastReadAt` becomes now.
**Call it when the chat screen opens, and whenever a `message:new` event arrives for the chat that is currently open.**
Response **200** → `{ "success": true, "data": { "conversationId": "...", "lastReadAt": "2026-11-10T09:20:00.000Z" } }`
Side effect: the other user receives the socket event `conversation:read`.
Errors: **404** `Conversation not found`.

#### `DELETE /conversations/:id` 🔒
"Delete chat" **for you only**:
- The chat is hidden from your list.
- Every message up to now is hidden from your history.
- Your `unreadCount` resets to 0.

The other user sees no change. If **either** user sends a new message later, the chat reappears in your list, showing only messages sent after the deletion.
Response **204**. Errors: **404** `Conversation not found`.

---

### 5.5 Messages

#### `GET /conversations/:id/messages` 🔒
Message history, **newest first**, with cursor pagination.

| Query | Type | Notes |
|---|---|---|
| `limit` | int 1–100, default 30 | |
| `before` | ObjectId, optional | Pass the previous response's `meta.nextCursor` to load **older** messages |
| `type` | `text` \| `image`, optional | `image` → only image messages (e.g. a "media" tab) |
| `q` | string, optional | Case-insensitive substring search in `text` (captions included) |

- Excludes messages you deleted "for me", and messages from before you deleted the chat.
- **Includes** messages deleted for everyone, with `isDeletedForEveryone: true`, `text: ""` and `imageUrl: null`. Render them as "This message was deleted".
- Your own messages include `status`: `"read"` when the other user has read the chat at or after the message's `createdAt`, otherwise `"sent"`.
- **To render top-to-bottom, reverse the array**, because the API returns newest first.

Response **200** → `ApiCursorPage<Message>`:
```json
{
  "success": true,
  "data": [
    { "_id": "6650...03", "conversation": "664f...", "sender": "665f...71", "type": "image", "text": "Sunset!",
      "imageUrl": "/uploads/messages/8d1c2f0e-....jpg", "isDeletedForEveryone": false,
      "createdAt": "2026-11-10T09:12:00.000Z", "updatedAt": "2026-11-10T09:12:00.000Z", "status": "read" },
    { "_id": "6650...02", "conversation": "664f...", "sender": "665f...72", "type": "text", "text": "Send a pic",
      "imageUrl": null, "isDeletedForEveryone": false,
      "createdAt": "2026-11-10T09:10:00.000Z", "updatedAt": "2026-11-10T09:10:00.000Z" }
  ],
  "meta": { "limit": 30, "hasMore": false, "nextCursor": null }
}
```
Errors: **400** validation (e.g. `limit must be less than or equal to 100`, `type must be one of [text, image]`) · **404** `Conversation not found`.

#### `POST /conversations/:id/messages` 🔒
Send a message. It accepts **either** JSON (text only) **or** multipart (image + optional caption).

Text, as JSON:
```json
{ "text": "Hey! How are you?" }
```
Image, as multipart:

| Form field | Type | Notes |
|---|---|---|
| `image` | file | jpeg/png/webp, ≤ 5 MB |
| `text` | string, optional | Caption, ≤ 2000 characters |

```js
const form = new FormData();
form.append('image', file);
form.append('text', caption);   // optional
await fetch(`${API}/conversations/${id}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
```

Response **201** → `ApiSuccess<Message>` with `status: "sent"`. The message `type` is `"image"` if a file was sent, otherwise `"text"`.

Side effects:
- The recipient's `unreadCount` goes up by 1.
- The recipient receives `message:new`.
- The chat is un-hidden for both users.
- Your own `unreadCount` resets to 0 and your `lastReadAt` becomes now, because replying counts as reading.

Errors, in the order they are checked:

| Status | `error.message` | Cause |
|---|---|---|
| 400 | `Only JPG, PNG and WEBP images are allowed` | Wrong file type |
| 400 | `Unexpected file field: <name>` | The file field isn't named `image` |
| 413 | `Image must be 5 MB or smaller` | File too large |
| 400 | `Validation failed` | `text` longer than 2000, or a bad id |
| 400 | `A message needs text or an image` | Empty or whitespace-only text and no file |
| 404 | `Conversation not found` | Not a participant |
| 403 | `You cannot message this user` | A block in either direction, or the other user is banned |

#### `DELETE /messages/:id` 🔒
| Query | Values | Default |
|---|---|---|
| `scope` | `me` \| `everyone` | `me` |

- `scope=me` hides the message **only for you**. It works on anyone's message. Repeating it is harmless (still **204**).
- `scope=everyone` is for **the sender only, within 15 minutes**. It clears the text, deletes the image file, and marks the chat-list preview as deleted. The other user receives `message:deleted`.

Response **204**.
Errors:

| Status | `error.message` |
|---|---|
| 404 | `Message not found` |
| 404 | `Conversation not found` (you're not a participant of the message's chat) |
| 403 | `You can only delete your own messages for everyone` |
| 403 | `Messages can only be deleted for everyone within 15 minutes` |
| 409 | `Message is already deleted` |

**UI rule:** show "Delete for everyone" only when `message.sender === me._id`, `!message.isDeletedForEveryone`, and `now - createdAt < 15 min`. Always show "Delete for me".

---

### 5.6 Admin 👑

#### `GET /admin/users` 👑
| Query | Type | Notes |
|---|---|---|
| `isBanned` | boolean, optional | Filter by ban status. Omit it to get everyone. |
| `search` | string, optional | Case-insensitive substring of **username or email** |
| `page`, `limit` | int | |

Sorted by `createdAt`, newest first. Includes admins and the caller.
Response **200** → `ApiPage<User>`.

#### `PATCH /admin/users/:id/ban` 👑
Request body: `{ "isBanned": true }` (send `false` to unban).
Response **200** → `ApiSuccess<User>`.
A ban works immediately: all of that user's requests return **403** and their sockets are disconnected.
Errors: **400** `You cannot change your own ban status` · **404** `User not found` · **403** `Admins cannot be banned` (this is also returned when trying to *unban* an admin).

---

### 5.7 Non-API routes (no `/api/v1` prefix)

| Route | Response |
|---|---|
| `GET /health` | `{ "success": true, "data": { "status": "ok", "timestamp": "..." } }` |
| `GET /api-docs` | Swagger UI |
| `GET /api-docs.json` | OpenAPI JSON |
| `GET /uploads/<folder>/<file>` | Image files (`avatars/`, `messages/`). No auth needed: anyone with the URL can load the image. |
| Any unknown route | **404** `Route not found: <METHOD> <path>` |

---

## 6. Realtime: Socket.IO

### 6.1 Connecting

```js
import { io } from 'socket.io-client';   // socket.io-client v4

const socket = io('http://localhost:5000', {   // the SERVER ORIGIN, not /api/v1
  auth: { token },                              // the same JWT as REST
});

socket.on('connect_error', (err) => {
  // err.message is one of:
  // "Invalid or expired token" | "User no longer exists" | "Your account has been banned" | "Authentication failed"
});

socket.on('disconnect', (reason) => {
  // reason === 'io server disconnect' → the server kicked you (e.g. banned). Do NOT auto-reconnect; check GET /auth/me.
});
```

- Connect **after login**. Disconnect on logout. Reconnect with the new token if the user logs in again.
- The client **never emits** chat events. There are no client→server events at all.
- Multiple tabs are supported for presence. However, `message:new` goes only to the **recipient**, so the sender's other tabs won't see their own new message until they refetch.

### 6.2 Events (server → client)

| Event | Who receives it | Payload | What the frontend should do |
|---|---|---|---|
| `message:new` | The recipient | `Message` without `status` | If the chat is open: append the message, then call `PATCH /conversations/:id/read`. Otherwise: increase that chat's `unreadCount`, update `lastMessage` and move the chat to the top. If the chat isn't in the loaded list (new or hidden): `GET /conversations/:id` and insert it at the top. |
| `message:deleted` | The other participant | `{ conversationId, messageId }` | Replace that message with "This message was deleted". If it is the chat's `lastMessage`, set its preview to deleted. |
| `conversation:read` | The other participant | `{ conversationId, readerId, readAt }` | Set `otherLastReadAt = readAt`, and mark your own messages in that chat with `createdAt <= readAt` as `status: "read"` (blue ticks). |
| `user:online` | Users who share a chat with this user | `{ userId }` | Set `isOnline = true` wherever that user appears |
| `user:offline` | Users who share a chat with this user | `{ userId, lastSeenAt }` | Set `isOnline = false` and `lastSeenAt` |

Presence notes:
- `user:online` fires when a user's **first** socket connects, and `user:offline` when their **last** one disconnects.
- The REST field `isOnline` exists only on `GET /users/:id` and on `Conversation.otherUser`.

---

## 7. Frontend flows

### 7.1 Session
1. On app start: read the token from storage → `GET /auth/me`. On 200: logged in, then connect the socket. On 401 or 403: clear the token and show login.
2. Login or register: store `data.token`, keep `data.user` as `me`, connect the socket.
3. Logout: delete the token, `socket.disconnect()`, clear all state. There is no logout endpoint, because JWTs are stateless.
4. Global fetch wrapper: on **401**, log out. On **403** with `"Your account has been banned"`, log out and show a banned notice.
5. Tokens expire after `JWT_EXPIRES_IN` (default 1 day). There is no refresh, so the user must log in again.

### 7.2 Chat list screen
- `GET /conversations?page=1&limit=20`. Load more pages while `page < totalPages`.
- An "Unread" tab uses `GET /conversations?unread=true`.
- Each row shows:
  - Avatar: `otherUser.avatarUrl` (null → initials) with an online dot from `otherUser.isOnline`.
  - Name: `otherUser.name`.
  - Preview: if `lastMessage` is null → "Say hi 👋"; if `lastMessage.isDeleted` → "This message was deleted"; if `type === 'image'` → `"📷 " + (text || "Photo")`; otherwise `text`. Prefix it with "You: " when `lastMessage.sender === me._id`.
  - Time: `lastMessageAt`.
  - Badge: `unreadCount` when it is above 0.
- Keep the list live with the socket events from section 6.2.

### 7.3 Opening a chat
1. From search or a profile: `POST /conversations { participantId }`, then navigate to `/chat/:conversationId`.
2. On the chat screen:
   - Call `GET /conversations/:id` for the header (name, avatar, online / last seen).
   - Call `GET /conversations/:id/messages?limit=30`, reverse the array and render it.
   - Call `PATCH /conversations/:id/read`.
3. **Infinite scroll up:** while `meta.hasMore`, call `GET .../messages?before=<meta.nextCursor>` and prepend the reversed results.
4. Header status: `isOnline ? "online" : "last seen " + relativeTime(lastSeenAt)`.

### 7.4 Sending
- Text: `POST` JSON. Image: `POST` multipart with `image` and an optional `text`. Validate type and size in the client first (section 4).
- Optimistic UI: add a temporary bubble, then replace it with the returned `Message` (`status: "sent"`). If the request fails, mark the bubble as failed and show `error.message`.
- Ticks for your own messages: `status === "read"` (or `createdAt <= otherLastReadAt`) → ✓✓ in blue; otherwise ✓.
- On **403** `You cannot message this user`: disable the composer and show "You can't message this user".

### 7.5 Message bubble rendering

| Condition | Render |
|---|---|
| `isDeletedForEveryone` | Muted italic "This message was deleted" (no image, no text) |
| `type === 'image'` | `<img src={SERVER_ORIGIN + imageUrl}>`, with `text` as the caption if not empty |
| `type === 'text'` | `text` (preserve line breaks) |
| `sender === me._id` | Right-aligned, with ticks from `status` |
| Otherwise | Left-aligned |

### 7.6 Other screens
- **Search:** `GET /users?search=<debounced input>` → list rows → "Message" button runs flow 7.3.
- **Profile (other user):** `GET /users/:id`, with "Message" and "Block" buttons. Show "Unblock" if the user is in `GET /users/me/blocks`.
- **My profile:** `PATCH /users/me` for name and bio, `PUT /users/me/avatar` for the picture. Update the stored `me` from the response.
- **Blocked users (settings):** `GET /users/me/blocks`, with "Unblock" → `DELETE /users/:id/block`.
- **Media tab in a chat:** `GET /conversations/:id/messages?type=image`.
- **Search in a chat:** `GET /conversations/:id/messages?q=<term>`.
- **Admin panel** (only when `me.role === 'admin'`): a table from `GET /admin/users?search=&isBanned=` with a Ban/Unban toggle → `PATCH /admin/users/:id/ban`. Hide the toggle for admins and for yourself.

### 7.7 Suggested routes
`/login`, `/register`, `/chats`, `/chats/:conversationId`, `/search`, `/users/:id`, `/settings/profile`, `/settings/blocked`, `/admin/users`

---

## 8. Business rules and edge cases (don't get these wrong)

1. **One chat per pair of users.** `POST /conversations` is idempotent. Never assume it creates a new chat.
2. **A block works in both directions**, but the API only tells you about blocks **you** made. When the other user has blocked you, you only see **403** `You cannot message this user`.
3. **404 can mean "not yours".** Conversations you aren't part of return 404, never 403.
4. **Messages deleted for everyone stay in history** as placeholders. Messages deleted for you, and messages from before you cleared the chat, are removed from your responses.
5. **`unreadCount` doesn't go down** when the other person deletes a message for everyone. It resets when you call the read endpoint.
6. **Sending a message marks the chat as read for the sender.**
7. **A hidden chat comes back** when a new message arrives in it. Your client receives `message:new` for a chat that isn't in your list, so fetch it with `GET /conversations/:id`.
8. **`status` exists only on your own messages, and only in REST responses.** Work out live updates from `conversation:read`.
9. **Image URLs are relative.** Always prefix the server origin, never the `/api/v1` base.
10. **No sort parameters.** Users are A→Z by username, conversations newest-activity first, messages newest first, admin users newest-registered first, blocks newest first.

---

## 9. Data model (backend reference)

| Collection | Key fields | Notes |
|---|---|---|
| `users` | `name`, `username` (unique), `email` (unique), `password` (bcrypt hash, never returned), `role`, `bio`, `avatarUrl`, `lastSeenAt`, `isBanned` | Users are banned, never deleted |
| `conversations` | `participants[2]` (embedded: `user`, `lastReadAt`, `unreadCount`, `isHidden`, `clearedAt`), `participantKey` (unique, sorted `idA_idB`), `lastMessage` (embedded preview), `lastMessageAt` | The API flattens this into the per-viewer `Conversation` type |
| `messages` | `conversation`, `sender`, `type`, `text`, `imageUrl`, `deletedFor[]` (never returned), `isDeletedForEveryone` | Cursor pagination uses `_id` order |
| `blocks` | `blocker`, `blocked` (unique pair) | |

The full ER diagram is in [er-diagram.md](er-diagram.md).

---

## 10. Development data (sample accounts already in the development database)

All passwords are `Password123!`.

| Email | Username | Role | State |
|---|---|---|---|
| admin@chatnest.dev | admin | admin | — |
| aisha@example.com | aisha_k | user | Chats with `rahul.v` (all read) and `sara_l` (1 unread image message from Sara) |
| rahul@example.com | rahul.v | user | Chats with `aisha_k` and `ken_t` |
| sara@example.com | sara_l | user | Has blocked `priya.n` |
| ken@example.com | ken_t | user | Has 1 unread message from Rahul |
| priya@example.com | priya.n | user | Blocked by Sara, so Priya → Sara returns 403 |

Good manual test: log in as Aisha and as Sara in two browser windows to see live messages, read ticks and presence.

---

## 11. Backend file map (where behaviour lives)

| Concern | File |
|---|---|
| Limits, enums, socket event names | `src/config/constants.js` |
| Environment variables | `src/config/env.js`, `.env.example` |
| Route definitions + OpenAPI annotations | `src/routes/*.routes.js` |
| Request validation (Joi) | `src/validators/*.validator.js` |
| Business rules | `src/services/*.service.js` |
| Error → HTTP mapping | `src/middleware/errorHandler.js` |
| Socket auth, presence, emits | `src/socket/index.js` |
| Image storage on disk | `src/services/storage.service.js` |

---

## 12. Not supported (don't build UI for these)

- Group chats, message requests, contacts or friends lists
- Video, audio, documents, multiple images per message, GIFs or stickers
- Editing messages, reactions, replies or quotes, forwarding, pinning, starring
- Typing indicators, a separate "delivered" tick state, push or email notifications
- Password reset, email verification, changing email or password, deleting an account, refresh tokens, OAuth login
- Sending messages over the socket, i.e. any client→server socket events
- A total-unread endpoint. Sum `unreadCount` over the loaded chats, or treat `GET /conversations?unread=true` → `meta.total` as "chats with unread messages".
