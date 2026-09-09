CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  original_file_path text NOT NULL,
  processed_file_path text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  token text NOT NULL,
  label text,
  auto_suggested_label text,
  label_source text NOT NULL DEFAULT 'ai_suggested',
  confirmed_by_admin boolean NOT NULL DEFAULT false,
  field_type text NOT NULL DEFAULT 'text',
  context_hint text,
  position_order integer NOT NULL,
  location_type text,
  location_ref jsonb,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.generated_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  filled_data jsonb NOT NULL,
  result_file_path text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_template_fields_template_id ON public.template_fields(template_id, position_order);
CREATE INDEX idx_generated_letters_template_id ON public.generated_letters(template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_fields TO authenticated;
GRANT ALL ON public.template_fields TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_letters TO authenticated;
GRANT ALL ON public.generated_letters TO service_role;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY templates_manage ON public.templates FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = created_by OR (SELECT private.is_owner()))
  WITH CHECK ((SELECT auth.uid()) = created_by OR (SELECT private.is_owner()));

CREATE POLICY template_fields_manage ON public.template_fields FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.templates t WHERE t.id = template_id AND ((SELECT auth.uid()) = t.created_by OR (SELECT private.is_owner()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.templates t WHERE t.id = template_id AND ((SELECT auth.uid()) = t.created_by OR (SELECT private.is_owner()))));

CREATE POLICY generated_letters_manage ON public.generated_letters FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = created_by OR (SELECT private.is_owner()))
  WITH CHECK ((SELECT auth.uid()) = created_by OR (SELECT private.is_owner()));

CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();