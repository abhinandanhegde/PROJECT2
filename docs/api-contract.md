# T2 Bug Tracker — API Contract

> The full API contract will be defined before feature development begins.
> This document tracks the current endpoints.

## Base URL

```
http://localhost:8000
```

---

## Endpoints

### Health Check

```
GET /health
```

**Response:**

```json
{
  "status": "ok"
}
```

**Status codes:**

| Code | Meaning |
|------|---------|
| 200  | Service is healthy |

---

## Notes

- All future endpoints will follow REST conventions.
- The API contract will be finalized and documented here before the team begins feature work.
- Interactive API docs are available at `http://localhost:8000/docs` (Swagger UI).
