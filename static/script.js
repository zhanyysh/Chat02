console.log('script.js загружен');

// Глобальная функция для отображения flash-сообщений
function showFlashMessage(message, type) {
    console.log(`Показываю flash-сообщение: ${message} (${type})`);
    const flashMessages = document.getElementById('flash-messages');
    if (flashMessages) {
        const div = document.createElement('div');
        div.className = `flash-${type}`;
        div.textContent = message;
        flashMessages.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    } else {
        console.warn('Контейнер flash-сообщений не найден, сообщение не отображено:', message);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Событие DOMContentLoaded сработало');
    const token = localStorage.getItem('token');
    console.log('Проверка токена:', token);

    // Проверка доступа к /chat
    if (window.location.pathname === '/chat') {
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
        try {
            console.log('Запрос к /chat с токеном:', token);
            const response = await fetch('/chat?token=' + encodeURIComponent(token), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                console.error('Не удалось получить доступ к /chat:', response.status, await response.text());
                localStorage.removeItem('token');
                window.location.href = '/';
                return;
            }
            console.log('Доступ к /chat подтвержден');
            initChat();
        } catch (error) {
            console.error('Ошибка проверки доступа к /chat:', error);
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
    }

    // Проверка доступа к /my-profile
    if (window.location.pathname === '/my-profile') {
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
        try {
            console.log('Запрос к /my-profile с токеном:', token);
            const response = await fetch('/my-profile?token=' + encodeURIComponent(token), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                console.error('Не удалось получить доступ к /my-profile:', response.status, await response.text());
                localStorage.removeItem('token');
                window.location.href = '/';
                return;
            }
            console.log('Доступ к /my-profile подтвержден');
            loadProfile();
        } catch (error) {
            console.error('Ошибка проверки доступа к /my-profile:', error);
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
    }

    // Проверка доступа к /edit-profile
    if (window.location.pathname === '/edit-profile') {
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
        try {
            console.log('Запрос к /edit-profile с токеном:', token);
            const response = await fetch('/edit-profile?token=' + encodeURIComponent(token), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                console.error('Не удалось получить доступ к /edit-profile:', response.status, await response.text());
                localStorage.removeItem('token');
                window.location.href = '/';
                return;
            }
            console.log('Доступ к /edit-profile подтвержден');
            loadEditProfile();
        } catch (error) {
            console.error('Ошибка проверки доступа к /edit-profile:', error);
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
    }

    // Обработка формы входа
    const signinForm = document.getElementById('signin-form');
    if (signinForm) {
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Форма входа отправлена');
            const formData = new FormData(signinForm);
            try {
                console.log('Отправляю запрос на /token');
                const response = await fetch('/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(formData)
                });
                console.log('Получен ответ от /token:', response.status);
                const result = await response.json();
                console.log('Результат входа:', result);
                if (response.ok) {
                    localStorage.setItem('token', result.access_token);
                    console.log('Токен сохранен:', localStorage.getItem('token'));
                    console.log('Запрос к /chat после входа');
                    const chatResponse = await fetch('/chat', {
                        headers: { 'Authorization': `Bearer ${result.access_token}` }
                    });
                    console.log('Получен ответ от /chat:', chatResponse.status);
                    if (chatResponse.ok) {
                        console.log('Доступ к /chat получен, перенаправляю');
                        window.location.href = '/chat?token=' + encodeURIComponent(result.access_token);
                    } else {
                        console.error('Не удалось получить доступ к /chat:', chatResponse.status, await chatResponse.text());
                        showFlashMessage('Не удалось войти в чат, попробуйте снова', 'danger');
                    }
                } else {
                    console.error('Ошибка входа:', result.detail);
                    showFlashMessage(result.detail, 'danger');
                }
            } catch (error) {
                console.error('Ошибка входа:', error);
                showFlashMessage('Не удалось войти, попробуйте снова', 'danger');
            }
        });
    }

    // Обработка формы регистрации
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.removeEventListener('submit', handleSignupSubmit);
        signupForm.addEventListener('submit', handleSignupSubmit);
    }

    async function handleSignupSubmit(e) {
        e.preventDefault();
        console.log('Форма регистрации отправлена');
        const formData = new FormData(signupForm);
        const data = Object.fromEntries(formData);
        if (data.password !== data.confirm_password) {
            showFlashMessage('Пароли не совпадают', 'danger');
            return;
        }
        try {
            console.log('Отправляю запрос на /signup с данными:', data);
            const response = await fetch('/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            console.log('Получен ответ от /signup:', response.status);
            const result = await response.json();
            console.log('Результат регистрации:', result);
            if (response.ok) {
                showFlashMessage('Регистрация успешна! Перенаправляю на вход...', 'success');
                console.log('Планирую перенаправление на / через 2000 мс');
                setTimeout(() => {
                    console.log('Выполняю перенаправление на /');
                    window.location.assign('/');
                }, 2000);
            } else {
                showFlashMessage(result.detail, 'danger');
            }
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            showFlashMessage('Не удалось зарегистрироваться, попробуйте снова', 'danger');
        }
    }

    // Загрузка профиля
    function loadProfile() {
        console.log('Загружаю профиль');
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
        fetch('/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Не удалось загрузить данные пользователя: ${response.status}`);
            }
            return response.json();
        })
        .then(user => {
            console.log('Данные пользователя:', user);
            document.getElementById('profile-username').textContent = user.username || 'Не указано';
            document.getElementById('profile-username-display').textContent = '@' + (user.username || 'Не указано');
            document.getElementById('profile-mobile').textContent = user.mobile || 'Не указано';
            if (user.date_of_birth) {
                const dob = new Date(user.date_of_birth);
                const age = Math.floor((new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25));
                document.getElementById('profile-dob').textContent = `${user.date_of_birth} (${age} лет)`;
            } else {
                document.getElementById('profile-dob').textContent = 'Не указано';
            }
            if (user.avatar_url) {
                const avatarImg = document.getElementById('avatar-img');
                avatarImg.src = user.avatar_url;
                avatarImg.style.display = 'block';
                document.getElementById('avatar-svg').style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки профиля:', error);
            showFlashMessage('Не удалось загрузить профиль, попробуйте снова', 'danger');
            localStorage.removeItem('token');
            window.location.href = '/';
        });

        const closeBtn = document.getElementById('close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log('Нажата кнопка закрытия профиля');
                window.location.href = '/chat?token=' + encodeURIComponent(token);
            });
        }

        const editBtn = document.getElementById('edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                console.log('Нажата кнопка редактирования профиля');
                window.location.href = '/edit-profile?token=' + encodeURIComponent(token);
            });
        }
    }

    // Загрузка страницы редактирования профиля
    function loadEditProfile() {
        console.log('Загружаю редактирование профиля');
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }

        fetch('/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Не удалось загрузить данные пользователя: ${response.status}`);
            }
            return response.json();
        })
        .then(user => {
            console.log('Данные пользователя:', user);
            document.getElementById('username').value = user.username || '';
            document.getElementById('mobile').value = user.mobile || '';
            document.getElementById('date_of_birth').value = user.date_of_birth || '';
            if (user.avatar_url) {
                const avatarImg = document.getElementById('avatar-img');
                avatarImg.src = user.avatar_url;
                avatarImg.style.display = 'block';
                document.getElementById('avatar-svg').style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки данных профиля:', error);
            showFlashMessage('Не удалось загрузить данные профиля, попробуйте снова', 'danger');
            localStorage.removeItem('token');
            window.location.href = '/';
        });

        const avatarUpload = document.getElementById('avatar-upload');
        const changeAvatarBtn = document.getElementById('change-avatar-btn');
        const avatarImg = document.getElementById('avatar-img');
        const avatarSvg = document.getElementById('avatar-svg');

        if (changeAvatarBtn && avatarUpload) {
            changeAvatarBtn.addEventListener('click', () => {
                avatarUpload.click();
            });

            avatarUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        avatarImg.src = event.target.result;
                        avatarImg.style.display = 'block';
                        avatarSvg.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        const editProfileForm = document.getElementById('edit-profile-form');
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Форма редактирования профиля отправлена');
                const formData = new FormData(editProfileForm);
                if (avatarUpload.files[0]) {
                    formData.append('avatar', avatarUpload.files[0]);
                }

                try {
                    console.log('Отправляю PUT-запрос на /users/me');
                    const response = await fetch('/users/me', {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });
                    console.log('Получен ответ от PUT /users/me:', response.status);
                    const result = await response.json();
                    if (response.ok) {
                        showFlashMessage('Профиль успешно обновлен', 'success');
                        setTimeout(() => {
                            window.location.href = '/my-profile?token=' + encodeURIComponent(token);
                        }, 2000);
                    } else {
                        console.error('Ошибка обновления:', result.detail);
                        showFlashMessage(result.detail, 'danger');
                    }
                } catch (error) {
                    console.error('Ошибка обновления:', error);
                    showFlashMessage('Не удалось обновить профиль, попробуйте снова', 'danger');
                }
            });
        }

        const backBtn = document.getElementById('back-btn');
        const closeBtn = document.getElementById('close-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                console.log('Нажата кнопка возврата к профилю');
                window.location.href = '/my-profile?token=' + encodeURIComponent(token);
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log('Нажата кнопка закрытия редактирования профиля');
                window.location.href = '/my-profile?token=' + encodeURIComponent(token);
            });
        }
    }

    // Инициализация чата
    function initChat() {
        console.log('Инициализация чата');
        let currentChatUserId = null;
        let currentUserId = null;
        let ws = null;
        let hasMarkedAsRead = false; // Флаг для отслеживания, были ли сообщения помечены как прочитанные
        let hasInteracted = false; // Флаг для отслеживания взаимодействия пользователя с чатом

        const chatForm = document.getElementById('chat-form');
        const messageInput = document.getElementById('message-input');
        const chatMessages = document.getElementById('chat-messages');
        const chatList = document.getElementById('chat-list');
        const searchInput = document.getElementById('search-user-input');
        const searchResults = document.getElementById('search-results');
        const logoutBtn = document.getElementById('logout-btn');
        const profileBtn = document.getElementById('profile-btn');
        const menuIcon = document.querySelector('.menu-icon');
        const menuDrawer = document.querySelector('.menu-drawer');

        if (menuIcon && menuDrawer) {
            menuIcon.addEventListener('click', () => {
                console.log('Нажата иконка меню');
                menuDrawer.classList.toggle('active');
            });
            document.addEventListener('click', (e) => {
                if (!menuIcon.contains(e.target) && !menuDrawer.contains(e.target)) {
                    menuDrawer.classList.remove('active');
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                console.log('Нажата кнопка выхода');
                localStorage.removeItem('token');
                window.location.href = '/';
            });
        }

        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                console.log('Нажата кнопка профиля');
                menuDrawer.classList.remove('active');
                window.location.href = '/my-profile?token=' + encodeURIComponent(token);
            });
        }

        // Загрузка недавних чатов
        async function loadRecentChats() {
            console.log('Загружаю недавние чаты');
            try {
                const response = await fetch('/messages/recent', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Не удалось загрузить недавние чаты: ${response.status} (${errorText})`);
                }
                const recentChats = await response.json();
                console.log('Недавние чаты:', recentChats);
                chatList.innerHTML = '';
                recentChats.forEach(chat => {
                    addChatToList(chat.user_id, chat.username, chat.unread_count);
                });
            } catch (error) {
                console.error('Ошибка загрузки недавних чатов:', error);
                showFlashMessage(`Не удалось загрузить недавние чаты: ${error.message}`, 'danger');
            }
        }

        // Добавление пользователя в список чатов с счётчиком
        async function addChatToList(userId, username, unreadCount) {
            const existingChat = document.querySelector(`.group-item[data-user-id="${userId}"]`);
            if (!existingChat) {
                const chatItem = document.createElement('div');
                chatItem.className = 'group-item';
                chatItem.dataset.userId = userId;
                chatItem.dataset.chatType = 'private';
                chatItem.innerHTML = `
                    <span class="group-name">${username}</span>
                    ${unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : ''}
                `;
                chatItem.addEventListener('click', async () => {
                    // Перед переключением чата помечаем сообщения текущего чата как прочитанные
                    if (currentChatUserId) {
                        await markMessagesAsRead(currentChatUserId);
                    }

                    // Удаляем существующий разделитель перед переключением чата
                    const existingDivider = document.querySelector('.unread-divider');
                    if (existingDivider) {
                        existingDivider.remove();
                    }

                    currentChatUserId = parseInt(userId);
                    document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
                    chatItem.classList.add('active');
                    document.getElementById('chat-title').textContent = username;
                    hasMarkedAsRead = false; // Сбрасываем флаг при открытии нового чата
                    hasInteracted = false; // Сбрасываем флаг взаимодействия
                    loadMessages(currentChatUserId);
                    updateUnreadCount(userId, 0);
                });
                chatList.appendChild(chatItem);
            } else {
                updateUnreadCount(userId, unreadCount);
            }
        }

        // Обновление счётчика непрочитанных сообщений
        function updateUnreadCount(userId, unreadCount) {
            const chatItem = document.querySelector(`.group-item[data-user-id="${userId}"]`);
            if (chatItem) {
                const existingCounter = chatItem.querySelector('.unread-count');
                if (unreadCount > 0) {
                    if (existingCounter) {
                        existingCounter.textContent = unreadCount;
                    } else {
                        const counter = document.createElement('span');
                        counter.className = 'unread-count';
                        counter.textContent = unreadCount;
                        chatItem.appendChild(counter);
                    }
                } else if (existingCounter) {
                    existingCounter.remove();
                }
            }
        }

        // Пометка сообщений как прочитанных
        async function markMessagesAsRead(receiverId) {
            if (hasMarkedAsRead) return Promise.resolve(); // Если уже помечено, возвращаем разрешенный промис
            try {
                const response = await fetch(`/messages/${receiverId}/mark-read`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Не удалось пометить сообщения как прочитанные: ${response.status} (${errorText})`);
                }
                console.log('Сообщения помечены как прочитанные');
                hasMarkedAsRead = true;
                // Перезагружаем сообщения, чтобы обновить их статус
                await loadMessages(receiverId);
            } catch (error) {
                console.error('Ошибка при пометке сообщений как прочитанных:', error);
                throw error; // Пробрасываем ошибку, чтобы await в addChatToList мог её обработать
            }
        }

        // Обновление разделителя непрочитанных сообщений
        function updateUnreadDivider() {
            const messages = document.querySelectorAll('.chat-message');
            const existingDivider = document.querySelector('.unread-divider');
            let firstUnreadMessage = null;
            let foundUnread = false;

            // Находим первое непрочитанное сообщение
            messages.forEach(message => {
                const isOwnMessage = message.classList.contains('own-message');
                const isRead = message.dataset.read === 'true';
                if (!isOwnMessage && !isRead && !foundUnread) {
                    firstUnreadMessage = message;
                    foundUnread = true;
                }
            });

            // Если есть непрочитанные сообщения и разделителя нет, добавляем его
            if (foundUnread && !existingDivider) {
                const divider = document.createElement('div');
                divider.className = 'unread-divider';
                divider.textContent = 'Непрочитанные сообщения';
                chatMessages.insertBefore(divider, firstUnreadMessage);
            } else if (!foundUnread && existingDivider) {
                existingDivider.remove();
            }
            console.log('Найдено непрочитанных сообщений:', document.querySelectorAll('.chat-message:not(.own-message):not([data-read="true"])').length);

            // Проверяем, виден ли разделитель или первое непрочитанное сообщение
            if (firstUnreadMessage && !hasMarkedAsRead && hasInteracted) {
                const divider = document.querySelector('.unread-divider');
                const dividerRect = divider ? divider.getBoundingClientRect() : null;
                const messageRect = firstUnreadMessage.getBoundingClientRect();
                const chatRect = chatMessages.getBoundingClientRect();
                if (
                    (divider && dividerRect.top >= chatRect.top && dividerRect.bottom <= chatRect.bottom) ||
                    (messageRect.top >= chatRect.top && messageRect.bottom <= chatRect.bottom)
                ) {
                    markMessagesAsRead(currentChatUserId);
                }
            }
        }

        // Инициализация WebSocket
        async function initWebSocket() {
            console.log('Инициализация WebSocket');
            const token = localStorage.getItem('token');
            console.log('Токен для WebSocket:', token);
            if (!token) {
                showFlashMessage('Токен не найден, пожалуйста, войдите снова', 'danger');
                window.location.href = '/';
                return;
            }

            try {
                console.log('Запрос к /users/me');
                const response = await fetch('/users/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error(`Не удалось загрузить данные пользователя: ${response.status}`);
                }
                const user = await response.json();
                console.log('Данные пользователя:', user);
                currentUserId = user.id;
                ws = new WebSocket(`ws://${window.location.host}/ws/${user.id}`);

                ws.onopen = () => {
                    console.log('WebSocket соединение установлено');
                };

                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    console.log('Получено сообщение:', message);
                    if (message.sender_id !== currentUserId && !message.is_read) {
                        const senderId = message.sender_id;
                        // Увеличиваем счётчик, если чат не активен
                        if (senderId !== currentChatUserId) {
                            const chatItem = document.querySelector(`.group-item[data-user-id="${senderId}"]`);
                            let currentCount = 0;
                            if (chatItem) {
                                const counter = chatItem.querySelector('.unread-count');
                                currentCount = counter ? parseInt(counter.textContent) : 0;
                            }
                            updateUnreadCount(senderId, currentCount + 1);
                        }
                        addChatToList(senderId, message.username, 0);
                    }
                    if (message.receiver_id === currentChatUserId || message.sender_id === currentChatUserId) {
                        displayMessage(message);
                        updateUnreadDivider();
                    }
                };

                ws.onclose = () => {
                    console.log('WebSocket соединение закрыто');
                    showFlashMessage('WebSocket отключен, обновите страницу', 'warning');
                };

                ws.onerror = (error) => {
                    console.error('Ошибка WebSocket:', error);
                    showFlashMessage('Ошибка WebSocket, попробуйте снова', 'danger');
                };
            } catch (error) {
                console.error('Ошибка инициализации WebSocket:', error);
                showFlashMessage('Не удалось инициализировать чат, попробуйте снова', 'danger');
            }
        }

        // Загрузка сообщений
        async function loadMessages(receiverId) {
            console.log('Загружаю сообщения для получателя:', receiverId);
            try {
                const response = await fetch(`/messages/${receiverId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Не удалось загрузить сообщения: ${response.status} (${errorText})`);
                }
                const messages = await response.json();
                console.log('Загружены сообщения:', messages);
                chatMessages.innerHTML = '';
                messages.forEach(displayMessage);

                // Прокручиваем к первому непрочитанному сообщению или разделителю
                const firstUnreadMessage = chatMessages.querySelector('.chat-message:not(.own-message):not([data-read="true"])');
                if (firstUnreadMessage) {
                    firstUnreadMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    chatMessages.scrollTop = chatMessages.scrollHeight; // Если нет непрочитанных, прокручиваем вниз
                }

                updateUnreadDivider();
            } catch (error) {
                console.error('Ошибка загрузки сообщений:', error);
                showFlashMessage('Не удалось загрузить сообщения', 'danger');
            }
        }

        // Отображение сообщения
        function displayMessage(message) {
            console.log(`Отображаю сообщение: sender_id=${message.sender_id}, currentUserId=${currentUserId}, isOwnMessage=${message.sender_id === currentUserId}`);
            const div = document.createElement('div');
            const isOwnMessage = message.sender_id === currentUserId;
            div.className = `chat-message ${isOwnMessage ? 'own-message' : ''}`;
            div.dataset.read = message.is_read ? 'true' : 'false';

            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'message-avatar';
            if (message.avatar_url) {
                const avatarImg = document.createElement('img');
                avatarImg.src = message.avatar_url;
                avatarImg.alt = message.username;
                avatarDiv.appendChild(avatarImg);
            } else {
                avatarDiv.innerHTML = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" rx="12" fill="#1E90FF"/>
                        <circle cx="12" cy="8" r="4" fill="white"/>
                        <path d="M12 14c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z" fill="white"/>
                    </svg>
                `;
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content-wrapper';
            const date = new Date(message.timestamp);
            const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            contentDiv.innerHTML = `
                <div class="username">${message.username}</div>
                <div class="content">
                    <div class="content-text">${message.content}</div>
                    <div class="timestamp">${timeString}</div>
                </div>
            `;

            if (isOwnMessage) {
                div.appendChild(contentDiv);
                div.appendChild(avatarDiv);
            } else {
                div.appendChild(avatarDiv);
                div.appendChild(contentDiv);
            }

            chatMessages.appendChild(div);
        }

        // Обработка формы чата
        if (chatForm) {
            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Форма чата отправлена');
                if (!currentChatUserId) {
                    showFlashMessage('Выберите чат', 'warning');
                    return;
                }
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    showFlashMessage('WebSocket не подключен, обновите страницу', 'danger');
                    return;
                }
                const content = messageInput.value.trim();
                if (content) {
                    console.log('Отправляю сообщение:', content);
                    ws.send(JSON.stringify({
                        content,
                        receiver_id: currentChatUserId
                    }));
                    messageInput.value = '';
                    hasInteracted = true; // Пользователь отправил сообщение
                    updateUnreadDivider();
                }
            });
        }

        // Поиск пользователей
        if (searchInput) {
            searchInput.addEventListener('input', async () => {
                console.log('Изменен ввод поиска:', searchInput.value);
                const query = searchInput.value.trim();
                if (query.length < 2) {
                    searchResults.classList.remove('active');
                    searchResults.innerHTML = '';
                    return;
                }
                try {
                    console.log('Отправляю запрос на /users/search с запросом:', query);
                    const response = await fetch(`/users/search?query=${encodeURIComponent(query)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        throw new Error(`Поиск не удался: ${response.status}`);
                    }
                    const users = await response.json();
                    console.log('Результаты поиска:', users);
                    searchResults.innerHTML = '';
                    if (users.length === 0) {
                        searchResults.innerHTML = '<div class="search-result-item">Пользователи не найдены</div>';
                    } else {
                        users.forEach(user => {
                            const item = document.createElement('div');
                            item.className = 'search-result-item';
                            item.innerHTML = `
                                <div class="avatar">${user.username[0].toUpperCase()}</div>
                                <div class="username">${user.username}</div>
                            `;
                            item.addEventListener('click', () => {
                                console.log('Выбран результат поиска:', user);
                                currentChatUserId = user.id;
                                document.getElementById('chat-title').textContent = user.username;
                                loadMessages(user.id);
                                searchResults.classList.remove('active');
                                searchInput.value = '';
                                addChatToList(user.id, user.username, 0);
                                document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
                                const chatItem = document.querySelector(`.group-item[data-user-id="${user.id}"]`);
                                if (chatItem) chatItem.classList.add('active');
                            });
                            searchResults.appendChild(item);
                        });
                    }
                    searchResults.classList.add('active');
                } catch (error) {
                    console.error('Ошибка поиска:', error);
                    showFlashMessage('Не удалось найти пользователей', 'danger');
                }
            });
        }

        // Добавляем обработчик прокрутки для проверки видимости непрочитанных сообщений
        chatMessages.addEventListener('scroll', () => {
            if (currentChatUserId) {
                hasInteracted = true; // Пользователь прокрутил чат
                updateUnreadDivider();
            }
        });

        // Добавляем обработчик клика для отслеживания взаимодействия
        chatMessages.addEventListener('click', () => {
            if (currentChatUserId) {
                hasInteracted = true; // Пользователь кликнул в чате
                updateUnreadDivider();
            }
        });

        console.log('Вызываю initWebSocket');
        initWebSocket();
        loadRecentChats();
    }
});