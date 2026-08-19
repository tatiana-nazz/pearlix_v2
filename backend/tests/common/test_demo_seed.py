from io import StringIO

import pytest
from django.core.management import call_command

from apps.accounts.models import User
from apps.billing.models import BillingHandoff
from apps.patients.models import Patient
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


pytestmark = pytest.mark.django_db(transaction=True)


def test_demo_seed_creates_coherent_longitudinal_stories_and_is_resettable():
    output = StringIO()
    call_command("seed_demo", password="StrongDemoPassword!2026", stdout=output)

    assert User.objects.filter(email__endswith="@pearlix.demo").count() == 4
    assert Patient.objects.filter(national_id_or_passport__startswith="DEMO-P").count() == 10
    assert Appointment.objects.filter(patient__national_id_or_passport__startswith="DEMO-P").count() >= 15
    assert Visit.objects.filter(patient__national_id_or_passport__startswith="DEMO-P").count() >= 8
    assert BillingHandoff.objects.filter(patient__national_id_or_passport__startswith="DEMO-P").count() >= 8
    assert "consistency audit PASS" in output.getvalue()

    # A reset replaces demo records without duplicating them.
    call_command("seed_demo", reset=True, password="StrongDemoPassword!2026")
    assert User.objects.filter(email__endswith="@pearlix.demo").count() == 4
    assert Patient.objects.filter(national_id_or_passport__startswith="DEMO-P").count() == 10
