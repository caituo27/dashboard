import {useQuery} from '@tanstack/react-query';
import { readDashboardAnalyticsMock, type AnalyticsRange } from '../services/dashboardAnalyticsMock';
export function useDashboardAnalytics(range:AnalyticsRange){
 return useQuery({queryKey:['sprix-admin','dashboard',range],queryFn:({signal})=>readDashboardAnalyticsMock(range,signal),staleTime:Infinity,refetchInterval:false,refetchOnWindowFocus:false,refetchOnReconnect:false,retry:1});
}
