"""Sample reviewed listings for offline development."""

from db_client.types import ReviewedListing

SAMPLE_REVIEWED_LISTINGS: list[ReviewedListing] = [
    ReviewedListing(
        id='sample-reviewed-pcb',
        address='14401 Front Beach Rd Unit 403, Panama City Beach, FL 32413',
        city='Panama City Beach',
        country='United States',
        region='FL',
        listing_url='https://example.com/listing/pcb-403',
        asking_price=125000,
        estimated_cap_rate=0.216,
        rough_gross_yield=0.216,
        estimated_monthly_rent=2250,
        beds=0,
        property_type='condo',
        market_id='panama-city-beach-fl',
        scout_decision='REJECT',
        reviewed_at='2026-08-10T04:00:00Z',
        notes='Studio efficiency fails beds_min filter.',
    ),
    ReviewedListing(
        id='sample-reviewed-manta',
        address='Poseidon Building Unit 7F, Barbasquillo, Manta, Manabí, Ecuador',
        city='Manta',
        country='Ecuador',
        region='Manabí',
        listing_url='https://example.com/listing/poseidon-7f',
        asking_price=199000,
        estimated_cap_rate=0.056,
        rough_gross_yield=0.0784,
        estimated_monthly_rent=1300,
        hoa_monthly=369,
        beds=2,
        baths=2,
        property_type='condo',
        market_id='manta-ec',
        scout_decision='REJECT',
        reviewed_at='2026-08-10T05:00:00Z',
        notes='Yield too low after HOA.',
    ),
]
