import { Hono } from 'hono';
import path from 'path';

const app = new Hono();

// AI Settings file path
const AI_CONFIG_PATH = path.join(process.cwd(), 'config', 'ai-settings.json');

// Default AI settings
const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'google/gemini-2.0-flash-001',
  availableModels: [
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'Google' },
    { id: 'google/gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', provider: 'Google' },
    { id: 'google/gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', provider: 'Google' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek' },
  ],
};

// Load AI settings
async function loadSettings() {
  try {
    const file = Bun.file(AI_CONFIG_PATH);
    if (await file.exists()) {
      const settings = await file.json();
      return { ...DEFAULT_SETTINGS, ...settings };
    }
  } catch (error) {
    console.error('Error loading AI settings:', error);
  }
  return DEFAULT_SETTINGS;
}

// Save AI settings
async function saveSettings(settings: any) {
  await Bun.write(AI_CONFIG_PATH, JSON.stringify(settings, null, 2));
}

// GET /api/ai/settings - Get AI settings
app.get('/settings', async (c) => {
  const settings = await loadSettings();
  // Mask API key for security
  return c.json({
    success: true,
    data: {
      ...settings,
      apiKey: settings.apiKey ? `${settings.apiKey.substring(0, 20)}...` : '',
      hasApiKey: !!settings.apiKey,
    },
  });
});

// PUT /api/ai/settings - Update AI settings
app.put('/settings', async (c) => {
  try {
    const body = await c.req.json();
    const currentSettings = await loadSettings();
    
    const newSettings = {
      ...currentSettings,
      model: body.model || currentSettings.model,
    };
    
    // Only update API key if provided and not masked
    if (body.apiKey && !body.apiKey.includes('...')) {
      newSettings.apiKey = body.apiKey;
    }
    
    await saveSettings(newSettings);
    
    return c.json({
      success: true,
      data: {
        ...newSettings,
        apiKey: `${newSettings.apiKey.substring(0, 20)}...`,
        hasApiKey: true,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to save settings' }, 500);
  }
});

// POST /api/ai/test - Test AI connection
app.post('/test', async (c) => {
  try {
    const settings = await loadSettings();
    
    if (!settings.apiKey) {
      return c.json({ success: false, error: 'กรุณาตั้งค่า API Key ก่อน' }, 400);
    }
    
    const startTime = Date.now();
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Pacioli Invoice Generator',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'user', content: 'ตอบว่า "สวัสดี" เท่านั้น' },
        ],
        max_tokens: 50,
      }),
    });
    
    const elapsed = Date.now() - startTime;
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter test error:', response.status, errorData);
      return c.json({ 
        success: false, 
        error: `API Error ${response.status}: ${errorData.error?.message || JSON.stringify(errorData)}`,
        model: settings.model,
      }, 400);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    return c.json({
      success: true,
      data: {
        message: content,
        model: settings.model,
        responseTime: `${elapsed}ms`,
        usage: data.usage,
      },
    });
  } catch (error) {
    console.error('AI Test error:', error);
    return c.json({ 
      success: false, 
      error: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown'}` 
    }, 500);
  }
});

// POST /api/ai/generate-items - Generate line items using AI
app.post('/generate-items', async (c) => {
  try {
    const { description, count = 3 } = await c.req.json();
    
    if (!description) {
      return c.json({ success: false, error: 'กรุณาระบุรายละเอียดงาน' }, 400);
    }
    
    const settings = await loadSettings();
    
    if (!settings.apiKey) {
      return c.json({ success: false, error: 'กรุณาตั้งค่า API Key ก่อน' }, 400);
    }

    console.log('Generating items with model:', settings.model);
    console.log('Description:', description);
    console.log('Count:', count);
    
    const prompt = `คุณเป็นผู้เชี่ยวชาญด้านการเขียนใบเสนอราคาและใบแจ้งหนี้สำหรับงาน IT และบริการ

จากงานต่อไปนี้: "${description}"

สร้างรายการบริการ ${count} รายการที่เหมาะสม แต่ละรายการต้อง:
- เขียนเป็นภาษาไทยที่เป็นทางการ ชัดเจน กระชับ
- อธิบายขอบเขตงานที่ชัดเจน ลูกค้าเข้าใจง่าย
- ระบุหน่วยที่เหมาะสม (เช่น: งาน, ระบบ, หน้า, ชั่วโมง, วัน, เดือน, ครั้ง)

ตอบเป็น JSON array เท่านั้น ไม่มีคำอธิบายก่อนหรือหลัง:
[{"description": "รายละเอียด", "unit": "หน่วย"}]`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Pacioli Invoice Generator',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'system',
            content: 'คุณเป็น AI ที่ช่วยสร้างรายการสินค้า/บริการสำหรับใบเสนอราคา ตอบเป็น JSON array เท่านั้น ไม่มีข้อความอื่น'
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', response.status, errorText);
      
      let errorMessage = `AI API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (e) {}
      
      return c.json({ success: false, error: errorMessage }, 500);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI Response:', content);
    
    // Parse JSON from response
    let items = [];
    try {
      // Clean up the content - remove markdown code blocks if present
      let cleanContent = content
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/gi, '')
        .trim();
      
      // Try to extract JSON array from response
      const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        items = JSON.parse(jsonMatch[0]);
        console.log('Parsed items:', items);
      } else {
        console.error('No JSON array found in response:', cleanContent);
        return c.json({ 
          success: false, 
          error: 'AI ไม่ได้ตอบเป็น JSON array กรุณาลองใหม่',
          rawResponse: cleanContent.substring(0, 200)
        }, 500);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError, content);
      return c.json({ 
        success: false, 
        error: 'ไม่สามารถ parse ผลลัพธ์จาก AI ได้ กรุณาลองใหม่',
        rawResponse: content.substring(0, 200)
      }, 500);
    }
    
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ 
        success: false, 
        error: 'AI ไม่ได้สร้างรายการ กรุณาลองใหม่',
        rawResponse: content.substring(0, 200)
      }, 500);
    }
    
    // Add default values and validate
    const formattedItems = items.map((item: any, index: number) => ({
      description: item.description || `รายการที่ ${index + 1}`,
      quantity: 1,
      unit: item.unit || 'รายการ',
      unitPrice: 0,
    }));
    
    console.log('Formatted items:', formattedItems);
    
    return c.json({
      success: true,
      data: {
        items: formattedItems,
        model: settings.model,
        rawItemCount: items.length,
      },
    });
  } catch (error) {
    console.error('Generate items error:', error);
    return c.json({ 
      success: false, 
      error: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown'}` 
    }, 500);
  }
});

// POST /api/ai/chat - AI Chat endpoint
app.post('/chat', async (c) => {
  try {
    const { message, context } = await c.req.json();
    
    if (!message) {
      return c.json({ success: false, error: 'กรุณาพิมพ์ข้อความ' }, 400);
    }
    
    const settings = await loadSettings();
    
    if (!settings.apiKey) {
      return c.json({ success: false, error: 'กรุณาตั้งค่า API Key ก่อน' }, 400);
    }
    
    const systemPrompt = `คุณคือ Pacioli AI ผู้ช่วยสร้างเอกสารทางการเงิน (ใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จ) สำหรับ freelancer ชาวไทย

ความสามารถของคุณ:
1. ช่วยสร้างและจัดการข้อมูลลูกค้า
2. ช่วยสร้างรายการสินค้า/บริการ
3. ให้คำแนะนำเกี่ยวกับการออกเอกสาร
4. ตอบคำถามเกี่ยวกับภาษีและการเงินเบื้องต้น

ตอบเป็นภาษาไทย กระชับ ชัดเจน เป็นมิตร`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'https://pacioli.app',
        'X-Title': 'Pacioli Invoice Generator',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(context || []),
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter chat error:', error);
      return c.json({ success: false, error: 'AI API error' }, 500);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'ขออภัย ไม่สามารถตอบได้';
    
    return c.json({
      success: true,
      data: {
        message: content,
        model: settings.model,
      },
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    return c.json({ 
      success: false, 
      error: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown'}` 
    }, 500);
  }
});

export default app;
