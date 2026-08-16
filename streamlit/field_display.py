"""Field provenance display helpers (parity with ui FieldValueDisplay / badges)."""

from __future__ import annotations

import html

from db_client.types import ConfidenceLevel, FieldValue, PropertyStatus

STATUS_INDICATOR = {
    'VERIFIED': '✓',
    'ESTIMATED': '~',
    'UNKNOWN': '?',
}

STATUS_COLOR = {
    'VERIFIED': '#16a34a',
    'ESTIMATED': '#d97706',
    'UNKNOWN': '#9ca3af',
}

STATUS_ROW_BG = {
    'VIABLE': '#f0fdf4',
    'WATCHLIST': '#fffbeb',
    'REJECTED': '#fef2f2',
}

STATUS_PILL = {
    'VIABLE': 'success',
    'WATCHLIST': 'warning',
    'REJECTED': 'danger',
}

# Match ui/src/components/ConfidenceBadge.tsx
CONFIDENCE_COLORS: dict[ConfidenceLevel, dict[str, str]] = {
    'HIGH': {'bg': '#dbeafe', 'text': '#1e40af', 'border': '#93c5fd'},
    'MEDIUM': {'bg': '#e5e7eb', 'text': '#374151', 'border': '#9ca3af'},
    'LOW': {'bg': '#fef3c7', 'text': '#92400e', 'border': '#fcd34d'},
}


def format_currency(value: float) -> str:
    return f'${value:,.0f}'


def format_percent(value: float) -> str:
    return f'{value * 100:.1f}%'


def format_field_plain(
    field: FieldValue,
    *,
    show_status: bool = True,
    show_confidence: bool = True,
    suffix: str = '',
) -> str:
    """Plain-text field display including provenance (for tests / tooltips)."""
    if field.value is None:
        return 'Unknown'

    text = format_currency(field.value) + suffix
    if not show_status:
        return text

    parts = [text, STATUS_INDICATOR[field.status], field.status]
    if show_confidence:
        parts.append(field.confidence)
    return ' '.join(parts)


def field_value_html(
    field: FieldValue,
    *,
    show_status: bool = True,
    show_confidence: bool = True,
    suffix: str = '',
) -> str:
    """HTML field display with VERIFIED/ESTIMATED/UNKNOWN + confidence."""
    if field.value is None:
        return '<span class="field-value field-value-unknown" style="color:#9ca3af">Unknown</span>'

    formatted = format_currency(field.value)
    if not show_status:
        return html.escape(formatted) + html.escape(suffix)

    indicator = STATUS_INDICATOR[field.status]
    color = STATUS_COLOR[field.status]
    title = html.escape(
        field.evidence or f'Status: {field.status}, Confidence: {field.confidence}'
    )
    confidence_html = ''
    if show_confidence:
        confidence_html = (
            f'<span class="field-confidence" style="margin-left:0.25rem;color:#6b7280;'
            f'font-size:0.7em;font-weight:500">{html.escape(field.confidence)}</span>'
        )

    return (
        f'<span class="field-value field-value-{field.status.lower()}" title="{title}">'
        f'{html.escape(formatted)}{html.escape(suffix)}'
        f'<span class="field-status" style="color:{color}">{indicator}</span>'
        f'<span class="field-status-label" style="margin-left:0.2rem;color:{color};'
        f'font-size:0.65em;font-weight:600">{html.escape(field.status)}</span>'
        f'{confidence_html}</span>'
    )


def status_badge_html(status: PropertyStatus) -> str:
    tone = STATUS_PILL[status]
    return (
        f'<span class="pill pill-{tone} status-badge status-{status.lower()}" '
        f'data-status="{html.escape(status)}">{html.escape(status)}</span>'
    )


def confidence_badge_html(confidence: ConfidenceLevel) -> str:
    colors = CONFIDENCE_COLORS[confidence]
    return (
        f'<span class="confidence-badge confidence-{confidence.lower()}" '
        f'data-confidence="{html.escape(confidence)}" '
        f'style="display:inline-flex;align-items:center;padding:0.125rem 0.5rem;'
        f'border-radius:4px;font-size:0.7rem;font-weight:500;'
        f'background-color:{colors["bg"]};color:{colors["text"]};'
        f'border:1px solid {colors["border"]}">{html.escape(confidence)}</span>'
    )
