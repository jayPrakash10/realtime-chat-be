# ChatNest: Data Model

MongoDB stores four collections. `Participant` and `LastMessage` are **embedded sub-documents** inside
`Conversation`, not separate collections, because a direct chat always has exactly two participants that are
always read together with the conversation.

```mermaid
erDiagram
    USER ||--o{ PARTICIPANT : "takes part as"
    CONVERSATION ||--|{ PARTICIPANT : "embeds exactly 2"
    CONVERSATION ||--o| LAST_MESSAGE : "embeds preview of"
    CONVERSATION ||--o{ MESSAGE : "contains"
    USER ||--o{ MESSAGE : "sends"
    USER ||--o{ BLOCK : "blocks (blocker)"
    USER ||--o{ BLOCK : "is blocked (blocked)"

    USER {
        ObjectId _id PK
        string name
        string username UK "lowercase, 3-30 chars"
        string email UK
        string password "bcrypt hash, never returned"
        string role "user | admin"
        string bio "max 150"
        string avatarUrl "nullable"
        date lastSeenAt
        boolean isBanned
        date createdAt
        date updatedAt
    }

    CONVERSATION {
        ObjectId _id PK
        string participantKey UK "sorted userIdA_userIdB"
        date lastMessageAt "sort key for the chat list"
        date createdAt
        date updatedAt
    }

    PARTICIPANT {
        ObjectId user FK "-> USER"
        date lastReadAt "drives read receipts"
        int unreadCount
        boolean isHidden "chat deleted for me"
        date clearedAt "history hidden before this"
    }

    LAST_MESSAGE {
        ObjectId messageId FK "-> MESSAGE"
        ObjectId sender FK "-> USER"
        string type
        string text
        boolean isDeleted
        date createdAt
    }

    MESSAGE {
        ObjectId _id PK
        ObjectId conversation FK "-> CONVERSATION"
        ObjectId sender FK "-> USER"
        string type "text | image"
        string text "max 2000, caption for images"
        string imageUrl "nullable"
        ObjectId[] deletedFor "-> USER, delete for me"
        boolean isDeletedForEveryone
        date createdAt
        date updatedAt
    }

    BLOCK {
        ObjectId _id PK
        ObjectId blocker FK "-> USER"
        ObjectId blocked FK "-> USER"
        date createdAt
    }
```

## Indexes (created by `migrations/20261109000000-create-indexes.js`)

| Collection | Index | Why |
|---|---|---|
| users | `{ username: 1 }` unique | No duplicate usernames; fast prefix search |
| users | `{ email: 1 }` unique | No duplicate accounts; fast login lookup |
| conversations | `{ participantKey: 1 }` unique | Only one chat per pair of users, even under concurrent requests |
| conversations | `{ 'participants.user': 1, lastMessageAt: -1 }` | "My chats, newest first" |
| messages | `{ conversation: 1, _id: -1 }` | Message history and cursor pagination |
| blocks | `{ blocker: 1, blocked: 1 }` unique | A user can block someone only once; fast block checks |

## How relationships are enforced without foreign keys

- **References** use `ObjectId` fields with Mongoose `ref`, so `.populate()` can join them.
- **Existence and ownership checks** happen in the service layer (for example, "is this user a participant of this
  conversation?") before any write.
- **Uniqueness** is enforced by unique indexes, which are safe under concurrent requests.
- **No cascading deletes** are needed: users are banned, never hard-deleted, so references never point to missing documents.
