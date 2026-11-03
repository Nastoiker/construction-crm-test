import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/shared/api/client';

export const profileSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  role: z.enum(['manager', 'executor']),
});
export type Profile = z.infer<typeof profileSchema>;
export const SessionContext = createContext<{
  session: Session | null;
  ready: boolean;
  error: unknown;
}>({ session: null, ready: false, error: null });
export function useSession() {
  return useContext(SessionContext);
}
export function useProfile() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session!.user.id)
        .single();
      if (error)
        throw new Error('Профиль не настроен. Обратитесь к администратору.');
      return profileSchema.parse(data);
    },
  });
}
export function useProfiles() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['profiles', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('display_name');
      if (error) throw error;
      return z.array(profileSchema).parse(data);
    },
  });
}
