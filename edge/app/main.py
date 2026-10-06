"""
CropFit Edge — Main Daemon Entry Point
Thin bootstrap script initializing configuration, identity, and the edge state machine.
"""
import logging
import sys
from pathlib import Path

# Add edge root to sys.path
EDGE_ROOT = Path(__file__).resolve().parent.parent
if str(EDGE_ROOT) not in sys.path:
    sys.path.insert(0, str(EDGE_ROOT))

from app.config_manager import ConfigManager
from app.state_machine import EdgeStateMachine


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    )


def main():
    setup_logging()
    log = logging.getLogger("cropfit.main")
    log.info("=" * 55)
    log.info("  CropFit GreenNode Edge Hub Appliance Daemon")
    log.info("=" * 55)

    config_mgr = ConfigManager()
    state_machine = EdgeStateMachine(config_mgr=config_mgr)
    state_machine.run()


if __name__ == "__main__":
    main()
