import { LiveRoom } from './live-room.js';
export { LiveRoom };

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const COOKIE = 'sfn_slc_session';
const MAX_ACCOUNTS = 10000;

function json(data, status = 200, extra = {}) { return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } }); }
function bad(message, status = 400, detail = undefined) { return json({ ok: false, message, detail }, status); }
function ok(data = {}) { return json({ ok: true, ...data }); }
function nowIso() { return new Date().toISOString(); }
function randomToken(bytes = 32) { const a = new Uint8Array(bytes); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2,'0')).join(''); }
function safeName(s='file') { return s.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,120) || 'file'; }
function cookieParse(h='') { return Object.fromEntries(h.split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf('='); return i<0?[v,'']:[v.slice(0,i),decodeURIComponent(v.slice(i+1))]})); }
function sessionCookie(token, days=30) { return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${days*86400}`; }
function clearCookie() { return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`; }
function idCode(n) { return `SFN${String(n).padStart(5,'0')}`; }
function slugCode(prefix='CLS') { return `${prefix}-${Math.random().toString(36).slice(2,6).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`; }

async function hashPassword(password, saltHex = null) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/.{1,2}/g).map(x=>parseInt(x,16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations:210000, hash:'SHA-256' }, key, 256);
  const hash = [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const saltOut = [...salt].map(x=>x.toString(16).padStart(2,'0')).join('');
  return { hash, salt: saltOut };
}
async function verifyPassword(password, salt, expected) { return (await hashPassword(password, salt)).hash === expected; }

async function getSession(request, env) {
  const token = cookieParse(request.headers.get('cookie') || '')[COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare(`SELECT s.id session_id,s.user_id,s.expires_at,u.sfn_no,u.sfn_id,u.full_name,u.email,u.phone,u.role,u.status,u.avatar_key FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at > CURRENT_TIMESTAMP AND u.status='active'`).bind(token).first();
  return row || null;
}
async function requireUser(req, env) { const u=await getSession(req,env); if(!u) throw Object.assign(new Error('AUTH'),{status:401}); return u; }
async function requireRole(req, env, roles) { const u=await requireUser(req,env); if(!roles.includes(u.role)) throw Object.assign(new Error('FORBIDDEN'),{status:403}); return u; }

async function activeExam(userId, env) {
  return env.DB.prepare(`SELECT a.id attempt_id,e.id exam_id,e.title FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.user_id=? AND a.status='in_progress' AND a.started_at IS NOT NULL ORDER BY a.id DESC LIMIT 1`).bind(userId).first();
}

async function uploadR2(file, env, prefix, ownerId=null, visibility='private') {
  if (!(file instanceof File) || !file.size) return null;
  if (file.size > 50*1024*1024) throw new Error('Tệp vượt quá 50MB');
  const key = `${prefix}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${safeName(file.name)}`;
  await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
  const res = await env.DB.prepare(`INSERT INTO files(id,owner_user_id,r2_key,name,mime,size,visibility,created_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(crypto.randomUUID(), ownerId, key, file.name, file.type||'', file.size, visibility).run();
  return { key, name:file.name, mime:file.type||'', size:file.size };
}

function normalizeEmail(s=''){return s.trim().toLowerCase();}
function str(v=''){return String(v ?? '').trim();}

async function sendMail(env,to,subject,html){
  if(!env.RESEND_API_KEY) return {sent:false,reason:'RESEND_API_KEY_NOT_CONFIGURED'};
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM||'SLC · Sky First Network <support@skyfirst.io.vn>',to:[to],subject,html})});
  if(!r.ok) return {sent:false,reason:await r.text()};
  return {sent:true,data:await r.json()};
}

async function routeApi(request, env, ctx, url) {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/health') return ok({ service:'SFN SLC', time:nowIso(), domain:env.APP_URL });

  if (path === '/api/setup/bootstrap' && method === 'POST') {
    if (!env.SETUP_TOKEN || request.headers.get('x-setup-token') !== env.SETUP_TOKEN) return bad('Setup token không hợp lệ.',403);
    const exists=await env.DB.prepare(`SELECT COUNT(*) n FROM users`).first();
    if(Number(exists.n)>0) return bad('Hệ thống đã được khởi tạo.',409);
    const body=await request.json(); const fullName=str(body.full_name)||'SFN Super Admin'; const email=normalizeEmail(str(body.email)); const password=str(body.password);
    if(!email || password.length<12) return bad('Email hợp lệ và mật khẩu tối thiểu 12 ký tự là bắt buộc.');
    const seq=await env.DB.prepare(`UPDATE counters SET value=value+1 WHERE key='sfn_user' AND value < ? RETURNING value`).bind(MAX_ACCOUNTS).first();
    if(!seq) return bad('Không thể cấp số tài khoản.',409);
    const hp=await hashPassword(password); const id=crypto.randomUUID(); const no=Number(seq.value);
    await env.DB.prepare(`INSERT INTO users(id,sfn_no,sfn_id,full_name,email,phone,role,status,profile_json,password_hash,password_salt,created_at,updated_at) VALUES(?,?,?,?,?,?,'super_admin','active','{}',?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(id,no,idCode(no),fullName,email,str(body.phone),hp.hash,hp.salt).run();
    return ok({sfn_id:idCode(no),message:'Đã khởi tạo Super Admin đầu tiên.'});
  }

  if (path === '/api/auth/request-account' && method === 'POST') {
    const form = await request.formData();
    const fullName=str(form.get('full_name')), email=normalizeEmail(str(form.get('email'))), phone=str(form.get('phone'));
    if (!fullName || !email || !phone) return bad('Vui lòng nhập đầy đủ họ tên, email và số điện thoại.');
    const portrait = form.get('portrait');
    const studentCard = form.get('student_card');
    if (!(portrait instanceof File) || !portrait.size) return bad('Ảnh chân dung là bắt buộc.');
    const requestId = `ACC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const portraitMeta = await uploadR2(portrait, env, 'account-requests/portrait');
    const studentMeta = studentCard instanceof File && studentCard.size ? await uploadR2(studentCard, env, 'account-requests/student-card') : null;
    const data = {
      birth_date:str(form.get('birth_date')), gender:str(form.get('gender')), province:str(form.get('province')),
      education_unit_type:str(form.get('education_unit_type')), education_unit:str(form.get('education_unit')), faculty:str(form.get('faculty')),
      major:str(form.get('major')), class_name:str(form.get('class_name')), student_code:str(form.get('student_code')), academic_year:str(form.get('academic_year')),
      sfn_unit:str(form.get('sfn_unit')), sfn_role:str(form.get('sfn_role')), purpose:str(form.get('purpose')), requested_access:str(form.get('requested_access')),
      referral:str(form.get('referral')), notes:str(form.get('notes'))
    };
    await env.DB.prepare(`INSERT INTO account_requests(request_code,full_name,email,phone,data_json,portrait_key,student_card_key,status,created_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
      .bind(requestId,fullName,email,phone,JSON.stringify(data),portraitMeta.key,studentMeta?.key||null,'pending').run();
    return ok({ request_code:requestId, message:'Yêu cầu đã được gửi. SFN sẽ xem xét trước khi cấp tài khoản.' });
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const body=await request.json(); const login=str(body.login); const pw=str(body.password);
    const u=await env.DB.prepare(`SELECT * FROM users WHERE (lower(email)=lower(?) OR lower(sfn_id)=lower(?)) LIMIT 1`).bind(login,login).first();
    if(!u || u.status!=='active' || !(await verifyPassword(pw,u.password_salt,u.password_hash))) return bad('Thông tin đăng nhập không đúng.',401);
    const token=randomToken(32); const days=Math.max(1,Math.min(90,Number(env.SESSION_DAYS||30)));
    const exp=new Date(Date.now()+days*86400000).toISOString();
    await env.DB.prepare(`INSERT INTO sessions(token,user_id,ip_hash,user_agent,expires_at,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(token,u.id,'',request.headers.get('user-agent')||'',exp).run();
    return json({ok:true,user:{sfn_id:u.sfn_id,full_name:u.full_name,role:u.role}},200,{'set-cookie':sessionCookie(token,days)});
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const token=cookieParse(request.headers.get('cookie')||'')[COOKIE]; if(token) await env.DB.prepare(`DELETE FROM sessions WHERE token=?`).bind(token).run();
    return json({ok:true},200,{'set-cookie':clearCookie()});
  }

  if (path === '/api/auth/me' && method === 'GET') {
    const u=await getSession(request,env); if(!u) return ok({user:null});
    const exam=await activeExam(u.user_id,env);
    return ok({user:{id:u.user_id,sfn_id:u.sfn_id,full_name:u.full_name,email:u.email,phone:u.phone,role:u.role,avatar_key:u.avatar_key},active_exam:exam||null});
  }

  if (path === '/api/auth/activate' && method === 'POST') {
    const body=await request.json(); const token=str(body.token), password=str(body.password);
    if(password.length<10) return bad('Mật khẩu phải có ít nhất 10 ký tự.');
    const row=await env.DB.prepare(`SELECT * FROM activation_tokens WHERE token=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP`).bind(token).first();
    if(!row) return bad('Liên kết kích hoạt không hợp lệ hoặc đã hết hạn.');
    const hp=await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare(`UPDATE users SET password_hash=?,password_salt=?,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(hp.hash,hp.salt,row.user_id),
      env.DB.prepare(`UPDATE activation_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.id)
    ]);
    return ok({message:'Tài khoản SFN đã được kích hoạt.'});
  }

  const publicLiveInfo=path.match(/^\/api\/public\/classes\/([^/]+)\/live-info$/);
  if(publicLiveInfo && method==='GET'){
    const cls=await env.DB.prepare(`SELECT id,name,unit,status FROM classes WHERE id=? AND status='active'`).bind(publicLiveInfo[1]).first();
    if(!cls) return bad('Không tìm thấy lớp.',404);
    return ok({class:cls});
  }

  if (path === '/api/classes' && method === 'GET') {
    const u=await requireUser(request,env);
    const rows=await env.DB.prepare(`SELECT c.*,cm.role member_role,(SELECT COUNT(*) FROM class_members x WHERE x.class_id=c.id) member_count FROM classes c JOIN class_members cm ON cm.class_id=c.id WHERE cm.user_id=? AND cm.status='active' ORDER BY c.updated_at DESC`).bind(u.user_id).all();
    return ok({classes:rows.results});
  }

  if (path === '/api/classes' && method === 'POST') {
    const u=await requireRole(request,env,['super_admin','school_admin','teacher']);
    const b=await request.json(); if(!str(b.name)) return bad('Tên lớp không được để trống.');
    const id=crypto.randomUUID(), joinCode=slugCode('SLC');
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO classes(id,name,description,unit,cover_key,join_code,owner_user_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(id,str(b.name),str(b.description),str(b.unit),null,joinCode,u.user_id),
      env.DB.prepare(`INSERT INTO class_members(class_id,user_id,role,status,joined_at) VALUES(?,?,'teacher','active',CURRENT_TIMESTAMP)`).bind(id,u.user_id)
    ]);
    return ok({id,join_code:joinCode});
  }

  const classMatch=path.match(/^\/api\/classes\/([^/]+)$/);
  if(classMatch && method==='GET'){
    const u=await requireUser(request,env); const id=classMatch[1];
    const member=await env.DB.prepare(`SELECT role FROM class_members WHERE class_id=? AND user_id=? AND status='active'`).bind(id,u.user_id).first();
    if(!member) return bad('Bạn không thuộc lớp này.',403);
    const cls=await env.DB.prepare(`SELECT c.*,u.full_name owner_name FROM classes c JOIN users u ON u.id=c.owner_user_id WHERE c.id=?`).bind(id).first();
    const members=await env.DB.prepare(`SELECT cm.role,u.sfn_id,u.full_name,u.email FROM class_members cm JOIN users u ON u.id=cm.user_id WHERE cm.class_id=? AND cm.status='active' ORDER BY cm.role,u.full_name`).bind(id).all();
    return ok({class:cls,members:members.results,my_role:member.role});
  }

  const joinMatch=path.match(/^\/api\/classes\/join$/);
  if(joinMatch && method==='POST'){
    const u=await requireUser(request,env); const b=await request.json(); const code=str(b.code).toUpperCase();
    const cls=await env.DB.prepare(`SELECT id FROM classes WHERE upper(join_code)=? AND status='active'`).bind(code).first();
    if(!cls) return bad('Mã lớp không hợp lệ.');
    await env.DB.prepare(`INSERT INTO class_members(class_id,user_id,role,status,joined_at) VALUES(?,?,'student','active',CURRENT_TIMESTAMP) ON CONFLICT(class_id,user_id) DO UPDATE SET status='active'`).bind(cls.id,u.user_id).run();
    return ok({class_id:cls.id});
  }

  const postsMatch=path.match(/^\/api\/classes\/([^/]+)\/posts$/);
  if(postsMatch && method==='GET'){
    const u=await requireUser(request,env); const id=postsMatch[1];
    const member=await env.DB.prepare(`SELECT 1 ok FROM class_members WHERE class_id=? AND user_id=? AND status='active'`).bind(id,u.user_id).first(); if(!member)return bad('Không có quyền.',403);
    const rows=await env.DB.prepare(`SELECT p.*,u.full_name author FROM class_posts p JOIN users u ON u.id=p.author_user_id WHERE p.class_id=? ORDER BY p.pinned DESC,p.created_at DESC LIMIT 100`).bind(id).all(); return ok({posts:rows.results});
  }
  if(postsMatch && method==='POST'){
    const u=await requireUser(request,env); const id=postsMatch[1]; const m=await env.DB.prepare(`SELECT role FROM class_members WHERE class_id=? AND user_id=? AND status='active'`).bind(id,u.user_id).first(); if(!m)return bad('Không có quyền.',403);
    const b=await request.json(); if(!str(b.body))return bad('Nội dung trống.');
    await env.DB.prepare(`INSERT INTO class_posts(id,class_id,author_user_id,body,pinned,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(crypto.randomUUID(),id,u.user_id,str(b.body),['teacher','assistant'].includes(m.role)&&b.pinned?1:0).run(); return ok();
  }

  const matsMatch=path.match(/^\/api\/classes\/([^/]+)\/materials$/);
  if(matsMatch && method==='GET'){
    const u=await requireUser(request,env); const id=matsMatch[1]; const m=await env.DB.prepare(`SELECT 1 ok FROM class_members WHERE class_id=? AND user_id=? AND status='active'`).bind(id,u.user_id).first(); if(!m)return bad('Không có quyền.',403);
    const rows=await env.DB.prepare(`SELECT m.*,f.name,f.mime,f.size FROM materials m JOIN files f ON f.id=m.file_id WHERE m.class_id=? ORDER BY m.created_at DESC`).bind(id).all(); return ok({materials:rows.results});
  }
  if(matsMatch && method==='POST'){
    const u=await requireUser(request,env); const id=matsMatch[1]; const m=await env.DB.prepare(`SELECT role FROM class_members WHERE class_id=? AND user_id=? AND status='active'`).bind(id,u.user_id).first(); if(!m||!['teacher','assistant'].includes(m.role))return bad('Chỉ giáo viên/trợ giảng được tải học liệu.',403);
    const form=await request.formData(); const file=form.get('file'); if(!(file instanceof File)||!file.size)return bad('Chưa chọn tệp.');
    const meta=await uploadR2(file,env,`classes/${id}/materials`,u.user_id,'class');
    const f=await env.DB.prepare(`SELECT id FROM files WHERE r2_key=?`).bind(meta.key).first(); const mid=crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO materials(id,class_id,file_id,title,description,created_by,created_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(mid,id,f.id,str(form.get('title'))||file.name,str(form.get('description')),u.user_id).run(); return ok({id:mid});
  }

  const assignmentsMatch=path.match(/^\/api\/classes\/([^/]+)\/assignments$/);
  if(assignmentsMatch && method==='GET'){
    const u=await requireUser(request,env); const id=assignmentsMatch[1]; const rows=await env.DB.prepare(`SELECT a.*,(SELECT status FROM submissions s WHERE s.assignment_id=a.id AND s.user_id=?) my_status FROM assignments a WHERE a.class_id=? ORDER BY a.created_at DESC`).bind(u.user_id,id).all(); return ok({assignments:rows.results});
  }
  if(assignmentsMatch && method==='POST'){
    const u=await requireUser(request,env); const id=assignmentsMatch[1]; const m=await env.DB.prepare(`SELECT role FROM class_members WHERE class_id=? AND user_id=?`).bind(id,u.user_id).first(); if(!m||!['teacher','assistant'].includes(m.role))return bad('Không có quyền.',403);
    const b=await request.json(); const aid=crypto.randomUUID(); await env.DB.prepare(`INSERT INTO assignments(id,class_id,type,title,instructions,due_at,points,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(aid,id,b.type==='tnv_task'?'tnv_task':'assignment',str(b.title),str(b.instructions),b.due_at||null,Number(b.points||10),u.user_id).run(); return ok({id:aid});
  }

  const submitMatch=path.match(/^\/api\/assignments\/([^/]+)\/submit$/);
  if(submitMatch && method==='POST'){
    const u=await requireUser(request,env); const aid=submitMatch[1]; const form=await request.formData(); const file=form.get('file'); let fileId=null;
    if(file instanceof File && file.size){ const meta=await uploadR2(file,env,`submissions/${aid}`,u.user_id,'private'); fileId=(await env.DB.prepare(`SELECT id FROM files WHERE r2_key=?`).bind(meta.key).first()).id; }
    await env.DB.prepare(`INSERT INTO submissions(id,assignment_id,user_id,text_answer,file_id,status,submitted_at,updated_at) VALUES(?,?,?,?,?,'submitted',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(assignment_id,user_id) DO UPDATE SET text_answer=excluded.text_answer,file_id=COALESCE(excluded.file_id,submissions.file_id),status='submitted',submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(crypto.randomUUID(),aid,u.user_id,str(form.get('text')),fileId).run(); return ok();
  }

  const examsMatch=path.match(/^\/api\/classes\/([^/]+)\/exams$/);
  if(examsMatch && method==='GET'){
    const u=await requireUser(request,env); const id=examsMatch[1]; const rows=await env.DB.prepare(`SELECT e.*, (SELECT status FROM exam_attempts a WHERE a.exam_id=e.id AND a.user_id=? ORDER BY a.id DESC LIMIT 1) attempt_status FROM exams e WHERE e.class_id=? ORDER BY e.created_at DESC`).bind(u.user_id,id).all(); return ok({exams:rows.results});
  }
  if(examsMatch && method==='POST'){
    const u=await requireUser(request,env); const id=examsMatch[1]; const m=await env.DB.prepare(`SELECT role FROM class_members WHERE class_id=? AND user_id=?`).bind(id,u.user_id).first(); if(!m||!['teacher','assistant'].includes(m.role))return bad('Không có quyền.',403);
    const b=await request.json(); const eid=crypto.randomUUID(); await env.DB.prepare(`INSERT INTO exams(id,class_id,title,instructions,duration_minutes,strict_mode,question_json,status,created_by,created_at) VALUES(?,?,?,?,?,?,?,'published',?,CURRENT_TIMESTAMP)`).bind(eid,id,str(b.title),str(b.instructions),Math.max(1,Number(b.duration_minutes||30)),b.strict_mode?1:0,JSON.stringify(b.questions||[]),u.user_id).run(); return ok({id:eid});
  }

  const startExam=path.match(/^\/api\/exams\/([^/]+)\/start$/);
  if(startExam && method==='POST'){
    const u=await requireUser(request,env); const eid=startExam[1]; const e=await env.DB.prepare(`SELECT * FROM exams WHERE id=? AND status='published'`).bind(eid).first(); if(!e)return bad('Không tìm thấy bài kiểm tra.');
    const existing=await activeExam(u.user_id,env); if(existing)return bad('Bạn đang có một phiên kiểm tra khác đang hoạt động.',409,existing);
    const id=crypto.randomUUID(); await env.DB.prepare(`INSERT INTO exam_attempts(id,exam_id,user_id,status,started_at,answers_json,event_log_json) VALUES(?,?,?,'in_progress',CURRENT_TIMESTAMP,'{}','[]')`).bind(id,eid,u.user_id).run(); return ok({attempt_id:id,exam:{id:e.id,title:e.title,duration_minutes:e.duration_minutes,strict_mode:e.strict_mode,questions:JSON.parse(e.question_json||'[]')}});
  }

  const saveExam=path.match(/^\/api\/exam-attempts\/([^/]+)\/save$/);
  if(saveExam && method==='POST'){
    const u=await requireUser(request,env); const b=await request.json(); const a=await env.DB.prepare(`SELECT * FROM exam_attempts WHERE id=? AND user_id=? AND status='in_progress'`).bind(saveExam[1],u.user_id).first(); if(!a)return bad('Phiên thi không còn hoạt động.',409);
    const events=Array.isArray(b.events)?b.events.slice(-500):JSON.parse(a.event_log_json||'[]');
    await env.DB.prepare(`UPDATE exam_attempts SET answers_json=?,event_log_json=?,last_saved_at=CURRENT_TIMESTAMP WHERE id=?`).bind(JSON.stringify(b.answers||{}),JSON.stringify(events),a.id).run(); return ok({saved_at:nowIso()});
  }

  const submitExam=path.match(/^\/api\/exam-attempts\/([^/]+)\/submit$/);
  if(submitExam && method==='POST'){
    const u=await requireUser(request,env); const b=await request.json(); const a=await env.DB.prepare(`SELECT a.*,e.question_json FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.id=? AND a.user_id=? AND a.status='in_progress'`).bind(submitExam[1],u.user_id).first(); if(!a)return bad('Phiên thi không còn hoạt động.',409);
    const qs=JSON.parse(a.question_json||'[]'), ans=b.answers||{}; let score=0,max=0;
    for(const q of qs){ const pts=Number(q.points||1); max+=pts; if(q.type==='mcq' && String(ans[q.id])===String(q.answer)) score+=pts; if(q.type==='truefalse' && String(ans[q.id])===String(q.answer)) score+=pts; }
    await env.DB.prepare(`UPDATE exam_attempts SET answers_json=?,event_log_json=?,score=?,max_score=?,status='submitted',submitted_at=CURRENT_TIMESTAMP WHERE id=?`).bind(JSON.stringify(ans),JSON.stringify(b.events||[]),score,max,a.id).run(); return ok({score,max_score:max});
  }

  if(path==='/api/quiz/generate' && method==='POST'){
    const u=await requireRole(request,env,['super_admin','school_admin','teacher','assistant']); const b=await request.json(); const text=str(b.text).replace(/\s+/g,' ');
    if(text.length<120)return bad('Nội dung quá ngắn để tạo quiz.');
    const sentences=text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>45&&s.length<260).slice(0,40);
    const count=Math.max(3,Math.min(20,Number(b.count||8))); const questions=[];
    for(let i=0;i<Math.min(count,sentences.length);i++){
      const s=sentences[i]; const words=s.match(/[A-Za-zÀ-ỹ0-9]{5,}/g)||[]; const target=words.sort((a,b)=>b.length-a.length)[0];
      if(!target)continue; const prompt=s.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),'_____');
      questions.push({id:crypto.randomUUID(),type:'fill',question:`Điền từ còn thiếu theo tài liệu: ${prompt}`,answer:target,points:1,source_excerpt:s});
    }
    return ok({draft:true,questions,notice:'Bản nháp được tạo từ nội dung tài liệu. Giáo viên cần kiểm tra trước khi xuất bản.'});
  }

  if(path==='/api/support/tickets' && method==='GET'){
    const u=await requireUser(request,env); const rows=await env.DB.prepare(`SELECT * FROM support_tickets WHERE requester_user_id=? ORDER BY created_at DESC`).bind(u.user_id).all(); return ok({tickets:rows.results});
  }
  if(path==='/api/support/tickets' && method==='POST'){
    const u=await requireUser(request,env); const b=await request.json(); const code=`SUP-${Date.now().toString(36).toUpperCase()}`; await env.DB.prepare(`INSERT INTO support_tickets(id,ticket_code,requester_user_id,category,subject,message,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'new',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(crypto.randomUUID(),code,u.user_id,str(b.category),str(b.subject),str(b.message)).run(); return ok({ticket_code:code});
  }

  if(path==='/api/admin/account-requests' && method==='GET'){
    await requireRole(request,env,['super_admin','account_admin']); const rows=await env.DB.prepare(`SELECT * FROM account_requests ORDER BY created_at DESC LIMIT 200`).all(); return ok({requests:rows.results});
  }

  const approve=path.match(/^\/api\/admin\/account-requests\/([^/]+)\/approve$/);
  if(approve && method==='POST'){
    const admin=await requireRole(request,env,['super_admin','account_admin']); const reqRow=await env.DB.prepare(`SELECT * FROM account_requests WHERE id=? AND status='pending'`).bind(approve[1]).first(); if(!reqRow)return bad('Yêu cầu không tồn tại hoặc đã xử lý.');
    if(await env.DB.prepare(`SELECT 1 ok FROM users WHERE lower(email)=lower(?)`).bind(reqRow.email).first())return bad('Email này đã có tài khoản.',409);
    const seq=await env.DB.prepare(`UPDATE counters SET value=value+1 WHERE key='sfn_user' AND value < ? RETURNING value`).bind(MAX_ACCOUNTS).first();
    if(!seq) return bad(`Hệ thống đã đạt giới hạn ${MAX_ACCOUNTS.toLocaleString('vi-VN')} tài khoản cho giai đoạn khởi tạo.`,409);
    const sfnNo=Number(seq.value); const userId=crypto.randomUUID(); const activation=randomToken(24); const expires=new Date(Date.now()+7*86400000).toISOString();
    const data=JSON.parse(reqRow.data_json||'{}');
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO users(id,sfn_no,sfn_id,full_name,email,phone,role,status,avatar_key,profile_json,password_hash,password_salt,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending_activation',?,?, '', '',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(userId,sfnNo,idCode(sfnNo),reqRow.full_name,reqRow.email,reqRow.phone,data.requested_access==='teacher'?'teacher':'student',reqRow.portrait_key,JSON.stringify(data)),
      env.DB.prepare(`INSERT INTO activation_tokens(token,user_id,expires_at,created_at) VALUES(?,?,?,CURRENT_TIMESTAMP)`).bind(activation,userId,expires),
      env.DB.prepare(`UPDATE account_requests SET status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,approved_user_id=? WHERE id=?`).bind(admin.user_id,userId,reqRow.id)
    ]);
    const activationUrl=`${env.APP_URL}/#activate/${activation}`;
    const mail=await sendMail(env,reqRow.email,`[SLC] Kích hoạt tài khoản ${idCode(sfnNo)}`,`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px"><h2>Sky First Network · SLC</h2><p>Xin chào <b>${reqRow.full_name}</b>, yêu cầu tài khoản của bạn đã được duyệt.</p><p>SFN ID: <b>${idCode(sfnNo)}</b></p><p><a href="${activationUrl}" style="display:inline-block;padding:12px 18px;background:#a21caf;color:white;text-decoration:none;border-radius:10px">Kích hoạt tài khoản</a></p><p>Nếu cần hỗ trợ: ${env.SUPPORT_EMAIL||'support@skyfirst.io.vn'}</p></div>`);
    return ok({sfn_id:idCode(sfnNo),activation_token:activation,activation_url:activationUrl,activation_email_sent:mail.sent,limit:MAX_ACCOUNTS});
  }

  if(path==='/api/admin/stats' && method==='GET'){
    await requireRole(request,env,['super_admin','school_admin','account_admin']);
    const [users,classes,requests,tickets]=await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) n FROM users`).first(),env.DB.prepare(`SELECT COUNT(*) n FROM classes WHERE status='active'`).first(),env.DB.prepare(`SELECT COUNT(*) n FROM account_requests WHERE status='pending'`).first(),env.DB.prepare(`SELECT COUNT(*) n FROM support_tickets WHERE status!='resolved'`).first()
    ]); return ok({users:users.n,account_limit:MAX_ACCOUNTS,classes:classes.n,pending_requests:requests.n,open_tickets:tickets.n});
  }

  const fileMatch=path.match(/^\/api\/files\/([^/]+)$/);
  if(fileMatch && method==='GET'){
    const u=await requireUser(request,env); const f=await env.DB.prepare(`SELECT * FROM files WHERE id=?`).bind(fileMatch[1]).first(); if(!f)return bad('Không tìm thấy tệp.',404);
    if(f.visibility==='private' && f.owner_user_id!==u.user_id && !['super_admin','school_admin'].includes(u.role)) return bad('Không có quyền.',403);
    if(f.visibility==='class' && !['super_admin','school_admin'].includes(u.role)){ const allowed=await env.DB.prepare(`SELECT 1 ok FROM materials m JOIN class_members cm ON cm.class_id=m.class_id WHERE m.file_id=? AND cm.user_id=? AND cm.status='active' LIMIT 1`).bind(f.id,u.user_id).first(); if(!allowed) return bad('Không có quyền.',403); }
    const obj=await env.FILES.get(f.r2_key); if(!obj)return bad('Tệp không còn trong kho.',404);
    const headers=new Headers(); obj.writeHttpMetadata(headers); headers.set('content-disposition',`inline; filename*=UTF-8''${encodeURIComponent(f.name)}`); return new Response(obj.body,{headers});
  }

  const wsMatch=path.match(/^\/api\/live\/([^/]+)\/ws$/);
  if(wsMatch){
    const id=env.LIVE_ROOM.idFromName(wsMatch[1]); return env.LIVE_ROOM.get(id).fetch(request);
  }

  return bad('API không tồn tại.',404);
}

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);
    try {
      if(url.pathname.startsWith('/api/')){
        const session=await getSession(request,env);
        if(session && !url.pathname.startsWith('/api/exam-attempts/') && !['/api/auth/me','/api/auth/logout'].includes(url.pathname)){
          const exam=await activeExam(session.user_id,env);
          const allowed=url.pathname.startsWith('/api/exams/') || url.pathname.startsWith('/api/quiz/')===false && url.pathname==='/api/health';
          if(exam && !url.pathname.startsWith('/api/exam-attempts/') && !url.pathname.startsWith('/api/exams/') && url.pathname!='/api/auth/me' && url.pathname!='/api/auth/logout') return bad('Tài khoản đang ở Chế độ kiểm tra. Hãy hoàn thành hoặc nộp bài trước khi truy cập chức năng khác.',423,exam);
        }
        return await routeApi(request,env,ctx,url);
      }
      return env.ASSETS.fetch(request);
    } catch(e){
      if(e?.message==='AUTH')return bad('Vui lòng đăng nhập tài khoản SFN.',401);
      if(e?.message==='FORBIDDEN')return bad('Bạn không có quyền thực hiện thao tác này.',403);
      console.error(e); return bad(e?.message||'Lỗi hệ thống.',e?.status||500);
    }
  }
};
