from django.urls import path

from apps.common.views import api_root, health_check, temporary_demo_finalize


urlpatterns = [
    path("", api_root, name="api-root"),
    path("health/", health_check, name="health-check"),
    path("setup/demo-finalize-8a9162f5400b4d908e20/", temporary_demo_finalize, name="temporary-demo-finalize"),
]
