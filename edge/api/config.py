import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "GreenNode Edge Gateway API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Node Identity
    NODE_ID: str = os.getenv("NODE_ID", "pi-edge-hub-01")
    GREENHOUSE_ID: str = os.getenv("GREENHOUSE_ID", "greenhouse-01")

    # Database
    DB_URL: str = os.getenv("DB_URL", "sqlite:///./greennode.db")

    # Local MQTT Broker
    MQTT_HOST: str = os.getenv("MQTT_HOST", "127.0.0.1")
    MQTT_PORT: int = int(os.getenv("MQTT_PORT", "1883"))
    MQTT_USER: str = os.getenv("MQTT_USER", "greennode-dispatch")
    MQTT_PASS: str = os.getenv("MQTT_PASS", "CHANGE_ME")

    # Cloud Django Backend Configuration
    CLOUD_BACKEND_URL: str = os.getenv("CLOUD_BACKEND_URL", "http://127.0.0.1:8000")
    CLOUD_SYNC_TOKEN: str = os.getenv("CLOUD_SYNC_TOKEN", "")
    SYNC_BATCH_SIZE: int = int(os.getenv("SYNC_BATCH_SIZE", "50"))
    SYNC_INTERVAL_SECONDS: int = int(os.getenv("SYNC_INTERVAL_SECONDS", "30"))

    # Pairing Watcher Local API
    PAIRING_WATCHER_URL: str = os.getenv("PAIRING_WATCHER_URL", "http://127.0.0.1:8091")

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
