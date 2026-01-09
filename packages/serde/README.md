# @effing/serde

**URL-safe serialization with compression and HMAC signing.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Serialize JSON data into URL-safe strings with automatic compression and cryptographic signing. Compatible with Python's [itsdangerous](https://itsdangerous.palletsprojects.com/).

## Installation

```bash
npm install @effing/serde
```

## Quick Start

```typescript
import { serialize, deserialize } from "@effing/serde";

const secret = process.env.SECRET_KEY!;
const data = { userId: 123, action: "view" };

// Signed (and sometimes compressed) URL segment
const segment = await serialize(data, secret);

// Verify signature (and decompress if needed)
const restored = await deserialize<typeof data>(segment, secret);
```

## Concepts

### URL-Safe Base64

Standard Base64 uses `+` and `/` which have special meaning in URLs. This package uses URL-safe Base64:

- `+` → `-`
- `/` → `_`
- No padding (`=`)

### Signed Serialization

Serialization is signed with HMAC (default: `sha1`) so the result can safely be used in a URL without being tampered with:

```typescript
// Server: create signed URL segment
const segment = await serialize(data, secret);

// Client: passes segment in URL
// Server: verify and deserialize
const data = await deserialize(segment, secret);
// Throws if signature is invalid.
```

### Compression

Payloads are gzip-compressed when it saves space. Compressed payloads are prefixed with a leading `"."` (matching `itsdangerous`).

## API Overview

#### `serialize(obj, secretKey, options?)`

Serialize a value to a URL-safe string.

```typescript
function serialize(
  obj: object,
  secretKey: string,
  options?: {
    /** Salt for key derivation (default: "itsdangerous") */
    salt?: string;
    /** Hash algorithm for HMAC (default: "sha1") */
    algorithm?: string;
  },
): Promise<string>;
```

#### `deserialize(segment, secretKey, options?)`

Deserialize a URL segment back to a value.

```typescript
function deserialize<T = Record<string, unknown>>(
  segment: string,
  secretKey: string,
  options?: {
    /** Salt for key derivation (default: "itsdangerous") */
    salt?: string;
    /** Hash algorithm for HMAC (default: "sha1") */
    algorithm?: string;
    /** Convert snake_case keys to camelCase (default: true) */
    convertKeysToCamel?: boolean;
  },
): Promise<T>;
```

**Throws:**

- `Error` — If signature verification fails

## Examples

### Passing Props in URLs

```typescript
import { serialize, deserialize } from "@effing/serde";

// Create URL with serialized props
const secret = process.env.SECRET_KEY!;
const props = { imageUrl: "https://example.com/image.png", duration: 5 };
const segment = await serialize(props, secret);
const url = `/render/${segment}`;

// In route handler
async function loader({ params }) {
  const props = await deserialize(params.segment, secret);
  // props = { imageUrl: "https://example.com/image.png", duration: 5 }
}
```

> **Note:** The `convertKeysToCamel` deserialization option (which is `true` by default) is useful when URLs are built in Python (with itsdangerous) and then consumed by Effing. Python typically uses `snake_case` keys, while TypeScript prefers `camelCase`.

### Secure Tokens

```typescript
const SECRET = process.env.TOKEN_SECRET!;

// Create signed token
async function createToken(userId: number, expiresAt: number) {
  return serialize({ userId, expiresAt }, SECRET);
}

// Verify token
async function verifyToken(token: string) {
  try {
    const { userId, expiresAt } = await deserialize(token, SECRET);
    if (Date.now() > expiresAt) throw new Error("Token expired");
    return userId;
  } catch (e) {
    throw new Error("Invalid token");
  }
}
```
