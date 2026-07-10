from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.urls import URLPattern, URLResolver, get_resolver
import pytest

from apps.common.errors import error_payload


def _route_strings(patterns):
    for pattern in patterns:
        if isinstance(pattern, URLPattern):
            yield str(pattern.pattern)
        elif isinstance(pattern, URLResolver):
            yield str(pattern.pattern)
            yield from _route_strings(pattern.url_patterns)


def test_django_system_check_passes():
    call_command("check")


def test_health_endpoint_returns_ok(api_client):
    response = api_client.get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_no_api_v1_routes_are_registered():
    routes = list(_route_strings(get_resolver().url_patterns))

    assert not any("api/v1/" in route for route in routes)


def test_error_payload_has_standard_shape():
    payload = error_payload(
        code="VALIDATION_ERROR",
        message="Some fields are invalid.",
        details={"field": ["Reason"]},
    )

    assert payload == {
        "code": "VALIDATION_ERROR",
        "message": "Some fields are invalid.",
        "details": {"field": ["Reason"]},
    }


@pytest.mark.django_db
def test_database_can_create_and_read_user():
    User = get_user_model()

    User.objects.create_user(
        email="foundation@example.com",
        password="test-password",
        full_name="Foundation User",
        role=User.Role.ADMIN,
    )

    user = User.objects.get(email="foundation@example.com")
    assert user.full_name == "Foundation User"
    assert user.role == User.Role.ADMIN
