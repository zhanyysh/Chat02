import sqlite3
import uuid
from fastapi import FastAPI, WebSocket, HTTPException, Depends, status, Request, File, UploadFile, Form
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
import shutil
from typing import List

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Ensure avatars directory exists
AVATARS_DIR = "static/avatars"
if not os.path.exists(AVATARS_DIR):
    os.makedirs(AVATARS_DIR)

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

class User(BaseModel):
    username: str
    email: str
    mobile: str | None = None
    date_of_birth: str | None = None
    password: str | None = None
    avatar_url: str | None = None

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
    username: str
    avatar_url: str | None = None
    is_read: bool = False

class RecentChat(BaseModel):
    user_id: int
    username: str
    unread_count: int

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
            hashed_password TEXT NOT NULL,
            avatar_url TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
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

async def get_current_user(request: Request, token: str = Depends(oauth2_scheme)):
    print(f"get_current_user called with token: {token}")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token:
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
    else:
        token = request.query_params.get("token")
        if not token:
            print("No token provided in headers or query")
            raise credentials_exception
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            print(f"Token payload from query: {payload}")
            user_id: str = payload.get("sub")
            if user_id is None:
                print("No user_id in query token payload")
                raise credentials_exception
        except JWTError as e:
            print(f"JWT Error from query token: {e}")
            raise credentials_exception

    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, mobile, date_of_birth, avatar_url FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    if user is None:
        print("User not found in database")
        raise credentials_exception
    print(f"User found: {user}")
    return {"id": user[0], "username": user[1], "email": user[2], "mobile": user[3], "date_of_birth": user[4], "avatar_url": user[5]}

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

@app.get("/my-profile", response_class=HTMLResponse)
async def get_profile(request: Request, current_user: dict = Depends(get_current_user)):
    print(f"Request headers for /my-profile: {request.headers}")
    print(f"Accessing /my-profile for user: {current_user}")
    with open("my-profile.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/edit-profile", response_class=HTMLResponse)
async def get_edit_profile(request: Request, current_user: dict = Depends(get_current_user)):
    print(f"Request headers for /edit-profile: {request.headers}")
    print(f"Accessing /edit-profile for user: {current_user}")
    with open("edit-profile.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/users/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    print(f"Accessing /users/me for user: {current_user}")
    return current_user

@app.put("/users/me")
async def update_user(
    username: str = Form(...),
    mobile: str = Form(None),
    date_of_birth: str = Form(None),
    avatar: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    print(f"Updating user: {current_user['id']}, username: {username}, mobile: {mobile}, date_of_birth: {date_of_birth}")
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()

    # Validate inputs
    if not username or len(username) < 3:
        conn.close()
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long")
    
    if mobile and not mobile.replace(" ", "").replace("-", "").replace("+", "").isdigit():
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    if date_of_birth:
        try:
            datetime.strptime(date_of_birth, "%Y-%m-%d")
        except ValueError:
            conn.close()
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    # Check if username is taken
    cursor.execute("SELECT id FROM users WHERE username = ? AND id != ?", (username, current_user['id']))
    if cursor.fetchone():
        conn.close()
        print("Username already taken")
        raise HTTPException(status_code=400, detail="Username already taken")

    # Handle avatar upload
    avatar_url = current_user.get('avatar_url')
    if avatar:
        # Validate file type
        if avatar.content_type not in ["image/jpeg", "image/png"]:
            conn.close()
            raise HTTPException(status_code=400, detail="Only JPEG or PNG images are allowed")
        # Generate unique filename
        filename = f"{current_user['id']}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{avatar.filename}"
        file_path = os.path.join(AVATARS_DIR, filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(avatar.file, f)
        avatar_url = f"/static/avatars/{filename}"
        print(f"Avatar saved: {avatar_url}")

    # Update user data
    cursor.execute(
        "UPDATE users SET username = ?, mobile = ?, date_of_birth = ?, avatar_url = ? WHERE id = ?",
        (username, mobile, date_of_birth, avatar_url, current_user['id'])
    )
    conn.commit()
    conn.close()
    print(f"User {current_user['id']} updated successfully")
    return {"message": "Profile updated successfully"}

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
            "INSERT INTO users (username, email, mobile, date_of_birth, hashed_password, avatar_url) VALUES (?, ?, ?, ?, ?, ?)",
            (user.username, user.email, user.mobile, user.date_of_birth, hashed_password, None)
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

@app.get("/messages/recent", response_model=List[RecentChat])
async def get_recent_chats(current_user: dict = Depends(get_current_user)):
    print(f"Fetching recent chats for user {current_user['id']}")
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        print("Executing SQL query...")
        cursor.execute(
            """
            SELECT DISTINCT u.id, u.username,
                   (SELECT COUNT(*) FROM messages m2 
                    WHERE m2.receiver_id = ? AND m2.sender_id = u.id AND m2.is_read = 0) as unread_count
            FROM messages m
            JOIN users u ON (u.id = m.sender_id OR u.id = m.receiver_id)
            WHERE (m.sender_id = ? OR m.receiver_id = ?) AND u.id != ?
            ORDER BY m.timestamp DESC
            LIMIT 10
            """,
            (current_user["id"], current_user["id"], current_user["id"], current_user["id"])
        )
        rows = cursor.fetchall()
        print(f"Raw rows from database: {rows}")
        chats = [{"user_id": row[0], "username": row[1], "unread_count": row[2]} for row in rows]
        print(f"Processed chats: {chats}")
        conn.close()
        print(f"Recent chats fetched: {len(chats)}")
        return chats
    except Exception as e:
        print(f"Error in get_recent_chats: {str(e)}")
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to fetch recent chats: {str(e)}")

@app.get("/messages/{receiver_id}", response_model=List[Message])
async def get_messages(receiver_id: int, current_user: dict = Depends(get_current_user)):
    print(f"Fetching messages between user {current_user['id']} and receiver {receiver_id}")
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        # Удаляем автоматическую пометку сообщений как прочитанных
        cursor.execute(
            """
            SELECT m.content, m.timestamp, m.sender_id, m.receiver_id, u.username, u.avatar_url, m.is_read
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
                "receiver_id": row[3],
                "username": row[4],
                "avatar_url": row[5],
                "is_read": bool(row[6])
            }
            for row in cursor.fetchall()]
        conn.close()
        print(f"Messages fetched: {len(messages)}")
        return messages
    except Exception as e:
        print(f"Error in get_messages: {str(e)}")
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to fetch messages: {str(e)}")

@app.post("/messages/{receiver_id}/mark-read")
async def mark_messages_as_read(receiver_id: int, current_user: dict = Depends(get_current_user)):
    print(f"Marking messages as read between user {current_user['id']} and receiver {receiver_id}")
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE messages
            SET is_read = 1
            WHERE receiver_id = ? AND sender_id = ?
            """,
            (current_user["id"], receiver_id)
        )
        conn.commit()
        conn.close()
        print("Messages marked as read")
        return {"message": "Messages marked as read"}
    except Exception as e:
        print(f"Error in mark_messages_as_read: {str(e)}")
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to mark messages as read: {str(e)}")

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
                "INSERT INTO messages (sender_id, receiver_id, content, timestamp, is_read) VALUES (?, ?, ?, ?, ?)",
                (
                    user_id,
                    message["receiver_id"],
                    message["content"],
                    datetime.utcnow().isoformat(),
                    0
                )
            )
            conn.commit()
            cursor.execute("SELECT username, avatar_url FROM users WHERE id = ?", (user_id,))
            user_data = cursor.fetchone()
            username = user_data[0]
            avatar_url = user_data[1]
            conn.close()
            
            message_data = {
                "content": message["content"],
                "timestamp": datetime.utcnow().isoformat(),
                "sender_id": user_id,
                "receiver_id": message["receiver_id"],
                "username": username,
                "avatar_url": avatar_url,
                "is_read": False
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