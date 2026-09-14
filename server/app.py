#!/usr/bin/env python3
import json, os, re, secrets, sqlite3, time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

DB_PATH = os.environ.get("ROOMIE_DB", "/var/lib/roomie/roomie.db")
SESSION_TTL = 86400

def seed_state(name):
    return {
        "name": name, "restocked": False, "paid": 0, "ruleAgreed": False,
        "house": {"name": "晚风公寓", "inviteCode": "ROOMIE88", "joinedCode": None},
        "tasks": [
            {"id":"kitchen","icon":"🫧","title":"厨房焕新计划","description":"擦灶台、清理水槽、拖一拖地面，大约 20 分钟。","kind":"recurring","mode":"rotate","proponent":name,"assignee":name,"due":"今天","period":"每周 · 成员轮班","points":10,"priority":"high","estimateMinutes":20,"status":"doing","active":True},
            {"id":"delivery","icon":"📦","title":"领取物业快递","description":"物业前台有一份公共区域收纳盒，请顺路带回家。","kind":"temporary","mode":"assign","proponent":"Nina","assignee":"陈默","due":"今天 18:00 前","period":"一次性 · 指定任务","points":5,"priority":"normal","estimateMinutes":10,"status":"doing","active":True},
            {"id":"bathroom","icon":"🛁","title":"卫生间清洁","description":"镜子、台面和地面都已经清爽啦。","kind":"recurring","mode":"rotate","proponent":"小宇","assignee":"Nina","due":"昨天","period":"每周 · 成员轮班","points":10,"priority":"normal","estimateMinutes":20,"status":"done","active":True},
            {"id":"fridge","icon":"🧊","title":"周日一起整理冰箱","description":"看看过期食物，也给下周的食材腾出一点空间。","kind":"recurring","mode":"claim","proponent":"陈默","assignee":None,"due":"本周日","period":"每周 · 公开认领","points":10,"priority":"low","estimateMinutes":15,"status":"claim","active":True},
            {"id":"lamp","icon":"💡","title":"更换客厅灯泡","description":"客厅落地灯忽明忽暗，需要一只 E27 暖光灯泡。","kind":"temporary","mode":"claim","proponent":name,"assignee":None,"due":"今天","period":"一次性 · 公开认领","points":5,"priority":"high","estimateMinutes":10,"status":"claim","active":True}
        ], "createdBills": [], "createdSupplies": [], "createdRules": [],
        "alpaca": {"yarnBalls": 4, "lifetimeYarnBalls": 4, "rewardModelVersion": 3},
        "charity": {"houseDonationCents": 0, "selectedCause": None, "receipts": []},
        "rewardedActionIds": []
    }

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, nickname TEXT NOT NULL, state TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)")
    return conn

class Handler(BaseHTTPRequestHandler):
    server_version = "RoomieAPI/1.0"
    def log_message(self, fmt, *args): print(fmt % args)
    def json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length) or b"{}")
    def send_json(self, payload, status=200, cookie=None):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if cookie: self.send_header("Set-Cookie", cookie)
        self.end_headers(); self.wfile.write(body)
    def token(self):
        cookie = SimpleCookie(self.headers.get("Cookie", "")); morsel = cookie.get("roomie_session")
        return morsel.value if morsel else None
    def load(self):
        token = self.token()
        if not token: return None, None
        with db() as conn:
            row = conn.execute("SELECT state, expires_at FROM sessions WHERE token=?", (token,)).fetchone()
        if not row or row[1] < int(time.time()): return token, None
        return token, json.loads(row[0])
    def save(self, token, state):
        with db() as conn: conn.execute("UPDATE sessions SET state=? WHERE token=?", (json.dumps(state, ensure_ascii=False), token))
    def require(self):
        token, state = self.load()
        if not state: self.send_json({"error":"请重新进入 Demo"}, 401); return None, None
        return token, state
    def reward(self, state, action_id):
        if action_id in state["rewardedActionIds"]: return False
        state["rewardedActionIds"].append(action_id); state["alpaca"]["yarnBalls"] += 1; state["alpaca"]["lifetimeYarnBalls"] += 1
        return True
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health": return self.send_json({"ok":True})
        if path == "/api/state":
            _, state = self.require()
            if state: self.send_json({"state":state})
            return
        self.send_json({"error":"not found"}, 404)
    def do_POST(self): self.mutate("POST")
    def do_PATCH(self): self.mutate("PATCH")
    def mutate(self, method):
        path = urlparse(self.path).path
        try: data = self.json_body()
        except Exception: return self.send_json({"error":"请求格式不正确"}, 400)
        if path == "/api/demo/login" and method == "POST":
            name = str(data.get("nickname", "")).strip()[:12]
            if not name: return self.send_json({"error":"请输入昵称"}, 400)
            token = secrets.token_urlsafe(32); now = int(time.time()); state = seed_state(name)
            with db() as conn:
                conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
                conn.execute("INSERT INTO sessions VALUES (?,?,?,?,?)", (token,name,json.dumps(state,ensure_ascii=False),now,now+SESSION_TTL))
            return self.send_json({"state":state}, cookie=f"roomie_session={token}; Path=/; Max-Age={SESSION_TTL}; HttpOnly; SameSite=Lax")
        token, state = self.require()
        if not state: return
        now_id = str(int(time.time()*1000))
        if path == "/api/bills" and method == "POST": state["createdBills"].insert(0,{"id":"bill-"+now_id,**data,"paid":False})
        elif path == "/api/tasks" and method == "POST": state["tasks"].insert(0,{"id":"task-"+now_id,**data})
        elif path == "/api/supplies" and method == "POST": state["createdSupplies"].insert(0,{"id":"supply-"+now_id,**data})
        elif path == "/api/rules" and method == "POST": state["createdRules"].insert(0,{"id":"rule-"+now_id,**data,"agreed":False})
        elif path == "/api/charity/donate" and method == "POST":
            if state["alpaca"]["yarnBalls"] < 5: return self.send_json({"error":"毛线球还没有集齐"},400)
            state["alpaca"]["yarnBalls"] -= 5; state["charity"]["houseDonationCents"] += 100; state["charity"]["selectedCause"] = data.get("cause")
            state["charity"]["receipts"].insert(0,{"id":"demo-"+now_id,"cause":data.get("cause"),"amountCents":100,"createdAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"demo":True})
        else:
            match = re.fullmatch(r"/api/(tasks|bills|supplies|rules)/([^/]+)(?:/(pay|agree))?", path)
            if not match: return self.send_json({"error":"not found"},404)
            kind, item_id, suffix = match.groups(); action = data.get("action") or suffix
            if kind == "tasks":
                item = next((x for x in state["tasks"] if x.get("id")==item_id),None)
                if not item: return self.send_json({"error":"任务不存在"},404)
                if action=="claim": item.update(status="doing",assignee=state["name"])
                elif action=="complete": item["status"]="done"; self.reward(state,"task:"+item_id)
                elif action=="pause": item["active"]=False
                elif action=="resume": item["active"]=True
                elif action=="abandon": item.update(status="claim",assignee=None)
            elif kind == "bills":
                created = next((x for x in state["createdBills"] if x.get("id")==item_id),None)
                if created: created["paid"] = True
                rewarded = self.reward(state,"bill:"+item_id)
                if rewarded and not created: state["paid"] = min(2,state["paid"]+1)
            elif kind == "supplies": state["restocked"]=True; self.reward(state,"supply:"+item_id)
            elif kind == "rules": state["ruleAgreed"]=True; self.reward(state,"rule:"+item_id)
        self.save(token,state); self.send_json({"state":state})

if __name__ == "__main__":
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with db(): pass
    ThreadingHTTPServer(("127.0.0.1",8787),Handler).serve_forever()
