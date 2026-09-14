const schemaReadyByDb = new WeakSet();

export const VPLUS = Object.freeze({
  product: 'Sky First School',
  channel: 'VPLUS',
  edition: 'VIP PRO'
});

export const ROLE_PERMISSIONS = Object.freeze({
  student: ['ai.ask','ai.research','ai.create','class.join','class.chat','class.react'],
  guest: ['class.join','class.chat','class.react'],
  assistant: ['ai.ask','ai.research','ai.create','ai.analyze.class','ai.act.class','class.manage'],
  teacher: ['ai.ask','ai.research','ai.create','ai.analyze.class','ai.act.class','class.manage'],
  account_admin: ['ai.ask','ai.research','ai.create','accounts.manage'],
  school_admin: ['ai.ask','ai.research','ai.create','ai.analyze.school','school.manage'],
  super_admin: ['*']
});

export function hasPermission(user, permission) {
  const role=String(user?.role||'guest');
  const perms=ROLE_PERMISSIONS[role]||[];
  return perms.includes('*') || perms.includes(permission);
}

export function requirePermission(user, permission) {
  if (!hasPermission(user, permission)) throw Object.assign(new Error('FORBIDDEN'),{status:403});
  return true;
}

export function safeUserMessage(error, fallback='Đã xảy ra sự cố tạm thời. Vui lòng thử lại sau.') {
  const status=Number(error?.status||500);
  if(status===401) return 'Vui lòng đăng nhập để tiếp tục.';
  if(status===403) return 'Bạn không có quyền thực hiện thao tác này.';
  if(status===404) return 'Không tìm thấy nội dung bạn yêu cầu.';
  if(status===409) return 'Thao tác chưa thể hoàn tất do dữ liệu vừa thay đổi. Vui lòng thử lại.';
  if(status===413) return 'Tệp bạn chọn vượt quá giới hạn cho phép.';
  if(status===429) return 'Có quá nhiều yêu cầu cùng lúc. Vui lòng thử lại sau ít phút.';
  if(status>=500) return fallback;
  const msg=String(error?.publicMessage||error?.message||'').trim();
  if(!msg || /\b(D1|R2|SFU|mesh|durable|worker|websocket|ICE|binding|schema|SQL|API|HTTP)\b/i.test(msg)) return fallback;
  return msg.slice(0,400);
}

export async function ensureVPlusSchema(env){
  if(!env?.DB) return;
  if(schemaReadyByDb.has(env.DB)) return;
  const sql=[
    `CREATE TABLE IF NOT EXISTS platform_events (
      id TEXT PRIMARY KEY,
      tenant_key TEXT NOT NULL DEFAULT 'sky-first',
      class_id TEXT,
      user_id TEXT,
      event_type TEXT NOT NULL,
      event_source TEXT NOT NULL DEFAULT 'platform',
      detail_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_platform_events_class_time ON platform_events(class_id,created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_platform_events_type_time ON platform_events(event_type,created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      class_id TEXT,
      mode TEXT NOT NULL DEFAULT 'ask',
      title TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id,updated_at DESC)`,
    `CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id,created_at)`,
    `CREATE TABLE IF NOT EXISTS ai_audit (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      class_id TEXT,
      mode TEXT NOT NULL DEFAULT 'ask',
      action TEXT NOT NULL DEFAULT 'chat',
      status TEXT NOT NULL DEFAULT 'ok',
      detail_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_audit_time ON ai_audit(created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS ai_action_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      class_id TEXT,
      action_key TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      risk_level TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_action_requests_user ON ai_action_requests(user_id,status,created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS ai_rate_limits (
      user_id TEXT NOT NULL,
      bucket TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id,bucket)
    )`,
    `CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      plan TEXT NOT NULL DEFAULT 'community',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS organization_members (
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(organization_id,user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id,status)`,
    `CREATE TABLE IF NOT EXISTS organization_domains (
      domain TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS organization_settings (
      organization_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(organization_id,key)
    )`,
    `CREATE TABLE IF NOT EXISTS usage_hourly (
      organization_id TEXT NOT NULL DEFAULT 'sky-first',
      bucket TEXT NOT NULL,
      metric TEXT NOT NULL,
      value INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(organization_id,bucket,metric)
    )`
  ];
  for(const statement of sql) await env.DB.prepare(statement).run();
  schemaReadyByDb.add(env.DB);
}

export async function recordPlatformEvent(env,{classId=null,userId=null,type,source='platform',detail={}}={}){
  if(!type||!env?.DB) return;
  try{
    await ensureVPlusSchema(env);
    await env.DB.prepare(`INSERT INTO platform_events(id,class_id,user_id,event_type,event_source,detail_json,created_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
      .bind(crypto.randomUUID(),classId,userId,type,source,JSON.stringify(detail||{})).run();
  }catch{}
}

export async function auditAi(env,{userId=null,classId=null,mode='ask',action='chat',status='ok',detail={}}={}){
  try{
    await ensureVPlusSchema(env);
    await env.DB.prepare(`INSERT INTO ai_audit(id,user_id,class_id,mode,action,status,detail_json,created_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
      .bind(crypto.randomUUID(),userId,classId,mode,action,status,JSON.stringify(detail||{})).run();
  }catch{}
}

export function aiConfigured(env){
  return !!(String(env?.AI_API_URL||'').trim() && String(env?.AI_API_KEY||'').trim() && String(env?.AI_MODEL||'').trim());
}


export async function consumeAiQuota(env,userId,{limit=40,windowMinutes=10}={}){
  await ensureVPlusSchema(env);
  const ms=Math.max(1,windowMinutes)*60*1000;
  const bucket=new Date(Math.floor(Date.now()/ms)*ms).toISOString();
  const row=await env.DB.prepare(`SELECT count FROM ai_rate_limits WHERE user_id=? AND bucket=?`).bind(userId,bucket).first();
  const count=Number(row?.count||0);
  if(count>=limit) throw Object.assign(new Error('AI_RATE_LIMIT'),{status:429,publicMessage:'Bạn đang gửi yêu cầu quá nhanh. Vui lòng chờ một chút rồi thử lại.'});
  await env.DB.prepare(`INSERT INTO ai_rate_limits(user_id,bucket,count,updated_at) VALUES(?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(user_id,bucket) DO UPDATE SET count=count+1,updated_at=CURRENT_TIMESTAMP`).bind(userId,bucket).run();
  return {remaining:Math.max(0,limit-count-1)};
}

export async function fetchResearchSources(env,query){
  const endpoint=String(env?.AI_RESEARCH_URL||'').trim();
  if(!endpoint||!query) return [];
  try{
    const headers={'content-type':'application/json'};
    if(env.AI_RESEARCH_API_KEY) headers.authorization=`Bearer ${env.AI_RESEARCH_API_KEY}`;
    const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({query:String(query).slice(0,1000),limit:6})});
    if(!r.ok)return [];
    const data=await r.json();
    const arr=Array.isArray(data)?data:(data.results||data.items||data.web?.results||[]);
    return arr.slice(0,6).map((x,i)=>({index:i+1,title:String(x.title||x.name||`Nguồn ${i+1}`).slice(0,180),url:String(x.url||x.link||'').slice(0,1200),snippet:String(x.snippet||x.description||x.text||'').slice(0,700)})).filter(x=>/^https?:\/\//i.test(x.url));
  }catch{return []}
}

export function parseAiAction(text=''){
  let raw=String(text).trim();
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i); if(fenced) raw=fenced[1].trim();
  try{
    const obj=JSON.parse(raw);
    if(!obj||typeof obj!=='object')return null;
    const action=obj.action&&typeof obj.action==='object'?obj.action:null;
    if(!action||!['create_poll','add_resource','update_class_policy'].includes(String(action.key)))return null;
    return {message:String(obj.message||'Mình đã chuẩn bị thao tác này.').slice(0,1000),action:{key:String(action.key),payload:action.payload&&typeof action.payload==='object'?action.payload:{}}};
  }catch{return null}
}

export async function callAiProvider(env,{messages,temperature=.35,maxTokens=1200}={}){
  if(!aiConfigured(env)) throw Object.assign(new Error('AI_NOT_READY'),{status:503,publicMessage:'Sky First AI đang được chuẩn bị. Vui lòng quay lại sau.'});
  const base=String(env.AI_API_URL).replace(/\/+$/,'');
  const r=await fetch(base,{method:'POST',headers:{'authorization':`Bearer ${env.AI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:env.AI_MODEL,messages,temperature,max_tokens:maxTokens})});
  if(!r.ok) throw Object.assign(new Error('AI_PROVIDER_FAILED'),{status:503,publicMessage:'Sky First AI tạm thời chưa thể phản hồi. Vui lòng thử lại sau.'});
  const data=await r.json();
  const text=String(data?.choices?.[0]?.message?.content ?? data?.output_text ?? data?.response ?? '').trim();
  if(!text) throw Object.assign(new Error('AI_EMPTY'),{status:503,publicMessage:'Sky First AI chưa thể tạo câu trả lời lúc này. Vui lòng thử lại.'});
  return {text,providerId:String(data?.id||'')};
}

export function buildAiSystemPrompt({user,classInfo=null,mode='ask',contextText=''}={}){
  const role=String(user?.role||'student');
  const modeGuide={
    ask:'Trả lời rõ ràng, ưu tiên nội dung học tập và ngữ cảnh hiện có.',
    research:'Nghiên cứu có hệ thống. Phân biệt dữ kiện, suy luận và phần chưa đủ nguồn. Không giả vờ đã truy cập nguồn mà hệ thống chưa cung cấp.',
    create:'Tạo đầu ra thực dụng, có cấu trúc, có thể dùng ngay.',
    analyze:'Phân tích dữ liệu được cung cấp, nêu xu hướng và giới hạn của dữ liệu. Không suy diễn đặc điểm nhạy cảm của người học.',
    act:'Nếu yêu cầu có thể thực hiện bằng một trong các hành động được hỗ trợ, chỉ trả JSON hợp lệ dạng {\"message\":\"...\",\"action\":{\"key\":\"create_poll|add_resource|update_class_policy\",\"payload\":{...}}}. create_poll cần question, options (2-8 mục), anonymous; add_resource cần title,url; update_class_policy chỉ dùng allow_student_mic, allow_student_camera, allow_student_share, allow_chat, allow_reactions. Nếu không phù hợp, trả lời văn bản bình thường. Không tuyên bố đã thực hiện trước khi người dùng xác nhận.'
  }[mode]||'';
  return `Bạn là Sky First Network AI, trợ lý bên trong Sky First School.\nVai trò người dùng: ${role}.\n${classInfo?`Lớp hiện tại: ${classInfo.name||classInfo.id||''}.`:''}\n${modeGuide}\nNguyên tắc bắt buộc: không tiết lộ hạ tầng nội bộ, secret, database, storage, transport, log kỹ thuật hoặc dữ liệu ngoài quyền người dùng; không bịa nguồn; nếu thiếu dữ liệu hãy nói rõ.\n${contextText?`Ngữ cảnh được phép sử dụng:\n${contextText}`:''}`;
}
