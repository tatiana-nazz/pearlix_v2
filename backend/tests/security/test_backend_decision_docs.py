from pathlib import Path


def test_doctor_patient_access_docs_reflect_connected_full_history_rule():
    repo_root = Path(__file__).resolve().parents[3]
    docs = [
        repo_root / "_codex_backend_handoff" / "25_POST_12K_CORRECTIONS_SOURCE_OF_TRUTH.md",
        repo_root / "backend" / "project_docs" / "CURRENT_BACKEND_DECISIONS.md",
    ]

    for path in docs:
        text = path.read_text(encoding="utf-8")
        assert "Doctor visit detail remains own-only" not in text
        assert "All active Doctors can read all active/non-archived patient profiles." in text
        assert "All active Doctors can update allowed patient profile fields." in text
        assert "All active Doctors can read the full clinical history for all active/non-archived patients." in text
        assert "Doctor can only edit their own visit notes." in text
        if path.name == "CURRENT_BACKEND_DECISIONS.md":
            assert "The owning Doctor completes an active visit with required final billing" in text
            assert "no Staff approval or conversion step exists" in text
            assert "Staff creates manual invoices and manages eligible invoice edits" in text
        else:
            assert "Doctor can create billing handoff for their own completed visit" in text
            assert "Staff handles invoice creation and payment recording from the handoff." in text
