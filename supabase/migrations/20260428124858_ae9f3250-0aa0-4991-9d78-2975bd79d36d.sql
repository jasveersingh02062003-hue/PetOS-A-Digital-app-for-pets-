DO $$
DECLARE
  v_owner1 uuid := '877f5f8a-cce8-486d-a1cf-3f9568835253';
  v_owner2 uuid := '3fb47456-d0ac-49ac-b147-cd1f579b603c';
  v_pet1 uuid := '11111111-1111-1111-1111-000000000001';
  v_pet2 uuid := '11111111-1111-1111-1111-000000000002';
  v_pet3 uuid := '11111111-1111-1111-1111-000000000003';
  v_pet4 uuid := '11111111-1111-1111-1111-000000000004';
  v_pet5 uuid := '11111111-1111-1111-1111-000000000005';
  v_pet6 uuid := '11111111-1111-1111-1111-000000000006';
  v_pet7 uuid := '11111111-1111-1111-1111-000000000007';
  v_pet8 uuid := '11111111-1111-1111-1111-000000000008';
BEGIN

INSERT INTO public.pets (id, owner_id, name, species, breed, date_of_birth, gender, weight_kg, neutered, avatar_url, bio, city, lat, lng, temperament, vaccination_verified) VALUES
  (v_pet1, v_owner1, 'Pablo',  'dog', 'Golden Retriever',  '2022-04-12', 'male',   28.5, true,  'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400', 'Loves the beach and treats.',     'Mumbai',    19.0760, 72.8777, ARRAY['friendly','playful'], true),
  (v_pet2, v_owner1, 'Luna',   'cat', 'Persian',           '2023-01-22', 'female', 4.1,  true,  'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=400', 'Queen of the windowsill.',        'Mumbai',    19.0822, 72.8811, ARRAY['calm','curious'],     true),
  (v_pet3, v_owner2, 'Rocky',  'dog', 'Labrador',          '2021-09-01', 'male',   32.0, false, 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', 'Tennis ball is life.',            'Bengaluru', 12.9716, 77.5946, ARRAY['energetic'],          true),
  (v_pet4, v_owner2, 'Misty',  'cat', 'Maine Coon',        '2020-06-18', 'female', 6.2,  true,  'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400', 'Big floof, bigger personality.',  'Bengaluru', 12.9352, 77.6245, ARRAY['regal','aloof'],      false),
  (v_pet5, v_owner1, 'Bruno',  'dog', 'Beagle',            '2023-08-30', 'male',   12.4, false, 'https://images.unsplash.com/photo-1534361960057-19889db9621e?w=400', 'Tiny detective, big nose.',       'Delhi',     28.6139, 77.2090, ARRAY['curious','friendly'], true),
  (v_pet6, v_owner2, 'Coco',   'dog', 'Pomeranian',        '2022-12-05', 'female', 3.8,  true,  'https://images.unsplash.com/photo-1583511655826-05700d52f4d9?w=400', 'Smol fluff, big bark.',           'Pune',      18.5204, 73.8567, ARRAY['playful'],            true),
  (v_pet7, v_owner1, 'Simba',  'cat', 'Bengal',            '2021-03-14', 'male',   5.5,  true,  'https://images.unsplash.com/photo-1561948955-570b270e7c36?w=400', 'Wild looking, gentle soul.',      'Hyderabad', 17.3850, 78.4867, ARRAY['adventurous'],        true),
  (v_pet8, v_owner2, 'Nala',   'dog', 'Indie',             '2022-07-20', 'female', 18.0, true,  'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400', 'Rescued and ruling the house.',   'Chennai',   13.0827, 80.2707, ARRAY['gentle','protective'],true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.posts (id, author_id, pet_id, caption, image_url, created_at) VALUES
  ('22222222-0000-0000-0000-000000000001', v_owner1, v_pet1, 'Beach day with my best boy! #goldenretriever #beachvibes', 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800', now() - interval '2 hours'),
  ('22222222-0000-0000-0000-000000000002', v_owner1, v_pet2, 'Luna found a sunbeam. Do not disturb. #catsofpetos', 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800', now() - interval '5 hours'),
  ('22222222-0000-0000-0000-000000000003', v_owner2, v_pet3, 'Rocky learned a new trick today! #goodboy #training', 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=800', now() - interval '1 day'),
  ('22222222-0000-0000-0000-000000000004', v_owner1, v_pet5, 'Bruno''s first puppy meetup. So many friends! #beagle #meetup', 'https://images.unsplash.com/photo-1534361960057-19889db9621e?w=800', now() - interval '1 day 4 hours'),
  ('22222222-0000-0000-0000-000000000005', v_owner2, v_pet6, 'Coco got a new haircut ✨ #pomeranian #grooming', 'https://images.unsplash.com/photo-1583511655826-05700d52f4d9?w=800', now() - interval '2 days'),
  ('22222222-0000-0000-0000-000000000006', v_owner1, v_pet7, 'Simba on patrol 🐅 #bengalcat', 'https://images.unsplash.com/photo-1561948955-570b270e7c36?w=800', now() - interval '3 days'),
  ('22222222-0000-0000-0000-000000000007', v_owner2, v_pet8, 'Nala''s adoption-versary. 1 year strong! #adoptdontshop #indiedog', 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=800', now() - interval '4 days'),
  ('22222222-0000-0000-0000-000000000008', v_owner1, v_pet1, 'Park run completed 🏃 5km with Pablo. #dogwalk', 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800', now() - interval '6 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vaccinations (pet_id, vaccine_name, administered_on, next_due_on, vet_name) VALUES
  (v_pet1, 'Rabies',         CURRENT_DATE - 300, CURRENT_DATE + 65,  'Dr. Mehta'),
  (v_pet1, 'DHPP',           CURRENT_DATE - 90,  CURRENT_DATE + 275, 'Dr. Mehta'),
  (v_pet2, 'FVRCP',          CURRENT_DATE - 200, CURRENT_DATE + 165, 'Dr. Iyer'),
  (v_pet3, 'Rabies',         CURRENT_DATE - 250, CURRENT_DATE + 115, 'Dr. Rao'),
  (v_pet5, 'Puppy DHPP-1',   CURRENT_DATE - 30,  CURRENT_DATE + 21,  'Dr. Mehta'),
  (v_pet8, 'Rabies',         CURRENT_DATE - 100, CURRENT_DATE + 265, 'Dr. Singh')
ON CONFLICT DO NOTHING;

INSERT INTO public.meetups (id, host_id, title, description, city, venue, lat, lng, starts_at, capacity, cover_url) VALUES
  ('33333333-0000-0000-0000-000000000001', v_owner1, 'Sunday Bandstand Walkies', 'Casual dog walk + coffee at Bandstand promenade.', 'Mumbai',    'Bandstand Promenade',     19.0438, 72.8202, now() + interval '3 days',  20, 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800'),
  ('33333333-0000-0000-0000-000000000002', v_owner2, 'Cubbon Park Pup Picnic',  'BYO blanket. Treats and toys provided.',         'Bengaluru', 'Cubbon Park, Gate 3',     12.9763, 77.5929, now() + interval '5 days',  30, 'https://images.unsplash.com/photo-1534361960057-19889db9621e?w=800'),
  ('33333333-0000-0000-0000-000000000003', v_owner1, 'Cat Cafe Mixer',          'For cat parents only — meet over chai and kitty pics.', 'Delhi', 'Cat Cafe, Hauz Khas', 28.5494, 77.2001, now() + interval '8 days',  15, 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800'),
  ('33333333-0000-0000-0000-000000000004', v_owner2, 'Pune Puppy Playdate',     'Friendly off-leash play in a fenced area.',     'Pune',      'Pawsh Pet Park',         18.5089, 73.8294, now() + interval '12 days', 25, 'https://images.unsplash.com/photo-1583511655826-05700d52f4d9?w=800'),
  ('33333333-0000-0000-0000-000000000005', v_owner1, 'Bandra Beach Cleanup + Walk', 'Help clean Carter Rd, then walk together.',  'Mumbai',    'Carter Road',            19.0596, 72.8295, now() + interval '6 days',  40, 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_providers (id, owner_id, name, category, city, bio, hourly_rate_inr, cover_url, lat, lng, verified, contact_phone) VALUES
  ('44444444-0000-0000-0000-000000000001', v_owner1, 'Wagging Tails Boarding',   'boarding', 'Mumbai',    'Climate-controlled rooms, 24/7 supervision.', 800,  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800', 19.1136, 72.8697, true,  '+919900000001'),
  ('44444444-0000-0000-0000-000000000002', v_owner1, 'Happy Paws Grooming',      'grooming', 'Mumbai',    'Spa treatments, breed-specific cuts.',         600,  'https://images.unsplash.com/photo-1583511655826-05700d52f4d9?w=800', 19.0825, 72.8811, true,  '+919900000002'),
  ('44444444-0000-0000-0000-000000000003', v_owner2, 'Bengaluru Walks Co.',      'walking',  'Bengaluru', 'Twice-daily walks, GPS-tracked.',              400,  'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800', 12.9716, 77.5946, true,  '+919900000003'),
  ('44444444-0000-0000-0000-000000000004', v_owner2, 'Pet Sitters Pune',         'sitting',  'Pune',      'In-home sitters, vetted and insured.',         500,  'https://images.unsplash.com/photo-1534361960057-19889db9621e?w=800', 18.5204, 73.8567, false, '+919900000004'),
  ('44444444-0000-0000-0000-000000000005', v_owner1, 'Delhi Dog Trainers',       'training', 'Delhi',     'Positive-reinforcement obedience and tricks.', 1200, 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=800', 28.6139, 77.2090, true,  '+919900000005')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vet_profiles (id, user_id, display_name, photo_url, bio, languages, license_number, license_council, year_qualified, clinic_name, address, city, lat, lng, phone, specialisations, default_duration_min, price_chat_inr, price_video_inr, price_clinic_inr, onboarded, active, rating_avg, rating_count) VALUES
  ('55555555-0000-0000-0000-000000000001', v_owner1, 'Dr. Aarav Mehta',    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400', 'Small-animal vet, 12 years experience.', ARRAY['en','hi','mr'], 'MVC-12345', 'Maharashtra Veterinary Council', 2013, 'PetCare Mumbai', 'Bandra West',     'Mumbai',    19.0596, 72.8295, '+919900000010', ARRAY['general','dermatology'], 30, 200, 500, 800, true, true, 4.8, 124),
  ('55555555-0000-0000-0000-000000000002', v_owner2, 'Dr. Priya Iyer',     'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400',  'Feline specialist and behaviourist.',     ARRAY['en','ta','hi'], 'KVC-67890', 'Karnataka Veterinary Council',   2017, 'CatCare Bengaluru', 'Indiranagar', 'Bengaluru', 12.9716, 77.6411, '+919900000011', ARRAY['feline','behaviour'],     30, 250, 600, 900, true, true, 4.9, 86)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES (v_owner1, 'vet'), (v_owner2, 'vet') ON CONFLICT DO NOTHING;

INSERT INTO public.vet_questions (id, asker_id, pet_id, title, body, species, category, status, created_at) VALUES
  ('66666666-0000-0000-0000-000000000001', v_owner2, v_pet3, 'Rocky has been scratching his ears',     'Started 2 days ago, no smell yet. Should I worry?',      'dog', 'medical',   'open',     now() - interval '6 hours'),
  ('66666666-0000-0000-0000-000000000002', v_owner1, v_pet2, 'Luna is eating less than usual',         'Half her usual food for 3 days. Otherwise active.',      'cat', 'nutrition', 'answered', now() - interval '2 days'),
  ('66666666-0000-0000-0000-000000000003', v_owner2, v_pet8, 'Vaccination schedule for adult rescue?', 'Just adopted Nala. No vaccine records. Where to start?', 'dog', 'medical',   'open',     now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.missing_pets (id, pet_id, owner_id, photo_url, last_seen_lat, last_seen_lng, last_seen_city, last_seen_at, reward_inr, note, status) VALUES
  ('77777777-0000-0000-0000-000000000001', v_pet5, v_owner1, 'https://images.unsplash.com/photo-1534361960057-19889db9621e?w=800', 28.6139, 77.2090, 'Delhi',  now() - interval '8 hours', 5000, 'Last seen near the park entrance, wearing red collar. Responds to "Bruno".', 'active'),
  ('77777777-0000-0000-0000-000000000002', v_pet6, v_owner2, 'https://images.unsplash.com/photo-1583511655826-05700d52f4d9?w=800', 18.5204, 73.8567, 'Pune',   now() - interval '2 days', 3000, 'Slipped through the gate. Very small, golden fur.', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shop_products (id, seller_id, title, description, category, price_inr, stock, image_url, tags) VALUES
  ('88888888-0000-0000-0000-000000000001', v_owner1, 'Premium Salmon Dog Food 5kg', 'Grain-free, single-protein recipe.', 'food',        2400, 50, 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600', ARRAY['dog','grain-free']),
  ('88888888-0000-0000-0000-000000000002', v_owner1, 'Cat Scratching Tower',        'Sisal rope, 120cm tall.',            'toys',        1800, 20, 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600', ARRAY['cat']),
  ('88888888-0000-0000-0000-000000000003', v_owner2, 'Reflective Dog Leash 1.5m',   'Heavy-duty clip, padded handle.',    'accessories',  600,100, 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600', ARRAY['dog','walk']),
  ('88888888-0000-0000-0000-000000000004', v_owner2, 'Pet Travel Carrier Medium',   'Airline-compliant, 18kg max.',       'accessories', 3200, 15, 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600', ARRAY['travel'])
ON CONFLICT (id) DO NOTHING;

END $$;