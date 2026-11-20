-- Classification columns on existing checks. campaign_id already points at public.campaigns.
-- All new columns are nullable so current rows stay valid. features holds extracted
-- signals only; do not store message text.

alter table public.checks
  add column features jsonb,
  add column scam_type text,
  add column impersonated_brand text,
  add column confidence numeric,
  add constraint checks_scam_type_check check (
    scam_type is null or scam_type in (
      'fake_institution_login',
      'parcel_postal_fee',
      'fine_or_tax_refund',
      'fake_bank',
      'fake_app',
      'other'
    )
  ),
  add constraint checks_impersonated_brand_check check (
    impersonated_brand is null or impersonated_brand in (
      'e_albania',
      'tax',
      'postal',
      'municipality',
      'bank',
      'police',
      'utility',
      'telecom',
      'other'
    )
  ),
  add constraint checks_confidence_check check (
    confidence is null or confidence between 0 and 1
  );

-- DOWN
-- alter table public.checks drop constraint if exists checks_confidence_check;
-- alter table public.checks drop constraint if exists checks_impersonated_brand_check;
-- alter table public.checks drop constraint if exists checks_scam_type_check;
-- alter table public.checks
--   drop column if exists confidence,
--   drop column if exists impersonated_brand,
--   drop column if exists scam_type,
--   drop column if exists features;
