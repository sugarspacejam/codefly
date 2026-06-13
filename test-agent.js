// Test script to create a code agent
const http = require('http');

const agentConfig = {
    name: 'CodeExplorer',
    role: 'assistant',
    systemPrompt: 'You are a code exploration assistant helping users understand codebases.',
    llm: {
        baseUrl: 'http://10.0.0.6:11434',
        model: 'llama3.2'
    },
    position: {
        x: 10,
        y: 30,
        z: 80
    }
};

const postData = JSON.stringify(agentConfig);

const options = {
    hostname: 'localhost',
    port: 8090,
    path: '/api/agents',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('Response:', data);
        try {
            const parsed = JSON.parse(data);
            console.log('Agent created successfully:', parsed);
        } catch (e) {
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('Error creating agent:', error.message);
});

req.write(postData);
req.end();
