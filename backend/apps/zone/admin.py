from django.contrib import admin
from .models import Zone

@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'description')
