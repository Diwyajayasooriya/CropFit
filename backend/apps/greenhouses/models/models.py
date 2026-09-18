from django.contrib.auth import get_user_model
from django.db import models
User=get_user_model()

#user can have more green house
class GreenHouse(models.Model):
    user=models.ForeignKey(User,on_delete=models.CASCADE,related_name="greenHouse")
    #green house name
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200)
    #crop type
    crop = models.CharField(max_length=100)
    #start day
    plantation_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
