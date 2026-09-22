import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import settings
from api.database import engine
from api.routers import actuators, devices, rules, sensors, status, sync
from api.services.mqtt_publisher import mqtt_publisher
from models import Base

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
log = logging.getLogger("edge.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    log.info("Starting GreenNode Edge Gateway API on %s:%s...", settings.HOST, settings.PORT)
    # Ensure all tables exist in SQLite
    Base.metadata.create_all(bind=engine)
    # Connect to local Mosquitto MQTT broker
    mqtt_publisher.start()
    log.info("Edge Gateway API initialized successfully.")

    yield

    # --- Shutdown ---
    log.info("Shutting down GreenNode Edge Gateway API...")
    mqtt_publisher.stop()
    log.info("Edge Gateway API stopped.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="GreenNode Smart Greenhouse — Raspberry Pi Edge Gateway REST API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for local dashboards, web UI, and technician devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open on local greenhouse subnet
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Sub-Routers
app.include_router(sensors.router, prefix="/api")
app.include_router(actuators.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(sync.router, prefix="/api")
app.include_router(status.router, prefix="/api")


@app.get("/", tags=["Root"])
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "node_id": settings.NODE_ID,
        "docs": "/docs",
        "api_endpoints": {
            "sensors": "/api/sensors/latest",
            "actuators": "/api/actuators",
            "devices": "/api/devices",
            "rules": "/api/rules",
            "sync": "/api/sync/status",
            "status": "/api/status",
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
