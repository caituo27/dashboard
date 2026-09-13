import {useQuery} from '@tanstack/react-query';
import { readDashboardAnalyticsMock, type AnalyticsRange } from '../services/dashboardAnalyticsMock';
const LIVE_OVERVIEW_INTERVAL_MS=5*60*1000;
export function useDashboardAnalytics(range:AnalyticsRange){
 return useQuery({queryKey:['sprix-admin','dashboard',range],queryFn:({signal})=>readDashboardAnalyticsMock(range,signal),staleTime:LIVE_OVERVIEW_INTERVAL_MS,refetchInterval:LIVE_OVERVIEW_INTERVAL_MS,refetchIntervalInBackground:false,refetchOnWindowFocus:false,refetchOnReconnect:false,retry:1});
}
