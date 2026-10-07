"""Isolated local browser fixture. Never uses backend/db.sqlite3."""
import os
import sys
import time
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(root / '.review' / 'frontend-preview.sqlite')
settings.CORS_ALLOW_ALL_ORIGINS = True
import django
django.setup()
from django.core.management import call_command
call_command('migrate', verbosity=0, interactive=False)
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.greenhouses.models.models import GreenHouse
from apps.node.models.nodeDetails.models import Node
from apps.node.models.actuators.models import Actuator
from apps.node.sensor.sensors.models import Sensor
from apps.conditions.models.models import ConditionReading, Condition
User = get_user_model()
user, _ = User.objects.get_or_create(username='preview-farmer', defaults={'email': 'preview@example.test', 'role': 'farmer', 'first_name': 'Preview'})
user.set_password('Preview-local-42!')
user.save()
for index in (1, 2):
    gh, _ = GreenHouse.objects.get_or_create(user=user, name=f'Preview Greenhouse {index}', defaults={'location': 'Local browser fixture', 'crop': 'Tomato'})
    node, _ = Node.objects.get_or_create(node_id=f'PREVIEW-{index}', defaults={'node_name': f'Preview Hub {index}', 'greenHouse': gh, 'is_claimed': True})
    node.last_seen = timezone.now()
    node.save()
    Sensor.objects.get_or_create(node=node, sensor_id=f'preview-sensor-{index}', defaults={'sensor_type': 'DHT22', 'unit': '°C'})
    Actuator.objects.get_or_create(node=node, actuator_id=f'preview-fan-{index}', defaults={'actuator_type': 'fan', 'is_active': False})
    Condition.objects.get_or_create(condition_id=f'preview-temperature-{index}', defaults={'node': node, 'greenhouse': gh, 'condition_type': 'temperature_max', 'threshold_value': 30})
    if not ConditionReading.objects.filter(node=node).exists():
        for step in range(12):
            ConditionReading.objects.create(node=node, device_id=f'preview-sensor-{index}', reading_ts=int(time.time()) - (11-step)*300, temperature=23+step/3, humidity=65-step/2, soil_moisture=40-step/4)
Node.objects.get_or_create(node_id='PREVIEW-CLAIM', defaults={'node_name': 'Claim Preview Hub', 'claim_code': 'PREVIEW123'})
print('Isolated preview API ready at http://127.0.0.1:8100', flush=True)
call_command('runserver', '127.0.0.1:8100', use_reloader=False)
