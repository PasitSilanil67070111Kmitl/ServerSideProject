# เสียงของมหาลัย (Campus Voice)

เว็บต้นแบบระบบแจ้งปัญหาและวิเคราะห์ปัญหาพื้นที่สาธารณะภายในมหาวิทยาลัย พัฒนาด้วย Node.js + Express + MongoDB

## ความสามารถ
- สมัครสมาชิก / เข้าสู่ระบบ (รหัสผ่านถูก Hash ด้วย bcrypt)
- บทบาทผู้ใช้: `บุคลากรมหาลัย`, `เจ้าหน้าที่`, `แอดมิน`
- แจ้งปัญหาและระบุพิกัดบนแผนที่
- ประเภทปัญหาถูกสร้างให้อัตโนมัติเมื่อเริ่มระบบครั้งแรก
- ดูรายการทั้งหมด / รายการของฉัน / รายละเอียด
- แนบรูปภาพได้สูงสุด 5 รูปต่อครั้ง
- เจ้าหน้าที่และแอดมินเปลี่ยนสถานะหรือลบรายการได้

## สิ่งที่ต้องติดตั้ง
1. Node.js (แนะนำรุ่น LTS)
2. MongoDB Community Server หรือ MongoDB Atlas

## วิธีเริ่มใช้งาน
เปิด Terminal ในโฟลเดอร์โปรเจกต์ แล้วรัน:

```bash
npm install
```

คัดลอก `.env.example` เป็น `.env` และแก้ `MONGODB_URI` ให้ตรงกับ MongoDB ของคุณ จากนั้นรัน:

```bash
npm start
```

เปิดเว็บที่ `http://localhost:3000`

## การสร้างบัญชีเจ้าหน้าที่/แอดมิน
การสมัครผ่านหน้าเว็บจะได้ role `บุคลากรมหาลัย` เท่านั้น เพื่อป้องกันผู้ใช้กำหนดสิทธิ์ตัวเองเป็นแอดมิน

หากต้องการทดสอบหน้าจัดการ ให้เปิด MongoDB Compass แล้วแก้ค่า `user_role` ของบัญชีทดสอบใน collection `users` เป็น `เจ้าหน้าที่` หรือ `แอดมิน` จากนั้นออกจากระบบและเข้าสู่ระบบใหม่ เพื่อให้ token มี role ล่าสุด

## API หลัก
| Method | Endpoint | คำอธิบาย |
|---|---|---|
| POST | `/api/v1/auth/register` | สมัครสมาชิก |
| POST | `/api/v1/auth/login` | เข้าสู่ระบบ |
| GET | `/api/v1/categories` | ดูประเภทปัญหา |
| POST | `/api/v1/reports` | สร้างรายการแจ้งปัญหา (ต้อง Login) |
| GET | `/api/v1/reports` | ดูรายการทั้งหมด |
| GET | `/api/v1/reports/:id` | ดูรายละเอียด |
| PATCH | `/api/v1/reports/:id/status` | เปลี่ยนสถานะ (เจ้าหน้าที่/แอดมิน) |
| DELETE | `/api/v1/reports/:id` | ลบรายการ (เจ้าหน้าที่/แอดมิน) |
| GET | `/api/v1/reports/me` | ดูรายการที่ตนเองแจ้ง (ต้อง Login) |
| POST | `/api/v1/reports/:id/images` | เพิ่มรูปภาพ (ต้อง Login และเป็นเจ้าของรายการหรือเจ้าหน้าที่) |

## โครงสร้างข้อมูล
- `users`: `user_name`, `user_email`, `user_password` (hashed), `user_role`
- `categories`: `cat_name`, `cat_icon`, `cat_description`
- `reports`: `user_id`, `cat_id`, `report_title`, `report_desc`, `latitude`, `longitude`, `status`, `created_at`, `updated_at`
- `report_images`: `report_id`, `image_url`, `created_at`

MongoDB สร้าง `_id` ให้อัตโนมัติ ซึ่งทำหน้าที่เป็น ObjectId

## หมายเหตุ
- แผนที่ใช้ Leaflet และ OpenStreetMap ต้องเชื่อมต่ออินเทอร์เน็ต
- รูปภาพตัวอย่างถูกเก็บไว้ในโฟลเดอร์ `uploads/` บนเครื่องเซิร์ฟเวอร์ เหมาะสำหรับการพัฒนา/สาธิต หากนำขึ้นใช้งานจริงควรย้ายไป Object Storage เช่น AWS S3
- ควรเปลี่ยน `JWT_SECRET` ก่อนใช้งานจริง และเพิ่ม HTTPS, validation, rate limit และนโยบายสำรองข้อมูล
- ข้อมูลพิกัดเริ่มต้นของแผนที่เป็นบริเวณลาดกระบัง สามารถเปลี่ยนใน `public/app.js` ได้
"# ServerSideProject" 
