const API = "/api/v1";
let token = localStorage.getItem("cv_token") || "";
let currentUser = JSON.parse(localStorage.getItem("cv_user") || "null");
let reportsCache = [];
let map, marker;
let authMode = "login";
const statusText = {pending:"รอดำเนินการ",in_progress:"กำลังดำเนินการ",resolved:"แก้ไขแล้ว",rejected:"ไม่รับดำเนินการ"};

async function api(path, options={}) {
  const headers = options.headers || {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData) && options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(API + path, {...options, headers});
  if (response.status === 204) return null;
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");
  return data;
}
function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function showPage(name){
  document.querySelectorAll("main .page").forEach(p=>p.classList.add("hidden"));
  const el=document.getElementById(name+"Page"); if(el)el.classList.remove("hidden");
  if(name==="home")loadLatest(); if(name==="reports")loadReports(); if(name==="mine")loadMine();
  if(name==="create"){if(!currentUser){showPage("auth");return}loadCategories().then(initMap)}
  window.scrollTo({top:0,behavior:"smooth"});
}
function updateAccount(){
  const area=document.getElementById("accountArea");
  area.innerHTML=currentUser?`<span class="user-chip">สวัสดี, ${escapeHtml(currentUser.user_name)} </span> <button class="text-btn" onclick="logout()">ออกจากระบบ</button>`:`<button class="btn secondary" onclick="showPage('auth')">เข้าสู่ระบบ</button>`;
}
function logout(){token="";currentUser=null;localStorage.removeItem("cv_token");localStorage.removeItem("cv_user");updateAccount();toast("ออกจากระบบแล้ว");showPage("home")}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function statusBadge(status){return `<span class="status ${status}">${statusText[status]||status}</span>`}
function card(r){
  const cat=r.cat_id||{};const img=r.images?.[0]?.image_url;
  const date=r.created_at?new Date(r.created_at).toLocaleDateString("th-TH"):"";
  return `<article class="report-card" onclick="showDetail('${r._id}')"><div class="report-image">${img?`<img src="${img}" alt="ภาพประกอบ">`:(cat.cat_icon||"📌")}</div><div class="report-body"><h3>${escapeHtml(r.report_title)}</h3><p>${escapeHtml(r.report_desc)}</p><div class="meta"><span>${escapeHtml(cat.cat_name||"ไม่ระบุประเภท")} · ${date}</span>${statusBadge(r.status)}</div></div></article>`;
}
function renderList(target,arr){document.getElementById(target).innerHTML=arr.length?arr.map(card).join(""):`<div class="empty">ยังไม่มีรายการแจ้งปัญหา</div>`}
async function loadLatest(){try{const a=await api("/reports");reportsCache=a;renderList("latestReports",a.slice(0,3))}catch(e){document.getElementById("latestReports").innerHTML='<div class="empty">ไม่สามารถโหลดข้อมูลได้</div>'}}
async function loadReports(){try{reportsCache=await api("/reports");renderReports()}catch(e){document.getElementById("allReports").innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}}
function renderReports(){const q=(document.getElementById("searchReports")?.value||"").toLowerCase();const st=document.getElementById("filterStatus")?.value||"";renderList("allReports",reportsCache.filter(r=>(!st||r.status===st)&&(`${r.report_title} ${r.report_desc}`).toLowerCase().includes(q)))}
async function loadMine(){if(!currentUser){showPage("auth");return}try{const a=await api("/reports/me");renderList("myReports",a)}catch(e){toast(e.message)}}
async function loadCategories(){try{const cats=await api("/categories");document.getElementById("categorySelect").innerHTML='<option value="">เลือกประเภทปัญหา</option>'+cats.map(c=>`<option value="${c._id}">${c.cat_icon||"📌"} ${escapeHtml(c.cat_name)}</option>`).join("")}catch(e){toast(e.message)}}
function initMap(){
  if(map){setTimeout(()=>map.invalidateSize(),150);return}
  map=L.map("map").setView([13.729,100.775],15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);
  map.on("click",e=>setMarker(e.latlng.lat,e.latlng.lng));
  setTimeout(()=>map.invalidateSize(),250);
}
function setMarker(lat,lng){
  if(marker)marker.setLatLng([lat,lng]);else marker=L.marker([lat,lng],{draggable:true}).addTo(map).on("dragend",e=>{const p=e.target.getLatLng();setMarker(p.lat,p.lng)});
  document.getElementById("latitude").value=lat;document.getElementById("longitude").value=lng;
  document.getElementById("latText").textContent=lat.toFixed(6);document.getElementById("lngText").textContent=lng.toFixed(6);
}
function locateMe(){
  if(!navigator.geolocation)return toast("เบราว์เซอร์ไม่รองรับตำแหน่งปัจจุบัน");
  navigator.geolocation.getCurrentPosition(pos=>{const {latitude,longitude}=pos.coords;map.setView([latitude,longitude],17);setMarker(latitude,longitude)},()=>toast("ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาอนุญาต Location"));
}
document.getElementById("reportForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!currentUser)return showPage("auth");
  const f=new FormData(e.target);const latitude=f.get("latitude"),longitude=f.get("longitude");
  if(!latitude||!longitude)return toast("กรุณาปักหมุดตำแหน่งบนแผนที่");
  try{const result=await api("/reports",{method:"POST",body:JSON.stringify(Object.fromEntries(f))});toast("ส่งเรื่องแจ้งปัญหาเรียบร้อย");
    e.target.reset();if(marker){map.removeLayer(marker);marker=null}document.getElementById("latText").textContent="ยังไม่ได้เลือก";document.getElementById("lngText").textContent="ยังไม่ได้เลือก";
    showDetail(result.report._id);
  }catch(err){toast(err.message)}
});
async function showDetail(id){
  showPage("detail");
  try{
    const r=await api("/reports/"+id);const images=(r.images||[]).map(i=>`<img src="${i.image_url}" alt="ภาพประกอบ">`).join("");
    const staff=["แอดมิน","เจ้าหน้าที่"].includes(currentUser?.user_role);
    document.getElementById("reportDetail").innerHTML=`<div class="detail-card"><span class="eyebrow">${escapeHtml(r.cat_id?.cat_name||"รายงาน")}</span><h1>${escapeHtml(r.report_title)}</h1>${statusBadge(r.status)}<p>${escapeHtml(r.report_desc)}</p><p class="meta">ผู้แจ้ง: ${escapeHtml(r.user_id?.user_name||"ผู้ใช้งาน")} · ${new Date(r.created_at).toLocaleString("th-TH")}</p><div class="detail-images">${images||"<span class='meta'>ไม่มีรูปภาพประกอบ</span>"}</div><p class="meta">ตำแหน่ง: ${Number(r.latitude).toFixed(6)}, ${Number(r.longitude).toFixed(6)}</p><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${r.latitude},${r.longitude}">เปิดตำแหน่งใน Google Maps ↗</a>
    ${currentUser&&String(r.user_id?._id||r.user_id)===String(currentUser.id)?`<form id="imageForm" style="margin-top:20px"><label>เพิ่มรูปภาพประกอบ (สูงสุด 5 รูป, ไม่เกิน 5MB/รูป)</label><input type="file" name="images" accept="image/*" multiple><button class="btn secondary" style="margin-top:10px">อัปโหลดรูป</button></form>`:""}
    ${staff?`<div class="admin-tools"><b>จัดการสถานะ</b><select id="adminStatus">${Object.entries(statusText).map(([k,v])=>`<option value="${k}" ${r.status===k?"selected":""}>${v}</option>`).join("")}</select><button class="btn primary" onclick="changeStatus('${r._id}')">บันทึก</button><button class="btn secondary" onclick="deleteReport('${r._id}')">ลบรายการ</button></div>`:""}
    </div>`;
    const imageForm=document.getElementById("imageForm");if(imageForm)imageForm.addEventListener("submit",async ev=>{ev.preventDefault();const fd=new FormData();[...imageForm.querySelector('input[type=file]').files].forEach(file=>fd.append("images",file));try{await api(`/reports/${id}/images`,{method:"POST",body:fd});toast("อัปโหลดรูปสำเร็จ");showDetail(id)}catch(e){toast(e.message)}});
  }catch(e){document.getElementById("reportDetail").innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
async function changeStatus(id){try{await api(`/reports/${id}/status`,{method:"PATCH",body:JSON.stringify({status:document.getElementById("adminStatus").value})});toast("อัปเดตสถานะแล้ว");showDetail(id)}catch(e){toast(e.message)}}
async function deleteReport(id){if(!confirm("ยืนยันลบรายการนี้?"))return;try{await api(`/reports/${id}`,{method:"DELETE"});toast("ลบรายการแล้ว");showPage("reports")}catch(e){toast(e.message)}}
function toggleAuth(){
  authMode=authMode==="login"?"register":"login";
  document.getElementById("authTitle").textContent=authMode==="login"?"เข้าสู่ระบบ":"สมัครสมาชิก";
  document.getElementById("authSubtitle").textContent=authMode==="login"?"เข้าสู่ระบบเพื่อแจ้งปัญหาและติดตามผล":"สร้างบัญชีเพื่อร่วมเป็นส่วนหนึ่งในการพัฒนามหาวิทยาลัย";
  document.getElementById("nameField").classList.toggle("hidden",authMode==="login");
  document.getElementById("authSubmit").textContent=authMode==="login"?"เข้าสู่ระบบ":"สมัครสมาชิก";
  document.getElementById("authSwitch").innerHTML=authMode==="login"?'ยังไม่มีบัญชี? <a onclick="toggleAuth()">สมัครสมาชิก</a>':'มีบัญชีแล้ว? <a onclick="toggleAuth()">เข้าสู่ระบบ</a>';
}
document.getElementById("authForm").addEventListener("submit",async e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(e.target));
  try{const result=await api(`/auth/${authMode==="login"?"login":"register"}`,{method:"POST",body:JSON.stringify(data)});token=result.token;currentUser=result.user;localStorage.setItem("cv_token",token);localStorage.setItem("cv_user",JSON.stringify(currentUser));updateAccount();toast(result.message);showPage("home")}
  catch(err){toast(err.message)}
});
updateAccount();loadLatest();
