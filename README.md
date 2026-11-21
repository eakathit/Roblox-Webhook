# ⚔️ Anime Crusaders X - Webhook Farm Tracker & Drop Inspector

> **Open Source Real-time Macro Webhook Monitor & Analytics Dashboard for Roblox Anime Crusaders X**

---

## ✨ Features

- 🔗 **Dedicated Webhook URL Generator:** ให้ผู้ใช้สร้างลิงก์ Webhook เฉพาะของตัวเองได้ทันทีในคลิกเดียว
- ⚡ **Real-time Live Feed:** ดักจับข้อมูลจากเกมแบบสดๆ ผ่าน Server-Sent Events / Fast Polling ไม่ต้องกด Refresh หน้าจอ
- 🎯 **Discord Embed Parser:** รองรับโครงสร้าง Discord Webhook มาตรฐานของ Macro ใน Roblox:
  - สถานะรอบการฟาร์ม (`Victory`, `Defeat`, `Wave Reached`)
  - เวลาการเล่น (`Match Duration`, `Time Elapsed`)
  - จำนวนรอบ (`Total Runs`, `Daily Runs`, `Win Rate`)
  - ทรัพยากรที่ได้ (`Gems`, `Gold`)
  - ไอเทมและตัวละครที่ดรอป (`Drops` แยก Rarity: Secret, Shiny, Mythic, Legendary, Epic)
- 🔍 **Raw JSON Inspector:** มีปุ่มขยายดู Raw Payload JSON เพื่อตรวจสอบฟิลด์ทั้งหมดที่ตัวเกมส่งมาอย่างละเอียด
- 🧪 **Built-in Simulator:** มีปุ่มทดสอบส่งข้อมูลจำลองทั้ง Send Test, Run Finished, และ Rare Drop ทันทีโดยไม่ต้องเปิดเกม

---

## 🚀 วิธีเปิดใช้งานและทดสอบ

### 1. รันระบบ (Local Development)
```bash
cd C:\Users\omgom\.gemini\antigravity\scratch\acx-webhook-tracker
npm run start
```
เปิดบราวเซอร์ไปที่: **`http://localhost:3000`**

---

### 2. นำไปใช้งานกับ Macro ในเกม Anime Crusaders X

1. เปิดหน้าเว็บ `http://localhost:3000`
2. กดปุ่ม **"คัดลอกลิงก์"** (เช่น `http://localhost:3000/api/webhook/user_xxxxxx`)
3. ในเกม Roblox:
   - เปิดหน้าต่างเมนู **Macro**
   - ไปที่แท็บ **Webhook** (เมนูด้านซ้าย)
   - วางลิงก์ลงในช่อง **Webhook link** แล้วกด **Enter**
   - เปิดสวิตช์ **Use webhook** ให้เป็นสีเขียว
   - กดปุ่ม **"Send Test"** เพื่อทดสอบเชื่อมต่อ
4. กลับมาดูที่หน้าเว็บ ข้อมูลจะเด้งขึ้นหน้าจอสดๆ ทันที!

> **💡 หมายเหตุสำหรับการทดสอบ:**
> - หากตัว Macro ทำงานบนเครื่องของคุณ (Client-side / Executor / AutoHotKey / Python) สามารถใช้ `http://localhost:3000/api/webhook/...` ได้โดยตรง
> - หากต้องการให้ Webhook ส่งได้จากทุกที่ (รวมถึงดูผ่านมือถือหรือคลาวด์) สามารถใช้ **ngrok** (`ngrok http 3000`) หรือ deploy ฟรีขึ้น **Vercel** ได้ทันทีใน 1 นาที!
