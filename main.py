import sqlite3
import uuid
from fastapi import FastAPI, WebSocket, HTTPException, Depends, status, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import List, Dict
from pydantic import BaseModel
import json
import os

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class User(BaseModel):
    username: str
    email: str
    mobile: str | None = None
    date_of_birth: str | None = None
    password: str | None = None

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Message(BaseModel):
    content: str
    timestamp: str
    sender_id: int
    receiver_id: int

def init_db():
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            mobile TEXT,
            date_of_birth TEXT,
            hashed_password TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()

init_db()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message)

manager = ConnectionManager()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    print(f"get_current_user called with token: {token}")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"Token payload: {payload}")
        user_id: str = payload.get("sub")
        if user_id is None:
            print("No user_id in token payload")
            raise credentials_exception
    except JWTError as e:
        print(f"JWT Error: {e}")
        raise credentials_exception
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    if user is None:
        print("User not found in database")
        raise credentials_exception
    print(f"User found: {user}")
    return {"id": user[0], "username": user[1], "email": user[2]}

@app.get("/", response_class=HTMLResponse)
async def get_signin():
    with open("signin.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/signup", response_class=HTMLResponse)
async def get_signup():
    with open("signup.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/chat", response_class=HTMLResponse)
async def get_chat(request: Request, current_user: dict = Depends(get_current_user)):
    print(f"Request headers for /chat: {request.headers}")
    print(f"Accessing /chat for user: {current_user}")
    with open("chat.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/users/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    print(f"Accessing /users/me for user: {current_user}")
    return current_user

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    print(f"Login attempt for username: {form_data.username}")
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, hashed_password FROM users WHERE username = ?", (form_data.username,))
    user = cursor.fetchone()
    conn.close()
    
    if not user or not verify_password(form_data.password, user[2]):
        print("Invalid username or password")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user[0])})
    print(f"Token generated for user {user[1]}: {access_token}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/signup")
async def signup(user: User):
    print(f"Signup attempt for username: {user.username}, email: {user.email}")
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        hashed_password = get_password_hash(user.password)
        cursor.execute(
            "INSERT INTO users (username, email, mobile, date_of_birth, hashed_password) VALUES (?, ?, ?, ?, ?)",
            (user.username, user.email, user.mobile, user.date_of_birth, hashed_password)
        )
        conn.commit()
        print("User created successfully")
        return {"message": "User created successfully"}
    except sqlite3.IntegrityError:
        conn.close()
        print("Username or email already exists")
        raise HTTPException(status_code=400, detail="Username or email already exists")
    finally:
        conn.close()

@app.get("/users/search")
async def search_users(query: str, current_user: dict = Depends(get_current_user)):
    print(f"Searching users with query: {query}")
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 10",
        (f"%{query}%", current_user["id"])
    )
    users = [{"id": user[0], "username": user[1]} for user in cursor.fetchall()]
    conn.close()
    print(f"Search results: {users}")
    return users

@app.get("/messages/{receiver_id}")
async def get_messages(receiver_id: int, current_user: dict = Depends(get_current_user)):
    print(f"Fetching messages between user {current_user['id']} and receiver {receiver_id}")
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT m.content, m.timestamp, m.sender_id, u.username
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.timestamp
        """,
        (current_user["id"], receiver_id, receiver_id, current_user["id"])
    )
    messages = [
        {
            "content": row[0],
            "timestamp": row[1],
            "sender_id": row[2],
            "username": row[3]
        }
        for row in cursor.fetchall()]
    conn.close()
    print(f"Messages fetched: {len(messages)}")
    return messages

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    print(f"WebSocket connection attempt for user_id: {user_id}")
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            print(f"Received message from user {user_id}: {message}")
            conn = sqlite3.connect("chat.db")
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO messages (sender_id, receiver_id, content, timestamp) VALUES (?, ?, ?, ?)",
                (
                    user_id,
                    message["receiver_id"],
                    message["content"],
                    datetime.utcnow().isoformat()
                )
            )
            conn.commit()
            conn.close()
            
            message_data = {
                "content": message["content"],
                "timestamp": datetime.utcnow().isoformat(),
                "sender_id": user_id,
                "receiver_id": message["receiver_id"],
                "username": (await get_current_user_info({"id": user_id}))["username"]
            }
            print(f"Sending message to users {user_id} and {message['receiver_id']}: {message_data}")
            await manager.send_personal_message(message_data, user_id)
            await manager.send_personal_message(message_data, message["receiver_id"])
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(user_id)
        print(f"WebSocket disconnected for user_id: {user_id}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)