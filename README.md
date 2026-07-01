# TaskMaster

A backend for a collaborative task tracking application. Teams can be created, members invited, tasks assigned and tracked through their lifecycle, and discussions kept on each task through comments and file attachments. Real-time notifications are pushed over WebSockets whenever something relevant happens to a user, and there's an optional endpoint that uses Claude to turn a rough idea into a proper task description.

## Why these choices

The brief left the database open, so I went with MongoDB. Tasks naturally carry a variable amount of nested data (attachments, assignment history, comments referencing them) and Mongoose made that easy to model without forcing a rigid join-heavy schema. Express keeps the routing layer simple and explicit, which made sense for an API this size.

## Stack

- Node.js / Express
- MongoDB with Mongoose
- JWT for authentication, bcrypt for password hashing
- Socket.io for real-time notifications
- Multer for file attachments
- express-validator for request validation
- Claude API (Anthropic) for the AI description generation endpoint, optional

## Project structure

```
src/
  config/        database connection, multer, socket.io setup
  controllers/   request handlers, grouped by resource
  middleware/    auth guard, validation, centralized error handler
  models/        Mongoose schemas - User, Team, Task, Comment, Notification
  routes/        route definitions per resource
  services/      notification service (DB write + socket emit), AI service
  utils/         JWT helpers, AppError, async wrapper
  uploads/       stored attachment files, served statically
  app.js         express app and route mounting
  server.js      entry point - boots DB, http server, and socket.io
tests/
  smoke.test.js  validation/auth/routing tests that don't need a live DB
```

## Getting started

1. Clone the repo and install dependencies

```
npm install
```

2. Copy `.env.example` to `.env` and fill in the values

```
cp .env.example .env
```

You'll need a running MongoDB instance (local or Atlas) and a JWT secret. The `ANTHROPIC_API_KEY` is only needed if you want the AI description endpoint to work - everything else runs fine without it.

3. Start the server

```
npm run dev
```

The API will be available at `http://localhost:5000/api`, with a health check at `/api/health`.

## Authentication

Most routes expect a Bearer token from the login/register response:

```
Authorization: Bearer <token>
```

Socket.io connections also authenticate with a token, passed in the handshake:

```js
io(URL, { auth: { token } })
```

On connection, the server puts the socket into a private room keyed by the user's id, so notifications can be targeted directly without tracking socket ids anywhere.

## API overview

### Auth
- `POST /api/auth/register` - create an account
- `POST /api/auth/login` - get a token
- `GET /api/auth/profile` - current user's profile
- `PATCH /api/auth/profile` - update name, bio, avatar
- `POST /api/auth/logout`

### Teams
- `POST /api/teams` - create a team (creator becomes owner)
- `GET /api/teams` - teams the current user belongs to
- `GET /api/teams/:teamId`
- `POST /api/teams/:teamId/invite` - invite by email (owner/admin only)
- `POST /api/teams/join` - join using an invite code
- `DELETE /api/teams/:teamId/members/:userId`

### Tasks
- `POST /api/tasks` - create a task within a team
- `GET /api/tasks?team=...&status=&priority=&assignedTo=&search=&sortBy=&order=&page=&limit=` - filter, sort, search, paginate
- `GET /api/tasks/mine` - tasks assigned to the current user
- `GET /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId` - update fields, including status and assignment
- `DELETE /api/tasks/:taskId` - creator or team admin/owner only
- `POST /api/tasks/:taskId/attachments` - multipart upload, field name `file`
- `POST /api/tasks/generate-description` - body `{ "prompt": "short idea" }`, returns an AI-written description

### Comments
- `GET /api/tasks/:taskId/comments`
- `POST /api/tasks/:taskId/comments`
- `DELETE /api/comments/:commentId` - author only

### Notifications
- `GET /api/notifications?unreadOnly=true`
- `PATCH /api/notifications/:notificationId/read`
- `PATCH /api/notifications/read-all`

## Real-time events

The client listens for a `notification` event after connecting:

```js
socket.on('notification', (payload) => {
  // { id, type, message, task, team, createdAt }
});
```

Notifications are fired for task assignment, task updates that affect the assignee, new comments on a task you're assigned to, and team invites. Each one is also written to the database, so `GET /api/notifications` works even for events a user missed while offline.

## Error handling

All errors flow through a single error-handling middleware. Operational errors (validation failures, missing resources, auth issues) return a clean message and the right status code. Anything unexpected gets logged server-side and returns a generic message, so internals never leak into a response.

## Testing

```
npm test
```

The included tests cover validation, auth guards, and routing behavior without needing a live database connection, which keeps them fast and easy to run anywhere. For testing against real data, connect to a MongoDB instance and exercise the endpoints with a client like Postman or Thunder Client - a basic collection of example requests is the easiest way to walk through the full flow: register, create a team, invite a member, create and assign a task, comment, and check that a notification shows up for the assignee.

## Notes on scope

Task filtering uses MongoDB's text index on title and description, so search is a simple `$text` match rather than fuzzy search. File attachments are stored on local disk under `src/uploads` and served statically - for a production deployment this would move to object storage (S3 or similar), but local storage was the more practical option for a backend project on a tight timeline.
