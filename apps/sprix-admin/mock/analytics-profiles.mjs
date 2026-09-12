import {hash} from "./business-scenario.mjs";
// Synthetic context only; no device, location or cell-tower collection occurs.
const devices = [
  ['手机', 'Apple', 'iPhone 15', 'iOS', '17.6', 'Safari', '17.6', '393 × 852'],
  ['手机', 'Xiaomi', '小米 14', 'Android', '14', 'Chrome', '128', '393 × 873'],
  ['手机', 'Samsung', 'Galaxy S24', 'Android', '14', 'Chrome', '128', '360 × 780'],
  ['电脑', 'Apple', 'MacBook Air', 'macOS', '14.6', 'Safari', '17.6', '1440 × 900'],
  ['电脑', 'Lenovo', 'ThinkPad', 'Windows', '11', 'Edge', '128', '1920 × 1080']
];
const desktopDevices = [
 ['电脑','Apple','MacBook Pro','macOS','15.6','Chrome','139','1512 × 982'],
 ['电脑','Lenovo','ThinkPad','Windows','11','Chrome','139','1920 × 1080'],
 ['电脑','Dell','Latitude','Windows','11','Edge','139','2560 × 1440'],
 ['电脑','Apple','MacBook Air','macOS','15.6','Safari','18.6','1440 × 900'],
 ['电脑','Lenovo','ThinkBook','Windows','11','Edge','139','1920 × 1200']
];
// Province/city pairs stay coherent; larger technology hubs have more entries.
const cities = [
 ['广东','深圳'],['广东','广州'],['广东','佛山'],['广东','东莞'],
 ['浙江','杭州'],['浙江','宁波'],['江苏','南京'],['江苏','苏州'],['江苏','无锡'],
 ['上海','上海'],['北京','北京'],['四川','成都'],['四川','绵阳'],['重庆','重庆'],
 ['湖北','武汉'],['湖南','长沙'],['安徽','合肥'],['福建','福州'],['福建','厦门'],
 ['山东','济南'],['山东','青岛'],['河南','郑州'],['河北','石家庄'],['天津','天津'],
 ['陕西','西安'],['辽宁','沈阳'],['辽宁','大连'],['江西','南昌'],['广西','南宁'],
 ['云南','昆明'],['贵州','贵阳'],['海南','海口'],['山西','太原'],['吉林','长春'],
 ['黑龙江','哈尔滨'],['内蒙古','呼和浩特'],['甘肃','兰州'],['宁夏','银川'],
 ['青海','西宁'],['新疆','乌鲁木齐'],['西藏','拉萨']
];
export function visitorContext(uid) {
  const [device_type,device_brand,device_model,os_name,os_version,browser_name,browser_version,screen_resolution] = hash(uid,40)%100 < 94 ? desktopDevices[hash(uid,41)%desktopDevices.length] : devices[hash(uid,41)%3];
  const [province,city] = cities[hash(uid,42) % cities.length];
  const network_type = device_type === '电脑' ? (hash(uid,43) % 2 ? 'Wi-Fi' : '有线') : hash(uid,44) % 5 < 2 ? 'Wi-Fi' : hash(uid,44) % 5 < 4 ? '5G' : '4G';
  const cellular = ['4G','5G'].includes(network_type);
  return {device_type,device_brand,device_model,os_name,os_version,browser_name,browser_version,screen_resolution,network_type,carrier:cellular ? ['中国移动','中国联通','中国电信'][hash(uid,45) % 3] : null,country:'中国',province,city,location_precision:'城市',timezone:'Asia/Shanghai',language:'zh-CN',base_station_id:cellular ? `DEMO-CELL-${String(hash(uid,42) % 128).padStart(4,'0')}` : null,context_source:'synthetic'};
}
export function profileFromEvents(events, userId) {
  const rows = events.filter(e => e.user_id === userId);
  if (!rows.length) return null;
  const first = rows[0], latest = rows.at(-1);
  const sessions = new Map();
  const pageCounts = new Map();
  for (const event of rows) {
    const timestamp = Date.parse(event.event_time);
    const session = sessions.get(event.session_id) ?? {start:timestamp,end:timestamp};
    session.end = Math.max(session.end,timestamp);
    sessions.set(event.session_id,session);
    if (['task_market_view','task_detail_view'].includes(event.event_name)) pageCounts.set(event.page_id,(pageCounts.get(event.page_id) ?? 0)+1);
  }
  const successTasks = (name) => new Set(rows.filter(e => e.event_name === name && e.result === 'success').map(e => e.execution_id ?? e.task_id)).size;
  const firstDate = new Date(Date.parse(first.event_time)+28800000).toISOString().slice(0,10);
  const lastDate = new Date(Date.parse(latest.event_time)+28800000).toISOString().slice(0,10);
  return {user_name:latest.user_name,user_id:userId,anonymous_id:latest.anonymous_id,window_days:30,first_seen:first.event_time,last_seen:latest.event_time,visitor_type:firstDate === lastDate ? '单日访客' : '跨日回访',session_count:sessions.size,page_views:[...pageCounts.values()].reduce((a,b)=>a+b,0),event_count:rows.length,click_count:rows.filter(e=>e.event_name==='button_click').length,accepted_tasks:successTasks('task_accept_succeeded'),submitted_tasks:successTasks('delivery_submitted'),failure_count:rows.filter(e=>e.result==='failure').length,average_session_span_seconds:Math.round([...sessions.values()].reduce((sum,s)=>sum+(s.end-s.start)/1000,0)/sessions.size),top_pages:[...pageCounts].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([page,views])=>({page,views})),latest_context:visitorContext(Number(userId.split(':')[1]))};
}
