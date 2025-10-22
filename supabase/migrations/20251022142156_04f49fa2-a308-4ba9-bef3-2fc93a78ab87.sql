-- Enable realtime for funnel tracking tables
ALTER TABLE public.funnel_step_events REPLICA IDENTITY FULL;
ALTER TABLE public.funnel_visits REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.funnel_step_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.funnel_visits;