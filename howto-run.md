# How to Run Pacioli

คู่มือการติดตั้งและรันโปรเจค Pacioli บนเครื่องใหม่

---

## Prerequisites (สิ่งที่ต้องมีก่อน)

### 1. ติดตั้ง Bun

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# ตรวจสอบเวอร์ชัน (ต้อง >= 1.0.0)
bun --version
```

### 2. ติดตั้ง Git (ถ้ายังไม่มี)

```bash
# macOS
brew install git

# Ubuntu/Debian
sudo apt install git

# Windows - ดาวน์โหลดจาก https://git-scm.com/
```

---

## Installation (การติดตั้ง)

### Step 1: Clone หรือ Copy โปรเจค

```bash
# ถ้ามี Git repo
git clone https://github.com/peerasak-u/pacioli.git
cd pacioli

# หรือ copy folder ไปยังเครื่องใหม่
```

### Step 2: ติดตั้ง Dependencies หลัก

```bash
# ที่ root ของโปรเจค
bun install
```

### Step 3: ติดตั้ง Dependencies สำหรับ Web UI

```bash
# วิธีที่ 1: ใช้ script ที่เตรียมไว้
bun run web:install

# วิธีที่ 2: ติดตั้งแยก
cd web/api && bun install
cd ../app && bun install
cd ../..
```

### Step 4: ตั้งค่า Configuration

```bash
# Copy example config
cp config/freelancer.example.json config/freelancer.json

# (Optional) Copy AI settings ถ้าต้องการใช้ AI
cp config/ai-settings.example.json config/ai-settings.json

# แก้ไขไฟล์ config ตามข้อมูลของคุณ
```

---

## Running the Application

### CLI Mode (Command Line)

```bash
# ดู help
bun run dev --help

# Initialize project
bun run dev init

# Generate document
bun run generate invoice examples/invoice.json --customer customers/sample.json
bun run generate quotation examples/quotation.json --customer customers/sample.json
bun run generate receipt examples/receipt.json --customer customers/sample.json
```

### Web UI Mode

```bash
# วิธีที่ 1: รันแยก Terminal (แนะนำ)

# Terminal 1 - API Server (port 3001)
bun run web:api

# Terminal 2 - Frontend App (port 3000)
bun run web:app

# เปิด http://localhost:3000
```

```bash
# วิธีที่ 2: รันพร้อมกัน (background)
bun run web:dev

# เปิด http://localhost:3000
```

### Testing

```bash
# รันทุก tests
bun test

# รัน test file เดียว
bun test tests/utils.test.ts

# รัน test ตามชื่อ
bun test -t "test name"

# Watch mode
bun test --watch
```

---

## Quick Start Commands (สำหรับ Copy-Paste)

```bash
# ติดตั้งทุกอย่างในครั้งเดียว
bun install && bun run web:install

# ตั้งค่า config
cp config/freelancer.example.json config/freelancer.json

# รัน Web UI
bun run web:api &
bun run web:app

# เปิด http://localhost:3000
```

---

## Port Configuration

| Service | Default Port | URL |
|---------|-------------|-----|
| Frontend (Vite) | 3000 | http://localhost:3000 |
| Backend API (Hono) | 3001 | http://localhost:3001 |

---

## Folder Structure (โครงสร้างที่สำคัญ)

```
pacioli/
├── src/                    # Core CLI source code
├── web/
│   ├── api/                # Backend API (Hono)
│   └── app/                # Frontend (React + Vite)
├── templates/              # HTML templates สำหรับ PDF
├── config/
│   ├── freelancer.json     # ข้อมูล Freelancer (ต้องสร้าง)
│   └── ai-settings.json    # AI config (optional)
├── customers/              # ข้อมูลลูกค้า
├── examples/               # ตัวอย่าง document data
├── output/                 # PDF ที่ generate แล้ว
└── tests/                  # Test files
```

---

## Troubleshooting

### ปัญหา: `bun: command not found`

```bash
# เพิ่ม bun ใน PATH
export PATH="$HOME/.bun/bin:$PATH"

# หรือเพิ่มใน ~/.bashrc หรือ ~/.zshrc
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### ปัญหา: Puppeteer ไม่สามารถ download Chromium

```bash
# ลองติดตั้ง Chromium manually
npx puppeteer browsers install chrome
```

### ปัญหา: Port 3000 หรือ 3001 ถูกใช้งานอยู่

```bash
# หา process ที่ใช้ port
lsof -i :3000
lsof -i :3001

# Kill process (แทน PID ด้วยเลขที่ได้)
kill -9 <PID>
```

### ปัญหา: Permission denied บน macOS

```bash
# ให้ permission สำหรับ Chromium
xattr -cr ~/.cache/puppeteer
```

---

## Development Tips

### Hot Reload

- **API**: ใช้ `--watch` อัตโนมัติ (ไม่ต้องรีสตาร์ท)
- **Frontend**: Vite hot reload อัตโนมัติ

### ดู API Logs

```bash
# API จะแสดง logs ใน terminal ที่รัน web:api
DEBUG=* bun run web:api
```

### Build Production

```bash
# Build frontend
cd web/app && bun run build

# Output จะอยู่ใน web/app/dist/
```

---

## Environment Requirements

| Requirement | Version |
|-------------|---------|
| Bun | >= 1.0.0 |
| TypeScript | ^5.x |
| Node.js | ไม่จำเป็น (ใช้ Bun แทน) |

---

## ติดต่อ / รายงานปัญหา

- **GitHub**: https://github.com/peerasak-u/pacioli
- **Issues**: https://github.com/peerasak-u/pacioli/issues
