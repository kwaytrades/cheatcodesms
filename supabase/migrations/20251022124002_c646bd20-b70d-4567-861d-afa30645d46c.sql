-- Create funnels table
CREATE TABLE public.funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create funnel_steps table
CREATE TABLE public.funnel_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('landing', 'sales', 'checkout', 'upsell', 'downsell', 'thank-you')),
  page_url TEXT NOT NULL,
  conversion_goal TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create funnel_visits table
CREATE TABLE public.funnel_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  session_id TEXT NOT NULL,
  entry_step_id UUID REFERENCES public.funnel_steps(id),
  current_step_id UUID REFERENCES public.funnel_steps(id),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  referrer TEXT,
  device_type TEXT,
  browser TEXT,
  ip_address TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed BOOLEAN DEFAULT false,
  total_value NUMERIC DEFAULT 0
);

-- Create funnel_step_events table
CREATE TABLE public.funnel_step_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.funnel_visits(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.funnel_steps(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'form_submit', 'button_click', 'exit')),
  duration_seconds INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create funnel_conversions table
CREATE TABLE public.funnel_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.funnel_visits(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id),
  conversion_type TEXT NOT NULL CHECK (conversion_type IN ('main_offer', 'upsell', 'downsell')),
  product_id UUID REFERENCES public.products(id),
  order_value NUMERIC NOT NULL,
  converted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_funnel_visits_session ON public.funnel_visits(session_id);
CREATE INDEX idx_funnel_visits_contact ON public.funnel_visits(contact_id);
CREATE INDEX idx_funnel_visits_funnel ON public.funnel_visits(funnel_id);
CREATE INDEX idx_funnel_step_events_visit ON public.funnel_step_events(visit_id);
CREATE INDEX idx_funnel_conversions_funnel ON public.funnel_conversions(funnel_id);

-- Enable RLS
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_step_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_conversions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for funnels
CREATE POLICY "Authenticated users can view funnels" ON public.funnels
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create funnels" ON public.funnels
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update funnels" ON public.funnels
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete funnels" ON public.funnels
  FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for funnel_steps
CREATE POLICY "Authenticated users can view funnel steps" ON public.funnel_steps
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create funnel steps" ON public.funnel_steps
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update funnel steps" ON public.funnel_steps
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete funnel steps" ON public.funnel_steps
  FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for funnel_visits (allow public insert for tracking)
CREATE POLICY "Public can insert funnel visits" ON public.funnel_visits
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can view funnel visits" ON public.funnel_visits
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Public can update funnel visits" ON public.funnel_visits
  FOR UPDATE USING (true);

-- RLS Policies for funnel_step_events (allow public insert for tracking)
CREATE POLICY "Public can insert funnel events" ON public.funnel_step_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can view funnel events" ON public.funnel_step_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policies for funnel_conversions
CREATE POLICY "Public can insert funnel conversions" ON public.funnel_conversions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can view funnel conversions" ON public.funnel_conversions
  FOR SELECT USING (auth.role() = 'authenticated');