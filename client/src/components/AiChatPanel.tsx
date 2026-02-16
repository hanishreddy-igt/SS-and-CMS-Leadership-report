import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Trash2, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intentKey?: string;
  intentName?: string;
  timestamp: Date;
}

const quickActions = [
  { label: 'Steady Check-in', intent: 'eod_report', question: 'Generate my end-of-day report for today' },
  { label: 'Project Status', intent: 'project_status', question: 'Give me a status overview of all projects' },
  { label: 'My Tasks', intent: 'task_query', question: 'What are my current tasks and their status?' },
  { label: 'Overdue Items', intent: 'task_query', question: 'Show me all overdue tasks across all projects' },
  { label: 'Team Workload', intent: 'person_activity', question: 'Show me the current workload distribution across the team' },
  { label: 'How to Use', intent: 'usage_guide', question: 'How do I use this dashboard effectively?' },
];

export default function AiChatPanel() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!atBottom);
  }, []);

  const sendMessage = async (question: string, intentOverride?: string) => {
    if (!question.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    try {
      const historyForApi = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/ai-chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question: question.trim(),
          messageHistory: historyForApi,
          intentOverride,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'intent') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, intentKey: data.intentKey, intentName: data.intentName } : m
              ));
            } else if (data.type === 'content') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + data.content } : m
              ));
            } else if (data.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: 'Sorry, an error occurred. Please try again.' } : m
              ));
            }
          } catch {}
        }
      }
    } catch (error) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: 'Failed to connect to AI service. Please try again.' } : m
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const firstName = user?.firstName || user?.displayName?.split(' ')[0] || 'there';

  return (
    <>
      {!isOpen && (
        <button
          data-testid="button-open-ai-chat"
          onClick={() => setIsOpen(true)}
          className="bg-primary text-primary-foreground border border-primary-border rounded-full shadow-xl flex items-center gap-2 px-4 hover-elevate active-elevate-2"
          style={{ position: 'fixed', bottom: '5rem', right: '2rem', zIndex: 9999, height: '44px' }}
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">SS-CMA AI Assistant</span>
        </button>
      )}

      {isOpen && (
        <Card
          data-testid="panel-ai-chat"
          className="fixed bottom-8 right-8 z-[9999] flex flex-col shadow-xl border border-border"
          style={{ width: '420px', height: '600px' }}
        >
          <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm" data-testid="text-chat-title">SS-CMA AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                data-testid="button-clear-chat"
                size="icon"
                variant="ghost"
                onClick={clearChat}
                disabled={messages.length === 0 || isStreaming}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                data-testid="button-close-ai-chat"
                size="icon"
                variant="ghost"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-3 space-y-3"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 px-2">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium" data-testid="text-chat-greeting">Hi {firstName}, I'm SS-CMA Assistant. I'm still under development but how can I help you?</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Quick prompts for :</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {quickActions.map((action) => (
                    <Badge
                      key={action.intent + action.label}
                      data-testid={`button-quick-action-${action.intent}`}
                      className="cursor-pointer text-xs"
                      variant="secondary"
                      onClick={() => { setInput(action.question); setTimeout(() => inputRef.current?.focus(), 50); }}
                    >
                      {action.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                data-testid={`chat-message-${message.role}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.role === 'assistant' && message.intentName && (
                    <div className="flex items-center gap-1 mb-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {message.intentName}
                      </Badge>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {message.content || (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <span className="animate-pulse">Thinking</span>
                        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {showScrollDown && (
            <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2">
              <Button
                size="icon"
                variant="secondary"
                onClick={scrollToBottom}
                className="rounded-full shadow-md h-7 w-7"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-3 border-t border-border">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                data-testid="input-chat-message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={isStreaming}
                rows={1}
                className="flex-1 resize-none bg-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground disabled:opacity-50"
                style={{ minHeight: '36px', maxHeight: '100px' }}
              />
              <Button
                data-testid="button-send-message"
                type="submit"
                size="icon"
                disabled={!input.trim() || isStreaming}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
