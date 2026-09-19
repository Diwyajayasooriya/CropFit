from django.urls import path

from apps.node.sensor.sensorServices.postSensorData import PostSensorData

urlpatterns = [
    path("sensordata/", PostSensorData.as_view(), name="condition-create"),
]