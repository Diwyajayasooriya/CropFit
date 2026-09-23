# Green Node — Implementation Tasks

## Priority 1: ESP32 Real Sensor Firmware
- [ ] DHT22 temperature/humidity sensor firmware
- [ ] Capacitive soil moisture sensor firmware
- [ ] Relay actuator firmware

## Priority 2: Edge Ingestion (already done)
- [x] ingestion_service.py
- [x] actuator_dispatcher.py
- [x] models.py (SQLAlchemy)
- [x] init_db.py

## Priority 3: FastAPI on Pi (Completed)
- [x] `edge/api/config.py` — settings
- [x] `edge/api/main.py` — FastAPI app entry
- [x] `edge/api/models/schemas.py` — Pydantic schemas
- [x] `edge/api/routers/sensors.py` — GET latest, history
- [x] `edge/api/routers/actuators.py` — GET list, POST command
- [x] `edge/api/routers/devices.py` — GET list, POST register
- [x] `edge/api/routers/rules.py` — CRUD rules
- [x] `edge/api/routers/sync.py` — trigger sync, status
- [x] `edge/api/routers/status.py` — hub health
- [x] `edge/api/services/mqtt_publisher.py` — wraps ActuatorDispatcher
- [x] `edge/api/services/sync_service.py` — edge → cloud sync
- [x] `edge/mock_esp32.py` — Mock sensor & actuator simulator for hardware-free testing

## Priority 4: Django Cloud Backend Endpoints (Completed)
- [x] Greenhouse CRUD (`apps.greenhouses`: serializers, views, urls)
- [x] Node endpoints (`apps.node`: list, detail, sensors, actuators)
- [x] Conditions bulk-sync endpoint (`POST /api/v1/conditions/bulk-sync/` with SQL `bulk_create`)
- [x] Rules CRUD (`apps.rules`: serializers, views, urls, export for edge)
- [x] Devices registry API (`apps.devices`: fleet list, device sync)
- [x] Alerts system (`apps.alerts`: list, filter by severity, acknowledge action)
- [x] Reports/aggregation (`GET /api/v1/reports/summary/` with SQL Min/Max/Avg)

## Priority 5: Edge Sync Service
- [x] Sync conditions (synced=0 → cloud)
- [x] Sync actions_log
- [x] APScheduler integration
- [x] Retry with backoff

## Priority 6: Wire Dashboard to Real APIs
- [x] Replace mock data with real API calls
- [x] Dashboard sensor tiles → real data
- [x] Actuator toggles → real commands
- [x] Rules CRUD UI
- [x] Alerts page

## Priority 7: DB-Driven Rules Engine
- [ ] Read rules from node_rules_cache
- [ ] Compound conditions support
- [ ] actions_log writes
- [ ] Conflict detection
