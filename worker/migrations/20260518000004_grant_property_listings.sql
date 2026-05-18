-- Ensure service_role can bypass RLS (it should by default, but explicit grant helps)
GRANT ALL ON property_listings TO service_role;

