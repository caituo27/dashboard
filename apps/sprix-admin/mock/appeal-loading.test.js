// @vitest-environment node
import {test,expect,vi,beforeEach} from 'vitest';
import {adminQueryClient} from '../src/services/adminQueryClient';
import {readAppealPage} from '../src/services/pagedAdminData';
import * as real from '../src/services/sprixApi';
import axios from 'axios';
vi.mock('../src/services/sprixApi',()=>({readRemoteAppeals:vi.fn(),readCachedAppealDetail:vi.fn()}));
beforeEach(()=>{adminQueryClient.clear();vi.clearAllMocks();});
test('appeal navigation hydrates only current page while counts use list metadata',async()=>{
 const rows=Array.from({length:100},(_,i)=>({backendId:`real-${i}`,appealNo:`AP${i}`,submittedAt:`2026-09-12 12:${String(59-Math.floor(i/60)).padStart(2,'0')}:${String(59-i%60).padStart(2,'0')}`,appealStatus:'待处理'}));
 real.readRemoteAppeals.mockResolvedValue(rows);
 real.readCachedAppealDetail.mockImplementation(async id=>({...rows.find(row=>row.backendId===id),taskTitle:'完整任务名称'}));
 vi.spyOn(axios,'get').mockImplementation(async(_url,{params})=>({data:params.kind==='appeal-stats'?{pending:0,processing:0,today:0,done:0}:{rows:[],total:0,version:'test'}}));
 try{
 const result=await readAppealPage({page:1,pageSize:20});
 expect(result.total).toBe(100);expect(result.stats.pending).toBe(100);
 expect(real.readCachedAppealDetail).toHaveBeenCalledTimes(20);
 expect(result.rows.every(row=>row.taskTitle==='完整任务名称')).toBe(true);
 }finally{vi.restoreAllMocks();}
});
