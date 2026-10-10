"""
CropFit Edge — Main Daemon Entry Point
Thin bootstrap script initializing configuration, identity, and the edge state machine.
"""
import logging
import argparse
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
    parser = argparse.ArgumentParser(description="CropFit edge hub daemon")
    parser.add_argument("--setup-wifi", action="store_true", help="Open Wi-Fi setup without resetting hub ownership or credentials")
    args = parser.parse_args()
    setup_logging()
    log = logging.getLogger("cropfit.main")
    log.info("=" * 55)
    log.info("  CropFit GreenNode Edge Hub Appliance Daemon")
    log.info("=" * 55)

    config_mgr = ConfigManager()
    state_machine = EdgeStateMachine(config_mgr=config_mgr, setup_wifi=args.setup_wifi)
    state_machine.run()


if __name__ == "__main__":
    main()
