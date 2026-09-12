import { QueryClient } from '@tanstack/react-query';
export const adminQueryClient = new QueryClient();
let session: string | null | undefined;
export function sharedAdminRead<T>(key: string, queryFn: () => Promise<T>, staleTime = 4000): Promise<T> {
  const current = typeof localStorage === 'undefined' ? null : localStorage.getItem('sprix-admin-auth-token');
  if (session !== current) {
    adminQueryClient.removeQueries({queryKey:['sprix-admin','shared-read']});
    session = current;
  }
  return adminQueryClient.fetchQuery({queryKey:['sprix-admin','shared-read',key],queryFn,staleTime,gcTime:60000,retry:false});
}
