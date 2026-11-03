import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/shared/api/client';

export const objectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  created_by: z.uuid(),
  created_at: z.string(),
  version: z.number(),
});
export type ConstructionObject = z.infer<typeof objectSchema>;
export function useObjects(userId: string) {
  return useQuery({
    queryKey: ['objects', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return z.array(objectSchema).parse(data);
    },
  });
}
export function useObject(id: string, userId: string) {
  return useQuery({
    queryKey: ['objects', userId, id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? objectSchema.parse(data) : null;
    },
  });
}
