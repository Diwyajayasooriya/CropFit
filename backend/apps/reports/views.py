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
        if greenhouse_id:
            alerts_qs = alerts_qs.filter(greenhouse_id=greenhouse_id)

        active_alerts = alerts_qs.filter(is_resolved=False).count()
        critical_alerts = alerts_qs.filter(is_resolved=False, severity='critical').count()

        # Device stats
        devices_qs = Device.objects.all()
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
    """
    permission_classes = [IsFarmer]

    def get(self, request):
        # 1. Get latest readings for tiles
        latest_readings = ConditionReading.objects.order_by('-reading_ts')[:5]
        tiles = []
        for r in latest_readings:
            tiles.append({
                "sensor_id": f"SN-{r.id}",
                "label": "Temperature" if r.temperature else "Humidity",
                "value": float(r.temperature or r.humidity or 0),
                "unit": "°C" if r.temperature else "%",
                "kind": "temperature" if r.temperature else "humidity",
                "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(r.reading_ts))
            })

        # 2. Get actuators
        actuators_qs = Device.objects.filter(device_type='actuator')
        actuators = [{
            "actuator_id": a.device_id,
            "name": a.name,
            "is_active": a.is_online, # Mapping online status to active for simplicity
            "kind": "relay"
        } for a in actuators_qs]

        # 3. Overall status
        active_alerts = Alert.objects.filter(is_resolved=False).count()
        status_msg = "System Healthy. All conditions within optimal range."
        overall_status = "healthy"
        if active_alerts > 0:
            status_msg = f"System Warning. {active_alerts} active alerts detected."
            overall_status = "warning"

        return Response({
            "message": status_msg,
            "overall_status": overall_status,
            "tiles": tiles,
            "actuators": actuators
        })
