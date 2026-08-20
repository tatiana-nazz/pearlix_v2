"""JWT authentication boundaries for account security state."""

from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings


ACCOUNT_VERSION_CLAIM = "account_version"

# Public token-lifecycle endpoints do not require an access token.  Ignoring
# an accidentally attached stale Authorization header keeps recovery and
# refresh-token blacklisting usable during identity transitions.
UNAUTHENTICATED_TOKEN_LIFECYCLE_URLS = frozenset(
    {"auth-login", "auth-refresh", "auth-logout"}
)
PASSWORD_CHANGE_ALLOWED_URLS = frozenset(
    {
        "auth-change-password",
        "auth-logout",
        "me",
    }
)


class AccountAuthorityChanged(AuthenticationFailed):
    default_detail = "Account authority changed. Sign in again."
    default_code = "account_authority_changed"


class PasswordChangeRequired(PermissionDenied):
    default_detail = "Change the temporary password before using this account."
    default_code = "password_change_required"


class AccountVersionTokenRefreshSerializer(TokenRefreshSerializer):
    """Refuse refresh tokens issued before an account-authority transition."""

    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])
        user_id = refresh.payload.get(api_settings.USER_ID_CLAIM)
        user = get_user_model().objects.filter(
            **{api_settings.USER_ID_FIELD: user_id}
        ).first()
        if (
            user is None
            or not user.is_active
            or refresh.get(ACCOUNT_VERSION_CLAIM) != user.version
        ):
            raise AccountAuthorityChanged()
        return super().validate(attrs)


class PasswordLifecycleJWTAuthentication(JWTAuthentication):
    """Reject stale role authority and gate temporary-password accounts.

    Every issued Pearlix token is bound to ``User.version``.  Credential,
    activation, and role lifecycle transitions increment that version, so an
    access or refresh token issued under old state cannot retain authority.  A
    current token for an account with
    ``must_change_password`` may reach only identity, password-change, and
    logout endpoints until the password is changed.
    """

    def authenticate(self, request):
        url_name = getattr(getattr(request, "resolver_match", None), "url_name", None)
        if url_name in UNAUTHENTICATED_TOKEN_LIFECYCLE_URLS:
            return None

        authenticated = super().authenticate(request)
        if authenticated is None:
            return None

        user, validated_token = authenticated
        if validated_token.get(ACCOUNT_VERSION_CLAIM) != user.version:
            raise AccountAuthorityChanged()
        if user.must_change_password and url_name not in PASSWORD_CHANGE_ALLOWED_URLS:
            raise PasswordChangeRequired()
        return authenticated
