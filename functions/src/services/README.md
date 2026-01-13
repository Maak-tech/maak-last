# Services

External service adapters and background jobs.

## Structure (WIP)

- `zeina/` - Zeina AI assistant adapter
- `notifications/` - Push notification service
- `background/` - Scheduled jobs and background tasks

Services should:
- Provide clean interfaces to external systems
- Handle retries and error cases
- Use observability/logger for tracking
- Keep business logic in modules/
