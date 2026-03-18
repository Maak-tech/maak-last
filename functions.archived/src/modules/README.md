# Modules

Domain logic organized by business capability.

## Structure (WIP)

- `patients/` - Patient management logic
- `caregivers/` - Caregiver management logic
- `vitals/` - Vital signs processing and analysis
- `alerts/` - Alert generation and management
- `medications/` - Medication tracking and reminders

Each module should contain:
- Business logic functions
- Data validation
- Domain-specific calculations
- Use db/ helpers for data access
- Use observability/logger for logging
