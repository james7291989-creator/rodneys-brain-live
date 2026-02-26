from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Header, Request
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
import secrets
import string

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

# Stripe Settings
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Pricing Plans - Server-side defined (SECURITY: Never accept amounts from frontend)
PRICING_PLANS = {
    "beginner": {"name": "Beginner", "amount": 29.00, "type": "one_time", "features": ["10 AI generations", "Basic templates", "Email support"]},
    "pro": {"name": "Pro", "amount": 47.00, "type": "subscription", "features": ["Unlimited generations", "All templates", "Priority support", "Custom domains"]},
    "lifetime": {"name": "Lifetime", "amount": 297.00, "type": "one_time", "features": ["Lifetime access", "All features forever", "VIP support", "Early access"]},
    "bronze": {"name": "Bronze", "amount": 97.00, "type": "subscription", "features": ["Team access (5 seats)", "API access", "White-label", "Dedicated support"]},
}

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

# ==================== Payment Models ====================

class CheckoutRequest(BaseModel):
    plan_id: str
    email: EmailStr
    origin_url: str

class CheckoutStatusRequest(BaseModel):
    session_id: str

class PaymentTransactionResponse(BaseModel):
    id: str
    session_id: str
    plan_id: str
    plan_name: str
    amount: float
    email: str
    status: str
    payment_status: str
    created_at: str

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
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        created_at=user["created_at"]
    )

# ==================== Project Routes ====================

@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(project_data: ProjectCreate, user = Depends(get_current_user)):
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
    projects = await db.projects.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [ProjectResponse(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(**project)

@api_router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, update_data: ProjectUpdate, user = Depends(get_current_user)):
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
async def generate_code(request: GenerateRequest, user = Depends(get_current_user)):
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

# ==================== Stripe Payment Routes ====================

def generate_temp_password(length=12):
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

@api_router.get("/pricing/plans")
async def get_pricing_plans():
    """Get available pricing plans"""
    plans = []
    for plan_id, plan in PRICING_PLANS.items():
        plans.append({
            "id": plan_id,
            "name": plan["name"],
            "amount": plan["amount"],
            "type": plan["type"],
            "features": plan["features"]
        })
    return {"plans": plans}

@api_router.post("/checkout/session")
async def create_checkout_session(request: CheckoutRequest, http_request: Request):
    """Create a Stripe checkout session"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Validate plan exists (SECURITY: Amount comes from server, not frontend)
    if request.plan_id not in PRICING_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    plan = PRICING_PLANS[request.plan_id]
    amount = plan["amount"]
    
    # Build URLs from provided origin
    success_url = f"{request.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/pricing?cancelled=true"
    
    # Initialize Stripe checkout
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "plan_id": request.plan_id,
            "plan_name": plan["name"],
            "email": request.email,
            "source": "rodneysbrain"
        }
    )
    
    try:
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record BEFORE redirect
        transaction_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        transaction_doc = {
            "id": transaction_id,
            "session_id": session.session_id,
            "plan_id": request.plan_id,
            "plan_name": plan["name"],
            "amount": amount,
            "currency": "usd",
            "email": request.email,
            "status": "pending",
            "payment_status": "initiated",
            "created_at": now,
            "updated_at": now
        }
        
        await db.payment_transactions.insert_one(transaction_doc)
        logger.info(f"Created payment transaction: {transaction_id} for session: {session.session_id}")
        
        return {
            "url": session.url,
            "session_id": session.session_id
        }
        
    except Exception as e:
        logger.error(f"Checkout session error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, http_request: Request):
    """Get checkout session status and update transaction"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Find the transaction
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed, return cached status
    if transaction["payment_status"] in ["paid", "completed"]:
        return {
            "status": transaction["status"],
            "payment_status": transaction["payment_status"],
            "amount": transaction["amount"],
            "plan_name": transaction["plan_name"],
            "user_created": transaction.get("user_created", False)
        }
    
    # Initialize Stripe checkout
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        status_response = await stripe_checkout.get_checkout_status(session_id)
        
        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            "status": status_response.status,
            "payment_status": status_response.payment_status,
            "updated_at": now
        }
        
        # If payment successful and user not yet created
        if status_response.payment_status == "paid" and not transaction.get("user_created"):
            email = transaction["email"]
            
            # Check if user already exists
            existing_user = await db.users.find_one({"email": email})
            
            if not existing_user:
                # Create new user account
                temp_password = generate_temp_password()
                user_id = str(uuid.uuid4())
                
                user_doc = {
                    "id": user_id,
                    "email": email,
                    "name": email.split("@")[0],
                    "password_hash": hash_password(temp_password),
                    "plan": transaction["plan_id"],
                    "plan_name": transaction["plan_name"],
                    "created_at": now,
                    "payment_session_id": session_id
                }
                
                await db.users.insert_one(user_doc)
                update_data["user_created"] = True
                update_data["user_id"] = user_id
                update_data["temp_password"] = temp_password  # Store for confirmation page
                
                logger.info(f"Created user account for {email} after payment")
            else:
                # Update existing user's plan
                await db.users.update_one(
                    {"email": email},
                    {"$set": {
                        "plan": transaction["plan_id"],
                        "plan_name": transaction["plan_name"],
                        "updated_at": now
                    }}
                )
                update_data["user_created"] = True
                update_data["user_id"] = existing_user["id"]
                update_data["existing_user"] = True
                
                logger.info(f"Updated plan for existing user {email}")
        
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        # Get updated transaction
        updated_transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        
        return {
            "status": status_response.status,
            "payment_status": status_response.payment_status,
            "amount": updated_transaction["amount"],
            "plan_name": updated_transaction["plan_name"],
            "user_created": updated_transaction.get("user_created", False),
            "existing_user": updated_transaction.get("existing_user", False),
            "temp_password": updated_transaction.get("temp_password"),
            "email": updated_transaction["email"]
        }
        
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        logger.info(f"Webhook received: {webhook_response.event_type} for session {webhook_response.session_id}")
        
        if webhook_response.event_type == "checkout.session.completed":
            session_id = webhook_response.session_id
            
            # Find and update transaction
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            
            if transaction and transaction.get("payment_status") != "paid":
                now = datetime.now(timezone.utc).isoformat()
                
                # Update payment status
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "status": "complete",
                        "payment_status": "paid",
                        "updated_at": now
                    }}
                )
                
                # Create user if not exists
                email = transaction["email"]
                existing_user = await db.users.find_one({"email": email})
                
                if not existing_user:
                    temp_password = generate_temp_password()
                    user_id = str(uuid.uuid4())
                    
                    user_doc = {
                        "id": user_id,
                        "email": email,
                        "name": email.split("@")[0],
                        "password_hash": hash_password(temp_password),
                        "plan": transaction["plan_id"],
                        "plan_name": transaction["plan_name"],
                        "created_at": now,
                        "payment_session_id": session_id
                    }
                    
                    await db.users.insert_one(user_doc)
                    
                    await db.payment_transactions.update_one(
                        {"session_id": session_id},
                        {"$set": {
                            "user_created": True,
                            "user_id": user_id,
                            "temp_password": temp_password
                        }}
                    )
                    
                    logger.info(f"Webhook: Created user account for {email}")
                
                logger.info(f"Payment completed for session: {session_id}")
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

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