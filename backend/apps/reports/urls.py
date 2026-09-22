from django.urls import path
from apps.reports.views import ReportSummaryView

urlpatterns = [
    path('summary/', ReportSummaryView.as_view(), name='report-summary'),
]
