require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "development_secret_change_me";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const userSchema = new mongoose.Schema({
  user_name: { type: String, required: true, trim: true },
  user_email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  user_password: { type: String, required: true },
  user_role: {
    type: String,
    enum: ["บุคลากรมหาลัย", "แอดมิน", "เจ้าหน้าที่"],
    default: "บุคลากรมหาลัย"
  }
}, { timestamps: true });

const categorySchema = new mongoose.Schema({
  cat_name: { type: String, required: true, unique: true },
  cat_icon: { type: String, default: "📌" },
  cat_description: { type: String, default: "" }
}, { timestamps: true });

const reportSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  cat_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  report_title: { type: String, required: true, trim: true },
  report_desc: { type: String, required: true, trim: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "in_progress", "resolved", "rejected"],
    default: "pending"
  }
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const reportImageSchema = new mongoose.Schema({
  report_id: { type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true },
  image_url: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Category = mongoose.model("Category", categorySchema);
const Report = mongoose.model("Report", reportSchema);
const ReportImage = mongoose.model("ReportImage", reportImageSchema);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("อนุญาตเฉพาะไฟล์รูปภาพ"));
    cb(null, true);
  }
});

function makeToken(user) {
  return jwt.sign({ id: user._id, role: user.user_role }, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token ไม่ถูกต้องหรือหมดอายุ" });
  }
}
function staffOnly(req, res, next) {
  if (!["แอดมิน", "เจ้าหน้าที่"].includes(req.auth.role))
    return res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
  next();
}

// AUTH
app.post("/api/v1/auth/register", async (req, res) => {
  try {
    const { user_name, user_email, user_password } = req.body;
    if (!user_name || !user_email || !user_password)
      return res.status(400).json({ message: "กรอกชื่อ อีเมล และรหัสผ่านให้ครบ" });
    if (user_password.length < 6)
      return res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
    const exists = await User.findOne({ user_email });
    if (exists) return res.status(409).json({ message: "อีเมลนี้ถูกใช้งานแล้ว" });
    const hashed = await bcrypt.hash(user_password, 12);
    const user = await User.create({ user_name, user_email, user_password: hashed });
    res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ", token: makeToken(user),
      user: { id: user._id, user_name: user.user_name, user_email: user.user_email, user_role: user.user_role }
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { user_email, user_password } = req.body;
    const user = await User.findOne({ user_email });
    if (!user || !(await bcrypt.compare(user_password || "", user.user_password)))
      return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    res.json({
      message: "เข้าสู่ระบบสำเร็จ", token: makeToken(user),
      user: { id: user._id, user_name: user.user_name, user_email: user.user_email, user_role: user.user_role }
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// CATEGORIES
app.get("/api/v1/categories", async (_req, res) => {
  try { res.json(await Category.find().sort({ cat_name: 1 })); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// REPORTS
app.post("/api/v1/reports", auth, async (req, res) => {
  try {
    const { cat_id, report_title, report_desc, latitude, longitude } = req.body;
    if (!cat_id || !report_title || !report_desc || latitude === undefined || longitude === undefined)
      return res.status(400).json({ message: "กรุณากรอกข้อมูลและตำแหน่งให้ครบ" });
    const report = await Report.create({
      user_id: req.auth.id, cat_id, report_title, report_desc,
      latitude: Number(latitude), longitude: Number(longitude)
    });
    res.status(201).json({ message: "ส่งเรื่องแจ้งปัญหาแล้ว", report });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.get("/api/v1/reports/me", auth, async (req, res) => {
  try {
    const reports = await Report.find({ user_id: req.auth.id })
      .populate("cat_id", "cat_name cat_icon").sort({ created_at: -1 });
    const ids = reports.map(r => r._id);
    const images = await ReportImage.find({ report_id: { $in: ids } });
    res.json(reports.map(r => ({ ...r.toObject(), images: images.filter(i => String(i.report_id) === String(r._id)) })));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get("/api/v1/reports", async (_req, res) => {
  try {
    const reports = await Report.find().populate("cat_id", "cat_name cat_icon")
      .populate("user_id", "user_name").sort({ created_at: -1 });
    const ids = reports.map(r => r._id);
    const images = await ReportImage.find({ report_id: { $in: ids } });
    res.json(reports.map(r => ({ ...r.toObject(), images: images.filter(i => String(i.report_id) === String(r._id)) })));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get("/api/v1/reports/:id", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("cat_id", "cat_name cat_icon").populate("user_id", "user_name");
    if (!report) return res.status(404).json({ message: "ไม่พบรายการแจ้งปัญหา" });
    const images = await ReportImage.find({ report_id: report._id });
    res.json({ ...report.toObject(), images });
  } catch (e) { res.status(400).json({ message: "รหัสรายการไม่ถูกต้อง" }); }
});

app.patch("/api/v1/reports/:id/status", auth, staffOnly, async (req, res) => {
  try {
    const allowed = ["pending", "in_progress", "resolved", "rejected"];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });
    const report = await Report.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!report) return res.status(404).json({ message: "ไม่พบรายการแจ้งปัญหา" });
    res.json({ message: "อัปเดตสถานะแล้ว", report });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.delete("/api/v1/reports/:id", auth, staffOnly, async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ message: "ไม่พบรายการแจ้งปัญหา" });
    await ReportImage.deleteMany({ report_id: report._id });
    res.status(204).send();
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.post("/api/v1/reports/:id/images", auth, imageUpload.array("images", 5), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "ไม่พบรายการแจ้งปัญหา" });
    if (String(report.user_id) !== req.auth.id && !["แอดมิน", "เจ้าหน้าที่"].includes(req.auth.role))
      return res.status(403).json({ message: "ไม่มีสิทธิ์เพิ่มรูปในรายการนี้" });
    const docs = await ReportImage.insertMany((req.files || []).map(f => ({
      report_id: report._id, image_url: `/uploads/${f.filename}`
    })));
    res.status(201).json({ message: "อัปโหลดรูปภาพสำเร็จ", images: docs });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// Initial categories for first run
async function seedCategories() {
  const defaults = [
    ["ถนนและทางเดิน", "🛣️", "ถนนชำรุด ทางเท้าเสียหาย หรือทางเดินไม่ปลอดภัย"],
    ["ไฟฟ้าและแสงสว่าง", "💡", "ไฟดับ ไฟเสีย หรือไฟส่องสว่างไม่เพียงพอ"],
    ["น้ำและท่อระบายน้ำ", "💧", "น้ำท่วม ท่ออุดตัน หรือน้ำประปาขัดข้อง"],
    ["อุบัติเหตุและความปลอดภัย", "⚠️", "อุบัติเหตุหรือเหตุการณ์ที่อาจเป็นอันตราย"],
    ["อาคารและสถานที่", "🏢", "อุปกรณ์หรือพื้นที่ภายในอาคารชำรุด"],
    ["อื่น ๆ", "📌", "ปัญหาอื่นภายในมหาวิทยาลัย"]
  ];
  for (const [cat_name, cat_icon, cat_description] of defaults)
    await Category.updateOne({ cat_name }, { $setOnInsert: { cat_name, cat_icon, cat_description } }, { upsert: true });
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "เสียงของมหาลัย API" }));

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campus_voice")
  .then(async () => {
    console.log("Connected to MongoDB");
    await seedCategories();
    app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
  })
  .catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ message: err.message || "เกิดข้อผิดพลาด" });
});
