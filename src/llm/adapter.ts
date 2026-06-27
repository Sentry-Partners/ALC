export interface LlmAdapter {
  name: string;
  complete(prompt: string): Promise<string>;
}

export function createLlmAdapter(): LlmAdapter {
  const provider = (process.env.LLM_PROVIDER ?? "stub").toLowerCase();

  if (provider === "ollama") return ollamaAdapter();
  if (provider === "openai") return openaiAdapter();
  if (provider === "anthropic") return anthropicAdapter();
  return stubAdapter();
}

function stubAdapter(): LlmAdapter {
  return {
    name: "stub",
    async complete(prompt: string) {
      return `stub response\n\n${prompt.slice(0, 1200)}`;
    }
  };
}

function ollamaAdapter(): LlmAdapter {
  return {
    name: "ollama",
    async complete(prompt: string) {
      const url = process.env.OLLAMA_URL ?? "http://localhost:11434";
      const model = process.env.OLLAMA_MODEL ?? "llama3.1";
      const response = await fetch(`${url}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false })
      });
      if (!response.ok) throw new Error(`ollama failed: ${response.status} ${await response.text()}`);
      const data = (await response.json()) as { response?: string };
      return data.response ?? "";
    }
  };
}

function openaiAdapter(): LlmAdapter {
  return {
    name: "openai",
    async complete(prompt: string) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
      const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, input: prompt })
      });
      if (!response.ok) throw new Error(`openai failed: ${response.status} ${await response.text()}`);
      const data = (await response.json()) as { output_text?: string };
      return data.output_text ?? JSON.stringify(data);
    }
  };
}

function anthropicAdapter(): LlmAdapter {
  return {
    name: "anthropic",
    async complete(prompt: string) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
      const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!response.ok) throw new Error(`anthropic failed: ${response.status} ${await response.text()}`);
      const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
      return data.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
    }
  };
}
