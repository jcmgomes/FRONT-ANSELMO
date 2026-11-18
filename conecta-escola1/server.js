const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'data', 'conecta-escola.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Estrutura inicial do banco de dados.
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS equipment (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL,
 location TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Funcionando', notes TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tickets (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL,
 category TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'Média', status TEXT NOT NULL DEFAULT 'Aberto',
 requester_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notices (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL,
 details TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const count = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
if (!count) {
  const hash = bcrypt.hashSync('Admin@123', 10);
  db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)')
    .run('Administrador', 'admin@conectaescola.com', hash, 'admin');
  db.prepare('INSERT INTO equipment (name,type,location,status,notes) VALUES (?,?,?,?,?)')
    .run('Computador da sala dos professores', 'Computador', 'Sala dos professores', 'Funcionando', 'Equipamento compartilhado');
  db.prepare('INSERT INTO equipment (name,type,location,status,notes) VALUES (?,?,?,?,?)')
    .run('Roteador principal', 'Rede Wi-Fi', 'Sala de informática', 'Funcionando', 'Ponto de acesso institucional');
  db.prepare('INSERT INTO notices (title,body) VALUES (?,?)')
    .run('Bem-vindo ao Conecta Escola', 'Use este espaço para consultar orientações, registrar solicitações e acompanhar os recursos digitais da escola.');
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'conecta-escola-chave-local-altere-em-producao',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 4 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function log(userId, action, details) {
  db.prepare('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)').run(userId || null, action, details);
}
function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Faça login para continuar.' });
  next();
}
function admin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem realizar esta operação.' });
  next();
}
function safeUser(user) { return { id:user.id, name:user.name, email:user.email, role:user.role, active:!!user.active }; }

app.post('/api/login', (req,res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({error:'Informe e-mail e senha.'});
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  if (!user || !user.active || !bcrypt.compareSync(password, user.password)) return res.status(401).json({error:'Credenciais inválidas ou usuário inativo.'});
  req.session.user = safeUser(user); log(user.id,'LOGIN','Acesso ao sistema');
  res.json({ user: req.session.user });
});
app.post('/api/logout', auth, (req,res) => { log(req.session.user.id,'LOGOUT','Sessão encerrada'); req.session.destroy(()=>res.json({ok:true})); });
app.get('/api/me', (req,res) => res.json({user:req.session.user || null}));
app.post('/api/recover', (req,res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({error:'Informe seu e-mail.'});
  // Demonstração acadêmica: não envia e-mail real nem revela se a conta existe.
  res.json({message:'Se o e-mail estiver cadastrado, solicite ao administrador a redefinição da senha.'});
});

app.get('/api/dashboard', auth, (req,res) => {
  const user = req.session.user;
  const tickets = user.role === 'admin' ? db.prepare('SELECT COUNT(*) n FROM tickets WHERE status != ?').get('Concluído').n : db.prepare('SELECT COUNT(*) n FROM tickets WHERE requester_id=? AND status != ?').get(user.id,'Concluído').n;
  res.json({ users: db.prepare('SELECT COUNT(*) n FROM users WHERE active=1').get().n,
    equipment: db.prepare('SELECT COUNT(*) n FROM equipment').get().n, openTickets:tickets,
    notices:db.prepare('SELECT * FROM notices ORDER BY id DESC LIMIT 5').all() });
});

// Usuários: administração exclusiva do perfil administrador.
app.get('/api/users', auth, admin, (req,res)=>res.json(db.prepare('SELECT id,name,email,role,active,created_at FROM users ORDER BY id DESC').all()));
app.post('/api/users', auth, admin, (req,res)=>{
  const {name,email,password,role='user'}=req.body;
  if(!name||!email||!password||password.length<8) return res.status(400).json({error:'Preencha nome, e-mail e senha com pelo menos 8 caracteres.'});
  try { const info=db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run(name.trim(),email.trim().toLowerCase(),bcrypt.hashSync(password,10),role==='admin'?'admin':'user'); log(req.session.user.id,'CREATE_USER',`Usuário ${email} criado`); res.status(201).json({id:info.lastInsertRowid}); }
  catch(e){res.status(400).json({error:e.code==='SQLITE_CONSTRAINT_UNIQUE'?'Este e-mail já está cadastrado.':'Não foi possível cadastrar o usuário.'});}
});
app.put('/api/users/:id', auth, admin, (req,res)=>{
  const id=Number(req.params.id), {name,email,role,active,password}=req.body;
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(id); if(!target)return res.status(404).json({error:'Usuário não encontrado.'});
  if(id===req.session.user.id && active===false) return res.status(400).json({error:'Você não pode desativar sua própria conta.'});
  try {
    db.prepare('UPDATE users SET name=?,email=?,role=?,active=? WHERE id=?').run(name||target.name,(email||target.email).toLowerCase(),role==='admin'?'admin':'user',active===false?0:1,id);
    if(password && password.length>=8) db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(password,10),id);
    log(req.session.user.id,'UPDATE_USER',`Usuário ${id} atualizado`); res.json({ok:true});
  } catch(e){res.status(400).json({error:'Não foi possível atualizar. Verifique se o e-mail já está em uso.'});}
});
app.delete('/api/users/:id', auth, admin, (req,res)=>{
  const id=Number(req.params.id); if(id===req.session.user.id)return res.status(400).json({error:'Não é permitido excluir a própria conta.'});
  const info=db.prepare('UPDATE users SET active=0 WHERE id=?').run(id); if(!info.changes)return res.status(404).json({error:'Usuário não encontrado.'});
  log(req.session.user.id,'DEACTIVATE_USER',`Usuário ${id} desativado`); res.json({ok:true});
});

// Equipamentos: usuários autenticados consultam; somente administrador altera.
app.get('/api/equipment', auth, (req,res)=>res.json(db.prepare('SELECT * FROM equipment ORDER BY id DESC').all()));
app.post('/api/equipment', auth, admin, (req,res)=>{
 const {name,type,location,status='Funcionando',notes=''}=req.body;
 if(!name||!type||!location)return res.status(400).json({error:'Preencha nome, tipo e local.'});
 const info=db.prepare('INSERT INTO equipment(name,type,location,status,notes) VALUES(?,?,?,?,?)').run(name,type,location,status,notes);
 log(req.session.user.id,'CREATE_EQUIPMENT',`Equipamento ${name} cadastrado`);res.status(201).json({id:info.lastInsertRowid});
});
app.put('/api/equipment/:id', auth, admin, (req,res)=>{
 const {name,type,location,status,notes=''}=req.body;
 const info=db.prepare('UPDATE equipment SET name=?,type=?,location=?,status=?,notes=? WHERE id=?').run(name,type,location,status,notes,Number(req.params.id));
 if(!info.changes)return res.status(404).json({error:'Equipamento não encontrado.'});log(req.session.user.id,'UPDATE_EQUIPMENT',`Equipamento ${req.params.id} atualizado`);res.json({ok:true});
});
app.delete('/api/equipment/:id', auth, admin, (req,res)=>{const info=db.prepare('DELETE FROM equipment WHERE id=?').run(Number(req.params.id));if(!info.changes)return res.status(404).json({error:'Equipamento não encontrado.'});log(req.session.user.id,'DELETE_EQUIPMENT',`Equipamento ${req.params.id} excluído`);res.json({ok:true});});

// Chamados: todos registram; usuário comum vê apenas os próprios; admin vê todos.
app.get('/api/tickets', auth, (req,res)=>{
 const sql=req.session.user.role==='admin' ? 'SELECT t.*,u.name requester FROM tickets t JOIN users u ON u.id=t.requester_id ORDER BY t.id DESC' : 'SELECT t.*,u.name requester FROM tickets t JOIN users u ON u.id=t.requester_id WHERE requester_id=? ORDER BY t.id DESC';
 res.json(req.session.user.role==='admin'?db.prepare(sql).all():db.prepare(sql).all(req.session.user.id));
});
app.post('/api/tickets', auth, (req,res)=>{
 const {title,description,category='Suporte técnico',priority='Média'}=req.body;
 if(!title||!description)return res.status(400).json({error:'Informe título e descrição.'});
 const info=db.prepare('INSERT INTO tickets(title,description,category,priority,requester_id) VALUES(?,?,?,?,?)').run(title,description,category,priority,req.session.user.id);
 log(req.session.user.id,'CREATE_TICKET',`Chamado ${info.lastInsertRowid} aberto`);res.status(201).json({id:info.lastInsertRowid});
});
app.patch('/api/tickets/:id', auth, admin, (req,res)=>{
 const status=['Aberto','Em andamento','Concluído'].includes(req.body.status)?req.body.status:null;
 if(!status)return res.status(400).json({error:'Status inválido.'});
 const info=db.prepare('UPDATE tickets SET status=? WHERE id=?').run(status,Number(req.params.id));if(!info.changes)return res.status(404).json({error:'Chamado não encontrado.'});
 log(req.session.user.id,'UPDATE_TICKET',`Chamado ${req.params.id}: ${status}`);res.json({ok:true});
});
app.get('/api/notices', auth, (req,res)=>res.json(db.prepare('SELECT * FROM notices ORDER BY id DESC').all()));
app.post('/api/notices', auth, admin, (req,res)=>{const {title,body}=req.body;if(!title||!body)return res.status(400).json({error:'Preencha título e comunicado.'});const info=db.prepare('INSERT INTO notices(title,body) VALUES(?,?)').run(title,body);log(req.session.user.id,'CREATE_NOTICE',`Comunicado ${info.lastInsertRowid} publicado`);res.status(201).json({id:info.lastInsertRowid});});
app.delete('/api/notices/:id', auth, admin, (req,res)=>{const info=db.prepare('DELETE FROM notices WHERE id=?').run(Number(req.params.id));if(!info.changes)return res.status(404).json({error:'Comunicado não encontrado.'});log(req.session.user.id,'DELETE_NOTICE',`Comunicado ${req.params.id} excluído`);res.json({ok:true});});
app.get('/api/logs', auth, admin, (req,res)=>res.json(db.prepare('SELECT a.*,u.name user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100').all()));

app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`Conecta Escola disponível em http://localhost:${port}`));
