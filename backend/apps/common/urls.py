from django.urls import path

from apps.common.views import api_root, health_check, temporary_demo_seed


urlpatterns = [
    path("", api_root, name="api-root"),
    path("health/", health_check, name="health-check"),
    path("setup/demo-seed-6f41b6eec3d849a4a95d/", temporary_demo_seed, name="temporary-demo-seed"),
]
