-- Sample StoreListen data for local dashboards.
-- Apply after migrations 001–011. Safe to re-run (fixed UUIDs, on conflict do nothing).
-- Does not create auth.users — sign in with your own Supabase user, then attach
-- that user to the demo org in organization_members.

insert into public.organizations (id, name)
values ('11111111-1111-4111-8111-111111111111', 'StoreListen Demo Org')
on conflict (id) do nothing;

insert into public.stores (id, organization_id, name, city, address, timezone, is_active)
values
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'Lahore Flagship', 'Lahore', 'MM Alam Road', 'Asia/Karachi', true),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Karachi Mall', 'Karachi', 'Dolmen Clifton', 'Asia/Karachi', true)
on conflict (id) do nothing;

insert into public.salesmen (id, organization_id, store_id, name)
values
  ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'Ayesha Khan'),
  ('33333333-3333-4333-8333-333333333332', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Bilal Ahmed')
on conflict (id) do nothing;

insert into public.conversations (
  id, organization_id, store_id, salesman_id, device_id, duration_seconds, language, status, recorded_at
)
values
  (
    '44444444-4444-4444-8444-444444444441',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222221',
    '33333333-3333-4333-8333-333333333331',
    'demo-desktop-1',
    186,
    'en',
    'scored',
    now() - interval '2 hours'
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333332',
    'demo-desktop-2',
    142,
    'ur',
    'analyzed',
    now() - interval '1 day'
  )
on conflict (id) do nothing;

insert into public.transcripts (id, conversation_id, text, language, is_auto_generated)
values
  (
    '55555555-5555-4555-8555-555555555551',
    '44444444-4444-4444-8444-444444444441',
    'Customer asked about the two-year warranty and said they will buy the phone tomorrow if the price includes a case.',
    'en',
    true
  ),
  (
    '55555555-5555-4555-8555-555555555552',
    '44444444-4444-4444-8444-444444444442',
    'Customer compared two laptops and requested a callback after payday.',
    'ur',
    true
  )
on conflict (id) do nothing;

insert into public.conversation_analyses (
  id, conversation_id, summary, sentiment, purchase_intent, objections, key_points, customer_questions, language, duration_spoken_seconds, ai_model, ai_processed_at
)
values
  (
    '55555555-5555-4555-8555-555555555561',
    '44444444-4444-4444-8444-444444444441',
    'High-intent phone sale. Warranty and accessory bundle were the close.',
    'positive',
    'high',
    '["price includes case?"]'::jsonb,
    '["Two-year warranty explained","Callback tomorrow"]'::jsonb,
    '["Does the price include a case?"]'::jsonb,
    'en',
    180,
    'demo',
    now()
  ),
  (
    '55555555-5555-4555-8555-555555555562',
    '44444444-4444-4444-8444-444444444442',
    'Medium-intent laptop browse. Follow up after payday.',
    'neutral',
    'medium',
    '["waiting for salary"]'::jsonb,
    '["Compared two models"]'::jsonb,
    '["Can you call me next week?"]'::jsonb,
    'ur',
    130,
    'demo',
    now()
  )
on conflict (id) do nothing;

insert into public.customers (id, organization_id, name, phone, email, total_visits, preferred_language, last_visit_at)
values
  (
    '66666666-6666-4666-8666-666666666661',
    '11111111-1111-4111-8111-111111111111',
    'Sara Malik',
    '03001234567',
    'sara@example.com',
    2,
    'en',
    now() - interval '2 hours'
  )
on conflict (id) do nothing;

insert into public.follow_ups (
  id, organization_id, conversation_id, customer_id, customer_name, customer_phone, product_interest, priority, status, follow_up_date, notes, lead_score, assigned_to, store_id
)
values
  (
    '77777777-7777-4777-8777-777777777771',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444441',
    '66666666-6666-4666-8666-666666666661',
    'Sara Malik',
    '03001234567',
    'Flagship phone + case',
    'high',
    'pending',
    now() + interval '1 day',
    'Confirm warranty bundle tomorrow.',
    88,
    '33333333-3333-4333-8333-333333333331',
    '22222222-2222-4222-8222-222222222221'
  )
on conflict (id) do nothing;

insert into public.reports (id, organization_id, report_type, file_name, store_id, metadata)
values
  (
    '88888888-8888-4888-8888-888888888881',
    '11111111-1111-4111-8111-111111111111',
    'store',
    'demo-weekly-store.pdf',
    '22222222-2222-4222-8222-222222222221',
    '{"source":"seed"}'::jsonb
  )
on conflict (id) do nothing;
