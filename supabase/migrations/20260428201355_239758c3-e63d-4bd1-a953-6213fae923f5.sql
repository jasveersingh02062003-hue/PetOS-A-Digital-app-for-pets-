-- Single-subject aggregate
CREATE OR REPLACE FUNCTION public.review_summary(_subject_type public.review_subject, _subject_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'avg', COALESCE(ROUND(AVG(rating)::numeric, 2), 0),
    'verified_count', COUNT(*) FILTER (WHERE verified_purchase),
    'distribution', jsonb_build_object(
      '5', COUNT(*) FILTER (WHERE rating = 5),
      '4', COUNT(*) FILTER (WHERE rating = 4),
      '3', COUNT(*) FILTER (WHERE rating = 3),
      '2', COUNT(*) FILTER (WHERE rating = 2),
      '1', COUNT(*) FILTER (WHERE rating = 1)
    )
  )
  FROM public.reviews
  WHERE subject_type = _subject_type AND subject_id = _subject_id;
$$;

-- Bulk for list pages
CREATE OR REPLACE FUNCTION public.review_summaries_bulk(_subject_type public.review_subject, _ids uuid[])
RETURNS TABLE(subject_id uuid, count bigint, avg numeric, verified_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.subject_id,
    COUNT(*)::bigint,
    COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0),
    COUNT(*) FILTER (WHERE r.verified_purchase)::bigint
  FROM public.reviews r
  WHERE r.subject_type = _subject_type AND r.subject_id = ANY(_ids)
  GROUP BY r.subject_id;
$$;

-- Provider social proof: bookings in a city
CREATE OR REPLACE FUNCTION public.provider_social_proof(_provider_id uuid, _city text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_in_city int;
  v_repeat int;
BEGIN
  SELECT COUNT(DISTINCT customer_id) INTO v_total
  FROM public.service_bookings
  WHERE provider_id = _provider_id AND status IN ('confirmed','completed');

  IF _city IS NOT NULL AND _city <> '' THEN
    SELECT COUNT(DISTINCT sb.customer_id) INTO v_in_city
    FROM public.service_bookings sb
    JOIN public.profiles p ON p.id = sb.customer_id
    WHERE sb.provider_id = _provider_id
      AND sb.status IN ('confirmed','completed')
      AND lower(p.city) = lower(_city);
  ELSE
    v_in_city := 0;
  END IF;

  SELECT COUNT(*) INTO v_repeat FROM (
    SELECT customer_id FROM public.service_bookings
    WHERE provider_id = _provider_id AND status IN ('confirmed','completed')
    GROUP BY customer_id HAVING COUNT(*) > 1
  ) x;

  RETURN jsonb_build_object(
    'total_customers', v_total,
    'in_city', v_in_city,
    'repeat_customers', v_repeat
  );
END $$;