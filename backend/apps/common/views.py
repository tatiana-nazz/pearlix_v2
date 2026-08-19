import os
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def api_root(request):
    return Response({"health": request.build_absolute_uri("health/")})


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "ok"})


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def temporary_demo_finalize(request):
    """One-time staging data normalization; removed immediately after use."""
    if os.environ.get("PEARLIX_DEMO_FINALIZE_HTTP_ENABLED", "").lower() not in {"1", "true", "yes", "on"}:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    output = StringIO()
    try:
        call_command("finalize_demo_seed", stdout=output, stderr=output)
    except CommandError as exc:
        return Response(
            {"status": "error", "detail": str(exc), "command_output": output.getvalue()},
            status=status.HTTP_409_CONFLICT,
        )
    return Response({"status": "ok", "command_output": output.getvalue()})
