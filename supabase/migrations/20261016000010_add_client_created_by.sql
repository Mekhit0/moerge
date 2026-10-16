-- Migration 010: Add created_by column to public.clients for audit logging & quick appointments
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
