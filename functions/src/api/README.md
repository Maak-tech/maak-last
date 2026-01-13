# API

HTTP handlers and oRPC procedure handlers.

## Structure (WIP)

- `http/` - Express/Firebase HTTP endpoints
- `orpc/` - oRPC procedures (type-safe RPC)

API handlers should:
- Validate input
- Check permissions (security/rbac)
- Delegate to modules/ for business logic
- Return structured responses
- Log requests (observability/logger)
