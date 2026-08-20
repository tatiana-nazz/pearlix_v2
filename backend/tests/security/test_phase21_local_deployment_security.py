from __future__ import annotations

import json
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
LEGACY_SHARED_PASSWORD = "pearlix_dev_" + "password"


def _read(relative_path: str) -> str:
    return (REPOSITORY_ROOT / relative_path).read_text(encoding="utf-8")


def test_frontend_vercel_config_denies_all_framing_and_preserves_spa_rewrite():
    config = json.loads(_read("frontend/vercel.json"))
    global_headers = next(
        item["headers"] for item in config["headers"] if item["source"] == "/(.*)"
    )
    headers = {item["key"].lower(): item["value"] for item in global_headers}

    assert headers["content-security-policy"] == "frame-ancestors 'none'"
    assert headers["x-frame-options"] == "DENY"
    assert config["rewrites"] == [{"source": "/(.*)", "destination": "/index.html"}]


def test_local_postgresql_is_loopback_only_and_requires_ignored_credential():
    compose = _read("docker-compose.yml")

    assert '"127.0.0.1:5433:5432"' in compose
    assert '"5433:5432"' not in compose
    assert "0.0.0.0:5432" not in compose
    assert "${PEARLIX_LOCAL_DB_PASSWORD:?" in compose
    assert LEGACY_SHARED_PASSWORD not in compose


def test_checked_in_local_setup_uses_empty_required_values_not_authoritative_password():
    local_setup_paths = (
        "backend/.env.example",
        "backend/README.md",
        "backend/project_docs/LOCAL_DEVELOPMENT.md",
        "backend/project_docs/BACKEND_FINAL_HANDOFF.md",
    )
    local_setup = "\n".join(_read(path) for path in local_setup_paths)

    assert LEGACY_SHARED_PASSWORD not in local_setup
    assert "PEARLIX_LOCAL_DB_PASSWORD" in local_setup
    assert "docker compose --env-file backend/.env up -d db" in local_setup
    assert "127.0.0.1:5433" in local_setup
    assert "--settings=config.settings.local" in local_setup

    example_values = {
        key: value
        for line in _read("backend/.env.example").splitlines()
        if line and not line.startswith("#") and "=" in line
        for key, value in [line.split("=", 1)]
    }
    assert example_values["PEARLIX_LOCAL_DB_PASSWORD"] == ""
    assert example_values["DATABASE_URL"] == ""


def test_local_compose_credential_does_not_affect_production_database_contract():
    production_settings = _read("backend/config/settings/production.py")

    assert "PEARLIX_LOCAL_DB_PASSWORD" not in production_settings
    assert 'env("DATABASE_URL")' in production_settings
    assert "Production DATABASE_URL must use PostgreSQL" in production_settings
