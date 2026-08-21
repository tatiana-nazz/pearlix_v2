from __future__ import annotations

from ipaddress import IPv4Address, IPv6Address, ip_address, ip_network

from django.conf import settings


MAX_FORWARDED_FOR_HOPS = 32
MAX_FORWARDED_FOR_LENGTH = 2048


def _parse_ip(value) -> IPv4Address | IPv6Address | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or len(text) > 45 or "%" in text:
        return None
    try:
        return ip_address(text)
    except ValueError:
        return None


def _trusted_proxy_networks():
    configured = getattr(settings, "TRUSTED_PROXY_CIDRS", ())
    if isinstance(configured, str):
        configured = configured.split(",")
    try:
        values = tuple(configured)
    except TypeError:
        return ()

    networks = []
    for value in values:
        try:
            networks.append(ip_network(str(value).strip(), strict=False))
        except ValueError:
            # A bad trust entry must reduce trust, never make an arbitrary
            # forwarding header authoritative or break the request.
            continue
    return tuple(networks)


def _is_trusted_proxy(address, networks) -> bool:
    return any(address.version == network.version and address in network for network in networks)


def get_request_ip(request) -> str | None:
    """Return a validated client IP under an explicit reverse-proxy trust model.

    Forwarding data is considered only when the directly connected peer is in
    ``settings.TRUSTED_PROXY_CIDRS``.  The default is an empty trust list, so a
    client that can reach the application directly cannot spoof attribution by
    adding ``X-Forwarded-For``.  Trusted chains are evaluated from right to
    left, selecting the first non-trusted hop.
    """

    if request is None:
        return None

    remote_address = _parse_ip(request.META.get("REMOTE_ADDR"))
    if remote_address is None:
        return None

    trusted_networks = _trusted_proxy_networks()
    if not _is_trusted_proxy(remote_address, trusted_networks):
        return str(remote_address)

    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if not forwarded_for:
        return str(remote_address)
    forwarded_for = str(forwarded_for)
    if len(forwarded_for) > MAX_FORWARDED_FOR_LENGTH:
        return str(remote_address)

    forwarded_parts = forwarded_for.split(",")
    if not 1 <= len(forwarded_parts) <= MAX_FORWARDED_FOR_HOPS:
        return str(remote_address)

    forwarded_chain = [_parse_ip(part) for part in forwarded_parts]
    if any(address is None for address in forwarded_chain):
        return str(remote_address)

    for address in reversed(forwarded_chain):
        if not _is_trusted_proxy(address, trusted_networks):
            return str(address)

    # Every forwarded hop is trusted.  The left-most address is still the
    # closest available client attribution supplied by the trusted boundary.
    return str(forwarded_chain[0])
