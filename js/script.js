// ============================================
// TELEGRAM RICH TEXT EDITOR CONFIGURATION
// ============================================

// Initialize Quill Editor
const toolbarOptions = [
    // Text Formatting
    ['bold', 'italic', 'underline', 'strike'],
    ['blockquote', 'code-block'],
    
    // Headings
    [{ 'header': 1 }, { 'header': 2 }, { 'header': 3 }, { 'header': 4 }, { 'header': 5 }, { 'header': 6 }],
    
    // Lists
    [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
    
    // Tables
    ['table'],
    
    // Alignment
    [{ 'align': [] }],
    
    // Inline Media
    ['link', 'image', 'video', 'formula'],
    
    // Colors & Background
    [{ 'color': [] }, { 'background': [] }],
    
    // Font & Size
    [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
    
    // Clean
    ['clean']
];

// Initialize Quill
let quill;
try {
    quill = new Quill('#richEditor', {
        theme: 'snow',
        modules: {
            toolbar: toolbarOptions,
            table: true,
            clipboard: {
                matchVisual: false
            }
        },
        placeholder: 'Write your message here... Use Markdown, HTML, tables, formulas, and more!',
    });
} catch (e) {
    console.error('Quill initialization error:', e);
}

// ============================================
// CUSTOM MODULES & EXTENSIONS
// ============================================

// 1. Formula (KaTeX) Support
const Delta = Quill.import('delta');
const Embed = Quill.import('blots/embed');

class FormulaBlot extends Embed {
    static create(value) {
        const node = super.create();
        node.setAttribute('contenteditable', 'false');
        node.setAttribute('data-formula', value);
        
        // Render with KaTeX
        try {
            katex.render(value, node, {
                throwOnError: false,
                displayMode: false
            });
        } catch (e) {
            node.textContent = value;
        }
        return node;
    }
    
    static value(node) {
        return node.getAttribute('data-formula') || node.textContent;
    }
}

FormulaBlot.blotName = 'formula';
FormulaBlot.tagName = 'span';
FormulaBlot.className = 'ql-formula';

Quill.register(FormulaBlot);

// 2. Insert Formula Button
document.getElementById('insertFormulaBtn')?.addEventListener('click', function() {
    const formula = prompt('Enter LaTeX formula:', 'E = mc^2');
    if (formula && quill) {
        const range = quill.getSelection();
        if (range) {
            quill.insertEmbed(range.index, 'formula', formula);
        }
    }
});

// 3. AI Content Generator
document.getElementById('aiGenerateBtn')?.addEventListener('click', async function() {
    const prompt = prompt('Enter topic or prompt for AI content:', 'Write a professional message about...');
    if (!prompt) return;
    
    // Show loading
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    this.disabled = true;
    
    try {
        const aiContent = await generateAIContent(prompt);
        
        if (quill) {
            const range = quill.getSelection();
            if (range) {
                quill.insertText(range.index, aiContent);
            } else {
                quill.setText(aiContent);
            }
        }
        
        Swal.fire({
            icon: 'success',
            title: 'AI Content Generated!',
            text: 'Content has been inserted into the editor.',
            timer: 2000
        });
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'AI Generation Failed',
            text: error.message
        });
    } finally {
        this.innerHTML = '<i class="fas fa-robot"></i> Generate with AI';
        this.disabled = false;
    }
});

// 4. Clear Editor
document.getElementById('clearEditorBtn')?.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all content?')) {
        if (quill) {
            quill.setText('');
            updateMessagePreview();
        }
    }
});

// ============================================
// CONVERT QUIL CONTENT TO TELEGRAM FORMAT
// ============================================

function convertQuillToTelegram(parseMode) {
    if (!quill) return '';
    
    const content = quill.root.innerHTML;
    
    switch(parseMode) {
        case 'HTML':
            return content;
        case 'Markdown':
            return convertToMarkdown(content);
        case 'MarkdownV2':
            return convertToMarkdownV2(content);
        default:
            return content;
    }
}

function convertToMarkdown(html) {
    let text = html;
    
    // Replace tags with Markdown
    text = text.replace(/<strong>(.*?)<\/strong>/g, '*$1*');
    text = text.replace(/<b>(.*?)<\/b>/g, '*$1*');
    text = text.replace(/<em>(.*?)<\/em>/g, '_$1_');
    text = text.replace(/<i>(.*?)<\/i>/g, '_$1_');
    text = text.replace(/<u>(.*?)<\/u>/g, '__$1__');
    text = text.replace(/<s>(.*?)<\/s>/g, '~$1~');
    text = text.replace(/<code>(.*?)<\/code>/g, '`$1`');
    text = text.replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1');
    text = text.replace(/<h1>(.*?)<\/h1>/g, '# $1');
    text = text.replace(/<h2>(.*?)<\/h2>/g, '## $1');
    text = text.replace(/<h3>(.*?)<\/h3>/g, '### $1');
    text = text.replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)');
    
    // Lists
    text = text.replace(/<ol>/g, '');
    text = text.replace(/<ul>/g, '');
    text = text.replace(/<li>(.*?)<\/li>/g, '- $1');
    text = text.replace(/<\/ol>/g, '');
    text = text.replace(/<\/ul>/g, '');
    
    // Tables
    const tableRegex = /<table>(.*?)<\/table>/gs;
    text = text.replace(tableRegex, (match, content) => {
        const rows = content.match(/<tr>(.*?)<\/tr>/g) || [];
        let tableText = '|';
        rows.forEach((row, i) => {
            const cells = row.match(/<td>(.*?)<\/td>/g) || [];
            const cellContents = cells.map(c => c.replace(/<\/?td>/g, '').trim());
            tableText += cellContents.join(' | ') + ' |\n';
            if (i === 0) {
                tableText += '|' + cellContents.map(() => '---').join(' | ') + ' |\n';
            }
        });
        return tableText;
    });
    
    // Remove remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');
    
    return text.trim();
}

function convertToMarkdownV2(html) {
    let text = convertToMarkdown(html);
    
    // MarkdownV2 requires escaping special characters
    const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    specialChars.forEach(char => {
        text = text.replace(new RegExp('\\' + char, 'g'), '\\' + char);
    });
    
    return text;
}

// ============================================
// AI CONTENT GENERATOR
// ============================================

async function generateAIContent(prompt) {
    const templates = {
        'professional': `Dear Team,

I hope this message finds you well. 

I am writing to inform you about the upcoming project milestones and deliverables. 

**Key Highlights:**
- Project timeline has been updated
- New features are being developed
- Team collaboration is encouraged

Please review the attached documentation and provide your feedback by Friday.

Best regards,
Management Team`,

        'marketing': `🚀 **Exciting News!** 🚀

We are thrilled to announce our latest product launch! 

✨ **Features:**
• Advanced AI capabilities
• Seamless integration
• User-friendly interface

📅 **Launch Date:** Coming Soon!

🎯 **Special Offer:** 20% discount for early adopters.

Don't miss out on this opportunity to revolutionize your workflow!`,

        'technical': `## System Update Notice

**Date:** ${new Date().toLocaleDateString()}

Dear Users,

We have scheduled a system maintenance for the following updates:

1. **Security Patches** - Critical vulnerabilities addressed
2. **Performance Optimizations** - 40% faster response time
3. **New Features** - Enhanced analytics dashboard

**Downtime:** 2 hours

We apologize for any inconvenience caused.

Thank you for your cooperation.`
    };
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('professional') || lowerPrompt.includes('formal')) {
        return templates.professional;
    } else if (lowerPrompt.includes('marketing') || lowerPrompt.includes('promotion')) {
        return templates.marketing;
    } else if (lowerPrompt.includes('technical') || lowerPrompt.includes('update')) {
        return templates.technical;
    } else {
        return `📝 **AI Generated Content**

Here's a response based on your prompt: "${prompt}"

**Key Points:**
• Custom content generated for your needs
• Formatting includes bold, italic, and lists
• You can edit this content as needed

\`\`\`
// Example code block
function processData(data) {
    return data.map(item => item * 2);
}
\`\`\`

Let me know if you need any modifications!

--- 
*Generated by AI Assistant*`;
    }
}

// ============================================
// UPDATE PREVIEW FUNCTION
// ============================================

function updateMessagePreview() {
    if (!quill) return;
    
    const parseMode = document.getElementById('parse_mode').value;
    const preview = document.getElementById('message-preview');
    
    // Get raw content from Quill
    const content = quill.root.innerHTML;
    
    // Store converted content in hidden textarea
    const converted = convertQuillToTelegram(parseMode);
    document.getElementById('text').value = converted;
    
    // Show preview
    let previewHtml = content;
    
    // Clean up for preview
    previewHtml = previewHtml.replace(/<span class="ql-formula" data-formula="(.*?)">.*?<\/span>/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { throwOnError: false });
        } catch {
            return formula;
        }
    });
    
    preview.innerHTML = previewHtml || 'Preview will appear here...';
}

// Override Quill text change event
if (quill) {
    quill.on('text-change', function() {
        updateMessagePreview();
    });
}

// ============================================
// GET TELEGRAM MESSAGE
// ============================================

function getTelegramMessage() {
    const parseMode = document.getElementById('parse_mode').value;
    return {
        text: convertQuillToTelegram(parseMode),
        parse_mode: parseMode
    };
}

// Export for use in broadcast
window.getTelegramMessage = getTelegramMessage;

// ============================================
// JSON FILE UPLOAD
// ============================================

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
            if (data.chats && Array.isArray(data.chats)) {
                data.chats.forEach(chat => {
                    if (chat.id) userIDs.push(chat.id);
                });
            }
            if (data.users && Array.isArray(data.users)) {
                data.users.forEach(user => {
                    if (user.id) userIDs.push(user.id);
                });
            }
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

// ============================================
// COPY IDS TO CLIPBOARD
// ============================================

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

// ============================================
// TELEGRAM API REQUEST
// ============================================

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

// ============================================
// BROADCAST FUNCTION
// ============================================

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
        const caption = document.getElementById(`caption_${method.replace('send', '').toLowerCase()}`)?.value || '';
        const parseMode = document.getElementById(`parse_mode_${method.replace('send', '').toLowerCase()}`)?.value || 'HTML';
        payload = { caption, parse_mode: parseMode };
    }
    
    // Validate bot token
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

// ============================================
// EXPORT LOGS
// ============================================

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

// ============================================
// TEST API
// ============================================

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

// ============================================
// INITIALIZATION
// ============================================

// Update preview on parse mode change
document.getElementById('parse_mode')?.addEventListener('change', function() {
    updateMessagePreview();
});

// Initialize preview on page load
document.addEventListener('DOMContentLoaded', function() {
    // Add formula button to toolbar
    const toolbar = document.querySelector('.ql-toolbar');
    if (toolbar) {
        const formulaButton = document.createElement('button');
        formulaButton.className = 'ql-formula';
        formulaButton.innerHTML = '<i class="fas fa-square-root-variable"></i>';
        formulaButton.title = 'Insert Formula';
        formulaButton.addEventListener('click', function() {
            const formula = prompt('Enter LaTeX formula:', 'E = mc^2');
            if (formula && quill) {
                const range = quill.getSelection();
                if (range) {
                    quill.insertEmbed(range.index, 'formula', formula);
                }
            }
        });
        
        const imageButton = toolbar.querySelector('.ql-image');
        if (imageButton) {
            imageButton.parentNode.insertBefore(formulaButton, imageButton.nextSibling);
        } else {
            toolbar.appendChild(formulaButton);
        }
    }
    
    updateMessagePreview();
});

console.log('🚀 Smart Asynchronous Broadcast System loaded successfully!');
console.log('📝 Rich Text Editor initialized with Telegram formatting support.');
