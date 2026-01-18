import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, CheckCircle2, Settings, Zap, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';
import { AISettingsModal } from '@/components/ai/AISettingsModal';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: string;
  customerData?: CustomerData;
  itemData?: LineItemData;
}

interface CustomerData {
  id?: string;
  name: string;
  company: string;
  address: string;
  taxId: string;
  phone: string;
  email?: string;
}

interface LineItemData {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface ChatApiResponse {
  message: string;
  action?: string;
  customerData?: CustomerData;
  itemData?: LineItemData;
  sessionId?: string;
}

// Global event for autofill
export const autofillEvent = new EventTarget();

export function AIChatAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'smart' | 'ai'>('smart');
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'สวัสดีครับ! ผมช่วยจัดการลูกค้าได้ครับ\n\nลองพิมพ์ข้อมูลบริษัทแบบธรรมชาติ เช่น:\n"สร้างลูกค้า บริษัท ABC จำกัด เลขที่ 123 ถ.สุขุมวิท กรุงเทพ 10110 เลขภาษี 1234567890123"\n\nระบบจะ detect และ autofill ให้อัตโนมัติ',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const { loading, post } = useApi();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAutofill = useCallback((customerData: CustomerData) => {
    // Dispatch custom event for form to listen
    const event = new CustomEvent('pacioli:autofill', { 
      detail: { customerData } 
    });
    window.dispatchEvent(event);
    autofillEvent.dispatchEvent(event);
  }, []);

  const handleAddItem = useCallback((itemData: LineItemData) => {
    // Dispatch custom event for DocumentStep to listen
    const event = new CustomEvent('pacioli:additem', { 
      detail: { itemData } 
    });
    window.dispatchEvent(event);
    autofillEvent.dispatchEvent(event);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const messageText = input.trim();

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Use different endpoint based on chat mode
    const endpoint = chatMode === 'ai' ? '/ai/chat' : '/chat';
    const payload = chatMode === 'ai' 
      ? { message: messageText, context: messages.slice(-6).map(m => ({ role: m.role, content: m.content })) }
      : { message: messageText, sessionId };

    const response = await post<ChatApiResponse>(endpoint, payload);

    if (response.success && response.data) {
      const data = response.data as unknown as ChatApiResponse;
      
      // Handle session
      if (data.sessionId) {
        setSessionId(data.sessionId);
      } else {
        setSessionId(undefined);
      }

      // Handle autofill action
      if (data.action === 'autofill' || data.action === 'customer_created') {
        if (data.customerData) {
          handleAutofill(data.customerData);
        }
      }

      // Handle add item action
      if (data.action === 'add_item') {
        if (data.itemData) {
          handleAddItem(data.itemData);
        }
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'เสร็จสิ้น',
        timestamp: new Date(),
        action: data.action,
        customerData: data.customerData,
        itemData: data.itemData,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } else {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.error || 'ขออภัย เกิดข้อผิดพลาด',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { label: 'รายชื่อลูกค้า', action: 'รายชื่อลูกค้า', icon: '👥' },
    { label: 'ช่วยเหลือ', action: 'ช่วยเหลือ', icon: '❓' },
  ];

  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => {
      handleSend();
    }, 50);
  };

  // Render message content with formatting
  const renderContent = (content: string, action?: string) => {
    const lines = content.split('\n');
    
    return (
      <>
        {lines.map((line, i) => {
          // Handle checkmarks
          if (line.startsWith('✓') || line.startsWith('✗')) {
            const isCheck = line.startsWith('✓');
            return (
              <div key={i} className={cn(
                "flex items-start gap-1",
                isCheck ? "text-green-600" : "text-red-500"
              )}>
                <span>{line.charAt(0)}</span>
                <span>{renderTextWithFormatting(line.substring(1))}</span>
              </div>
            );
          }
          
          return (
            <div key={i}>
              {renderTextWithFormatting(line)}
              {i < lines.length - 1 && line === '' && <br />}
            </div>
          );
        })}
        
        {/* Show success indicator for customer_created */}
        {action === 'customer_created' && (
          <div className="mt-2 flex items-center gap-1 text-green-600 text-xs">
            <CheckCircle2 className="w-3 h-3" />
            <span>Autofill ไปที่ฟอร์มแล้ว</span>
          </div>
        )}
        
        {action === 'autofill' && (
          <div className="mt-2 flex items-center gap-1 text-blue-600 text-xs">
            <CheckCircle2 className="w-3 h-3" />
            <span>ข้อมูลถูกส่งไปที่ฟอร์มแล้ว</span>
          </div>
        )}

        {action === 'add_item' && (
          <div className="mt-2 flex items-center gap-1 text-purple-600 text-xs">
            <CheckCircle2 className="w-3 h-3" />
            <span>รายการถูกเพิ่มไปที่เอกสารแล้ว</span>
          </div>
        )}
      </>
    );
  };

  const renderTextWithFormatting = (text: string) => {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      // Code `text`
      if (part.includes('`')) {
        const codeParts = part.split(/(`[^`]+`)/g);
        return codeParts.map((cp, k) => {
          if (cp.startsWith('`') && cp.endsWith('`')) {
            return <code key={k} className="bg-black/10 px-1 rounded text-xs font-mono">{cp.slice(1, -1)}</code>;
          }
          return cp;
        });
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "w-14 h-14 rounded-full shadow-lg",
          "bg-primary text-primary-foreground",
          "flex items-center justify-center",
          "hover:scale-110 transition-all duration-200",
          "focus:outline-none focus:ring-4 focus:ring-primary/20",
          isOpen && "rotate-90"
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>

      {/* Notification Badge */}
      {sessionId && !isOpen && (
        <div className="fixed bottom-16 right-6 z-50 w-4 h-4 bg-orange-500 rounded-full animate-pulse md:bottom-16" />
      )}

      {/* Chat Window - Full screen on mobile, fixed size on desktop */}
      {isOpen && (
        <div className={cn(
          "fixed z-50",
          // Mobile: full screen with safe areas
          "inset-0 md:inset-auto",
          "md:bottom-24 md:right-6",
          // Desktop: fixed size
          "md:w-[420px] md:h-[550px]",
          "bg-background border-0 md:border md:rounded-2xl shadow-2xl",
          "flex flex-col overflow-hidden",
          "animate-slide-in-right"
        )}>
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 safe-area-pt">
            <div className="flex items-center gap-3">
              {/* Close button for mobile */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors md:hidden"
              >
                <X className="w-5 h-5" />
              </button>
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                chatMode === 'ai' ? "bg-purple-500/30" : "bg-white/20"
              )}>
                {chatMode === 'ai' ? <Brain className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Pond AI</h3>
                <p className="text-xs opacity-80">
                  {chatMode === 'ai' ? 'AI Chat (OpenRouter)' : 'Smart Parser'}
                </p>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
                title="ตั้งค่า AI"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            
            {/* Mode Toggle */}
            <div className="flex gap-1 mt-3 bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setChatMode('smart')}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all",
                  chatMode === 'smart' 
                    ? "bg-white text-primary" 
                    : "text-white/70 hover:text-white"
                )}
              >
                <Zap className="w-3 h-3 inline mr-1" />
                Smart Parser
              </button>
              <button
                onClick={() => setChatMode('ai')}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all",
                  chatMode === 'ai' 
                    ? "bg-white text-primary" 
                    : "text-white/70 hover:text-white"
                )}
              >
                <Brain className="w-3 h-3 inline mr-1" />
                AI Chat
              </button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted rounded-tl-none"
                    )}
                  >
                    <div className="text-sm">
                      {renderContent(message.content, message.action)}
                    </div>
                    <p className={cn(
                      "text-[10px] mt-1",
                      message.role === 'user' ? "text-primary-foreground/60" : "text-muted-foreground"
                    )}>
                      {message.timestamp.toLocaleTimeString('th-TH', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">กำลังวิเคราะห์...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Quick Actions */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.action)}
                  className="text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors flex items-center gap-1"
                >
                  <span>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Session indicator */}
          {sessionId && (
            <div className="px-4 pb-2">
              <div className="text-xs text-center text-orange-600 bg-orange-50 rounded-full py-1 px-3">
                พิมพ์ "ยกเลิก" เพื่อยกเลิก
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t bg-background">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={chatMode === 'ai' ? 'พิมพ์คำถามหรือคำสั่ง...' : 'พิมพ์ข้อมูลบริษัท ระบบจะ detect อัตโนมัติ...'}
                disabled={loading}
                className={cn(
                  "rounded-full text-sm",
                  sessionId && "border-orange-300 focus-visible:ring-orange-300",
                  chatMode === 'ai' && "border-purple-300 focus-visible:ring-purple-300"
                )}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="rounded-full"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Settings Modal */}
      <AISettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </>
  );
}
