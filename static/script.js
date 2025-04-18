console.log('script.js loaded');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded event fired');
    const token = localStorage.getItem('token');
    console.log('Initial token check:', token);

    // Проверяем доступ к /chat при загрузке
    if (window.location.pathname === '/chat') {
        if (!token) {
            console.log('No token, redirecting to /');
            window.location.href = '/';
            return;
        }
        try {
            console.log('Fetching /chat with token:', token);
            const response = await fetch('/chat', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                console.error('Failed to access /chat:', response.status, await response.text());
                localStorage.removeItem('token');
                window.location.href = '/';
                return;
            }
            console.log('Access to /chat confirmed');
            initChat();
        } catch (error) {
            console.error('Error checking /chat access:', error);
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
    }

    // Sign-in form
    const signinForm = document.getElementById('signin-form');
    if (signinForm) {
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Sign-in form submitted');
            const formData = new FormData(signinForm);
            try {
                console.log('Sending /token request');
                const response = await fetch('/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(formData)
                });
                console.log('Received /token response:', response.status);
                const result = await response.json();
                console.log('Login response:', result);
                if (response.ok) {
                    localStorage.setItem('token', result.access_token);
                    console.log('Token saved:', localStorage.getItem('token'));
                    // Проверяем доступ к /chat
                    console.log('Fetching /chat after login');
                    const chatResponse = await fetch('/chat', {
                        headers: { 'Authorization': `Bearer ${result.access_token}` }
                    });
                    console.log('Received /chat response:', chatResponse.status);
                    if (chatResponse.ok) {
                        console.log('Access to /chat granted, loading content');
                        const chatHtml = await chatResponse.text();
                        // Заменяем содержимое body вместо всего document
                        document.body.innerHTML = chatHtml;
                        // Повторно подключаем script.js, чтобы инициализировать чат
                        const script = document.createElement('script');
                        script.src = '/static/script.js';
                        document.body.appendChild(script);
                    } else {
                        console.error('Failed to access /chat:', chatResponse.status, await chatResponse.text());
                        showFlashMessage('Failed to access chat, please try again', 'danger');
                    }
                } else {
                    console.error('Login failed:', result.detail);
                    showFlashMessage(result.detail, 'danger');
                }
            } catch (error) {
                console.error('Login error:', error);
                showFlashMessage('Failed to sign in, please try again', 'danger');
            }
        });
    }

    // Sign-up form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(signupForm);
            const data = Object.fromEntries(formData);
            if (data.password !== data.confirm_password) {
                showFlashMessage('Passwords do not match', 'danger');
                return;
            }
            try {
                console.log('Sending /signup request');
                const response = await fetch('/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                console.log('Received /signup response:', response.status);
                const result = await response.json();
                console.log('Signup response:', result);
                if (response.ok) {
                    showFlashMessage('Registration successful! Please sign in.', 'success');
                    setTimeout(() => window.location.href = '/', 2000);
                } else {
                    showFlashMessage(result.detail, 'danger');
                }
            } catch (error) {
                console.error('Signup error:', error);
                showFlashMessage('Failed to sign up, please try again', 'danger');
            }
        });
    }

    // Chat functionality
    function initChat() {
        console.log('Initializing chat functionality');
        let currentChatUserId = null;
        let ws = null;

        const chatForm = document.getElementById('chat-form');
        const messageInput = document.getElementById('message-input');
        const chatMessages = document.getElementById('chat-messages');
        const chatList = document.getElementById('chat-list');
        const searchInput = document.getElementById('search-user-input');
        const searchResults = document.getElementById('search-results');
        const logoutBtn = document.getElementById('logout-btn');

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                console.log('Logout clicked');
                localStorage.removeItem('token');
                window.location.href = '/';
            });
        }

        async function initWebSocket() {
            console.log('initWebSocket called');
            const token = localStorage.getItem('token');
            console.log('Token for WebSocket:', token);
            if (!token) {
                showFlashMessage('No token found, please sign in again', 'danger');
                window.location.href = '/';
                return;
            }

            try {
                console.log('Fetching /users/me');
                const response = await fetch('/users/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch user info: ${response.status}`);
                }
                const user = await response.json();
                console.log('User info:', user);
                ws = new WebSocket(`ws://${window.location.host}/ws/${user.id}`);
                
                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    console.log('Received message:', message);
                    if (message.receiver_id === currentChatUserId || message.sender_id === currentChatUserId) {
                        displayMessage(message);
                    }
                    updateChatList(message);
                };

                ws.onclose = () => {
                    console.log('WebSocket connection closed');
                };
            } catch (error) {
                console.error('WebSocket initialization error:', error);
                showFlashMessage('Failed to initialize chat, please try again', 'danger');
            }
        }

        async function loadMessages(receiverId) {
            console.log('Loading messages for receiver:', receiverId);
            try {
                const response = await fetch(`/messages/${receiverId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error(`Failed to load messages: ${response.status}`);
                }
                const messages = await response.json();
                console.log('Loaded messages:', messages);
                chatMessages.innerHTML = '';
                messages.forEach(displayMessage);
            } catch (error) {
                console.error('Load messages error:', error);
                showFlashMessage('Failed to load messages', 'danger');
            }
        }

        function displayMessage(message) {
            const div = document.createElement('div');
            div.className = `chat-message ${message.sender_id === currentChatUserId ? 'own-message' : ''}`;
            div.innerHTML = `
                <div class="username">${message.username}</div>
                <div class="content">${message.content}</div>
                <div class="timestamp">${new Date(message.timestamp).toLocaleString()}</div>
            `;
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function updateChatList(message) {
            console.log('Updating chat list with message:', message);
            const existingChat = document.querySelector(`.group-item[data-user-id="${message.sender_id}"]`);
            if (existingChat) {
                chatList.prepend(existingChat);
            } else {
                const chatItem = document.createElement('div');
                chatItem.className = 'group-item';
                chatItem.dataset.userId = message.sender_id;
                chatItem.dataset.chatType = 'private';
                chatItem.innerHTML = `<span class="group-name">${message.username}</span>`;
                chatItem.addEventListener('click', () => {
                    currentChatUserId = parseInt(message.sender_id);
                    document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
                    chatItem.classList.add('active');
                    document.getElementById('chat-title').textContent = message.username;
                    loadMessages(currentChatUserId);
                });
                chatList.prepend(chatItem);
            }
        }

        if (chatForm) {
            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Chat form submitted');
                if (!currentChatUserId) {
                    showFlashMessage('Please select a chat', 'warning');
                    return;
                }
                const content = messageInput.value.trim();
                if (content) {
                    console.log('Sending message:', content);
                    ws.send(JSON.stringify({
                        content,
                        receiver_id: currentChatUserId
                    }));
                    messageInput.value = '';
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', async () => {
                console.log('Search input changed:', searchInput.value);
                const query = searchInput.value.trim();
                if (query.length < 2) {
                    searchResults.classList.remove('active');
                    return;
                }
                try {
                    const response = await fetch(`/users/search?query=${encodeURIComponent(query)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        throw new Error(`Search failed: ${response.status}`);
                    }
                    const users = await response.json();
                    console.log('Search results:', users);
                    searchResults.innerHTML = '';
                    users.forEach(user => {
                        const item = document.createElement('div');
                        item.className = 'search-result-item';
                        item.innerHTML = `
                            <div class="avatar">${user.username[0].toUpperCase()}</div>
                            <div class="username">${user.username}</div>
                        `;
                        item.addEventListener('click', () => {
                            console.log('Search result clicked:', user);
                            currentChatUserId = user.id;
                            document.getElementById('chat-title').textContent = user.username;
                            loadMessages(user.id);
                            searchResults.classList.remove('active');
                            searchInput.value = '';
                            const chatItem = document.createElement('div');
                            chatItem.className = 'group-item active';
                            chatItem.dataset.userId = user.id;
                            chatItem.dataset.chatType = 'private';
                            chatItem.innerHTML = `<span class="group-name">${user.username}</span>`;
                            chatItem.addEventListener('click', () => {
                                currentChatUserId = user.id;
                                document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
                                chatItem.classList.add('active');
                                document.getElementById('chat-title').textContent = user.username;
                                loadMessages(user.id);
                            });
                            chatList.prepend(chatItem);
                        });
                        searchResults.appendChild(item);
                    });
                    searchResults.classList.add('active');
                } catch (error) {
                    console.error('Search error:', error);
                    showFlashMessage('Failed to search users', 'danger');
                }
            });
        }

        function showFlashMessage(message, type) {
            console.log(`Showing flash message: ${message} (${type})`);
            const flashMessages = document.getElementById('flash-messages');
            if (flashMessages) {
                const div = document.createElement('div');
                div.className = `flash-${type}`;
                div.textContent = message;
                flashMessages.appendChild(div);
                setTimeout(() => div.remove(), 3000);
            }
        }

        // Инициализируем WebSocket для /chat
        console.log('Calling initWebSocket');
        initWebSocket();
    }

    // Инициализируем чат, если уже на /chat
    if (window.location.pathname === '/chat') {
        initChat();
    }
});