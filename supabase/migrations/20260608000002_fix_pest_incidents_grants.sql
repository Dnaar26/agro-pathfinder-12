-- Auditoría hallazgo C5: pest_incidents no tenía GRANTs, solo RLS policies
-- Sin GRANT las policies nunca se ejecutan — la tabla es invisible para authenticated
GRANT ALL ON public.pest_incidents TO authenticated;
