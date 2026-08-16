"""Field provenance display tests — React FieldValueDisplay / badge parity."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db_client.types import FieldValue
from field_display import (
    CONFIDENCE_COLORS,
    confidence_badge_html,
    field_value_html,
    format_field_plain,
    status_badge_html,
)


def _field(**overrides) -> FieldValue:
    base = dict(value=180000, status='VERIFIED', confidence='HIGH', evidence='Listing')
    base.update(overrides)
    return FieldValue(**base)


def test_format_field_plain_unknown():
    assert format_field_plain(_field(value=None, status='UNKNOWN', confidence='LOW')) == 'Unknown'


def test_format_field_plain_includes_status_and_confidence():
    text = format_field_plain(_field(value=2100, status='ESTIMATED', confidence='MEDIUM'))
    assert '$2,100' in text
    assert '~' in text
    assert 'ESTIMATED' in text
    assert 'MEDIUM' in text


def test_format_field_plain_verified():
    text = format_field_plain(_field())
    assert '$180,000' in text
    assert '✓' in text
    assert 'VERIFIED' in text
    assert 'HIGH' in text


def test_field_value_html_unknown():
    html = field_value_html(_field(value=None, status='UNKNOWN', confidence='LOW'))
    assert 'Unknown' in html
    assert 'field-value-unknown' in html


def test_field_value_html_shows_status_label_and_confidence():
    html = field_value_html(_field(status='ESTIMATED', confidence='MEDIUM', value=250))
    assert 'ESTIMATED' in html
    assert 'MEDIUM' in html
    assert '~' in html
    assert 'field-value-estimated' in html


def test_field_value_html_hides_status_when_disabled():
    html = field_value_html(_field(), show_status=False)
    assert '✓' not in html
    assert 'VERIFIED' not in html
    assert '$180,000' in html


def test_status_badge_html():
    html = status_badge_html('VIABLE')
    assert 'data-status="VIABLE"' in html
    assert 'status-viable' in html


def test_confidence_badge_html_matches_react_colors():
    html = confidence_badge_html('HIGH')
    assert 'data-confidence="HIGH"' in html
    assert CONFIDENCE_COLORS['HIGH']['bg'] in html
    assert CONFIDENCE_COLORS['HIGH']['text'] in html
