"""Session-authenticated enforcement for mandatory password changes."""

from django.http import JsonResponse

from apps.common.errors import error_payload


class MandatoryPasswordChangeMiddleware:
    """Prevent Django sessions from bypassing the JWT password-life-cycle gate."""

    ALLOWED_PATHS = frozenset(
        {
            "/admin/logout/",
            "/api/auth/change-password/",
            "/api/auth/login/",
            "/api/auth/logout/",
            "/api/auth/refresh/",
            "/api/me/",
        }
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if (
            user is not None
            and user.is_authenticated
            and user.must_change_password
            and request.path_info not in self.ALLOWED_PATHS
        ):
            return JsonResponse(
                error_payload(
                    "PASSWORD_CHANGE_REQUIRED",
                    "Change the temporary password before using this account.",
                ),
                status=403,
            )
        return self.get_response(request)
