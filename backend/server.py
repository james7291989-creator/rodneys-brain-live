from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import asyncio
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'rodneysbrain-secret-key-2025')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="RodneysBrain API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== Models ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class ProjectCreate(BaseModel):
    name: str
    prompt: str

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    files: Optional[Dict[str, str]] = None

class ProjectResponse(BaseModel):
    id: str
    user_id: str
    name: str
    prompt: str
    status: str
    files: Dict[str, str]
    preview_html: str
    created_at: str
    updated_at: str

class GenerateRequest(BaseModel):
    project_id: str
    prompt: str

# ==================== Auth Helpers ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== Auth Routes ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id)
    return TokenResponse(
        token=token,
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name, created_at=now)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user = Depends(get_current_user)):
    user = await get_current_user(authorization)
    user = await get_current_user(authorization)
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        created_at=user["created_at"]
    )

# ==================== Project Routes ====================

@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(project_data: ProjectCreate, user = Depends(get_current_user)):
    user = await get_current_user(authorization)
    user = await get_current_user(authorization)
    
    project_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    project_doc = {
        "id": project_id,
        "user_id": user["id"],
        "name": project_data.name,
        "prompt": project_data.prompt,
        "status": "created",
        "files": {},
        "preview_html": "",
        "created_at": now,
        "updated_at": now
    }
    
    await db.projects.insert_one(project_doc)
    
    return ProjectResponse(**{k: v for k, v in project_doc.items() if k != "_id"})

@api_router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(user = Depends(get_current_user)):
    user = await get_current_user(authorization)
    user = await get_current_user(authorization)
    projects = await db.projects.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [ProjectResponse(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user = Depends(get_current_user)):
    user = await get_current_user(authorization)
    user = await get_current_user(authorization)
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(**project)

@api_router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, update_data: ProjectUpdate, user = Depends(get_current_user)):
    user = await get_current_user(authorization)
    user = await get_current_user(authorization)
    
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.projects.update_one({"id": project_id}, {"$set": update_dict})
    
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return ProjectResponse(**updated)

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user = Depends(get_current_user)):
    user = await get_current_user(authorization)
    result = await db.projects.delete_one({"id": project_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}

# ==================== Code Generation ====================

async def generate_code_stream(project_id: str, prompt: str, user_id: str):
    """Stream code generation using LLM"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        yield f"data: {json.dumps({'type': 'error', 'content': 'LLM API key not configured'})}\n\n"
        return
    
    # Update project status
    await db.projects.update_one(
        {"id": project_id, "user_id": user_id},
        {"$set": {"status": "generating", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    yield f"data: {json.dumps({'type': 'status', 'content': 'Starting code generation...'})}\n\n"
    await asyncio.sleep(0.1)
    
    system_prompt = """You are Famous AI, an expert web application generator. Generate clean, modern, and functional web applications.

When given a prompt, create a complete single-page web application with:
1. HTML structure with proper semantic elements
2. CSS styling using modern CSS (flexbox, grid, custom properties)
3. JavaScript for interactivity

Output your response as a JSON object with this exact structure:
{
  "files": {
    "index.html": "<!DOCTYPE html>...",
    "styles.css": "...",
    "script.js": "..."
  },
  "preview_html": "<!-- Complete standalone HTML with embedded CSS and JS that can be rendered in an iframe -->"
}

IMPORTANT: The preview_html must be a complete, self-contained HTML document with all CSS in <style> tags and all JS in <script> tags. It should work standalone when rendered in an iframe.

Make the design modern, visually appealing with:
- Clean typography
- Thoughtful color scheme
- Smooth animations and transitions
- Responsive layout
- Professional appearance"""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"project-{project_id}",
            system_message=system_prompt
        )
        chat.with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=f"Create a web application for: {prompt}")
        
        yield f"data: {json.dumps({'type': 'status', 'content': 'Generating application code...'})}\n\n"
        
        response = await chat.send_message(user_message)
        
        # Parse the response
        try:
            # Try to extract JSON from the response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                files = result.get("files", {})
                preview_html = result.get("preview_html", "")
            else:
                # Fallback: treat entire response as HTML
                files = {"index.html": response}
                preview_html = response
        except json.JSONDecodeError:
            files = {"index.html": response}
            preview_html = response
        
        # Stream the files
        for filename, content in files.items():
            yield f"data: {json.dumps({'type': 'file', 'filename': filename, 'content': content})}\n\n"
            await asyncio.sleep(0.05)
        
        # Update project with generated files
        await db.projects.update_one(
            {"id": project_id, "user_id": user_id},
            {"$set": {
                "status": "completed",
                "files": files,
                "preview_html": preview_html,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        yield f"data: {json.dumps({'type': 'preview', 'content': preview_html})}\n\n"
        yield f"data: {json.dumps({'type': 'complete', 'content': 'Code generation complete!'})}\n\n"
        
    except Exception as e:
        logger.error(f"Generation error: {str(e)}")
        await db.projects.update_one(
            {"id": project_id, "user_id": user_id},
            {"$set": {"status": "error", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

@api_router.post("/generate")
async def generate_code(request: GenerateRequest, authorization: str = None):
    user = await get_current_user(authorization)
    
    project = await db.projects.find_one({"id": request.project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return StreamingResponse(
        generate_code_stream(request.project_id, request.prompt, user["id"]),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# ==================== Preview Route ====================

@api_router.get("/preview/{project_id}")
async def get_preview(project_id: str):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"preview_html": project.get("preview_html", "")}

# ==================== Health Check ====================

@api_router.get("/")
async def root():
    return {"message": "RodneysBrain API - Famous AI App Builder"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "service": "rodneysbrain"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
