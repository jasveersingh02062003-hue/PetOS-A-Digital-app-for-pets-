
DO $$
DECLARE
  existing_volume int;
  user_ids uuid[];
  pet_ids uuid[];
  post_ids uuid[];
  cities text[] := ARRAY['Mumbai','Delhi','Bengaluru','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad','Jaipur','Lucknow','Chandigarh','Kochi','Indore','Goa','Surat'];
  dog_breeds text[] := ARRAY['Labrador','Indie','Golden Retriever','German Shepherd','Beagle','Pug','Pomeranian','Rottweiler','Husky','Shih Tzu','Boxer','Dachshund'];
  cat_breeds text[] := ARRAY['Persian','Siamese','Indie','British Shorthair','Bengal','Maine Coon','Ragdoll','Sphynx'];
  pet_names text[] := ARRAY[
    'Mochi','Pixel','Bruno','Buddy','Charlie','Coco','Rocky','Max','Luna','Bella',
    'Daisy','Milo','Oreo','Simba','Leo','Tiger','Snowy','Casper','Ginger','Nala',
    'Zoe','Lily','Roxy','Duke','Bear','Toby','Jack','Lucy','Sophie','Princess',
    'Kiwi','Mango','Peanut','Caramel','Honey','Pepper','Cookie','Muffin','Brownie','Latte'
  ];
  captions text[] := ARRAY[
    'Sunday morning walks 🐾','Best buddy in the world ❤️','Beach day vibes','Sleepy puppy face',
    'Treat time! 🦴','New trick learned today','Park adventures','Just look at this face',
    'Birthday today 🎉','Vet checkup — all healthy!','Bath day struggles 🛁','Found a new toy',
    'Lazy afternoons','Adoption journey day 1','Snuggles ✨','Training pays off!','Morning zoomies',
    'Pet parent life','Forever home found','Garden patrol','Met a new friend at the park',
    'Indie pride 🇮🇳','Adopt don''t shop','Sunset walk','Cat tax 📸','Yoga buddy','Office mascot',
    'Hiking with the gang','Festival ready','Diwali safe pet tips','Vaccination done ✅'
  ];
  i int; j int;
  uid uuid; pid uuid; postid uuid; convid uuid; otheruid uuid;
  msgs int;
BEGIN
  SELECT count(*) INTO existing_volume FROM public.posts;
  IF existing_volume > 1000 THEN
    RAISE NOTICE 'Bulk demo volume already present (% posts). Skipping.', existing_volume;
    RETURN;
  END IF;

  SELECT array_agg(id) INTO user_ids FROM public.profiles WHERE handle IS NOT NULL;
  IF user_ids IS NULL OR array_length(user_ids,1) < 2 THEN
    RAISE EXCEPTION 'Need at least 2 demo users with handles. Run seed-demo-data first.';
  END IF;
  RAISE NOTICE 'Using % demo users for bulk seed', array_length(user_ids,1);

  pet_ids := ARRAY[]::uuid[];
  FOR i IN 1..500 LOOP
    pid := gen_random_uuid();
    pet_ids := array_append(pet_ids, pid);
    INSERT INTO public.pets (id, owner_id, name, species, breed, gender, date_of_birth, city, bio, vaccination_verified, created_at)
    VALUES (
      pid,
      user_ids[1 + (random() * (array_length(user_ids,1)-1))::int],
      pet_names[1 + (i % array_length(pet_names,1))] || CASE WHEN i > array_length(pet_names,1) THEN ' #' || (i / array_length(pet_names,1) + 1)::text ELSE '' END,
      (CASE (i % 4) WHEN 0 THEN 'cat' ELSE 'dog' END)::pet_species,
      CASE WHEN i % 4 = 0 THEN cat_breeds[1 + (i % array_length(cat_breeds,1))] ELSE dog_breeds[1 + (i % array_length(dog_breeds,1))] END,
      (CASE (i % 2) WHEN 0 THEN 'female' ELSE 'male' END)::pet_gender,
      (CURRENT_DATE - ((365 + (random()*1500)::int))::int)::date,
      cities[1 + (i % array_length(cities,1))],
      'A wonderful pet from ' || cities[1 + (i % array_length(cities,1))],
      (random() < 0.7),
      now() - (random() * interval '120 days')
    );
  END LOOP;

  post_ids := ARRAY[]::uuid[];
  FOR i IN 1..2000 LOOP
    postid := gen_random_uuid();
    post_ids := array_append(post_ids, postid);
    INSERT INTO public.posts (id, author_id, pet_id, caption, image_url, created_at, updated_at)
    VALUES (
      postid,
      user_ids[1 + (random() * (array_length(user_ids,1)-1))::int],
      pet_ids[1 + (random() * (array_length(pet_ids,1)-1))::int],
      captions[1 + (i % array_length(captions,1))],
      'https://picsum.photos/seed/' || i || '/800/800',
      now() - (random() * interval '90 days'),
      now() - (random() * interval '90 days')
    );
  END LOOP;

  FOR i IN 1..5000 LOOP
    BEGIN
      INSERT INTO public.post_likes (post_id, user_id, created_at)
      VALUES (
        post_ids[1 + (random() * (array_length(post_ids,1)-1))::int],
        user_ids[1 + (random() * (array_length(user_ids,1)-1))::int],
        now() - (random() * interval '60 days')
      );
    EXCEPTION WHEN unique_violation THEN NULL; END;
  END LOOP;

  FOR i IN 1..1000 LOOP
    INSERT INTO public.post_comments (post_id, author_id, body, created_at)
    VALUES (
      post_ids[1 + (random() * (array_length(post_ids,1)-1))::int],
      user_ids[1 + (random() * (array_length(user_ids,1)-1))::int],
      CASE (i % 12)
        WHEN 0 THEN 'So cute! 😍' WHEN 1 THEN 'Awwww ❤️'
        WHEN 2 THEN 'Where in the city are you?' WHEN 3 THEN 'My pup loves this too!'
        WHEN 4 THEN 'Adorable little face' WHEN 5 THEN 'Need to know the breed!'
        WHEN 6 THEN 'Goodest boy 🥺' WHEN 7 THEN 'Sending treats from afar 🦴'
        WHEN 8 THEN 'Such a smart pet' WHEN 9 THEN 'How old?'
        WHEN 10 THEN 'Best post today' ELSE 'I needed this on my timeline 🐾'
      END,
      now() - (random() * interval '45 days')
    );
  END LOOP;

  FOR i IN 1..array_length(user_ids,1) LOOP
    FOR j IN 1..array_length(user_ids,1) LOOP
      IF i <> j AND random() < 0.4 THEN
        BEGIN
          INSERT INTO public.follows (follower_id, following_id, created_at)
          VALUES (user_ids[i], user_ids[j], now() - (random() * interval '60 days'));
        EXCEPTION WHEN unique_violation THEN NULL; END;
      END IF;
    END LOOP;
  END LOOP;

  FOR i IN 1..40 LOOP
    uid := user_ids[1 + (random() * (array_length(user_ids,1)-1))::int];
    otheruid := user_ids[1 + (random() * (array_length(user_ids,1)-1))::int];
    CONTINUE WHEN uid = otheruid;
    convid := gen_random_uuid();

    INSERT INTO public.conversations (id, is_group, created_by, last_message_at, created_at)
    VALUES (convid, false, uid, now() - (random() * interval '20 days'), now() - (random() * interval '30 days'));

    INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (convid, uid);
    INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (convid, otheruid);

    msgs := 5 + (random() * 10)::int;
    FOR j IN 1..msgs LOOP
      INSERT INTO public.messages (conversation_id, sender_id, body, created_at)
      VALUES (
        convid,
        CASE WHEN j % 2 = 0 THEN uid ELSE otheruid END,
        CASE (j % 8)
          WHEN 0 THEN 'Hey! Saw your post about the puppy.'
          WHEN 1 THEN 'Yes! Are you interested?'
          WHEN 2 THEN 'Definitely. Where are you based?'
          WHEN 3 THEN 'Same city, that''s perfect.'
          WHEN 4 THEN 'Can we meet this weekend?'
          WHEN 5 THEN 'Sure, Saturday works.'
          WHEN 6 THEN 'Sending the address now.'
          ELSE 'Thanks! 🙏'
        END,
        now() - (random() * interval '10 days')
      );
    END LOOP;
  END LOOP;

  UPDATE public.posts p SET
    like_count = COALESCE((SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id), 0),
    comment_count = COALESCE((SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id), 0)
  WHERE p.id = ANY(post_ids);

  RAISE NOTICE 'Bulk demo seed complete.';
END $$;
