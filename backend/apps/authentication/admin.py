from django.contrib import admin
from .models import User, UserProfile


#register model in admin page
admin.site.register(UserProfile)
admin.site.register(User)