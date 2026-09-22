import time
from django.db.models import Avg, Min, Max, Count
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.conditions.models.models import ConditionReading
from apps.alerts.models import Alert
from apps.devices.models import Device
from apps.greenhouses.models.models import GreenHouse


class ReportSummaryView(APIView):
    """
    GET /api/v1/reports/summary/?greenhouse=<id>&hours=24
    Aggregates environmental conditions, active alerts, and fleet status using SQL aggregations.
    """
    permission_classes = [permissions.AllowAny]

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
