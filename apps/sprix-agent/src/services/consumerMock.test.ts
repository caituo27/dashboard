import {afterEach,describe,expect,it,vi} from 'vitest';
import {acceptConsumerTask,readConsumerTaskPage,readConsumerTask,consumerOwner} from './consumerMock';
import type {Task} from '../types';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
describe('shared consumer mock adapter',()=>{
 it('loads bounded pages after preserved real records and supports direct details',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({rows:Array.from({length:20},(_,i)=>({id:`demo:task:${i}`})),total:100})});
  vi.stubGlobal('fetch',fetchMock);
  const real=Array.from({length:3},(_,i)=>({id:`real-${i}`,taskStatus:"已发布",remainingSlots:1})) as Task[];
  const first=await readConsumerTaskPage([...real,{id:"full",taskStatus:"已发布",remainingSlots:0},{id:"offline",taskStatus:"已下线",remainingSlots:5}] as Task[],1);
  expect(first.total).toBe(103);expect(first.rows).toHaveLength(20);expect(first.rows.slice(0,3)).toEqual(real);
  expect(fetchMock.mock.calls[0][0]).toContain('offset=0&limit=17');
  await readConsumerTaskPage(real,2);expect(fetchMock.mock.calls[1][0]).toContain('offset=17&limit=20');
  await readConsumerTask('demo:task:42');expect(fetchMock.mock.calls[2][0]).toContain('kind=task-detail&id=demo%3Atask%3A42');
 });
 it('routes simulated accepts only to the local endpoint and scopes identities by account',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'demo:execution:9000000001'})});
  vi.stubGlobal('fetch',fetchMock);
  await acceptConsumerTask('demo:task:42',{phone:'13800001234'},{id:'codex-1',name:'Codex Agent'});
  expect(fetchMock.mock.calls[0][0]).toBe('/mock-api/consumer/accept');
  expect(fetchMock.mock.calls[0][1].headers).toEqual({'Content-Type':'application/json'});
  expect(consumerOwner('13800001234')).toBe(consumerOwner('13800001234'));
  expect(consumerOwner('13800001234')).not.toBe(consumerOwner('13800005678'));
 });
});
