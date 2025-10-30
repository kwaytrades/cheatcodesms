-- Fix search path for trigger functions to address security warnings
ALTER FUNCTION public.increment_campaign_message_counter() SET search_path = 'public';
ALTER FUNCTION public.increment_campaign_response_counter() SET search_path = 'public';