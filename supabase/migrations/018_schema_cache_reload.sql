-- Reload PostgREST schema cache so distance_km and transport_detail columns are visible
NOTIFY pgrst, 'reload schema';
