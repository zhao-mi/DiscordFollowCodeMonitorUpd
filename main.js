// ==UserScript==
// @name         Discord消息Follow邀请码监控修改  用户名可以为空 为空监听所有用户, Webhook URL 现在指向follow的验证码激活接口 只需要修改Token即可使用
// @namespace    http://tampermonkey.net/
// @version      2024-09-19
// @description  监控Discord特定用户的消息内容并发送到自定义Webhook
// @author       recar
// @match        https://discord.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(`
        #config-panel {
            position: fixed;
            top: 20px;
            right: -300px;
            width: 280px;
            background: #36393f;
            border-radius: 8px;
            box-shadow: 0 2px 10px 0 rgba(0,0,0,.2);
            padding: 16px;
            z-index: 9999;
            transition: right 0.3s ease-in-out;
            color: #dcddde;
            font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        #config-panel.open {
            right: 20px;
        }
        #config-panel h3 {
            margin-top: 0;
            color: #fff;
            font-size: 16px;
            margin-bottom: 16px;
        }
        #config-panel input, #config-panel button {
            width: 100%;
            padding: 8px;
            margin: 8px 0;
            border-radius: 4px;
            border: none;
            background: #40444b;
            color: #dcddde;
            font-size: 14px;
        }
        #config-panel input::placeholder {
            color: #72767d;
        }
        #config-panel button {
            background: #5865f2;
            color: #fff;
            cursor: pointer;
            transition: background 0.2s;
        }
        #config-panel button:hover {
            background: #4752c4;
        }
        #toggle-config {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #5865f2;
            color: #fff;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 20px;
            cursor: pointer;
            z-index: 10000;
            transition: transform 0.3s;
        }
        #toggle-config:hover {
            transform: rotate(180deg);
        }
        .example {
            font-size: 12px;
            color: #72767d;
            margin-top: 4px;
        }
        #status-message {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #5865f2;
            color: #fff;
            border-radius: 4px;
            opacity: 0;
            transition: opacity 0.3s;
        }
        #status-message.show {
            opacity: 1;
        }
    `);

    // 配置面板HTML
    const configPanelHTML = `
        <button id="toggle-config">⚙️</button>
        <div id="config-panel">
            <h3>配置面板</h3>
            <input id="usernames" type="text" placeholder="用户名(逗号分隔)">
            <div class="example">例如: Joshua,Alice,Bob</div>
            <input id="webhook-url" type="text" placeholder="Webhook URL">
            <div class="example">例如: https://api2.pushdeer.com/message/push?pushkey=YOUR_KEY</div>
            <input id="interval" type="number" placeholder="检查间隔(毫秒)">
            <div class="example">例如: 5000 (5秒)</div>
            <button id="save-config">保存配置</button>
            <button id="test-config">测试配置</button>
        </div>
        <div id="status-message"></div>
    `;

    // 添加配置面板到页面
    document.body.insertAdjacentHTML('beforeend', configPanelHTML);

    // 获取配置
    function getConfig() {
        return {
            usernames: localStorage.getItem('discord-monitor-usernames') || '',
            webhookUrl: localStorage.getItem('discord-monitor-webhook-url') || '',
            interval: parseInt(localStorage.getItem('discord-monitor-interval')) || 5000
        };
    }

    // 保存配置
    function saveConfig() {
        const usernames = document.getElementById('usernames').value;
        const webhookUrl = document.getElementById('webhook-url').value;
        const interval = document.getElementById('interval').value;

        localStorage.setItem('discord-monitor-usernames', usernames);
        localStorage.setItem('discord-monitor-webhook-url', webhookUrl);
        localStorage.setItem('discord-monitor-interval', interval);

        showStatus('配置已保存');
        setTimeout(() => location.reload(), 1000);
    }

    // 测试配置
    function testConfig() {
        const config = getConfig();
        sendWebhook('这是一条测试消息', config.webhookUrl);
    }

    function sendWebhook(message, webhookUrl) {
        // 使用正则表达式提取连续10位的字符串
        const regex = /[a-zA-Z0-9!@#$%^&*()_+~`{}\[\]:;"'<>,.?\/\\-]{10}/g;
        const matches = message.match(regex);

        if (matches && matches.length > 0) {
            const extractedMessage = matches[0]; // 取第一个匹配的结果
          console.log("10位字符串:",extractedMessage);
            const url = `${webhookUrl}&text=${encodeURIComponent(extractedMessage)}`;

            GM_xmlhttpRequest({
                method: "POST",
                url: "https://api.follow.is/invitations/use",
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify({
                    "code": extractedMessage,
                    "csrfToken": "你的Token"
                }),
                onload: function(response) {
                    console.log("Response:", response.responseText);
                    if (response.status === 200) {
                        console.log("请求成功:", JSON.parse(response.responseText));
                    } else {
                        console.log("请求失败，状态码:", response.status);
                    }
                },
                onerror: function(error) {
                    console.error("请求失败:", error);
                }
            });
        } else {
            console.log("未找到匹配的10位字符串");
        }
    }


    // 显示状态消息
    function showStatus(message, isError = false) {
        const statusElement = document.getElementById('status-message');
        statusElement.textContent = message;
        statusElement.style.background = isError ? '#ed4245' : '#5865f2';
        statusElement.classList.add('show');
        setTimeout(() => statusElement.classList.remove('show'), 3000);
    }

    // 用于存储已处理的消息ID
    const processedMessages = new Set();

    // 监控新消息
    function checkForNewMessages() {
        const config = getConfig();
        const usernames = config.usernames ? config.usernames.split(',').map(u => u.trim()) : [];

        const messages = document.evaluate(
            '//div[contains(@class, "contents_f9f2ca")]',
            document,
            null,
            XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
            null
        );

        for (let i = 0; i < messages.snapshotLength; i++) {
            const messageElement = messages.snapshotItem(i);
            const usernameElement = messageElement.querySelector('.username_f9f2ca');

            // 如果用户名列表为空，或者当前用户名在列表中
            if (usernameElement && (usernames.length === 0 || usernames.includes(usernameElement.textContent.trim()))) {
                const contentElements = messageElement.querySelectorAll('div[id^="message-content-"] span');
                contentElements.forEach(contentElement => {
                    const messageId = contentElement.parentElement.id;
                    if (!processedMessages.has(messageId)) {
                        processedMessages.add(messageId);
                        const content = contentElement.textContent.trim();
                        console.log(`${usernameElement.textContent.trim()}的新消息 (${messageId}): ${content}`);
                        sendWebhook(`${usernameElement.textContent.trim()}的新消息: ${content}`, config.webhookUrl);
                    }
                });
            }
        }
    }


    // 初始化
    function init() {
        const config = getConfig();
        document.getElementById('usernames').value = config.usernames;
        document.getElementById('webhook-url').value = config.webhookUrl;
        document.getElementById('interval').value = config.interval;

        document.getElementById('save-config').addEventListener('click', saveConfig);
        document.getElementById('test-config').addEventListener('click', testConfig);
        document.getElementById('toggle-config').addEventListener('click', () => {
            document.getElementById('config-panel').classList.toggle('open');
        });

        setInterval(checkForNewMessages, config.interval);
        checkForNewMessages(); // 初始检查
    }

    // 运行初始化
    init();
})();