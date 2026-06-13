// ============================================================
// LLM PROVIDER - Ollama Integration
// ============================================================

class LLMProvider {
    constructor(baseUrl, model = 'llama3.2') {
        if (!baseUrl) {
            throw new Error('LLMProvider: baseUrl is required');
        }
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.model = model;
        this.timeout = 30000;
    }

    async chat(messages, options = {}) {
        const url = `${this.baseUrl}/api/chat`;
        const payload = {
            model: options.model || this.model,
            messages: messages,
            stream: false,
            options: {
                temperature: options.temperature ?? 0.7,
                num_predict: options.num_predict ?? 2048,
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`LLMProvider: HTTP ${response.status} from ${url}`);
            }

            const data = await response.json();
            return data.message?.content || '';
        } catch (error) {
            if (error.name === 'TimeoutError') {
                throw new Error(`LLMProvider: Request timeout after ${this.timeout}ms`);
            }
            throw new Error(`LLMProvider: ${error.message}`);
        }
    }

    async generate(prompt, options = {}) {
        const messages = [{ role: 'user', content: prompt }];
        return this.chat(messages, options);
    }

    setModel(model) {
        if (!model) {
            throw new Error('LLMProvider: model name is required');
        }
        this.model = model;
    }

    setTimeout(ms) {
        if (typeof ms !== 'number' || ms <= 0) {
            throw new Error('LLMProvider: timeout must be positive number');
        }
        this.timeout = ms;
    }
}

module.exports = { LLMProvider };
