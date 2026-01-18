import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApi } from '@/hooks/useApi';
import { Loader2, CheckCircle2, AlertCircle, Bot, Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIModel {
  id: string;
  name: string;
  provider: string;
}

interface AISettings {
  apiKey: string;
  hasApiKey: boolean;
  model: string;
  availableModels: AIModel[];
}

interface TestResult {
  success: boolean;
  message?: string;
  model?: string;
  responseTime?: string;
  error?: string;
}

interface AISettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISettingsModal({ open, onOpenChange }: AISettingsModalProps) {
  const { loading, error, get, put, post, setError } = useApi();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (open) {
      loadSettings();
      setTestResult(null);
    }
  }, [open]);

  const loadSettings = async () => {
    const response = await get<AISettings>('/ai/settings');
    if (response.success && response.data) {
      setSettings(response.data);
      setSelectedModel(response.data.model);
      if (response.data.hasApiKey) {
        setApiKey(response.data.apiKey);
      }
    }
  };

  const handleSave = async () => {
    const response = await put<AISettings>('/ai/settings', {
      apiKey: apiKey,
      model: selectedModel,
    });
    
    if (response.success) {
      setSaved(true);
      setTestResult(null);
      setTimeout(() => {
        setSaved(false);
      }, 3000);
    }
  };

  const handleTest = async () => {
    // First save the settings
    const saveResponse = await put<AISettings>('/ai/settings', {
      apiKey: apiKey,
      model: selectedModel,
    });
    
    if (!saveResponse.success) {
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError(null);
    
    const response = await post<{ message: string; model: string; responseTime: string }>('/ai/test', {});
    
    setTesting(false);
    
    if (response.success && response.data) {
      setTestResult({
        success: true,
        message: response.data.message,
        model: response.data.model,
        responseTime: response.data.responseTime,
      });
    } else {
      setTestResult({
        success: false,
        error: response.error || 'ทดสอบไม่สำเร็จ',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Settings
          </DialogTitle>
          <DialogDescription>
            ตั้งค่า OpenRouter API สำหรับใช้งาน AI Features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="break-all">{error}</span>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>บันทึกการตั้งค่าเรียบร้อย</span>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className={cn(
              "p-3 rounded-lg text-sm",
              testResult.success 
                ? "bg-green-50 text-green-800 border border-green-200" 
                : "bg-red-50 text-red-800 border border-red-200"
            )}>
              {testResult.success ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">ทดสอบสำเร็จ!</span>
                  </div>
                  <div className="text-xs space-y-0.5 ml-6">
                    <p>Model: <code className="bg-green-100 px-1 rounded">{testResult.model}</code></p>
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Response time: {testResult.responseTime}
                    </p>
                    <p>AI ตอบว่า: "{testResult.message}"</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="break-all">{testResult.error}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiKey">OpenRouter API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="sk-or-v1-..."
            />
            <p className="text-xs text-muted-foreground">
              รับ API Key ได้ที่{' '}
              <a 
                href="https://openrouter.ai/keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                openrouter.ai/keys
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">AI Model</Label>
            <Select 
              value={selectedModel} 
              onValueChange={(val) => {
                setSelectedModel(val);
                setTestResult(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือก AI Model" />
              </SelectTrigger>
              <SelectContent>
                {settings?.availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      <span className="text-xs text-muted-foreground">({model.provider})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Model ID: <code className="bg-muted px-1 rounded">{selectedModel}</code>
            </p>
          </div>

          {/* Quick Model Reference */}
          <div className="p-3 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2">Models ที่รองรับ:</h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {settings?.availableModels.map((model) => (
                <div 
                  key={model.id} 
                  className={cn(
                    "flex items-center gap-1 p-1 rounded cursor-pointer hover:bg-background/50",
                    selectedModel === model.id && "bg-primary/10 text-primary"
                  )}
                  onClick={() => setSelectedModel(model.id)}
                >
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    selectedModel === model.id ? "bg-primary" : "bg-muted-foreground/30"
                  )} />
                  <span>{model.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={handleTest} 
            disabled={loading || testing || !apiKey}
            className="mr-auto"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังทดสอบ...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                ทดสอบการเชื่อมต่อ
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ปิด
          </Button>
          <Button onClick={handleSave} disabled={loading || !apiKey}>
            {loading && !testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              'บันทึก'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
