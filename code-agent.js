// ============================================================
// CODE AGENT - AI Agent that can interact with code
// ============================================================

const { LLMProvider } = require('./llm-provider');

class CodeAgent {
    constructor(config) {
        if (!config.id) {
            throw new Error('CodeAgent: id is required');
        }
        if (!config.name) {
            throw new Error('CodeAgent: name is required');
        }
        
        this.id = config.id;
        this.name = config.name;
        this.role = config.role || 'assistant';
        this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
        
        const llmConfig = config.llm || {};
        const baseUrl = llmConfig.baseUrl || 'http://10.0.0.6:11434';
        const model = llmConfig.model || 'llama3.2';
        
        this.llm = new LLMProvider(baseUrl, model);
        this.conversationHistory = [];
        this.context = {
            currentFile: null,
            currentFunction: null,
            repoContext: null
        };
    }

    getDefaultSystemPrompt() {
        return `You are a code exploration agent in CodeFly, a 3D codebase visualization tool.
Your role is to help users understand code by:
- Explaining functions and their relationships
- Suggesting navigation paths through the codebase
- Identifying patterns and potential issues
- Answering questions about code structure

Be concise and direct. Focus on actionable insights.`;
    }

    async processMessage(userMessage, codeContext = null) {
        if (!userMessage || typeof userMessage !== 'string') {
            throw new Error('CodeAgent: userMessage must be a non-empty string');
        }

        const messages = this.buildMessages(userMessage, codeContext);
        
        try {
            const response = await this.llm.chat(messages);
            this.addToHistory('user', userMessage);
            this.addToHistory('assistant', response);
            return response;
        } catch (error) {
            throw new Error(`CodeAgent ${this.id}: ${error.message}`);
        }
    }

    buildMessages(userMessage, codeContext) {
        const messages = [
            { role: 'system', content: this.systemPrompt }
        ];

        if (codeContext) {
            const contextStr = this.formatCodeContext(codeContext);
            messages.push({
                role: 'system',
                content: `Current code context:\n${contextStr}`
            });
        }

        messages.push({ role: 'user', content: userMessage });
        return messages;
    }

    formatCodeContext(context) {
        const parts = [];
        
        if (context.filePath) {
            parts.push(`File: ${context.filePath}`);
        }
        
        if (context.functionName) {
            parts.push(`Function: ${context.functionName}`);
        }
        
        if (context.code) {
            parts.push(`Code:\n${context.code}`);
        }
        
        if (context.dependencies) {
            parts.push(`Dependencies: ${context.dependencies.join(', ')}`);
        }
        
        return parts.join('\n');
    }

    addToHistory(role, content) {
        this.conversationHistory.push({ role, content });
        
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
    }

    setContext(context) {
        if (!context || typeof context !== 'object') {
            throw new Error('CodeAgent: context must be an object');
        }
        this.context = { ...this.context, ...context };
    }

    clearHistory() {
        this.conversationHistory = [];
    }

    getPosition() {
        return this.position || { x: 0, y: 0, z: 0 };
    }

    setPosition(x, y, z) {
        this.position = { x, y, z };
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            role: this.role,
            position: this.getPosition(),
            context: this.context
        };
    }
}

module.exports = { CodeAgent };
