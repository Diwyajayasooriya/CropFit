from django.contrib import admin
# pyrefly: ignore [missing-import]
from apps.authentication.models import User
# Register your models here.
admin.site.register(User)
