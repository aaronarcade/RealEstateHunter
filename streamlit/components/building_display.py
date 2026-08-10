"""Building display names."""

from __future__ import annotations


def alias_from_address(address: str | None) -> str | None:
    if not address or ',' not in address:
        return None
    first = address.split(',', 1)[0].strip()
    if not first or first[0].isdigit():
        return None
    return first


def building_alias(building: dict) -> str | None:
    explicit = building.get('alias')
    if explicit:
        return str(explicit).strip()
    return alias_from_address(building.get('address'))


def building_street_address(building: dict) -> str:
    address = (building.get('address') or '').strip()
    alias = building_alias(building)
    if alias and address.lower().startswith(f'{alias.lower()},'):
        return address.split(',', 1)[1].strip()
    return address


def building_card_title(building: dict) -> str:
    return building_alias(building) or building.get('address') or 'Unknown'


def building_card_subtitle(building: dict) -> str | None:
    alias = building_alias(building)
    street = building_street_address(building)
    if alias and street and street != building.get('address'):
        return street
    return None


def building_nav_label(building: dict) -> str:
    return building_card_title(building)
