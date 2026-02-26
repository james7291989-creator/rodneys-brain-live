from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, uuid, bcrypt, jwt, json, asyncio
from datetime import datetime, timezone, timedelta

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'rodneysbrain')]
JWT_SECRET = os.environ.get('JWT_SECRET', 'rodneysbrain-secret-key-2025')

def hash_pw(pw): return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
def verify_pw(pw, h): return bcrypt.checkpw(pw.encode(), h.encode())

@app.get("/api/health")
async def health(): return {"status": "awake", "db": "ok" if mongo_url else "no_url"}

@app.post("/api/auth/register")
async def reg(data: dict):
    u_id = str(uuid.uuid4())
    await db.users.insert_one({"id": u_id, "email": data['email'], "pw": hash_pw(data['password'])})
    return {"token": jwt.encode({"u_id": u_id}, JWT_SECRET), "user": {"id": u_id}}

@app.post("/api/auth/login")
async def login(creds: dict):
    u = await db.users.find_one({"email": creds['email']})
    if not u or not verify_pw(creds['password'], u["pw"]): raise HTTPException(401)
    return {"token": jwt.encode({"u_id": u["id"]}, JWT_SECRET), "user": u}
