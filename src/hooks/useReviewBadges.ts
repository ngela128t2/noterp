import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useReviewBadges() {
  return useQuery({
    queryKey: ['review_badges'],
    queryFn: async () => {
      const [clients, projects, contacts] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('needs_review', true),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('needs_review', true),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('needs_review', true),
      ])

      if (clients.error) throw clients.error
      if (projects.error) throw projects.error
      if (contacts.error) throw contacts.error

      return {
        clients: clients.count ?? 0,
        projects: projects.count ?? 0,
        contacts: contacts.count ?? 0,
      }
    },
  })
}
