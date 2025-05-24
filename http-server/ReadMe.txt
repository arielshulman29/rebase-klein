# HTTP Blob Server

## Prerequisites

- Node.js v23 or higher
- pnpm

## API Endpoints

### POST /blobs/{id}
Upload a binary blob with optional metadata headers.

**Headers:**
- `Content-Type` (optional)
- Any header starting with `x-rebase-` (case insensitive)

**Limitations:**
- Maximum blob size: 10MB
- Maximum disk quota: 1GB
- Maximum header length: 50 characters
- Maximum header count: 20
- Maximum ID length: 200 characters
- ID can only contain: a-z, A-Z, 0-9, dot (.), underscore (_), minus (-)

### GET /blobs/{id}
Retrieve a stored blob and its associated metadata.

## Setup and Installation

1. Install dependencies:
```bash
pnpm install
```

2. Start the server:
```bash
pnpm start
node main.ts
```

The server will start on port 3000 by default.

## Running Tests

The project includes both unit and integration tests. To run the tests:

```bash
pnpm test
```
