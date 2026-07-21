document.getElementById('UploadUserID').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
        Swal.fire({
            icon: 'error',
            title: 'Invalid File',
            text: 'Please upload a valid .json file.'
        });
        this.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const userIDs = [];
            // Extract chat IDs
            if (data.chats && Array.isArray(data.chats)) {
                data.chats.forEach(chat => {
                    if (chat.id) userIDs.push(chat.id);
                });
            }
            // Extract user IDs
            if (data.users && Array.isArray(data.users)) {
                data.users.forEach(user => {
                    if (user.id) userIDs.push(user.id);
                });
            }
            // Update UserID textarea
            document.getElementById('UserID').value = userIDs.join('\n');
            document.getElementById('UserIDType').value = 'json';
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'JSON Parse Error',
                text: 'Invalid JSON structure. Please check the file format.'
            });
            document.getElementById('UploadUserID').value = '';
        }
    };
    reader.readAsText(file);
});

// Copy IDs to clipboard
function copyIDS(elementId) {
    const textarea = document.getElementById(elementId);
    textarea.select();
    document.execCommand('copy');
    Swal.fire({
        icon: 'success',
        title: 'Copied!',
        text: 'Content copied to clipboard.',
        timer: 1500
    });
}

// Telegram API request
async function sendMessageToTelegram(botToken, chatId, method, payload) {
    const url = `https://api.telegram.org/bot${botToken}/${method}`;
    try {
        const formData = new FormData();
        formData.append('chat_id', chatId);
        if (method === 'sendMessage') {
            formData.append('text', payload.text);
            if (payload.parse_mode) {
                formData.append('parse_mode', payload.parse_mode);
            }
        } else {
            // Handle file uploads for other methods
            const fileInput = document.getElementById(method.replace('send', '').toLowerCase());
            if (fileInput && fileInput.files[0]) {
                formData.append(method.replace('send', '').toLowerCase(), fileInput.files[0]);
            }
            if (payload.caption) {
                formData.append('caption', payload.caption);
            }
            if (payload.parse_mode) {
                formData.append('parse_mode', payload.parse_mode);
            }
        }
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        return data;
    } catch (error) {
        return { ok: false, error_code: 0, description: error.message };
    }
}

// Broadcast function
async function startBroadcast() {
    const botToken = document.getElementById('BotToken').value.trim();
    const userIDs = document.getElementById('UserID').value.trim().split('\n').filter(id => id.trim());
    const method = document.getElementById('Methods').value;
    const batchSize = parseInt(document.getElementById('batchSize').value) || 50;
    const interval = parseInt(document.getElementById('loop').value) || 1000;
    const schedule = document.getElementById('schedule').value;
    // Validation
    if (!botToken) {
        Swal.fire({
            icon: 'error',
            title: 'Missing Bot Token',
            text: 'Please enter a valid bot token.'
        });
        return;
    }
    if (!userIDs.length) {
        Swal.fire({
            icon: 'error',
            title: 'Missing User IDs',
            text: 'Please enter or upload user IDs.'
        });
        return;
    }
    if (method !== 'sendMessage') {
        const fileInput = document.getElementById(method.replace('send', '').toLowerCase());
        if (!fileInput || !fileInput.files[0]) {
            Swal.fire({
                icon: 'error',
                title: 'Missing File',
                text: `Please upload a file for ${method}.`
            });
            return;
        }
    }
    // Handle scheduling
    if (schedule) {
        const scheduleTime = new Date(schedule).getTime();
        const now = new Date().getTime();
        if (scheduleTime > now) {
            const delay = scheduleTime - now;
            document.getElementById('Start').textContent = 'Scheduled Broadcast...';
            document.getElementById('Start').disabled = true;
            setTimeout(() => {
                proceedWithBroadcast(botToken, userIDs, method, batchSize, interval);
            }, delay);
            return;
        }
    }
    // Start broadcast immediately
    proceedWithBroadcast(botToken, userIDs, method, batchSize, interval);
}

async function proceedWithBroadcast(botToken, userIDs, method, batchSize, interval) {
    const startButton = document.getElementById('Start');
    const processingSection = document.getElementById('Processing');
    const broadcastSummary = document.getElementById('broadcastSummary');
    const totalElement = document.getElementById('Total');
    const completedElement = document.getElementById('Compleated');
    const successElement = document.getElementById('Success');
    const failedElement = document.getElementById('Failed');
    const percentElement = document.getElementById('percent');
    const progressBar = document.getElementById('progressBar');
    const successUserID = document.getElementById('SuccessUserID');
    const failedUserID = document.getElementById('FailedUserID');
    const failedDetails = document.getElementById('FailedDetails');
    const summarySuccess = document.getElementById('summarySuccess');
    const summaryBlocked = document.getElementById('summaryBlocked');
    // Update UI
    startButton.textContent = 'Processing Broadcast...';
    startButton.disabled = true;
    processingSection.classList.remove('d-none');
    broadcastSummary.style.display = 'none';
    totalElement.textContent = userIDs.length;
    completedElement.textContent = '0';
    successElement.textContent = '0';
    failedElement.textContent = '0';
    percentElement.textContent = '0%';
    progressBar.style.width = '0%';
    progressBar.setAttribute('aria-valuenow', '0');
    successUserID.value = '';
    failedUserID.value = '';
    failedDetails.value = '';
    let completed = 0;
    let successCount = 0;
    let failedCount = 0;
    const successIDs = [];
    const failedIDs = [];
    const failedDetailsList = [];
    // Prepare payload based on method
    let payload = {};
    if (method === 'sendMessage') {
        const text = document.getElementById('text').value;
        const parseMode = document.getElementById('parse_mode').value;
        if (!text) {
            Swal.fire({
                icon: 'error',
                title: 'Missing Message',
                text: 'Please enter a message to broadcast.'
            });
            startButton.textContent = 'START BROADCAST';
            startButton.disabled = false;
            return;
        }
        payload = { text, parse_mode: parseMode };
    } else {
        const caption = document.getElementById('caption').value;
        const parseMode = document.getElementById('parse_mode').value;
        payload = { caption, parse_mode: parseMode };
    }
    // Validate bot token before starting broadcast
    const testResponse = await sendMessageToTelegram(botToken, null, 'getMe', {});
    if (!testResponse.ok) {
        Swal.fire({
            icon: 'error',
            title: 'Invalid Bot Token',
            text: `Bot token validation failed: ${testResponse.description || 'Unknown error'}`
        });
        startButton.textContent = 'START BROADCAST';
        startButton.disabled = false;
        processingSection.classList.add('d-none');
        return;
    }
    // Process in batches
    for (let i = 0; i < userIDs.length; i += batchSize) {
        const batch = userIDs.slice(i, i + batchSize);
        const promises = batch.map(async (chatId) => {
            try {
                const response = await sendMessageToTelegram(botToken, chatId, method, payload);
                completed++;
                completedElement.textContent = completed;
                const percent = Math.round((completed / userIDs.length) * 100);
                percentElement.textContent = `${percent}%`;
                progressBar.style.width = `${percent}%`;
                progressBar.setAttribute('aria-valuenow', percent);
                if (response.ok) {
                    successCount++;
                    successElement.textContent = successCount;
                    successIDs.push(chatId);
                    successUserID.value = successIDs.join('\n');
                } else {
                    failedCount++;
                    failedElement.textContent = failedCount;
                    failedIDs.push(chatId);
                    failedDetailsList.push(`ID: ${chatId}, Error: ${response.description || 'Unknown error'}`);
                    failedUserID.value = failedIDs.join('\n');
                    failedDetails.value = failedDetailsList.join('\n');
                }
            } catch (error) {
                completed++;
                failedCount++;
                failedElement.textContent = failedCount;
                failedIDs.push(chatId);
                failedDetailsList.push(`ID: ${chatId}, Error: ${error.message}`);
                failedUserID.value = failedIDs.join('\n');
                failedDetails.value = failedDetailsList.join('\n');
                const percent = Math.round((completed / userIDs.length) * 100);
                percentElement.textContent = `${percent}%`;
                progressBar.style.width = `${percent}%`;
                progressBar.setAttribute('aria-valuenow', percent);
            }
        });
        await Promise.all(promises);
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    // Show summary
    startButton.textContent = 'START BROADCAST';
    startButton.disabled = false;
    broadcastSummary.style.display = 'block';
    summarySuccess.textContent = successCount;
    summaryBlocked.textContent = failedCount;
    Swal.fire({
        icon: 'success',
        title: 'Broadcast Completed',
        text: `Successfully sent to ${successCount} users, failed for ${failedCount} users.`
    });
}

// Attach broadcast handler
document.getElementById('Start').addEventListener('click', startBroadcast);

// Export logs
document.getElementById('exportLogs').addEventListener('click', () => {
    const successIDs = document.getElementById('SuccessUserID').value;
    const failedIDs = document.getElementById('FailedUserID').value;
    const failedDetails = document.getElementById('FailedDetails').value;
    const data = {
        successIDs: successIDs.split('\n').filter(id => id.trim()),
        failedIDs: failedIDs.split('\n').filter(id => id.trim()),
        failedDetails: failedDetails.split('\n').filter(detail => detail.trim())
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'broadcast_logs.json';
    a.click();
    URL.revokeObjectURL(url);
});

// Test API endpoint
document.getElementById('testApi').addEventListener('click', async () => {
    const apiTestInput = document.getElementById('apiTest').value.trim();
    if (!apiTestInput) {
        Swal.fire({
            icon: 'error',
            title: 'Missing Endpoint',
            text: 'Please enter a valid API endpoint.'
        });
        return;
    }
    try {
        const response = await fetch(apiTestInput);
        const data = await response.json();
        if (data.ok) {
            Swal.fire({
                icon: 'success',
                title: 'API Test Successful',
                text: JSON.stringify(data.result, null, 2)
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'API Test Failed',
                text: `Error: ${data.description || 'Unknown error'}`
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'API Test Error',
            text: `Error: ${error.message}`
        });
    }
});
