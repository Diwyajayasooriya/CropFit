from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from apps.node.sensor.sensorSerializers.sensorSerializer import SensorSerializer


class PostSensorData(APIView):
    def post(self,request):
        serializer=SensorSerializer(data=request.data)
        serializer.is_valid(
            raise_exception=True
        )
        serializer.save()
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED

        )
