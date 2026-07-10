from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import (
    RefreshView,
    UserViewSet,
    change_password_view,
    login_view,
    logout_view,
    me_view,
    preferences_view,
)


router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("auth/login/", login_view, name="auth-login"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", logout_view, name="auth-logout"),
    path("auth/change-password/", change_password_view, name="auth-change-password"),
    path("me/", me_view, name="me"),
    path("me/preferences/", preferences_view, name="me-preferences"),
]

urlpatterns += router.urls
