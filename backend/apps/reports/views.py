import time
from django.db.models import Avg, Min, Max, Count
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.conditions.models.models import ConditionReading
from apps.alerts.models import Alert
from apps.devices.models import Device
from apps.greenhouses.models.models import GreenHouse


from apps.authentication.Permitions.permissions import IsFarmer

class ReportSummaryView(APIView):
    """
    GET /api/v1/reports/summary/?greenhouse=<id>&hours=24
    Aggregates environmental conditions, active alerts, and fleet status using SQL aggregations.
    """
    permission_classes = [IsFarmer]

    def get(self, request):
        greenhouse_id = request.query_params.get('greenhouse')
        hours = int(request.query_params.get('hours', 24))

        cutoff_ts = int(time.time()) - (hours * 3600)

        # Base query for readings within time window
        readings_qs = ConditionReading.objects.filter(reading_ts__gte=cutoff_ts)
        user = request.user
        is_admin = user.is_superuser or getattr(user, 'role', '') == 'admin'
        if not is_admin:
            readings_qs = readings_qs.filter(node__greenHouse__user=user)
        if greenhouse_id:
            readings_qs = readings_qs.filter(node__greenHouse_id=greenhouse_id)

        # SQL Aggregate Metrics (Min, Max, Avg)
        aggregates = readings_qs.aggregate(
            avg_temp=Avg('temperature'),
            min_temp=Min('temperature'),
            max_temp=Max('temperature'),
            avg_humidity=Avg('humidity'),
            min_humidity=Min('humidity'),
            max_humidity=Max('humidity'),
            avg_soil_moisture=Avg('soil_moisture'),
            min_soil_moisture=Min('soil_moisture'),
            max_soil_moisture=Max('soil_moisture'),
            total_readings=Count('id'),
        )

        # Alert stats
        alerts_qs = Alert.objects.all()
        if not is_admin:
            alerts_qs = alerts_qs.filter(greenhouse__user=user)
        if greenhouse_id:
            alerts_qs = alerts_qs.filter(greenhouse_id=greenhouse_id)

        active_alerts = alerts_qs.filter(is_resolved=False).count()
        critical_alerts = alerts_qs.filter(is_resolved=False, severity='critical').count()

        # Device stats
        devices_qs = Device.objects.all()
        if not is_admin:
            devices_qs = devices_qs.filter(node__greenHouse__user=user)
        if greenhouse_id:
            devices_qs = devices_qs.filter(node__greenHouse_id=greenhouse_id)

        total_devices = devices_qs.count()
        active_sensors = devices_qs.filter(device_type='sensor', revoked=False).count()
        active_actuators = devices_qs.filter(device_type='actuator', revoked=False).count()

        return Response({
            "window_hours": hours,
            "greenhouse_id": greenhouse_id,
            "metrics": {
                "temperature": {
                    "avg": round(aggregates['avg_temp'], 1) if aggregates['avg_temp'] is not None else None,
                    "min": aggregates['min_temp'],
                    "max": aggregates['max_temp'],
                    "unit": "°C",
                },
                "humidity": {
                    "avg": round(aggregates['avg_humidity'], 1) if aggregates['avg_humidity'] is not None else None,
                    "min": aggregates['min_humidity'],
                    "max": aggregates['max_humidity'],
                    "unit": "%",
                },
                "soil_moisture": {
                    "avg": round(aggregates['avg_soil_moisture'], 1) if aggregates['avg_soil_moisture'] is not None else None,
                    "min": aggregates['min_soil_moisture'],
                    "max": aggregates['max_soil_moisture'],
                    "unit": "%",
                },
                "total_readings_logged": aggregates['total_readings'],
            },
            "alerts": {
                "active_total": active_alerts,
                "active_critical": critical_alerts,
            },
            "fleet": {
                "total_devices": total_devices,
                "active_sensors": active_sensors,
                "active_actuators": active_actuators,
            }
        }, status=status.HTTP_200_OK)


class DashboardSummaryView(APIView):
    """
    GET /api/v1/reports/dashboard/
    Combines latest metrics and actuator states for the frontend dashboard.
    Conforms strictly to frontend DashboardSummary interface with tenant greenhouse isolation.
    """
    permission_classes = [IsFarmer]

    def get(self, request):
        user = request.user
        greenhouse_id = request.query_params.get('greenhouse')

        # Greenhouse isolation: Admins see all; farmers see their own
        if getattr(user, 'role', '') == 'admin' or user.is_superuser:
            greenhouses = GreenHouse.objects.all()
            if greenhouse_id:
                greenhouses = greenhouses.filter(id=greenhouse_id)
        else:
            greenhouses = GreenHouse.objects.filter(user=user)
            if greenhouse_id:
                greenhouses = greenhouses.filter(id=greenhouse_id)

        from apps.node.models.nodeDetails.models import Node
        from apps.node.models.actuators.models import Actuator

        nodes = Node.objects.filter(greenHouse__in=greenhouses)
        
        # Latest two samples per device. A trend requires two real measurements.
        tiles = []
        readings = ConditionReading.objects.filter(node__in=nodes)
        devices = readings.order_by().values_list('node_id', 'device_id').distinct()
        metrics = [
            ('temperature', 'temp', 'Ambient Temperature', '°C'),
            ('humidity', 'hum', 'Relative Humidity', '%'),
            ('soil_moisture', 'soil', 'Soil Moisture', '%'),
        ]
        node_map = {node.id: node for node in nodes}
        for node_id, device_id in devices:
            samples = list(readings.filter(node_id=node_id, device_id=device_id).order_by('-reading_ts', '-id')[:2])
            latest = samples[0]
            previous = samples[1] if len(samples) > 1 else None
            for metric, prefix, name, unit in metrics:
                value = getattr(latest, metric)
                before = getattr(previous, metric) if previous else None
                trend = None
                if value is not None and before is not None:
                    trend = 'up' if value > before else 'down' if value < before else 'stable'
                tiles.append({
                    'sensor_id': f'{prefix}-{node_id}-{device_id}',
                    'node_id': node_id, 'device_id': device_id,
                    'sensor_name': f'{name} · {device_id}',
                    'sensor_kind': metric,
                    'value': round(float(value), 1) if value is not None else None,
                    'unit': unit,
                    'status': 'online' if node_map[node_id].is_online else 'offline',
                    'trend': trend,
                    'updated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(latest.reading_ts)),
                })

        # 2. Fetch actuators
        actuators = []
        for a in Actuator.objects.filter(node__in=nodes):
            kind = a.actuator_type.lower()
            if kind not in ['pump', 'fan', 'vent', 'light', 'heater']:
                kind = 'pump'
            actuators.append({
                "id": a.id,
                "node": a.node_id,
                "confirmed_at": a.confirmed_at,
                "actuator_id": a.actuator_id,
                "name": f"{a.actuator_type.title()} ({a.actuator_id})",
                "actuator_kind": kind,
                "is_active": bool(a.is_active),
                "auto_mode": True,
                "status": "online" if a.node.is_online else "offline",
            })

        # 3. Overall status & active alerts
        active_alerts = Alert.objects.filter(greenhouse__in=greenhouses, is_resolved=False).count()
        if active_alerts > 0:
            status_msg = f"System Warning: {active_alerts} active alert(s) detected."
            overall_status = "warning"
        else:
            status_msg = "No unresolved alerts. Review readings against your crop's configured thresholds."
            overall_status = "healthy"

        return Response({
            "message": status_msg,
            "overall_status": overall_status,
            "tiles": tiles,
            "actuators": actuators
        }, status=status.HTTP_200_OK)
