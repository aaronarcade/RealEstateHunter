"""Tests for RealEstateTracker row mapping."""

from db_client.tracker_mapper import derive_tracker_confidence, derive_tracker_status, tracker_row_to_opportunity, _format_unit_address


def test_derive_tracker_status_viable():
    assert derive_tracker_status(10.5, True, 'researching') == 'VIABLE'


def test_derive_tracker_status_watchlist():
    assert derive_tracker_status(7.0, True, 'researching') == 'WATCHLIST'


def test_derive_tracker_status_rejected():
    assert derive_tracker_status(4.0, True, 'researching') == 'REJECTED'
    assert derive_tracker_status(12.0, True, 'passed') == 'REJECTED'


def test_derive_tracker_status_incomplete():
    assert derive_tracker_status(None, False, 'researching') == 'WATCHLIST'


def test_tracker_row_to_opportunity_maps_cap_rate_decimal():
    row = {
        'unit_id': '11111111-1111-1111-1111-111111111111',
        'unit_number': '301',
        'building_address': '15413 Front Beach Rd',
        'neighborhood_name': 'Panama City Beach',
        'region_name': 'Florida',
        'country_name': 'United States',
        'monthly_rent': 2500,
        'noi': 18000,
        'cap_rate_pct': 8.5,
        'value_basis': 210000,
        'has_complete_financials': True,
        'status': 'researching',
    }
    financials = {
        'hoa_monthly': 450,
        'assessment_fees_monthly': 0,
        'gross_annual_rent': 30000,
        'annual_operating_expenses': 12000,
    }

    opp = tracker_row_to_opportunity(
        row,
        financials=financials,
        source_url='https://example.com/listing',
        source_confidence=4,
    )

    assert opp.id == '11111111-1111-1111-1111-111111111111'
    assert opp.address == 'Unit 301, 15413 Front Beach Rd'
    assert opp.location == 'Panama City Beach, Florida, United States'
    assert opp.cap_rate == 0.085
    assert opp.status == 'WATCHLIST'
    assert opp.confidence == 'HIGH'
    assert opp.purchase_price.value == 210000
    assert opp.hoa.value == 450
    assert opp.listing_url == 'https://example.com/listing'


def test_format_unit_address_omits_unit_one_for_homes():
    assert _format_unit_address('1', 'Private Condominium House, Cuenca, Ecuador') == (
        'Private Condominium House, Cuenca, Ecuador'
    )
    assert _format_unit_address('301', '15413 Front Beach Rd') == 'Unit 301, 15413 Front Beach Rd'
