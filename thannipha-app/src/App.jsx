import React, { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import {
  LayoutDashboard, ShoppingCart, Package, History, LogOut, Search, Plus, Trash2, Edit,
  CheckCircle, X, Printer, Sparkles, Users, Lock, UserCircle, Calculator, PieChart,
  Calendar, Banknote, CreditCard, ArrowRightLeft, TrendingUp, CheckSquare, Menu,
  UserPlus, BellRing, Filter, WifiOff, Save, Download, Upload, FileSpreadsheet,
  ChevronLeft, ChevronRight, FileText, Settings, Store, BookUser, AlertCircle,
  HandCoins, CalendarClock, RotateCcw, Truck, ClipboardList, Database, MapPin, ScanLine, QrCode
} from "lucide-react";

// --- ข้อมูลเริ่มต้น (ตัวอย่างตอนติดตั้งร้านครั้งแรก) ---
const initialProducts = [
  { id: 1, barcode: "1001", name: "กล้อง กข.43", category: "ข้าวโล", cost: 28.0, price: 55.0, stock: 50, lastChecked: null },
  { id: 2, barcode: "1002", name: "ข้าวกล้องแดง", category: "ข้าวโล", cost: 42.0, price: 69.0, stock: 50, lastChecked: null },
  { id: 3, barcode: "1003", name: "ข้าวขาวเก่าคัดพิเศษ(แปดเพชร)", category: "ข้าวโล", cost: 22.0, price: 27.0, stock: 50, lastChecked: null },
];
const initialCustomers = [{ id: 1, phone: "0812345678", name: "คุณ สมชาย ใจดี", type: "Member", points: 2, accumulatedQty: 45, totalSpent: 15000, lastVisit: Date.now() - 5 * 86400000 }];
const initialSettings = { 
  printerSize: "80mm", autoPrint: false, 
  pointSystem: { qtyPerPoint: 100, bahtPerPoint: 10 },
  hardware: { scannerEnabled: true, wirelessPrinterIp: "", qrWalletEnabled: false }
};
const initialSuppliers = [{ id: 1, name: "ซัพพลายเออร์ A (ตลาดไท)" }, { id: 2, name: "บริษัท ส่งข้าว จำกัด" }];

// --- Helper Functions สำหรับโหลดเป็นไฟล์ Excel และ PDF ---
const exportToCSV = (headers, rows, filename) => {
  const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click(); URL.revokeObjectURL(url);
};

const exportToPDF = (title, headers, rows, footerHtml = "") => {
  const printWindow = window.open("", "", "height=600,width=800");
  printWindow.document.write(`<html><head><title>${title}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:14px}th,td{border:1px solid #cbd5e1;padding:8px 12px;text-align:left}th{background-color:#f1f5f9;font-weight:bold}.footer-summary{margin-top:20px;padding:15px;background:#f8fafc;font-weight:bold;border:1px solid #cbd5e1}</style></head><body><h2>${title}</h2>`);
  printWindow.document.write('<div style="text-align:right;font-size:12px;margin-bottom:10px;color:#64748b">พิมพ์เมื่อ: ' + new Date().toLocaleString("th-TH") + "</div>");
  printWindow.document.write("<table><thead><tr>");
  headers.forEach((h) => printWindow.document.write("<th>" + h + "</th>"));
  printWindow.document.write("</tr></thead><tbody>");
  rows.forEach((row) => { printWindow.document.write("<tr>"); row.forEach((c) => printWindow.document.write("<td>" + (c || "-") + "</td>")); printWindow.document.write("</tr>"); });
  printWindow.document.write("</tbody></table>" + (footerHtml ? `<div class="footer-summary">${footerHtml}</div>` : "") + "</body></html>");
  printWindow.document.close(); setTimeout(() => { printWindow.print(); }, 250);
};

const ExportButtons = ({ onCSV, onPDF }) => (
  <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
    <button onClick={onCSV} className="flex-1 md:flex-none justify-center bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center shadow-sm border border-emerald-200"><Download size={16} className="mr-1.5" /> Excel</button>
    <button onClick={onPDF} className="flex-1 md:flex-none justify-center bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center shadow-sm border border-rose-200"><Printer size={16} className="mr-1.5" /> PDF</button>
  </div>
);

const callGeminiAPI = async (prompt) => { return "ฟีเจอร์ AI วิเคราะห์ (ระบบจำลอง กรุณาใส่ API Key จริงเพื่อเปิดใช้งาน)"; };

// --- 🌟 APP COMPONENT หลัก 🌟 ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  });
  const [currentTab, setCurrentTab] = useState("pos");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopMenuCollapsed, setIsDesktopMenuCollapsed] = useState(false);
  
  // จัดการสาขา
  const [currentBranch, setCurrentBranch] = useState("1"); 

  // State เก็บข้อมูลทั้งหมด
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [accountingEntries, setAccountingEntries] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [settings, setSettings] = useState({});
  const [shiftState, setShiftState] = useState({});
  const [shiftHistory, setShiftHistory] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [debtPayments, setDebtPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [conversionRequests, setConversionRequests] = useState([]); 

  // ดึงข้อมูล Real-time จาก Firebase
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "products"), (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "customers"), (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "salesHistory"), (snap) => setSalesHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "accounting"), (snap) => setAccountingEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "admins"), (snap) => setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "employees"), (snap) => {
        const emps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEmployees(emps.length > 0 ? emps : [{ pin: "12345", name: "พนักงานขาย 1", branch: "1" }]);
      }),
      onSnapshot(collection(db, "settings"), (snap) => { 
        const sets = {}; snap.docs.forEach(d => { sets[d.id] = d.data(); }); setSettings(sets);
      }),
      onSnapshot(collection(db, "shiftState"), (snap) => { 
        const states = {}; snap.docs.forEach(d => { states[d.id] = d.data(); }); setShiftState(states);
      }),
      onSnapshot(collection(db, "shiftHistory"), (snap) => setShiftHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "debtors"), (snap) => setDebtors(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "debtPayments"), (snap) => setDebtPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "receipts"), (snap) => setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "suppliers"), (snap) => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "conversions"), (snap) => setConversionRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      if (currentUser.role === "employee" && currentUser.branch) setCurrentBranch(currentUser.branch);
    } else {
      localStorage.removeItem("currentUser");
    }
  }, [currentUser]);

  // คัดกรองข้อมูลให้แสดงเฉพาะสาขาที่เลือก
  const branchProducts = products.filter(p => p.branch === currentBranch);
  const branchSalesHistory = salesHistory.filter(s => s.branch === currentBranch);
  const branchAccountingEntries = accountingEntries.filter(a => a.branch === currentBranch);
  const branchShiftHistory = shiftHistory.filter(h => h.branch === currentBranch);
  const branchReceipts = receipts.filter(r => r.branch === currentBranch);
  const branchConversions = conversionRequests.filter(c => c.branch === currentBranch);
  const currentShiftState = shiftState[`branch_${currentBranch}`] || { isOpen: false, startTime: null, startingCash: 0 };
  const currentSettings = settings[`branch_${currentBranch}`] || initialSettings;

  // ฟังก์ชันบันทึก/ลบ ข้อมูลลงฐานข้อมูล Cloud
  const saveToDB = async (col, id, data) => { try { await setDoc(doc(db, col, String(id)), data, { merge: true }); } catch (e) { console.error("DB Error:", e); } };
  const delFromDB = async (col, id) => { try { await deleteDoc(doc(db, col, String(id))); } catch (e) { console.error("DB Error:", e); } };

  // บันทึกแบบระบุสาขา
  const addProduct = (p) => saveToDB("products", p.id, p.branch ? p : { ...p, branch: currentBranch });
  const updateProduct = addProduct;
  const deleteProduct = (id) => delFromDB("products", id);
  const addSale = (s) => saveToDB("salesHistory", s.id, { ...s, branch: currentBranch });
  const updateSale = addSale; 
  const addAccounting = (e) => saveToDB("accounting", e.id, { ...e, branch: currentBranch });
  const deleteAccounting = (id) => delFromDB("accounting", id);
  const updateShiftState = (s) => saveToDB("shiftState", `branch_${currentBranch}`, { ...s, branch: currentBranch });
  const addShiftHistory = (h) => saveToDB("shiftHistory", h.id, { ...h, branch: currentBranch });
  const updateSettings = (s) => saveToDB("settings", `branch_${currentBranch}`, { ...s, branch: currentBranch });
  const addReceipt = (r) => saveToDB("receipts", r.id, { ...r, branch: currentBranch });
  const deleteSupplier = (id) => delFromDB("suppliers", id);

  // บันทึกแบบแชร์ทุกสาขา (ลูกค้า, ลูกหนี้, ขออนุมัติแปลงสินค้า)
  const addCustomer = (c) => saveToDB("customers", c.id, c);
  const updateCustomer = addCustomer;
  const deleteCustomer = (id) => delFromDB("customers", id);
  const addDebtor = (d) => saveToDB("debtors", d.id, d);
  const updateDebtor = addDebtor;
  const deleteDebtor = (id) => delFromDB("debtors", id);
  const addDebtPayment = (p) => saveToDB("debtPayments", p.id, p); 
  const addSupplier = (s) => saveToDB("suppliers", s.id, s);

  const addConversionRequest = (req) => saveToDB("conversions", req.id, { ...req, branch: currentBranch, status: "pending" });
  const approveConversion = (req) => saveToDB("conversions", req.id, { ...req, status: "approved" });
  const rejectConversion = (req) => saveToDB("conversions", req.id, { ...req, status: "rejected" });

  // ฟังก์ชันพิเศษ: ยกเลิกบิลและคืนสต๊อก (แอดมิน)
  const handleVoidSale = (sale) => {
    if (!window.confirm(`ยืนยันการยกเลิกบิล ${sale.id} และคืนสต๊อกสินค้าทั้งหมดกลับเข้าคลังใช่หรือไม่?\n\n(ยอดขายและรายการนี้จะถูกลบออกจากประวัติ)`)) return;
    (sale.items || []).forEach(item => {
      const product = branchProducts.find(p => p.id === item.id);
      if (product) updateProduct({ ...product, stock: product.stock + item.qty });
    });
    delFromDB("salesHistory", sale.id);
    alert(`ยกเลิกบิล ${sale.id} และคืนสต๊อกเรียบร้อยแล้ว`);
  };

  const addAdmin = (a) => saveToDB("admins", a.username, a);
  const deleteAdmin = (id) => delFromDB("admins", id);
  const addEmployee = (e) => saveToDB("employees", e.pin, e); 
  const deleteEmployee = (id) => delFromDB("employees", id);
  
  // ฟังก์ชันตั้งร้านครั้งแรก (Seed Data)
  const loadInitialDataToFirebase = () => {
    if(window.confirm(`ยืนยันการโหลดข้อมูลสินค้าตัวอย่าง เข้าสู่ "สาขา ${currentBranch}"?`)) {
      initialProducts.forEach(p => addProduct({ ...p, branch: currentBranch }));
      initialCustomers.forEach(c => addCustomer(c));
      initialSuppliers.forEach(s => addSupplier(s));
      alert("โหลดข้อมูลเริ่มต้นเรียบร้อยแล้ว!");
    }
  };

  // ฟังก์ชันกู้คืนระบบจากไฟล์ Backup JSON
  const handleFullRestore = (data) => {
    if (!window.confirm("⚠️ คำเตือน: ระบบจะเขียนทับข้อมูลทั้งหมด ยืนยันหรือไม่?")) return;
    try {
      if (data.products) data.products.forEach(p => saveToDB("products", p.id, p));
      if (data.customers) data.customers.forEach(c => addCustomer(c));
      if (data.salesHistory) data.salesHistory.forEach(s => saveToDB("salesHistory", s.id, s));
      if (data.accountingEntries) data.accountingEntries.forEach(e => saveToDB("accounting", e.id, e));
      if (data.debtors) data.debtors.forEach(d => addDebtor(d));
      if (data.suppliers) data.suppliers.forEach(s => addSupplier(s));
      if (data.receipts) data.receipts.forEach(r => saveToDB("receipts", r.id, r));
      alert("กู้คืนข้อมูลสำเร็จ! ข้อมูลกำลังทำงานกับ Cloud...");
    } catch (err) { alert("เกิดข้อผิดพลาดในการกู้คืน: " + err.message); }
  };

  // จัดการการเข้าระบบ
  const handleLogin = (user) => {
    setCurrentUser(user);
    if (user.role === "employee" && user.branch) setCurrentBranch(user.branch);
    if (!shiftState[`branch_${user.branch || currentBranch}`]?.isOpen) setCurrentTab("shift"); else setCurrentTab("pos");
  };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} admins={admins} employees={employees} />;

  const isOwner = currentUser.role === "owner";
  const isEmployee = currentUser.role === "employee";
  const navigateTo = (tab) => { setCurrentTab(tab); setIsMobileMenuOpen(false); };

  const allDatabaseData = { products: branchProducts, customers, salesHistory: branchSalesHistory, accountingEntries: branchAccountingEntries, admins, employees, shiftHistory: branchShiftHistory, debtors, debtPayments, receipts: branchReceipts, suppliers, settings: currentSettings };
  const pendingConversionsCount = branchConversions.filter(c => c.status === "pending").length;

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* 🌟 Header มือถือ */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-800 text-white flex items-center justify-between px-4 z-30 shadow-md">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-green-400 leading-tight">sUriYaN<span className="text-white">_POS_</span></h1>
          <span className="text-[10px] text-blue-300">สาขา {currentBranch}</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 relative">
          {pendingConversionsCount > 0 && !isEmployee && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>}
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-20" onClick={() => setIsMobileMenuOpen(false)}></div>}

      {/* 🌟 แถบเมนูด้านซ้าย (Sidebar) */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 bg-slate-800 text-white flex flex-col shadow-xl transition-all duration-300 ${isMobileMenuOpen ? "translate-x-0 w-64" : `-translate-x-full md:translate-x-0 ${isDesktopMenuCollapsed ? "md:w-20" : "md:w-64"}`}`}>
        <div className="p-4 md:p-6 text-center border-b border-slate-700 hidden md:flex flex-col items-center relative">
          {!isDesktopMenuCollapsed ? (
            <>
              <h1 className="text-2xl font-bold text-green-400 transition-opacity duration-300">sUriYaN<span className="text-white">_POS_</span></h1>
              <span className="inline-flex items-center mt-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold"><Store size={12} className="mr-1" /> เชื่อมต่อ Cloud สำเร็จ</span>
            </>
          ) : (<h1 className="text-xl font-bold text-green-400 mt-2">sUri<br /><span className="text-white">YaN</span></h1>)}
          <button onClick={() => setIsDesktopMenuCollapsed(!isDesktopMenuCollapsed)} className="absolute -right-3 top-6 bg-slate-700 rounded-full p-1 text-gray-300 border border-slate-600 shadow-md z-40 hidden md:block">{isDesktopMenuCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
        </div>

        {!isEmployee && !isDesktopMenuCollapsed && (
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-700">
            <label className="text-[10px] text-slate-400 font-bold block mb-1 flex items-center"><MapPin size={12} className="mr-1"/> สาขาที่ดูแล</label>
            <select value={currentBranch} onChange={(e) => setCurrentBranch(e.target.value)} className="w-full bg-slate-700 text-white p-2 rounded text-sm font-bold outline-none border border-slate-600 focus:border-green-500 transition-colors">
              <option value="1">📍 สาขาที่ 1</option><option value="2">📍 สาขาที่ 2</option>
            </select>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto mt-16 md:mt-0 hide-scrollbar">
          <SidebarItem icon={<ShoppingCart size={20} />} label="ขายสินค้า (POS)" active={currentTab === "pos"} onClick={() => navigateTo("pos")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
          <SidebarItem icon={<Store size={20} />} label="เปิด-ปิดกะ" active={currentTab === "shift"} onClick={() => navigateTo("shift")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
          <SidebarItem icon={<BookUser size={20} />} label="ระบบลูกหนี้" active={currentTab === "debtors"} onClick={() => navigateTo("debtors")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
          
          {/* เมนูคลังสินค้า (มีแจ้งเตือนเวลามีคำขออนุมัติ) */}
          <button onClick={() => navigateTo("inventory")} className={`flex items-center w-full p-3 rounded-md font-medium transition-all relative ${currentTab === "inventory" ? "bg-green-600 text-white shadow" : "text-slate-300 hover:bg-slate-700 hover:text-white"} ${isDesktopMenuCollapsed && !isMobileMenuOpen ? "justify-center" : ""}`}>
            <span className={isDesktopMenuCollapsed && !isMobileMenuOpen ? "" : "mr-3"}><Package size={20} /></span>
            {!(isDesktopMenuCollapsed && !isMobileMenuOpen) && <span>คลังสินค้า</span>}
            {pendingConversionsCount > 0 && !isEmployee && (<span className={`absolute ${isDesktopMenuCollapsed && !isMobileMenuOpen ? "top-1 right-1" : "right-3"} bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full`}>{pendingConversionsCount}</span>)}
          </button>

          <SidebarItem icon={<UserPlus size={20} />} label="ระบบลูกค้า" active={currentTab === "customers"} onClick={() => navigateTo("customers")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
          
          {!isEmployee && (
            <>
              <SidebarItem icon={<LayoutDashboard size={20} />} label="แดชบอร์ด" active={currentTab === "dashboard"} onClick={() => navigateTo("dashboard")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
              <SidebarItem icon={<Calculator size={20} />} label="บัญชี" active={currentTab === "accounting"} onClick={() => navigateTo("accounting")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
              <SidebarItem icon={<Truck size={20} />} label="รับเข้าสินค้า" active={currentTab === "receive"} onClick={() => navigateTo("receive")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
              <SidebarItem icon={<ClipboardList size={20} />} label="รายงานรับเข้า" active={currentTab === "receipt_report"} onClick={() => navigateTo("receipt_report")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
            </>
          )}

          <SidebarItem icon={<History size={20} />} label="ประวัติการขาย" active={currentTab === "history"} onClick={() => navigateTo("history")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
          <SidebarItem icon={<FileText size={20} />} label="รายงานขาย" active={currentTab === "reports"} onClick={() => navigateTo("reports")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
          <SidebarItem icon={<Settings size={20} />} label="ตั้งค่าเครื่อง" active={currentTab === "settings"} onClick={() => navigateTo("settings")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
          
          {!isEmployee && (
            <>
              <SidebarItem icon={<Users size={20} />} label="จัดการพนักงาน" active={currentTab === "users"} onClick={() => navigateTo("users")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
              <SidebarItem icon={<Database size={20} />} label="ตั้งค่าฐานข้อมูล" active={currentTab === "backup"} onClick={() => navigateTo("backup")} collapsed={isDesktopMenuCollapsed && !isMobileMenuOpen} />
            </>
          )}
        </nav>
        <div className="p-3 md:p-4 border-t border-slate-700 bg-slate-850">
          <button onClick={() => setCurrentUser(null)} className="w-full flex items-center p-2 text-slate-300 hover:text-red-400 bg-slate-700 rounded-md transition-colors"><LogOut size={20} className="mr-3" /> ออกจากระบบ</button>
        </div>
      </aside>

      {/* 🌟 พื้นที่แสดงผลตรงกลาง (Main Content) */}
      <main className="flex-1 overflow-hidden flex flex-col pt-16 md:pt-0 w-full relative bg-gray-100">
        <div className="flex-1 overflow-hidden flex flex-col">
          {currentTab === "pos" && <POSSystem products={branchProducts} updateProduct={updateProduct} customers={customers} updateCustomer={updateCustomer} currentUser={currentUser} onSaleComplete={addSale} settings={currentSettings} shiftState={currentShiftState} onNavigate={navigateTo} onAddDebtor={addDebtor} />}
          {currentTab === "shift" && <ShiftManagement shiftState={currentShiftState} setShiftState={updateShiftState} salesHistory={branchSalesHistory} currentUser={currentUser} shiftHistory={branchShiftHistory} setShiftHistory={addShiftHistory} debtPayments={debtPayments} />}
          {currentTab === "debtors" && <DebtorManager debtors={debtors} updateDebtor={updateDebtor} deleteDebtor={deleteDebtor} addDebtor={addDebtor} customers={customers} debtPayments={debtPayments} addDebtPayment={addDebtPayment} currentUser={currentUser} currentBranch={currentBranch} />}
          {currentTab === "receive" && !isEmployee && <GoodsReceiptManager products={branchProducts} updateProduct={updateProduct} addReceipt={addReceipt} currentUser={currentUser} suppliers={suppliers} addSupplier={addSupplier} deleteSupplier={deleteSupplier} />}
          {currentTab === "inventory" && <InventoryManager products={branchProducts} addProduct={addProduct} updateProduct={updateProduct} deleteProduct={deleteProduct} currentUser={currentUser} currentBranch={currentBranch} conversionRequests={branchConversions} addConversionRequest={addConversionRequest} approveConversion={approveConversion} rejectConversion={rejectConversion} />}
          {currentTab === "customers" && <CustomerManager customers={customers} addCustomer={addCustomer} updateCustomer={updateCustomer} deleteCustomer={deleteCustomer} currentUser={currentUser} />}
          {currentTab === "dashboard" && !isEmployee && <Dashboard salesHistory={branchSalesHistory} products={branchProducts} currentBranch={currentBranch} />}
          {currentTab === "accounting" && !isEmployee && <AccountingDashboard salesHistory={branchSalesHistory} accountingEntries={branchAccountingEntries} addAccounting={addAccounting} deleteAccounting={deleteAccounting} currentBranch={currentBranch} />}
          {currentTab === "history" && <SalesHistory salesHistory={branchSalesHistory} currentUser={currentUser} updateSale={updateSale} onVoidSale={handleVoidSale} />}
          {currentTab === "reports" && <SalesReport salesHistory={branchSalesHistory} currentUser={currentUser} currentBranch={currentBranch} />}
          {currentTab === "receipt_report" && !isEmployee && <ReceiptReport receipts={branchReceipts} currentUser={currentUser} currentBranch={currentBranch} />}
          {currentTab === "settings" && <SettingsPanel settings={currentSettings} setSettings={updateSettings} currentBranch={currentBranch} />}
          {currentTab === "users" && !isEmployee && <UserManagement currentUser={currentUser} admins={admins} addAdmin={addAdmin} deleteAdmin={deleteAdmin} employees={employees} addEmployee={addEmployee} deleteEmployee={deleteEmployee} />}
          {currentTab === "backup" && !isEmployee && <DatabaseManager onSeedData={loadInitialDataToFirebase} onFullRestore={handleFullRestore} allData={allDatabaseData} addProduct={addProduct} updateProduct={updateProduct} addCustomer={addCustomer} updateCustomer={updateCustomer} currentBranch={currentBranch} />}
        </div>
      </main>
    </div>
  );
}// ------------------------------------------
// Login Screen & SidebarItem
// ------------------------------------------
function LoginScreen({ onLogin, admins, employees }) {
  const [loginMode, setLoginMode] = useState("employee");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (username === "Tnp08" && password === "sUriyan01") return onLogin({ role: "owner", username: "Tnp08", name: "เจ้าของร้าน" });
    const adminUser = (admins || []).find((a) => a.username === username && a.password === password);
    if (adminUser) return onLogin({ role: "admin", username: adminUser.username, name: adminUser.username });
    alert("Username หรือ Password ไม่ถูกต้อง!");
  };

  const handleEmployeeLogin = (e) => {
    e.preventDefault();
    if(pin === "12345") return onLogin({ role: "employee", username: "12345", name: "พนักงานขาย 1", branch: "1" }); 
    const empUser = (employees || []).find((e) => e.pin === pin);
    if (empUser) return onLogin({ role: "employee", username: empUser.pin, name: empUser.name, branch: empUser.branch || "1" });
    alert("ไม่พบรหัส PIN นี้ในระบบ");
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-100 p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>

      <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-green-500 z-10">
        <h1 className="text-3xl font-bold text-center mb-2 text-slate-800 tracking-tight">sUriYaN<span className="text-green-600">_POS_</span></h1>
        <p className="text-center text-slate-500 text-sm mb-6">ระบบจัดการร้าน ธัญญ์นิภา ค้าข้าว</p>
        
        <div className="flex bg-slate-100 p-1 rounded-lg mb-6 shadow-inner">
          <button onClick={() => setLoginMode("employee")} className={`flex-1 py-2 rounded-md font-bold transition-all ${loginMode === "employee" ? "bg-white shadow text-green-600" : "text-gray-500"}`}>พนักงาน</button>
          <button onClick={() => setLoginMode("admin")} className={`flex-1 py-2 rounded-md font-bold transition-all ${loginMode === "admin" ? "bg-white shadow text-blue-600" : "text-gray-500"}`}>แอดมิน</button>
        </div>
        
        {loginMode === "employee" ? (
          <form onSubmit={handleEmployeeLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">รหัสพนักงาน (PIN 5 หลัก)</label>
              <input type="password" required placeholder="•••••" maxLength={5} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="w-full px-4 py-3 border rounded-lg text-center tracking-widest font-mono text-2xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all bg-white/50" />
            </div>
            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center"><CheckCircle size={18} className="mr-2"/> เข้าสู่ระบบ</button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ชื่อผู้ใช้งาน (Username)</label>
              <input type="text" required placeholder="ระบุ Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 border rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white/50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">รหัสผ่าน (Password)</label>
              <input type="password" required placeholder="ระบุ Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white/50" />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center"><Lock size={18} className="mr-2"/> เข้าสู่ระบบผู้ดูแล</button>
          </form>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, collapsed }) {
  return (
    <button onClick={onClick} title={collapsed ? label : ""} className={`flex items-center w-full p-3 rounded-md font-medium transition-all ${active ? "bg-green-600 text-white shadow" : "text-slate-300 hover:bg-slate-700 hover:text-white"} ${collapsed ? "justify-center" : ""}`}>
      <span className={collapsed ? "" : "mr-3"}>{icon}</span>{!collapsed && <span>{label}</span>}
    </button>
  );
}

// ------------------------------------------
// 0. ระบบจัดการกะ (Shift Management)
// ------------------------------------------
function ShiftManagement({ shiftState, setShiftState, salesHistory, currentUser, shiftHistory, setShiftHistory, debtPayments }) {
  const [startingCash, setStartingCash] = useState("");
  const [actualCash, setActualCash] = useState("");

  const handleOpenShift = (e) => {
    e.preventDefault();
    setShiftState({ isOpen: true, startTime: Date.now(), startingCash: Number(startingCash) || 0 });
    setStartingCash("");
  };

  const handleCloseShift = (e) => {
    e.preventDefault();
    if (actualCash === "") return alert("กรุณาระบุยอดเงินสดที่นับได้จริง");

    const shiftSales = (salesHistory || []).filter((s) => s.timestamp >= shiftState.startTime);
    const cashSales = shiftSales.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + s.total, 0);
    const transferSales = shiftSales.filter((s) => s.paymentMethod === "transfer").reduce((sum, s) => sum + s.total, 0);
    const creditSales = shiftSales.filter((s) => s.paymentMethod === "credit").reduce((sum, s) => sum + s.total, 0);
    const totalSales = shiftSales.reduce((sum, s) => sum + s.total, 0);

    const cashDebtCollection = (debtPayments || []).filter((p) => p.timestamp >= shiftState.startTime && p.method === "cash").reduce((sum, p) => sum + p.amount, 0);
    const expectedCash = shiftState.startingCash + cashSales + cashDebtCollection;
    const countedCash = Number(actualCash) || 0;
    const diff = countedCash - expectedCash;

    const shiftRecord = {
      id: "SHIFT-" + Date.now().toString().slice(-6),
      openedAt: shiftState.startTime,
      closedAt: Date.now(),
      openedBy: currentUser.name || currentUser.username,
      closedBy: currentUser.name || currentUser.username,
      startingCash: shiftState.startingCash,
      cashSales, transferSales, creditSales, totalSales, cashDebtCollection,
      expectedCash, actualCash: countedCash, difference: diff,
    };

    setShiftHistory(shiftRecord);
    setShiftState({ isOpen: false, startTime: null, startingCash: 0 });
    setActualCash("");
    alert("ปิดการขาย (ปิดกะ) เรียบร้อยแล้ว ระบบได้บันทึกสรุปยอดลงประวัติครับ");
  };

  const shiftSales = shiftState.isOpen ? (salesHistory || []).filter((s) => s.timestamp >= shiftState.startTime) : [];
  const currentCashSales = shiftSales.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + s.total, 0);
  const currentCashDebtCollection = shiftState.isOpen ? (debtPayments || []).filter((p) => p.timestamp >= shiftState.startTime && p.method === "cash").reduce((sum, p) => sum + p.amount, 0) : 0;
  const currentExpectedCash = (shiftState.startingCash || 0) + currentCashSales + currentCashDebtCollection;

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden bg-gray-50 relative w-full">
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <div><h2 className="text-xl md:text-2xl font-bold text-gray-800">ระบบเปิด-ปิดการขาย (Shift)</h2></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          {shiftState.isOpen ? (
            <>
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"><Store size={40} /></div>
              <h3 className="text-2xl font-bold text-green-600 mb-1">ร้านเปิดอยู่</h3>
              <p className="text-sm text-gray-500 mb-4">เปิดเมื่อ: {new Date(shiftState.startTime).toLocaleString("th-TH")}</p>
              <div className="w-full bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">เงินทอนเริ่มต้น:</span><span className="font-bold">฿{shiftState.startingCash.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">ยอดขายเงินสด:</span><span className="font-bold text-green-600">+ ฿{currentCashSales.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">รับชำระหนี้ (สด):</span><span className="font-bold text-blue-600">+ ฿{currentCashDebtCollection.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm mt-2 pt-2 border-t font-bold"><span className="text-gray-800">ลิ้นชักควรมี (รวม):</span><span className="text-indigo-600 text-lg">฿{currentExpectedCash.toLocaleString()}</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4"><Store size={40} /></div>
              <h3 className="text-2xl font-bold text-gray-500 mb-1">ร้านปิดอยู่</h3>
            </>
          )}
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
          {!shiftState.isOpen ? (
            <form onSubmit={handleOpenShift} className="max-w-sm mx-auto w-full">
              <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">เปิดการขายใหม่ (Open Shift)</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">เงินทอนเริ่มต้นในลิ้นชัก (บาท)</label>
                <input type="number" min="0" required value={startingCash} onChange={(e) => setStartingCash(e.target.value)} className="w-full px-4 py-3 border rounded-lg text-lg font-bold text-center outline-none focus:border-green-500" placeholder="1000" />
              </div>
              <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex justify-center items-center transition-colors"><CheckCircle className="mr-2" /> ยืนยันเปิดการขาย</button>
            </form>
          ) : (
            <form onSubmit={handleCloseShift} className="max-w-sm mx-auto w-full">
              <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">ปิดการขาย (Close Shift)</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">ระบุยอดเงินสดที่นับได้จริง (บาท)</label>
                <input type="number" min="0" required value={actualCash} onChange={(e) => setActualCash(e.target.value)} className="w-full px-4 py-3 border rounded-lg text-lg font-bold text-center text-blue-600 outline-none focus:border-red-500" />
              </div>
              {actualCash !== "" && (
                <div className={`p-3 rounded-lg mb-4 text-center font-bold text-sm ${Number(actualCash) === currentExpectedCash ? "bg-green-100 text-green-700" : Number(actualCash) > currentExpectedCash ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                  ส่วนต่าง: {(Number(actualCash) - currentExpectedCash).toLocaleString()} บาท
                </div>
              )}
              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg flex justify-center items-center transition-colors"><X className="mr-2" /> ยืนยันปิดการขาย</button>
            </form>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-800">ประวัติการเปิด-ปิดกะ</h3></div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-gray-50 text-gray-600 text-sm border-b">
              <tr><th className="p-3">เวลาเปิด</th><th className="p-3">เวลาปิด</th><th className="p-3">พนักงาน</th><th className="p-3 text-right">ยอดขาย(รวม)</th><th className="p-3 text-right">เงินเชื่อ(ติดไว้)</th><th className="p-3 text-right">คาดหวัง(สด)</th><th className="p-3 text-right">ส่วนต่าง</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...(shiftHistory || [])].sort((a, b) => b.closedAt - a.closedAt).map((h, i) => (
                <tr key={i} className="odd:bg-white even:bg-slate-50 hover:bg-blue-50 text-sm">
                  <td className="p-3">{new Date(h.openedAt).toLocaleString("th-TH")}</td>
                  <td className="p-3">{new Date(h.closedAt).toLocaleString("th-TH")}</td>
                  <td className="p-3">{h.closedBy}</td>
                  <td className="p-3 text-right font-bold">฿{(h.totalSales || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-orange-500">฿{(h.creditSales || 0).toLocaleString()}</td>
                  <td className="p-3 text-right">฿{(h.expectedCash || 0).toLocaleString()}</td>
                  <td className={`p-3 text-right font-bold ${h.difference === 0 ? "text-green-500" : h.difference > 0 ? "text-blue-500" : "text-red-500"}`}>
                    {h.difference > 0 ? "+" : ""}{(h.difference || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!shiftHistory || shiftHistory.length === 0) && (<tr><td colSpan="7" className="p-8 text-center text-gray-400">ยังไม่มีประวัติการเปิด-ปิดกะ</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------
// 1. ระบบขายสินค้า (POS) - 🌟 ลากสลับตำแหน่ง ทศนิยม และ สแกนเนอร์
// ------------------------------------------
function POSSystem({ products, updateProduct, customers, updateCustomer, currentUser, onSaleComplete, settings, shiftState, onNavigate, onAddDebtor }) {
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
  const [discount, setDiscount] = useState(0); 
  const [usedPoints, setUsedPoints] = useState(0); 
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0];
  });
  const [showReceipt, setShowReceipt] = useState(null);
  const [memberPhone, setMemberPhone] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [mobileView, setMobileView] = useState(0);

  // 🌟 State สำหรับระบบลากสลับตำแหน่ง (Drag & Drop)
  const [draggedItemIdx, setDraggedItemIdx] = useState(null);

  useEffect(() => {
    if (!shiftState?.isOpen) return;
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      if (!settings?.hardware?.scannerEnabled) return; 
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 50) barcodeBuffer = ""; 
      lastKeyTime = currentTime;

      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        const product = (products || []).find(p => p.barcode === barcodeBuffer);
        if (product) {
          if (product.stock > 0) addToCart(product);
          else alert(`❌ สินค้า: ${product.name} หมดสต๊อก!`);
        } else {
          alert(`ไม่พบสินค้า รหัสบาร์โค้ด: ${barcodeBuffer}`);
        }
        barcodeBuffer = "";
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key; 
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, shiftState?.isOpen, settings]);

  if (!shiftState?.isOpen) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 h-full w-full p-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-200 flex flex-col items-center max-w-md w-full text-center">
          <div className="w-24 h-24 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-6"><Store size={40} /></div>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">ร้านยังไม่เปิดการขาย</h2>
          <p className="text-gray-500 mb-8">กรุณาทำการ <b>"เปิดกะ"</b> และระบุเงินทอนเริ่มต้นก่อนเริ่มการขาย</p>
          <button onClick={() => onNavigate("shift")} className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-bold text-lg flex justify-center items-center transition-colors">
            ไปที่หน้า เปิด-ปิดการขาย <ArrowRightLeft className="ml-2" />
          </button>
        </div>
      </div>
    );
  }

  const getWeightInKg = (product) => {
    if (!product) return 0;
    const name = product.name || "";
    const cat = product.category || "";
    if (name.includes("40กก") || name.includes("40 กก")) return 40;
    if (cat === "ข้าวยกท่อน" || name.includes("45 กก") || name.includes("45กก")) return 45;
    if (cat === "ข้าวถัง" || name.includes("15กก") || name.includes("15 กก")) return 15;
    if (cat === "ข้าวถุง5โล" || name.includes("5 กก") || name.includes("5กก")) return 5;
    if (cat === "ข้าวอินทรีย์ 2 โล") return 2;
    if (cat === "ข้าวโล") return 1;
    return 0;
  };

  const rawCategories = Array.from(new Set([...(products || [])].map((p) => (p.category || "").trim()).filter(Boolean)));
  const sortedCategories = rawCategories.includes("ข้าวโล") ? ["ข้าวโล", ...rawCategories.filter(c => c !== "ข้าวโล")] : rawCategories;
  const categories = ["ทั้งหมด", ...sortedCategories];

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const totalCartWeight = cart.reduce((sum, item) => sum + (getWeightInKg(item) * item.qty), 0); 
  const pointDiscount = usedPoints * (settings?.pointSystem?.bahtPerPoint || 10);
  const totalDiscount = discount + pointDiscount;
  const totalCost = cart.reduce((sum, item) => sum + item.cost * item.qty, 0);
  const total = Math.max(0, subtotal - totalDiscount);
  const change = paymentMethod === "cash" && cashReceived ? Math.max(0, parseFloat(cashReceived) - total) : 0;

  const filteredProducts = [...(products || [])].filter((p) =>
      p.stock > 0 &&
      (p.name.includes(searchTerm) || p.barcode.includes(searchTerm)) &&
      (selectedCategory === "ทั้งหมด" || (p.category || "").trim() === selectedCategory)
  );

  const handleSearchMember = () => {
    if(!memberPhone) return;
    const found = (customers || []).find((c) => c.phone === memberPhone);
    if (found) setSelectedCustomer(found);
    else { alert("ไม่พบเบอร์โทรศัพท์นี้ในระบบ"); setSelectedCustomer(null); }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchTerm) {
       const product = (products || []).find(p => p.barcode === searchTerm || p.name === searchTerm);
       if (product) {
         if(product.stock > 0) { addToCart(product); setSearchTerm(""); } 
         else { alert("สินค้าหมดสต๊อก!"); }
       }
    }
  };

  const addToCart = (product) => {
    if (product.stock <= 0) return alert("สินค้าหมดสต๊อก!");
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) return existing.qty >= product.stock ? prev : prev.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((item) => item.id !== id));
  
  const handleDirectQtyChange = (id, val) => {
    let newQty = parseFloat(val); // 🌟 รองรับทศนิยม
    if (isNaN(newQty) || newQty < 0.01) newQty = 1;
    setCart((prev) => prev.map((item) => {
      if (item.id === id) {
        const p = (products || []).find((x) => x.id === id);
        if (p && newQty <= p.stock) return { ...item, qty: newQty };
        else if (p && newQty > p.stock) {
           alert(`มีสต๊อกสูงสุดแค่ ${p.stock}`);
           return { ...item, qty: p.stock }; 
        }
      }
      return item;
    }));
  };

  const updateQty = (id, delta) => {
    setCart((prev) => prev.map((item) => {
      if (item.id === id) {
        const p = (products || []).find((x) => x.id === id);
        const n = item.qty + delta;
        if (n > 0 && n <= p.stock) return { ...item, qty: n };
      }
      return item;
    }));
  };

  // 🌟 ฟังก์ชันจัดการ Drag & Drop สลับลำดับตะกร้า
  const handleDragStart = (e, idx) => {
    setDraggedItemIdx(idx);
  };
  const handleDragOver = (e) => {
    e.preventDefault(); 
  };
  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    if (draggedItemIdx === null || draggedItemIdx === dropIdx) return;
    const newCart = [...cart];
    const draggedItem = newCart[draggedItemIdx];
    newCart.splice(draggedItemIdx, 1);
    newCart.splice(dropIdx, 0, draggedItem);
    setCart(newCart);
    setDraggedItemIdx(null);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return alert("กรุณาเลือกสินค้าก่อนทำรายการ");
    if (paymentMethod === "credit" && !selectedCustomer) return alert("การขายแบบเงินเชื่อ จำเป็นต้อง 'เลือกลูกค้า' ก่อนเสมอครับ");
    if (paymentMethod === "cash" && (!cashReceived || parseFloat(cashReceived) < total)) return alert("รับเงินมาไม่เพียงพอ");

    cart.forEach((cartItem) => {
      const p = (products || []).find((x) => x.id === cartItem.id);
      if (p) updateProduct({ ...p, stock: p.stock - cartItem.qty });
    });

    if (selectedCustomer) {
      const qtyNeeded = settings?.pointSystem?.qtyPerPoint || 100;
      let newPoints = (selectedCustomer.points || 0) - usedPoints;
      let newAccQty = (selectedCustomer.accumulatedQty || 0) + totalCartWeight;
      
      if (newAccQty >= qtyNeeded) {
         const earnedPoints = Math.floor(newAccQty / qtyNeeded);
         newPoints += earnedPoints;
         newAccQty = newAccQty % qtyNeeded; 
      }
      updateCustomer({ ...selectedCustomer, points: newPoints, accumulatedQty: newAccQty, totalSpent: (selectedCustomer.totalSpent||0) + total, lastVisit: Date.now() });
    }

    const saleId = "INV" + Date.now().toString().slice(-6);
    const timestamp = Date.now();

    if (paymentMethod === "credit") {
      const debtRecord = {
        id: `DEBT-${timestamp}`, customerId: selectedCustomer.id, saleId,
        amountTotal: total, amountPaid: 0, amountRemaining: total,
        dueDate: new Date(dueDate).getTime(), status: "active", timestamp,
      };
      onAddDebtor(debtRecord);
    }

    const saleRecord = {
      id: saleId, timestamp, date: new Date().toLocaleString("th-TH"),
      seller: currentUser.name || currentUser.username, customer: selectedCustomer ? selectedCustomer.name : "ลูกค้าทั่วไป",
      items: [...cart], subtotal, totalCost, discount: totalDiscount, total, paymentMethod,
      cashReceived: paymentMethod === "cash" ? parseFloat(cashReceived) : total, change,
    };
    onSaleComplete(saleRecord);
    setShowReceipt(saleRecord);
    setMobileView(0);

    if (settings?.autoPrint) setTimeout(() => { window.print(); }, 300);
  };

  const resetPOS = () => { setCart([]); setDiscount(0); setUsedPoints(0); setCashReceived(""); setSearchTerm(""); setShowReceipt(null); setPaymentMethod("cash"); setMobileView(0); setMemberPhone(""); setSelectedCustomer(null); };

  if (showReceipt) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 p-4 print:p-0 print:bg-white print:justify-start overflow-y-auto w-full">
        <div className={`bg-white p-6 rounded-lg shadow-lg w-full max-w-sm print:shadow-none print:m-0 print:p-0 print:w-[80mm] print:text-black`}>
          <div className="text-center mb-4 print:mb-2">
            <h2 className="text-xl font-bold">ใบเสร็จรับเงิน</h2>
            <p className="text-xs text-gray-500 print:text-black">ร้าน ธัญญ์นิภา ค้าข้าว</p>
            <div className="text-sm text-gray-500 print:text-black mt-2">บิล: {showReceipt.id} <br/> ({showReceipt.paymentMethod === "cash" ? "เงินสด" : showReceipt.paymentMethod === "transfer" ? "เงินโอน" : "ติดไว้ก่อน/เงินเชื่อ"})</div>
            <div className="text-xs text-gray-400 print:text-black">{showReceipt.date}</div>
            <div className="text-xs text-gray-400 print:text-black">พนักงาน: {showReceipt.seller}</div>
          </div>
          <div className="border-t border-b border-dashed border-gray-400 print:border-black py-2 my-2 text-sm space-y-1">
            {showReceipt.items.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="w-2/3 break-words">{item.name} <span className="text-gray-500 print:text-black text-xs">x{item.qty}</span></span>
                <span>฿{(item.price * item.qty).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {showReceipt.discount > 0 && <div className="flex justify-between text-sm mt-1"><span>ส่วนลดรวม</span><span>- ฿{showReceipt.discount.toLocaleString()}</span></div>}
          <div className="flex justify-between text-lg font-bold mt-2 border-b border-dashed border-gray-400 print:border-black pb-2"><span>ยอดสุทธิ</span><span>฿{showReceipt.total.toLocaleString()}</span></div>
          {showReceipt.paymentMethod === "cash" && (
            <>
              <div className="flex justify-between text-sm mt-1"><span>รับเงินสด</span><span>฿{showReceipt.cashReceived.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm font-bold"><span>เงินทอน</span><span>฿{showReceipt.change.toLocaleString()}</span></div>
            </>
          )}
          {selectedCustomer && (
            <div className="mt-4 pt-2 text-xs text-center">
               ลูกค้า: คุณ {selectedCustomer.name}
            </div>
          )}
          
          {settings?.hardware?.qrWalletEnabled && showReceipt.paymentMethod === "transfer" && (
             <div className="mt-4 text-center border-t border-dashed pt-4 print:border-black">
                <QrCode size={64} className="mx-auto text-gray-800 print:text-black"/>
                <p className="text-[10px] mt-1">สแกนเพื่อชำระเงิน (ตัวอย่าง)</p>
             </div>
          )}

          <div className="text-center mt-4 text-xs">
            <p>ขอบคุณที่อุดหนุนครับ/ค่ะ</p>
          </div>
          
          <div className="mt-8 space-y-2 print:hidden">
            <button onClick={resetPOS} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-md font-bold transition-colors">เริ่มรายการใหม่</button>
            <button onClick={() => window.print()} className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 py-3 rounded-md font-bold transition-colors flex justify-center items-center"><Printer size={18} className="mr-2"/> พิมพ์ซ้ำ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full w-full overflow-hidden relative">
      <div className="md:hidden flex bg-white border-b shadow-sm z-10 shrink-0">
        <button onClick={() => setMobileView(0)} className={`flex-1 py-3 font-bold ${mobileView === 0 ? "text-green-600 border-b-2 border-green-600" : "text-gray-500"}`}>รายการสินค้า</button>
        <button onClick={() => setMobileView(1)} className={`flex-1 py-3 font-bold ${mobileView === 1 ? "text-green-600 border-b-2 border-green-600" : "text-gray-500"}`}>ตะกร้า ({cart.length})</button>
      </div>

      <div className={`flex-1 flex flex-col bg-gray-50 md:border-r h-full ${mobileView === 0 ? "block" : "hidden md:flex"}`}>
        <div className="p-3 bg-white shadow-sm flex items-center gap-4 z-10 relative">
          <ScanLine className="text-gray-400" size={20} />
          <input type="text" placeholder="สแกนบาร์โค้ด หรือค้นหาด้วยชื่อ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleSearchKeyDown} className="w-full px-2 outline-none text-lg" autoFocus />
          {searchTerm && <button onClick={() => setSearchTerm("")} className="text-gray-400 hover:text-red-500"><X size={20}/></button>}
        </div>
        <div className="bg-white flex items-center px-3 py-2 overflow-x-auto border-b hide-scrollbar">
          <div className="flex gap-2">
            {categories.map((cat, i) => (
              <button key={i} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? "bg-green-100 text-green-800 border border-green-200" : "bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200"}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {filteredProducts.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock <= 0} className={`bg-white p-3 rounded-xl border border-gray-200 shadow-sm text-left flex flex-col justify-between transition-all ${p.stock <= 0 ? "opacity-50 grayscale cursor-not-allowed" : "hover:border-green-500 hover:shadow-md active:scale-95"}`}>
                <div>
                  <div className="text-[10px] text-gray-400 font-mono mb-1">{p.barcode}</div>
                  <div className="font-black text-gray-900 line-clamp-2 min-h-[40px] text-sm md:text-base leading-tight mb-2">{p.name}</div>
                </div>
                <div className="w-full flex justify-between items-end mt-auto">
                  <span className="text-green-700 font-black text-lg leading-none">฿{p.price.toLocaleString()}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${p.stock > 10 ? "bg-gray-100 text-gray-600" : p.stock > 0 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>เหลือ {p.stock}</span>
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
               <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400">
                  <Package size={48} className="opacity-20 mb-4"/>
                  <p>ไม่พบสินค้า (เสียบเครื่องสแกนแล้วยิงได้เลยครับ)</p>
               </div>
            )}
          </div>
        </div>
      </div>

      <div className={`w-full md:w-[400px] lg:w-[450px] bg-white flex flex-col shadow-2xl md:shadow-none border-l z-10 h-full ${mobileView === 1 ? "block" : "hidden md:flex"}`}>
        <div className="p-3 md:p-4 bg-slate-800 text-white font-bold flex justify-between items-center shrink-0">
          <div className="flex items-center"><ShoppingCart className="mr-2" size={18} /> ตะกร้าสินค้า</div>
          <span className="bg-slate-700 px-2 py-0.5 rounded text-xs md:text-sm">{cart.length} รายการ</span>
        </div>
        
        <div className="p-2 md:p-3 bg-blue-50 border-b shrink-0">
          {selectedCustomer ? (
            <div className="flex justify-between items-center bg-white p-2 md:p-3 rounded-lg shadow-sm border border-blue-200 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
              <div className="pl-2">
                <div className="font-bold text-blue-800 text-sm md:text-base flex items-center">{selectedCustomer.name} {selectedCustomer.type === "VIP" && <Sparkles size={14} className="text-amber-500 ml-1"/>}</div>
                <div className="text-[10px] md:text-xs text-gray-500 mt-1 flex flex-col sm:flex-row sm:gap-2 gap-1">
                  <span className="font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full inline-block w-max border border-orange-100">แต้ม: {selectedCustomer.points || 0}</span>
                  <span className="flex items-center">รอบนี้: {selectedCustomer.accumulatedQty || 0}/{settings?.pointSystem?.qtyPerPoint || 100} กก. {totalCartWeight > 0 && (<span className="text-green-600 font-bold ml-1 animate-pulse">(+{totalCartWeight})</span>)}</span>
                </div>
              </div>
              <button onClick={() => { setSelectedCustomer(null); setUsedPoints(0); }} className="text-gray-400 bg-gray-50 p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={16} /></button>
            </div>
          ) : (
            <form onSubmit={(e)=>{ e.preventDefault(); handleSearchMember(); }} className="flex gap-2">
              <div className="relative flex-1">
                <Users size={16} className="absolute left-2.5 top-2 text-blue-400"/>
                <input type="tel" placeholder="ค้นหาเบอร์โทรลูกค้า" value={memberPhone} onChange={(e) => setMemberPhone(e.target.value.replace(/\D/g, ""))} className="w-full pl-8 pr-2 py-1.5 md:py-2 border border-blue-200 rounded-lg text-xs md:text-sm outline-none focus:border-blue-500 bg-white" />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold shadow-sm">ค้นหา</button>
            </form>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 md:p-3 bg-gray-50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 md:space-y-4">
              <ShoppingCart size={48} className="opacity-20 text-slate-500" />
              <p className="font-medium text-sm md:text-base">ตะกร้าว่างเปล่า</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div 
                key={item.id} 
                draggable 
                onDragStart={(e) => handleDragStart(e, idx)} 
                onDragOver={handleDragOver} 
                onDrop={(e) => handleDrop(e, idx)}
                className="bg-white p-2 md:p-3 mb-2 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center relative transition-transform hover:-translate-y-0.5 cursor-grab active:cursor-grabbing"
                title="คลิกค้างเพื่อลากสลับตำแหน่ง"
              >
                <div className="mr-2 text-gray-300"><Menu size={20} /></div>
                <div className="flex-1 pr-2">
                  <div className="font-bold text-gray-800 text-xs md:text-sm leading-tight mb-1">{item.name}</div>
                  <div className="text-[10px] md:text-xs text-green-600 font-medium border border-green-200 bg-green-50 px-1.5 py-0.5 rounded inline-block">฿{item.price}/ชิ้น</div>
                </div>
                <div className="flex flex-col items-end gap-1 md:gap-2">
                  <div className="flex bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shadow-inner h-8 md:h-10">
                    <button onClick={() => updateQty(item.id, -1)} className="px-3 md:px-4 bg-gray-200 hover:bg-gray-300 font-black text-gray-700 transition-colors">-</button>
                    <input 
                       type="number" 
                       step="any"
                       min="0.01"
                       value={item.qty} 
                       onChange={(e) => handleDirectQtyChange(item.id, e.target.value)} 
                       className="w-12 md:w-16 flex items-center justify-center font-black text-sm md:text-base text-gray-800 bg-white text-center outline-none focus:border-blue-500" 
                    />
                    <button onClick={() => updateQty(item.id, 1)} className="px-3 md:px-4 bg-gray-200 hover:bg-gray-300 font-black text-gray-700 transition-colors">+</button>
                  </div>
                  <div className="font-black text-blue-700 text-sm md:text-base mt-1">฿{(item.price * item.qty).toLocaleString()}</div>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="absolute -top-2 -right-2 text-red-500 bg-white border border-red-100 shadow-sm p-1 rounded-full hover:bg-red-50"><X size={12} /></button>
              </div>
            ))
          )}
        </div>

        <div className="p-2 md:p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0">
          <div className="space-y-1 mb-2">
            <div className="flex justify-between items-center text-gray-700 text-base md:text-lg font-bold">
              <span>รวมเงิน (ก่อนลด)</span>
              <span>฿{subtotal.toLocaleString()}</span>
            </div>
            
            {selectedCustomer && (selectedCustomer.points > 0 || usedPoints > 0) && (
              <div className="flex justify-between items-center text-sm md:text-base font-bold bg-orange-50 p-1.5 md:p-2 rounded-lg border border-orange-100">
                <span className="text-orange-800">ใช้แต้ม (1=฿{settings?.pointSystem?.bahtPerPoint || 10})</span>
                <div className="flex items-center">
                  <input type="number" min="0" max={selectedCustomer.points || 0} value={usedPoints === 0 ? "" : usedPoints} onChange={(e) => { let val = Number(e.target.value); if (val > selectedCustomer.points) val = selectedCustomer.points; setUsedPoints(val); }} className="w-16 md:w-20 px-1 py-0.5 text-right font-black border border-orange-300 rounded outline-none text-orange-700" placeholder="0" />
                </div>
              </div>
            )}
            {usedPoints > 0 && (<div className="flex justify-between text-sm md:text-base text-orange-600 font-bold px-1"><span>ลดจากแต้ม</span><span>- ฿{pointDiscount.toLocaleString()}</span></div>)}
            
            <div className="flex justify-between items-center text-gray-700 text-base md:text-lg font-bold">
              <span>ลดเพิ่ม (บาท)</span>
              <div className="relative w-20 md:w-28">
                <input type="number" min="0" step="any" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value))} className="w-full px-2 py-1 text-right border border-gray-300 rounded-lg outline-none focus:border-red-500 font-black text-red-500 bg-red-50" placeholder="0" />
              </div>
            </div>

            <div className="flex justify-between font-black text-2xl md:text-3xl py-1.5 md:py-2 border-t-2 border-dashed mt-1 border-gray-300">
              <span className="text-gray-800">ยอดสุทธิ</span>
              <span className="text-green-600">฿{total.toLocaleString()}</span>
            </div>
          </div>

          <div className="mb-2">
            <div className="grid grid-cols-3 gap-1.5 md:gap-2">
              <button onClick={() => { setPaymentMethod("cash"); setCashReceived(total.toString()); }} className={`py-1.5 md:py-2.5 rounded-lg font-bold border-2 flex flex-col items-center justify-center text-[10px] md:text-xs transition-all ${paymentMethod === "cash" ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm scale-105" : "bg-white border-gray-200 text-gray-500 hover:border-blue-200"}`}><Banknote size={16} className="mb-0.5 md:mb-1" /> เงินสด</button>
              <button onClick={() => { setPaymentMethod("transfer"); setCashReceived(""); }} className={`py-1.5 md:py-2.5 rounded-lg font-bold border-2 flex flex-col items-center justify-center text-[10px] md:text-xs transition-all ${paymentMethod === "transfer" ? "bg-purple-50 border-purple-500 text-purple-700 shadow-sm scale-105" : "bg-white border-gray-200 text-gray-500 hover:border-purple-200"}`}><CreditCard size={16} className="mb-0.5 md:mb-1" /> เงินโอน</button>
              <button onClick={() => { setPaymentMethod("credit"); setCashReceived(""); }} className={`py-1.5 md:py-2.5 rounded-lg font-bold border-2 flex flex-col items-center justify-center text-[10px] md:text-xs transition-all ${paymentMethod === "credit" ? "bg-orange-50 border-orange-500 text-orange-700 shadow-sm scale-105" : "bg-white border-gray-200 text-gray-500 hover:border-orange-200"}`}><BookUser size={16} className="mb-0.5 md:mb-1" /> ติดไว้</button>
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div className="mb-2 bg-gray-50 p-2 md:p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] md:text-xs font-bold text-gray-600">รับเงินมา (บาท)</label>
              </div>
              <input type="number" step="any" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xl md:text-2xl text-right border border-gray-300 rounded-lg focus:border-blue-500 font-black outline-none shadow-inner bg-white mb-2" placeholder="0" />
              
              <div className="grid grid-cols-4 gap-1.5 w-full">
                  <button onClick={() => setCashReceived(total.toString())} className="py-2 bg-white border border-gray-300 font-bold text-gray-700 rounded-md shadow-sm text-[10px] md:text-sm">พอดี</button>
                  <button onClick={() => setCashReceived("100")} className="py-2 bg-blue-100 text-blue-700 font-bold rounded-md shadow-sm text-[10px] md:text-sm">100</button>
                  <button onClick={() => setCashReceived("500")} className="py-2 bg-purple-100 text-purple-700 font-bold rounded-md shadow-sm text-[10px] md:text-sm">500</button>
                  <button onClick={() => setCashReceived("1000")} className="py-2 bg-amber-100 text-amber-700 font-bold rounded-md shadow-sm text-[10px] md:text-sm">1000</button>
              </div>

              {cashReceived && parseFloat(cashReceived) >= total && (
                <div className="flex justify-between items-center bg-green-100 text-green-800 p-2 rounded-md mt-2 font-bold"><span className="text-[10px] md:text-sm">เงินทอน</span><span className="text-xl md:text-2xl font-black">฿{change.toLocaleString()}</span></div>
              )}
            </div>
          )}

          {paymentMethod === "credit" && (
            <div className="mb-2 bg-orange-50 p-2 md:p-3 rounded-lg border border-orange-200">
               <label className="text-[10px] md:text-xs text-orange-800 font-bold block mb-1">วันครบกำหนดชำระ</label>
               <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full p-1.5 md:p-2 border border-orange-300 rounded bg-white outline-none text-xs md:text-sm font-bold text-gray-700" />
            </div>
          )}

          <button onClick={handleCheckout} disabled={cart.length === 0} className={`w-full py-2.5 md:py-3 mt-1 font-bold rounded-xl shadow-lg text-sm md:text-lg flex items-center justify-center transition-all ${cart.length === 0 ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"}`}>
            <CheckCircle size={18} className="mr-1.5" /> ยืนยันชำระเงิน
          </button>
        </div>
      </div>
    </div>
  );
}// ------------------------------------------
// X. ระบบลูกหนี้ (Debtor Management) - แชร์ร่วมกันทุกสาขา
// ------------------------------------------
function DebtorManager({ debtors, updateDebtor, deleteDebtor, addDebtor, customers, debtPayments, addDebtPayment, currentUser, currentBranch }) {
  const [activeTab, setActiveTab] = useState("active");
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [promoMessage, setPromoMessage] = useState("");
  const [isGeneratingPromo, setIsGeneratingPromo] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDebtor, setNewDebtor] = useState({ customerId: "", amount: "", note: "", dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] });

  const activeDebts = [...(debtors || [])].filter((d) => d.status === "active").sort((a, b) => a.dueDate - b.dueDate);
  const isEmployee = currentUser.role === "employee";

  const getCustomerName = (id) => (customers || []).find((c) => c.id.toString() === id.toString())?.name || "ไม่ทราบชื่อ";
  const getCustomerPhone = (id) => (customers || []).find((c) => c.id.toString() === id.toString())?.phone || "-";

  const handleDeleteDebt = (id) => { if (window.confirm("แน่ใจหรือไม่ว่าต้องการลบรายการลูกหนี้ค้างชำระนี้?")) deleteDebtor(id); };

  const handleAddManualDebt = (e) => {
    e.preventDefault();
    if (!newDebtor.customerId) return alert("กรุณาเลือกลูกค้า");
    if (Number(newDebtor.amount) <= 0) return alert("กรุณาระบุยอด");
    addDebtor({ id: `DEBT-M-${Date.now()}`, customerId: Number(newDebtor.customerId), saleId: newDebtor.note || "ยอดยกมา / ระบุเอง", amountTotal: Number(newDebtor.amount), amountPaid: 0, amountRemaining: Number(newDebtor.amount), dueDate: new Date(newDebtor.dueDate).getTime(), status: "active", timestamp: Date.now() });
    setShowAddModal(false);
    setNewDebtor({ customerId: "", amount: "", note: "", dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] });
    alert("เพิ่มลูกหนี้เรียบร้อยแล้ว");
  };

  const handlePayDebt = (e) => {
    e.preventDefault();
    const amount = Number(payAmount);
    if (amount <= 0 || amount > payModal.amountRemaining) return alert("ระบุยอดไม่ถูกต้อง");
    const newRemaining = payModal.amountRemaining - amount;
    updateDebtor({ ...payModal, amountRemaining: newRemaining, amountPaid: payModal.amountPaid + amount, status: newRemaining === 0 ? "paid" : "active" });
    addDebtPayment({ id: `PAY-${Date.now()}`, debtId: payModal.id, customerId: payModal.customerId, amount, method: payMethod, timestamp: Date.now(), receivedBy: currentUser.name || currentUser.username, branch: currentBranch });
    setPayModal(null); setPayAmount(""); alert("รับชำระเงินเรียบร้อยแล้ว");
  };

  const handleGenerateFollowUp = async (debt) => {
    setPromoMessage(""); setIsGeneratingPromo(true);
    const daysOverdue = Math.floor((Date.now() - debt.dueDate) / (1000 * 60 * 60 * 24));
    try {
      const prompt = `เขียนข้อความ SMS/Line สุภาพๆ ทวงหนี้: ชื่อ: "${getCustomerName(debt.customerId)}", ยอดค้าง: ${debt.amountRemaining} บาท, ${daysOverdue > 0 ? `เกินกำหนดมาแล้ว ${daysOverdue} วัน` : "ใกล้กำหนดชำระ"} ประนีประนอม ไม่รุนแรง และใส่อีโมจิ`;
      setPromoMessage(await callGeminiAPI(prompt));
    } catch (err) { alert("เกิดข้อผิดพลาด: " + err.message); } finally { setIsGeneratingPromo(false); }
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden bg-gray-50 relative w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
        <div><h2 className="text-xl md:text-2xl font-bold flex items-center"><BookUser className="mr-2 text-orange-600" /> ระบบลูกหนี้ (เครดิตรวมทุกสาขา)</h2></div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center flex-1 justify-center transition-colors"><Plus size={18} className="mr-1" /> เพิ่มลูกหนี้</button>
        </div>
      </div>

      <div className="flex gap-4 mb-4 border-b pb-2">
        <button onClick={() => setActiveTab("active")} className={`font-bold pb-2 border-b-2 px-2 transition-colors ${activeTab === "active" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>ค้างชำระ ({activeDebts.length})</button>
        <button onClick={() => setActiveTab("history")} className={`font-bold pb-2 border-b-2 px-2 transition-colors ${activeTab === "history" ? "border-green-500 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>ประวัติรับชำระ</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
        {activeTab === "active" && (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left min-w-[850px]">
              <thead className="bg-gray-50 text-sm border-b"><tr><th className="p-4 text-gray-600 font-bold">เลขบิล/อ้างอิง</th><th className="p-4 text-gray-600 font-bold">ลูกค้า</th><th className="p-4 text-right text-gray-600 font-bold">ยอดตั้งต้น</th><th className="p-4 text-right text-gray-600 font-bold">ค้างชำระ</th><th className="p-4 text-center text-gray-600 font-bold">ครบกำหนด</th><th className="p-4 text-center text-gray-600 font-bold">จัดการ</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {activeDebts.map((d) => {
                  const isOverdue = Date.now() > d.dueDate;
                  return (
                    <tr key={d.id} className="hover:bg-orange-50 text-sm transition-colors">
                      <td className="p-4"><b>{d.saleId}</b><br /><span className="text-xs text-gray-500">{new Date(d.timestamp).toLocaleDateString()}</span></td>
                      <td className="p-4 text-blue-700 font-medium">{getCustomerName(d.customerId)}<br /><span className="text-xs text-gray-500">{getCustomerPhone(d.customerId)}</span></td>
                      <td className="p-4 text-right text-gray-500">฿{(d.amountTotal || 0).toLocaleString()}</td>
                      <td className="p-4 text-right font-bold text-orange-600 text-base">฿{(d.amountRemaining || 0).toLocaleString()}</td>
                      <td className="p-4 text-center"><div className={`font-bold ${isOverdue ? "text-red-600" : "text-gray-700"}`}>{new Date(d.dueDate).toLocaleDateString("th-TH")}</div>{isOverdue && (<span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full mt-1 inline-block border border-red-200">เกินกำหนด</span>)}</td>
                      <td className="p-4 text-center flex justify-center gap-2">
                        <button onClick={() => { setPayModal(d); setPayAmount(d.amountRemaining); }} className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center transition-colors"><HandCoins size={14} className="mr-1"/> รับเงิน</button>
                        <button onClick={() => handleGenerateFollowUp(d)} className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center transition-colors"><Sparkles size={14} className="mr-1"/> ทวงหนี้</button>
                        {!isEmployee && <button onClick={() => handleDeleteDebt(d.id)} className="bg-red-50 hover:bg-red-100 text-red-500 p-1.5 rounded-lg transition-colors"><Trash2 size={16} /></button>}
                      </td>
                    </tr>
                  );
                })}
                {activeDebts.length === 0 && (<tr><td colSpan="6" className="p-12 text-center text-gray-400"><BookUser size={48} className="mx-auto opacity-20 mb-3"/>ไม่มียอดค้างชำระ</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === "history" && (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-gray-50 text-sm border-b"><tr><th className="p-4 text-gray-600 font-bold">วันที่รับชำระ</th><th className="p-4 text-gray-600 font-bold">ลูกค้า</th><th className="p-4 text-center text-gray-600 font-bold">วิธีชำระ</th><th className="p-4 text-center text-gray-600 font-bold">สาขาที่รับ</th><th className="p-4 text-gray-600 font-bold">พนักงานที่รับ</th><th className="p-4 text-right text-gray-600 font-bold">ยอดเงิน (บาท)</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {[...(debtPayments || [])].sort((a, b) => b.timestamp - a.timestamp).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 text-sm transition-colors">
                      <td className="p-4 text-gray-600">{new Date(p.timestamp).toLocaleString("th-TH")}</td>
                      <td className="p-4 font-bold text-gray-800">{getCustomerName(p.customerId)}</td>
                      <td className="p-4 text-center"><span className={`px-2 py-0.5 rounded text-xs font-bold ${p.method === "cash" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-purple-100 text-purple-700 border border-purple-200"}`}>{p.method === "cash" ? "เงินสด" : "เงินโอน"}</span></td>
                      <td className="p-4 text-center font-bold text-indigo-600">สาขา {p.branch || "-"}</td>
                      <td className="p-4 text-gray-600">{p.receivedBy}</td>
                      <td className="p-4 text-right font-black text-green-600 text-base">฿{(p.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!debtPayments || debtPayments.length === 0) && (<tr><td colSpan="6" className="p-12 text-center text-gray-400">ไม่มีประวัติการรับชำระเงิน</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-6 flex items-center text-gray-800"><UserPlus className="mr-2 text-blue-600" /> เพิ่มรายการลูกหนี้ (ยอดยกมา)</h3>
            <form onSubmit={handleAddManualDebt}>
              <div className="mb-4"><label className="block text-sm font-bold text-gray-700 mb-2">เลือกลูกค้า</label><select required value={newDebtor.customerId} onChange={(e) => setNewDebtor({ ...newDebtor, customerId: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-gray-50"><option value="">-- กรุณาเลือกลูกค้า --</option>{(customers || []).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
              <div className="mb-4"><label className="block text-sm font-bold text-gray-700 mb-2">ยอดค้างชำระ (บาท)</label><input type="number" min="1" required value={newDebtor.amount} onChange={(e) => setNewDebtor({ ...newDebtor, amount: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg font-bold text-xl outline-none focus:border-blue-500 bg-gray-50 text-right" placeholder="0" /></div>
              <div className="mb-4"><label className="block text-sm font-bold text-gray-700 mb-2">วันครบกำหนดชำระ</label><input type="date" required value={newDebtor.dueDate} onChange={(e) => setNewDebtor({ ...newDebtor, dueDate: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-gray-50" /></div>
              <div className="mb-8"><label className="block text-sm font-bold text-gray-700 mb-2">รายละเอียดอ้างอิง</label><input type="text" value={newDebtor.note} onChange={(e) => setNewDebtor({ ...newDebtor, note: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-gray-50" placeholder="เช่น ยอดยกมาจากเดือนก่อน" /></div>
              <div className="flex gap-3"><button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-lg font-bold hover:bg-gray-50 transition-colors">ยกเลิก</button><button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-colors">บันทึกข้อมูล</button></div>
            </form>
          </div>
        </div>
      )}

      {payModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-4 flex items-center text-gray-800"><HandCoins className="mr-2 text-green-600" /> บันทึกรับชำระหนี้</h3>
            <div className="bg-orange-50 p-4 rounded-xl mb-6 border border-orange-100">
              <div className="flex justify-between mb-2"><span className="text-gray-500 text-sm">ลูกค้า:</span><span className="font-bold text-gray-800">{getCustomerName(payModal.customerId)}</span></div>
              <div className="flex justify-between font-bold text-orange-700 pt-2 border-t border-orange-200 items-center"><span>ยอดหนี้คงเหลือ:</span><span className="text-2xl">฿{payModal.amountRemaining.toLocaleString()}</span></div>
            </div>
            <form onSubmit={handlePayDebt}>
              <div className="mb-5">
                <label className="block text-sm font-bold text-gray-700 mb-2">ยอดเงินที่รับชำระ (บาท)</label>
                <input type="number" min="1" max={payModal.amountRemaining} required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg font-black text-green-600 text-right text-2xl outline-none focus:border-green-500 bg-gray-50 shadow-inner" />
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setPayAmount(payModal.amountRemaining)} className="flex-1 text-xs bg-orange-100 text-orange-700 py-1.5 rounded font-bold hover:bg-orange-200">จ่ายเต็มจำนวน</button>
                  <button type="button" onClick={() => setPayAmount(payModal.amountRemaining / 2)} className="flex-1 text-xs bg-gray-200 text-gray-700 py-1.5 rounded font-bold hover:bg-gray-300">จ่ายครึ่งหนึ่ง</button>
                </div>
              </div>
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-700 mb-2">รับชำระช่องทาง</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setPayMethod("cash")} className={`py-3 text-sm font-bold rounded-lg border-2 transition-all ${payMethod === "cash" ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-gray-200 text-gray-500"}`}>เงินสด</button>
                  <button type="button" onClick={() => setPayMethod("transfer")} className={`py-3 text-sm font-bold rounded-lg border-2 transition-all ${payMethod === "transfer" ? "bg-purple-50 border-purple-500 text-purple-700" : "bg-white border-gray-200 text-gray-500"}`}>เงินโอน</button>
                </div>
              </div>
              <div className="flex gap-3"><button type="button" onClick={() => setPayModal(null)} className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-lg font-bold hover:bg-gray-50 transition-colors">ยกเลิก</button><button type="submit" className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md transition-colors">บันทึกรับเงิน</button></div>
            </form>
          </div>
        </div>
      )}

      {promoMessage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative">
            <button onClick={() => setPromoMessage("")} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            <h3 className="text-xl font-bold mb-4 flex items-center text-purple-700"><Sparkles className="mr-2" /> ผู้ช่วยเขียนข้อความทวงหนี้</h3>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 min-h-[160px] flex flex-col mb-6 shadow-inner">
              {isGeneratingPromo ? (
                <div className="flex-1 flex flex-col items-center justify-center text-purple-500"><Sparkles className="animate-spin mb-2" size={32} /> กำลังคิดคำพูดสุภาพๆ...</div>
              ) : (
                <textarea value={promoMessage} onChange={(e) => setPromoMessage(e.target.value)} className="w-full flex-1 bg-transparent border-none outline-none resize-none text-sm text-gray-800 font-medium leading-relaxed" rows={6} />
              )}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(promoMessage); alert("คัดลอกแล้ว นำไปวางใน Line/SMS ได้เลย"); setPromoMessage(""); }} disabled={isGeneratingPromo} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold shadow-md transition-colors text-lg">คัดลอกข้อความ</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------
// 2. ระบบจัดการคลังสินค้า (Inventory) - รองรับทศนิยม & ปรับราคา & แจ้งเตือน
// ------------------------------------------
function InventoryManager({ products, addProduct, updateProduct, deleteProduct, currentUser, currentBranch, conversionRequests, addConversionRequest, approveConversion, rejectConversion }) {
  const isEmployee = currentUser.role === "employee";
  const [isEditing, setIsEditing] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false); 
  const [convertData, setConvertData] = useState({ sourceId: "", targetId: "", sourceQty: 1, targetQty: 1, targetPrice: "" });
  const [formData, setFormData] = useState({ id: null, barcode: "", name: "", category: "", cost: "", price: "", stock: "" });
  const [generatedCaption, setGeneratedCaption] = useState("");
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const fileInputRef = useRef(null);

  const pendingRequests = (conversionRequests || []).filter(c => c.status === "pending");

  const handleEdit = (product) => { setFormData(product); setIsEditing(true); setGeneratedCaption(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const handleDelete = (id) => { if (window.confirm("ต้องการลบสินค้านี้ใช่หรือไม่?")) deleteProduct(id); };

  const suggestBarcode = () => {
    const lastBarcode = (products || []).length > 0 ? Math.max(...(products || []).map((p) => parseInt(p.barcode) || 0)) : 0;
    setFormData({ ...formData, barcode: String(lastBarcode + 1).padStart(8, "0") });
  };

  const handlePrintBarcode = (product) => {
    if (!product.barcode) return alert("สินค้านี้ยังไม่มีรหัสบาร์โค้ด กรุณาแก้ไขเพื่อเพิ่มรหัสก่อนครับ");
    const printWindow = window.open("", "", "height=500,width=400");
    printWindow.document.write(`
      <html>
        <head>
          <title>พิมพ์บาร์โค้ด - ${product.name}</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; margin-top: 20px; }
            .label { border: 1px dashed #ccc; padding: 15px; text-align: center; width: max-content; }
            .name { font-size: 14px; font-weight: bold; margin-bottom: 5px; max-width: 250px; }
            .price { font-size: 18px; font-weight: bold; margin-top: 8px; color: #16a34a; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="name">${product.name}</div>
            <img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(product.barcode)}&scale=3&includetext=true&textxalign=center" alt="barcode" />
            <div class="price">ราคา: ฿${product.price}</div>
          </div>
          <script>
            setTimeout(() => { window.print(); }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleGenerateCaption = async () => {
    if (!formData.name) return alert("กรุณาระบุชื่อสินค้าก่อนให้ AI ช่วยเขียนแคปชั่นครับ");
    setIsGeneratingCaption(true);
    try {
      const prompt = `ช่วยเขียนแคปชั่นขายของลง Facebook/Instagram สั้นๆ น่าสนใจ ดึงดูดลูกค้า พร้อมใส่อีโมจิ สำหรับข้อมูลสินค้าดังนี้: ชื่อสินค้า: "${formData.name}", หมวดหมู่: "${formData.category}", ราคา: ${formData.price} บาท`;
      setGeneratedCaption(await callGeminiAPI(prompt));
    } catch (err) { alert("เกิดข้อผิดพลาดในการสร้างแคปชั่น: " + err.message); } finally { setIsGeneratingCaption(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSave = { ...formData, cost: parseFloat(formData.cost), price: parseFloat(formData.price), stock: parseFloat(formData.stock) };
    if (formData.id) updateProduct(dataToSave); else addProduct({ ...dataToSave, id: Date.now(), lastChecked: null });
    setIsEditing(false);
  };

  const handleCheckStock = (id) => {
    const p = (products || []).find((x) => x.id === id);
    if (p) updateProduct({ ...p, lastChecked: new Date().toLocaleString("th-TH") });
  };

  const executeConversion = (e) => {
    e.preventDefault();
    const source = (products || []).find((p) => p.id === parseInt(convertData.sourceId));
    const target = (products || []).find((p) => p.id === parseInt(convertData.targetId));
    const sQty = parseFloat(convertData.sourceQty);
    const tQty = parseFloat(convertData.targetQty);
    const newPrice = parseFloat(convertData.targetPrice);

    if (!source || !target) return alert("กรุณาเลือกสินค้าให้ครบถ้วน");
    if (source.stock < sQty) return alert(`สต๊อก ${source.name} ไม่เพียงพอ (มี ${source.stock})`);
    if (source.id === target.id) return alert("ไม่สามารถแปลงเป็นสินค้าชนิดเดียวกันได้");
    
    if (isEmployee) {
      addConversionRequest({
        id: `CONV-${Date.now()}`,
        sourceId: source.id,
        sourceName: source.name,
        targetId: target.id,
        targetName: target.name,
        sourceQty: sQty,
        targetQty: tQty,
        targetPrice: newPrice || null,
        requestedBy: currentUser.name || currentUser.username,
        timestamp: Date.now()
      });
      alert("✅ ส่งคำขออนุมัติแปลงสินค้าไปให้ 'แอดมิน' เรียบร้อยแล้ว");
      setShowConvertModal(false);
    } else {
      if (window.confirm(`ยืนยันการแปลง: หัก ${source.name} จำนวน ${sQty} ไปเพิ่มเป็น ${target.name} จำนวน ${tQty} ใช่หรือไม่?`)) {
        updateProduct({ ...source, stock: source.stock - sQty });
        updateProduct({ 
          ...target, 
          stock: target.stock + tQty, 
          price: convertData.targetPrice ? newPrice : target.price 
        });
        setShowConvertModal(false);
      }
    }
  };

  const handleApproveRequest = (req) => {
    const source = (products || []).find((p) => p.id === req.sourceId);
    const target = (products || []).find((p) => p.id === req.targetId);
    if (!source || !target) return alert("ไม่พบข้อมูลสินค้าต้นทางหรือปลายทาง");
    if (source.stock < req.sourceQty) return alert(`❌ อนุมัติไม่ได้! สต๊อก ${source.name} ปัจจุบันไม่เพียงพอ (เหลือแค่ ${source.stock})`);
    
    if (window.confirm(`ยืนยันอนุมัติคำขอแปลง ${source.name} จำนวน ${req.sourceQty}?`)) {
      updateProduct({ ...source, stock: source.stock - req.sourceQty });
      updateProduct({ 
        ...target, 
        stock: target.stock + req.targetQty,
        price: req.targetPrice ? req.targetPrice : target.price 
      });
      approveConversion(req);
      alert("✅ อนุมัติและตัดสต๊อกเรียบร้อยแล้ว");
    }
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const parseCSVRow = (str) => {
          const result = []; let cur = ""; let inQuotes = false;
          for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === '"') { if (inQuotes && str[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; } }
            else if (char === "," && !inQuotes) { result.push(cur); cur = ""; } else { cur += char; }
          }
          result.push(cur); return result;
        };

        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
        if (lines.length < 2) return alert("ไฟล์ไม่มีข้อมูล หรือมีแค่หัวตาราง");

        let added = 0; let updated = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVRow(lines[i]).map((c) => c.trim());
          if (cols.length >= 6) {
            const barcode = cols[0]; const name = cols[1]; const category = cols[2] || "ทั่วไป";
            const cost = parseFloat(cols[3].replace(/,/g, "")) || 0; const price = parseFloat(cols[4].replace(/,/g, "")) || 0; const stock = parseFloat(cols[5].replace(/,/g, "")) || 0;
            if (barcode && name) {
              const existingP = (products || []).find((p) => p.barcode === barcode);
              const newData = { barcode, name, category, cost, price, stock, lastChecked: null };
              if (existingP) { updateProduct({ ...existingP, ...newData }); updated++; } else { addProduct({ id: Date.now() + i, ...newData }); added++; }
            }
          }
        }
        alert(`นำเข้าข้อมูลสำเร็จ!\n\nเพิ่มรายการใหม่: ${added} รายการ\nอัปเดตรายการเดิม: ${updated} รายการ`);
      } catch (err) { alert("เกิดข้อผิดพลาดในการอ่านไฟล์ กรุณาตรวจสอบให้แน่ใจว่าเป็นไฟล์ CSV"); }
      e.target.value = null;
    };
    reader.readAsText(file, "utf-8");
  };

  const headers = isEmployee ? ["รหัส", "ชื่อสินค้า", "ราคาขาย", "คงเหลือ"] : ["รหัส", "ชื่อสินค้า", "หมวดหมู่", "ราคาทุน", "ราคาขาย", "คงเหลือ"];
  const rows = [...(products || [])].map((p) => isEmployee ? [p.barcode, p.name, p.price, p.stock] : [p.barcode, p.name, p.category, p.cost, p.price, p.stock]);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden bg-gray-50 relative w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
        <div>
           <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center"><Package className="mr-2 text-blue-600"/> คลังสินค้า <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg border border-blue-200">สาขาที่ {currentBranch}</span></h2>
        </div>
        <div className="flex flex-col md:flex-row w-full md:w-auto gap-2 items-center flex-wrap justify-end">
          <ExportButtons onCSV={() => exportToCSV(headers, rows, `Inventory_Branch_${currentBranch}`)} onPDF={() => exportToPDF(`รายงานคลังสินค้า (สาขาที่ ${currentBranch})`, headers, rows)} />
          
          <div className="flex w-full md:w-auto gap-2">
            {!isEmployee && (
              <>
                <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleImportCSV} />
                <button onClick={() => fileInputRef.current.click()} className="flex-1 md:flex-none justify-center bg-teal-100 text-teal-700 hover:bg-teal-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center transition-colors shadow-sm" title="นำเข้าข้อมูลจากไฟล์ CSV"><Upload size={16} className="mr-1" /> <span className="hidden sm:inline">นำเข้า Excel</span><span className="sm:hidden">นำเข้า</span></button>
                
                <button onClick={() => setShowRequestModal(true)} className="relative flex-1 md:flex-none justify-center bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center transition-colors shadow-sm">
                  <BellRing size={16} className="mr-1" /> อนุมัติ
                  {pendingRequests.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>}
                </button>
              </>
            )}

            <button onClick={() => setShowConvertModal(true)} className="flex-1 md:flex-none justify-center bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center transition-colors shadow-sm"><ArrowRightLeft size={16} className="mr-1" /> {isEmployee ? "ขอแปลงสินค้า" : "แปลงสินค้า"}</button>
            
            {!isEmployee && (
              <button onClick={() => { setIsEditing(true); setFormData({ id: null, barcode: "", name: "", category: "", cost: "", price: "", stock: "" }); }} className="flex-1 md:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center transition-colors shadow-sm"><Plus size={16} className="mr-1" /> เพิ่ม</button>
            )}
          </div>
        </div>
      </div>

      {isEditing && !isEmployee && (
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-blue-100 mb-6 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center"><Package className="mr-2 text-blue-500"/> {formData.id ? "แก้ไขข้อมูลสินค้า" : "เพิ่มสินค้าใหม่เข้าคลัง"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">รหัสบาร์โค้ด</label>
                <div className="flex gap-2">
                  <input required type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-gray-50 text-sm font-mono" />
                  {!formData.id && (<button type="button" onClick={suggestBarcode} className="bg-slate-800 text-white px-3 rounded-lg text-xs font-bold shrink-0 shadow-sm">สุ่มรหัส</button>)}
                </div>
              </div>
              <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-600 mb-2">ชื่อสินค้า</label><input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-white text-sm" /></div>
              <div><label className="block text-xs font-bold text-gray-600 mb-2">หมวดหมู่</label><input required type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-white text-sm" placeholder="เช่น ข้าวถุง, ข้าวสาร" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-gray-600 mb-2">ราคาทุน</label><input required type="number" step="any" min="0" value={formData.cost} onChange={(e) => setFormData({ ...formData, cost: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-red-400 bg-red-50 text-sm text-right font-bold text-red-600" /></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-2">ราคาขาย</label><input required type="number" step="any" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-green-500 bg-green-50 text-sm text-right font-bold text-green-600" /></div>
              </div>
              <div><label className="block text-xs font-bold text-gray-600 mb-2">จำนวนสต๊อก</label><input required type="number" step="any" min="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-blue-50 text-sm text-center font-bold text-blue-700" /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2.5 border border-gray-300 rounded-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors">ยกเลิก</button>
              <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-colors">บันทึกข้อมูลสินค้า</button>
            </div>
          </form>
        </div>
      )}

      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-6 flex items-center text-gray-800"><ArrowRightLeft className="mr-2 text-purple-600" /> {isEmployee ? "ขออนุมัติแปลงสินค้า" : "แปลงสินค้า (แบ่งบรรจุ)"}</h3>
            {isEmployee && <p className="text-sm text-gray-500 mb-4 bg-gray-50 p-2 rounded border border-gray-200">ระบบจะทำการส่งรายการนี้ไปให้ "แอดมิน" เพื่อตรวจสอบและอนุมัติก่อนตัดสต๊อกจริงครับ</p>}
            <form onSubmit={executeConversion} className="space-y-4">
              <div className="p-5 bg-orange-50 border border-orange-200 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                <label className="block text-sm font-bold text-orange-800 mb-3">1. สินค้าต้นทาง (กระสอบ/กระบุง ที่จะหักออก)</label>
                <select required value={convertData.sourceId} onChange={(e) => setConvertData({ ...convertData, sourceId: e.target.value })} className="w-full mb-3 p-3 border border-orange-300 rounded-lg bg-white text-sm outline-none focus:border-orange-500"><option value="">-- เลือกสินค้า --</option>{(products || []).map((p) => (<option key={p.id} value={p.id}>{p.name} (มี {p.stock})</option>))}</select>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-orange-700">จำนวนที่นำมาแบ่ง:</span>
                  <input required type="number" step="any" min="0.01" value={convertData.sourceQty} onChange={(e) => setConvertData({ ...convertData, sourceQty: e.target.value })} className="w-24 p-2 border border-orange-300 rounded-lg font-bold text-center outline-none focus:border-orange-500" />
                </div>
              </div>
              
              <div className="flex justify-center -my-3 relative z-10"><div className="bg-white p-2 rounded-full border border-gray-200 shadow-sm text-gray-400"><ArrowRightLeft size={20} className="rotate-90" /></div></div>

              <div className="p-5 bg-green-50 border border-green-200 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                <label className="block text-sm font-bold text-green-800 mb-3">2. สินค้าปลายทาง (ถุงเล็ก ที่จะเพิ่มเข้า)</label>
                <select required value={convertData.targetId} onChange={(e) => {
                   const tId = e.target.value;
                   const tProd = products.find(p => p.id === parseInt(tId));
                   setConvertData({ ...convertData, targetId: tId, targetPrice: tProd ? tProd.price : "" });
                }} className="w-full mb-3 p-3 border border-green-300 rounded-lg bg-white text-sm outline-none focus:border-green-500"><option value="">-- เลือกสินค้า --</option>{(products || []).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-700">ได้จำนวน:</span>
                    <input required type="number" step="any" min="0.01" value={convertData.targetQty} onChange={(e) => setConvertData({ ...convertData, targetQty: e.target.value })} className="w-20 p-2 border border-green-300 rounded-lg font-bold text-center outline-none focus:border-green-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-blue-700">ปรับราคาใหม่:</span>
                    <input type="number" step="any" min="0" value={convertData.targetPrice} onChange={(e) => setConvertData({ ...convertData, targetPrice: e.target.value })} placeholder="ราคา" className="w-20 p-2 border border-blue-300 rounded-lg font-bold text-center outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setShowConvertModal(false)} className="px-6 py-3 border border-gray-300 rounded-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors">ยกเลิก</button><button type="submit" className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-md transition-colors">{isEmployee ? "ส่งคำขออนุมัติ" : "ยืนยันการแปลงสต๊อก"}</button></div>
            </form>
          </div>
        </div>
      )}

      {showRequestModal && !isEmployee && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center text-gray-800"><BellRing className="mr-2 text-amber-500" /> คำขออนุมัติแปลงสินค้า</h3>
                <button onClick={() => setShowRequestModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
             </div>
             <div className="space-y-4 max-h-96 overflow-y-auto">
               {pendingRequests.map(req => (
                 <div key={req.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">พนักงาน: {req.requestedBy}</span>
                     <span className="text-xs text-gray-500">{new Date(req.timestamp).toLocaleString("th-TH")}</span>
                   </div>
                   <div className="flex items-center justify-between bg-white p-3 rounded border shadow-sm">
                      <div className="flex-1 text-center">
                         <div className="text-xs text-gray-500 mb-1">หักสต๊อก</div>
                         <div className="font-bold text-orange-700 text-sm">{req.sourceName}</div>
                         <div className="font-black text-lg">-{req.sourceQty}</div>
                      </div>
                      <ArrowRightLeft className="text-gray-300 mx-4"/>
                      <div className="flex-1 text-center">
                         <div className="text-xs text-gray-500 mb-1">เพิ่มเข้า</div>
                         <div className="font-bold text-green-700 text-sm">{req.targetName}</div>
                         <div className="font-black text-lg">+{req.targetQty}</div>
                         {req.targetPrice && <div className="text-[10px] text-blue-600 mt-1">ตั้งราคาใหม่: ฿{req.targetPrice}</div>}
                      </div>
                   </div>
                   <div className="flex gap-2 mt-3">
                     <button onClick={() => handleApproveRequest(req)} className="flex-1 bg-green-600 text-white py-2 rounded font-bold shadow-sm hover:bg-green-700"><CheckCircle size={16} className="inline mr-1"/> อนุมัติ</button>
                     <button onClick={() => { if(window.confirm("ปฏิเสธคำขอนี้?")) rejectConversion(req); }} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-2 rounded font-bold hover:bg-red-100">ปฏิเสธ</button>
                   </div>
                 </div>
               ))}
               {pendingRequests.length === 0 && <div className="text-center py-8 text-gray-400">ไม่มีคำขอที่รออนุมัติ</div>}
             </div>
           </div>
         </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-gray-50 text-gray-600 text-sm border-b">
              <tr><th className="p-4 font-bold text-gray-600">รหัส</th><th className="p-4 font-bold text-gray-600">ชื่อสินค้า</th>{!isEmployee && <th className="p-4 text-right font-bold text-gray-600">ราคาทุน</th>}<th className="p-4 text-right font-bold text-gray-600">ราคาขาย</th><th className="p-4 text-center font-bold text-gray-600">คงเหลือ</th><th className="p-4 text-center font-bold text-gray-600">อัปเดตสต๊อกล่าสุด</th>{!isEmployee && <th className="p-4 text-center font-bold text-gray-600">จัดการ</th>}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...(products || [])].sort((a, b) => parseInt(a.barcode) - parseInt(b.barcode)).map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50 transition-colors text-sm">
                    <td className="p-4 font-mono text-gray-500">{p.barcode}</td>
                    <td className="p-4"><div className="font-bold text-gray-900 text-base">{p.name}</div><div className="text-xs text-gray-500 font-medium">{p.category}</div></td>
                    {!isEmployee && (<td className="p-4 text-right text-gray-400">฿{(p.cost || 0).toLocaleString()}</td>)}
                    <td className="p-4 text-right font-black text-green-700 text-lg">฿{(p.price || 0).toLocaleString()}</td>
                    <td className="p-4 text-center"><span className={`px-3 py-1 rounded-full text-xs font-bold border ${p.stock > 10 ? "bg-green-50 text-green-700 border-green-200" : p.stock > 0 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-red-50 text-red-700 border-red-200"}`}>{p.stock}</span></td>
                    <td className="p-4 text-center">{p.lastChecked ? (<div className="text-[10px] text-green-600 flex flex-col items-center bg-green-50 p-1.5 rounded-lg border border-green-100"><CheckSquare size={14} className="mb-0.5" /> <span>{p.lastChecked}</span></div>) : (<button onClick={() => handleCheckStock(p.id)} className="text-[10px] border border-blue-300 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-bold">กดเช็คสต๊อก</button>)}</td>
                    {!isEmployee && (
                      <td className="p-4 text-center flex justify-center gap-1.5 mt-2">
                        <button onClick={() => handlePrintBarcode(p)} title="พิมพ์บาร์โค้ด" className="text-gray-600 bg-gray-100 p-2 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"><Printer size={16} /></button>
                        <button onClick={() => handleEdit(p)} title="แก้ไข" className="text-blue-500 bg-blue-50 p-2 hover:bg-blue-100 rounded-lg transition-colors"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(p.id)} title="ลบ" className="text-red-500 bg-red-50 p-2 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </td>
                    )}
                  </tr>
                ))}
                {(!products || products.length === 0) && (<tr><td colSpan={isEmployee ? 5 : 7} className="p-12 text-center text-gray-400"><Package size={48} className="mx-auto opacity-20 mb-3"/>สาขานี้ยังไม่มีสินค้าในคลัง</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------
// 3. ระบบสมาชิก (CRM) - แชร์ร่วมกันทุกสาขา
// ------------------------------------------
function CustomerManager({ customers, addCustomer, updateCustomer, deleteCustomer, currentUser }) {
  const isEmployee = currentUser.role === "employee";
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ id: null, phone: "", name: "", type: "Member" });
  const [searchTerm, setSearchTerm] = useState("");
  const [promoModalCustomer, setPromoModalCustomer] = useState(null);
  const [promoMessage, setPromoMessage] = useState("");
  const [isGeneratingPromo, setIsGeneratingPromo] = useState(false);

  const filteredCustomers = [...(customers || [])].filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm));

  const handleEdit = (customer) => { setFormData(customer); setIsEditing(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const handleDelete = (id) => { if (window.confirm("ต้องการลบลูกค้ารายนี้ใช่หรือไม่?")) deleteCustomer(id); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.id) updateCustomer({ ...formData });
    else {
      if ((customers || []).find((c) => c.phone === formData.phone)) return alert("เบอร์โทรศัพท์นี้เป็นสมาชิกอยู่แล้ว");
      addCustomer({ ...formData, id: Date.now(), totalSpent: 0, lastVisit: Date.now() });
    }
    setIsEditing(false);
  };

  const handleGeneratePromo = async (customer) => {
    setPromoModalCustomer(customer); setPromoMessage(""); setIsGeneratingPromo(true);
    try {
      const prompt = `ช่วยเขียนข้อความ SMS/Line สั้นๆ เป็นกันเอง ส่งโปรโมชั่นกระตุ้นยอดขายให้ลูกค้า: ชื่อ: "${customer.name}", ประเภท: "${customer.type}". ขอข้อความที่ใส่ใจ ไม่เหมือนหุ่นยนต์ เชิญชวนกลับมาซื้อซ้ำ และใส่อีโมจิ`;
      setPromoMessage(await callGeminiAPI(prompt));
    } catch (err) { setPromoMessage("เกิดข้อผิดพลาดในการสร้างข้อความ: " + err.message); } finally { setIsGeneratingPromo(false); }
  };

  const headers = ["เบอร์โทร", "ชื่อลูกค้า", "ประเภท", "ยอดซื้อสะสม (บาท)"];
  const rows = filteredCustomers.map((c) => [c.phone, c.name, c.type, c.totalSpent]);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden bg-gray-50 relative w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
        <div><h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center"><Users className="mr-2 text-blue-600"/> ระบบสมาชิกลูกค้า (รวมทุกสาขา)</h2></div>
        <div className="flex flex-col md:flex-row w-full md:w-auto gap-2 items-center">
          <ExportButtons onCSV={() => exportToCSV(headers, rows, "Customers_AllBranch")} onPDF={() => exportToPDF("รายชื่อลูกค้าและสมาชิก (รวม)", headers, rows)} />
          <div className="flex w-full md:w-auto gap-2">
            <button onClick={() => { setIsEditing(true); setFormData({ id: null, phone: "", name: "", type: "Member" }); }} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex justify-center items-center shadow-sm transition-colors"><UserPlus size={16} className="mr-2" /> เพิ่มลูกค้าใหม่</button>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-blue-100 mb-6 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center"><UserPlus className="mr-2 text-blue-500"/> {formData.id ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มลูกค้าใหม่เข้าสู่ระบบส่วนกลาง"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="block text-xs font-bold text-gray-600 mb-2">เบอร์โทรศัพท์ (ใช้สะสมแต้ม)</label><input required type="tel" maxLength={10} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-gray-50 text-sm font-mono tracking-wider" placeholder="08XXXXXXXX" /></div>
              <div className="sm:col-span-2"><label className="block text-xs font-bold text-gray-600 mb-2">ชื่อ-นามสกุล หรือ ชื่อร้าน</label><input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-white text-sm" /></div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">ประเภทสมาชิก</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-white text-sm font-bold text-blue-800"><option value="Member">สมาชิกทั่วไป (Member)</option><option value="VIP">ลูกค้า VIP</option><option value="Wholesale">ขายส่ง (Wholesale)</option></select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100"><button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2.5 border border-gray-300 rounded-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors">ยกเลิก</button><button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-colors">บันทึกข้อมูลส่วนกลาง</button></div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-100 flex items-center bg-gray-50"><Search className="text-blue-400 mr-2" size={20} /><input type="text" placeholder="ค้นหาเบอร์โทรหรือชื่อลูกค้า (ค้นหาได้จากทุกสาขา)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm text-gray-700" /></div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-gray-50 text-gray-600 text-sm border-b"><tr><th className="p-4 font-bold">เบอร์โทร</th><th className="p-4 font-bold">ชื่อลูกค้า</th><th className="p-4 text-center font-bold">ประเภท</th><th className="p-4 text-right font-bold">ยอดซื้อสะสม</th><th className="p-4 text-center font-bold">สถานะ/แจ้งเตือน</th><th className="p-4 text-center font-bold">จัดการ</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.map((c) => {
                const daysSince = Math.floor((Date.now() - c.lastVisit) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={c.id} className="hover:bg-blue-50 transition-colors text-sm">
                    <td className="p-4 font-mono font-bold text-gray-600">{c.phone}</td>
                    <td className="p-4 font-bold text-gray-800">{c.name}</td>
                    <td className="p-4 text-center"><span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${c.type === "VIP" ? "bg-amber-50 text-amber-700 border-amber-200" : c.type === "Wholesale" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50 text-gray-700 border-gray-200"}`}>{c.type}</span></td>
                    <td className="p-4 text-right font-bold text-green-600 text-base">฿{(c.totalSpent || 0).toLocaleString()}</td>
                    <td className="p-4 text-center"><div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 inline-block">ซื้อล่าสุด {daysSince === 0 ? "วันนี้" : `${daysSince} วันที่แล้ว`}</div></td>
                    <td className="p-4 text-center flex justify-center gap-1.5 mt-1">
                      <button onClick={() => handleGeneratePromo(c)} className="text-purple-500 bg-purple-50 p-2 hover:bg-purple-100 rounded-lg transition-colors" title="สร้างข้อความเชิญชวน (AI)"><Sparkles size={16} /></button>
                      <button onClick={() => handleEdit(c)} className="text-blue-500 bg-blue-50 p-2 hover:bg-blue-100 rounded-lg transition-colors"><Edit size={16} /></button>
                      {!isEmployee && <button onClick={() => handleDelete(c.id)} className="text-red-500 bg-red-50 p-2 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={16} /></button>}
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (<tr><td colSpan="6" className="p-12 text-center text-gray-400"><Users size={48} className="mx-auto opacity-20 mb-3"/>ไม่พบข้อมูลลูกค้า</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      {promoModalCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative">
            <button onClick={() => setPromoModalCustomer(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            <h3 className="text-xl font-bold mb-4 flex items-center text-purple-700"><Sparkles className="mr-2" /> สร้างข้อความโปรโมท (AI)</h3>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 min-h-[160px] flex flex-col mb-6 shadow-inner">
              {isGeneratingPromo ? (
                <div className="flex-1 flex flex-col items-center justify-center text-purple-500"><Sparkles className="animate-spin mb-2" size={32} /> กำลังคิดคำพูดโดนใจ...</div>
              ) : (
                <textarea value={promoMessage} onChange={(e) => setPromoMessage(e.target.value)} className="w-full flex-1 bg-transparent border-none outline-none resize-none text-sm text-gray-800 font-medium leading-relaxed" rows={6} />
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleGeneratePromo(promoModalCustomer)} disabled={isGeneratingPromo} className="flex-1 py-3 border border-purple-200 text-purple-700 rounded-lg font-bold hover:bg-purple-50 transition-colors">✨ สร้างใหม่</button>
              <button onClick={() => { navigator.clipboard.writeText(promoMessage); alert("คัดลอกข้อความแล้ว!"); }} disabled={isGeneratingPromo || !promoMessage} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-md transition-colors">คัดลอกข้อความ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}// ------------------------------------------
// 4. แดชบอร์ด (Dashboard) - เลือกระบุวัน/เดือน/ปี ได้
// ------------------------------------------
function Dashboard({ salesHistory, products, currentBranch }) {
  // ค่าเริ่มต้น: วันที่ 1 ของเดือนปัจจุบัน ถึง วันนี้
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const filteredSales = (salesHistory || []).filter((sale) => {
    const sDate = new Date(sale.timestamp); sDate.setHours(0,0,0,0);
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(23,59,59,999);
    return sDate >= start && sDate <= end;
  });

  const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const cashSales = filteredSales.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + s.total, 0);
  const transferSales = filteredSales.filter((s) => s.paymentMethod === "transfer").reduce((sum, s) => sum + s.total, 0);

  const totalCostValue = (products || []).reduce((sum, p) => sum + p.cost * p.stock, 0);
  const totalPriceValue = (products || []).reduce((sum, p) => sum + p.price * p.stock, 0);
  const totalProfitValue = totalPriceValue - totalCostValue;

  const itemSales = {};
  filteredSales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      if (!itemSales[item.id]) itemSales[item.id] = { name: item.name, qty: 0, revenue: 0 };
      itemSales[item.id].qty += item.qty;
      itemSales[item.id].revenue += item.price * item.qty;
    });
  });
  const topProducts = Object.values(itemSales).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const [aiInsight, setAiInsight] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeBusiness = async () => {
    setIsAnalyzing(true);
    try {
      const prompt = `ในฐานะที่ปรึกษาธุรกิจ SME มืออาชีพ ช่วยวิเคราะห์ข้อมูลร้านค้า สาขาที่ ${currentBranch} ช่วงวันที่ ${startDate} ถึง ${endDate} ต่อไปนี้และให้คำแนะนำสั้นๆ 3 ข้อ: ยอดขายรวม: ${totalSales} บาท, สินค้าขายดี: ${topProducts.map((p) => p.name).join(", ")}, สินค้าใกล้หมดสต๊อก: ${(products || []).filter((p) => p.stock <= 10).map((p) => p.name).join(", ") || "ไม่มี"}`;
      setAiInsight(await callGeminiAPI(prompt));
    } catch (err) { setAiInsight("ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้"); } finally { setIsAnalyzing(false); }
  };

  return (
    <div className="p-4 md:p-6 h-full overflow-y-auto bg-gray-50 w-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center">ภาพรวมธุรกิจ (Dashboard) <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg border border-blue-200">สาขาที่ {currentBranch}</span></h2>
        
        {/* 🌟 กล่องเลือกช่วงวันที่ */}
        <div className="flex flex-col sm:flex-row gap-3 items-end bg-white p-3 rounded-xl border border-gray-200 shadow-sm w-full lg:w-auto">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">ตั้งแต่วันที่</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500 text-sm font-bold text-gray-700" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">ถึงวันที่</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500 text-sm font-bold text-gray-700" />
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-2xl shadow-md text-white mb-8 relative overflow-hidden">
        <div className="flex justify-between items-center mb-4 relative z-10"><h3 className="text-lg font-bold flex items-center"><Sparkles className="mr-2" /> ผู้ช่วยที่ปรึกษาธุรกิจ (AI Insights)</h3><button onClick={handleAnalyzeBusiness} disabled={isAnalyzing} className="bg-white text-purple-700 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-transform active:scale-95">{isAnalyzing ? "กำลังประมวลผล..." : "✨ วิเคราะห์ร้าน"}</button></div>
        <div className="relative z-10">{aiInsight ? (<div className="bg-white/20 p-4 rounded-xl text-sm whitespace-pre-wrap backdrop-blur-sm border border-white/30">{aiInsight}</div>) : (<p className="text-purple-100 text-sm">ให้ AI ประเมินข้อมูลร้านปัจจุบันเพื่อเสนอไอเดียและกลยุทธ์!</p>)}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="ยอดขายรวม" value={`฿${(totalSales || 0).toLocaleString()}`} color="bg-green-500" icon={<ShoppingCart size={24} className="text-white" />} />
        <StatCard title="รับเงินสด" value={`฿${(cashSales || 0).toLocaleString()}`} color="bg-blue-500" icon={<Banknote size={24} className="text-white" />} />
        <StatCard title="รับเงินโอน" value={`฿${(transferSales || 0).toLocaleString()}`} color="bg-purple-500" icon={<CreditCard size={24} className="text-white" />} />
        <StatCard title="มูลค่าคลัง (ทุน)" value={`฿${(totalCostValue || 0).toLocaleString()}`} subtitle={`คาดการณ์กำไร ฿${(totalProfitValue || 0).toLocaleString()}`} color="bg-orange-500" icon={<Package size={24} className="text-white" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><TrendingUp className="mr-2 text-indigo-500" /> 5 อันดับ สินค้าขายดี (ช่วงเวลาที่เลือก)</h3>
          <div className="space-y-4">
            {topProducts.map((p, idx) => (
              <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 transition-colors hover:border-indigo-200">
                <div className="flex items-center"><div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 flex justify-center items-center text-sm font-bold mr-3">{idx + 1}</div><p className="font-medium text-gray-800">{p.name}</p></div>
                <div className="text-right"><p className="font-bold text-gray-700">{p.qty} ชิ้น</p><p className="text-xs font-bold text-green-600">฿{(p.revenue || 0).toLocaleString()}</p></div>
              </div>
            ))}
            {topProducts.length === 0 && <div className="text-center py-6 text-gray-400">ยังไม่มีข้อมูลการขายในช่วงนี้</div>}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><AlertCircle className="mr-2 text-red-500"/> สินค้าใกล้หมดสต๊อก (น้อยกว่า 10)</h3>
          <table className="w-full text-left text-sm">
            <thead><tr className="text-gray-500"><th className="pb-2 font-medium">ชื่อสินค้า</th><th className="pb-2 text-right font-medium">คงเหลือ</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {[...(products || [])].filter((p) => p.stock <= 10).map((p) => (
                  <tr key={p.id} className="hover:bg-red-50 transition-colors"><td className="py-3 font-medium text-gray-800">{p.name}</td><td className="py-3 text-right"><span className={`px-2 py-1 rounded-md text-xs font-bold border ${p.stock === 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}>{p.stock}</span></td></tr>
              ))}
              {((products || []).filter((p) => p.stock <= 10).length === 0) && <tr><td colSpan="2" className="py-6 text-center text-gray-400">ไม่มีสินค้าใกล้หมดสต๊อก</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, color, icon }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center relative overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-md">
      <div className={`absolute top-0 left-0 w-1.5 h-full ${color}`}></div>
      <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mr-4 shrink-0 shadow-inner`}>{icon}</div>
      <div className="min-w-0"><p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{title}</p><p className="text-2xl font-black text-gray-800 leading-none">{value}</p>{subtitle && <p className="text-[10px] font-bold text-emerald-600 mt-1.5 bg-emerald-50 inline-block px-1.5 py-0.5 rounded">{subtitle}</p>}</div>
    </div>
  );
}

// ------------------------------------------
// 5. บัญชี (Accounting) - เลือกวันที่ได้
// ------------------------------------------
function AccountingDashboard({ salesHistory, accountingEntries, addAccounting, deleteAccounting, currentBranch }) {
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split("T")[0], type: "asset", name: "", amount: "" });

  const filterByPeriod = (timestamp) => {
    const d = new Date(timestamp); d.setHours(0,0,0,0);
    const s = new Date(startDate); s.setHours(0,0,0,0);
    const e = new Date(endDate); e.setHours(23,59,59,999);
    return d >= s && d <= e;
  };

  const filteredSales = [...(salesHistory || [])].filter((s) => filterByPeriod(s.timestamp));
  const filteredEntries = [...(accountingEntries || [])].filter((e) => filterByPeriod(e.timestamp));
  
  const salesRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const cogs = filteredSales.reduce((sum, s) => sum + s.totalCost, 0);
  const grossProfit = salesRevenue - cogs;
  const otherRevenue = filteredEntries.filter((e) => e.type === "revenue").reduce((sum, e) => sum + e.amount, 0);
  const expenses = filteredEntries.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit + otherRevenue - expenses;

  const totalAssets = filteredEntries.filter((e) => e.type === "asset").reduce((sum, e) => sum + e.amount, 0) + salesRevenue + otherRevenue - expenses;
  const totalLiabilities = filteredEntries.filter((e) => e.type === "liability").reduce((sum, e) => sum + e.amount, 0);
  const totalEquity = filteredEntries.filter((e) => e.type === "equity").reduce((sum, e) => sum + e.amount, 0) + netProfit;
  const isBalanced = totalAssets === totalLiabilities + totalEquity;

  const handleAddEntry = (e) => {
    e.preventDefault();
    addAccounting({ ...formData, id: `ACC-${Date.now()}`, timestamp: new Date(formData.date).getTime(), amount: parseFloat(formData.amount) });
    setShowForm(false); setFormData({ date: new Date().toISOString().split("T")[0], type: "asset", name: "", amount: "" });
  };

  const typeLabels = { asset: "สินทรัพย์", liability: "หนี้สิน", equity: "ทุน", revenue: "รายได้", expense: "ค่าใช้จ่าย" };
  const typeColors = { asset: "text-blue-600 bg-blue-50 border-blue-200", liability: "text-orange-600 bg-orange-50 border-orange-200", equity: "text-purple-600 bg-purple-50 border-purple-200", revenue: "text-green-600 bg-green-50 border-green-200", expense: "text-red-600 bg-red-50 border-red-200" };

  return (
    <div className="p-4 md:p-6 h-full overflow-y-auto bg-slate-50 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center"><Calculator className="mr-2 text-indigo-600" /> บัญชีและกำไรขาดทุน <span className="ml-3 px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-lg border border-indigo-200">สาขา {currentBranch}</span></h2>
        
        <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm w-full md:w-auto">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-1 border-b border-gray-300 outline-none focus:border-indigo-500 text-sm font-bold text-gray-700 w-full" />
          <span className="text-gray-400 font-bold">-</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-1 border-b border-gray-300 outline-none focus:border-indigo-500 text-sm font-bold text-gray-700 w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
          <h3 className="font-bold text-gray-800 mb-5 flex items-center"><PieChart className="mr-2 text-indigo-500" /> สรุปกำไร/ขาดทุน (ตามช่วงเวลา)</h3>
          <div className="space-y-3 text-sm md:text-base">
            <div className="flex justify-between items-center"><span className="text-gray-600 font-medium">รายได้จากการขาย</span><span className="font-bold text-green-600">฿{(salesRevenue || 0).toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><span className="text-gray-600 font-medium">หัก: ต้นทุนขาย</span><span className="font-bold text-red-500">- ฿{(cogs || 0).toLocaleString()}</span></div>
            <div className="flex justify-between items-center font-bold border-t border-gray-100 pt-3"><span>กำไรขั้นต้น</span><span className="text-lg text-indigo-700">฿{(grossProfit || 0).toLocaleString()}</span></div>
            <div className="flex justify-between items-center mt-3"><span className="text-gray-600 font-medium">รายได้อื่นๆ</span><span className="font-bold text-green-600">+ ฿{(otherRevenue || 0).toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><span className="text-gray-600 font-medium">หัก: ค่าใช้จ่าย</span><span className="font-bold text-red-500">- ฿{(expenses || 0).toLocaleString()}</span></div>
          </div>
          <div className={`mt-5 pt-4 border-t-2 border-dashed flex justify-between font-black text-xl ${netProfit >= 0 ? "text-green-600 border-green-200" : "text-red-600 border-red-200"}`}><span>กำไรสุทธิ</span><span>฿{(netProfit || 0).toLocaleString()}</span></div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl shadow-md text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          <h3 className="font-bold text-blue-300 mb-6 flex items-center relative z-10"><Calculator className="mr-2"/> สมการบัญชี (A = L + E)</h3>
          <div className="space-y-6 relative z-10">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3"><span className="font-medium text-slate-300">สินทรัพย์รวม</span><span className="text-2xl font-black text-blue-400">฿{(totalAssets || 0).toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><span className="font-medium text-slate-300">หนี้สินรวม</span><span className="text-xl font-bold text-orange-400">฿{(totalLiabilities || 0).toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><span className="font-medium text-slate-300">ส่วนของเจ้าของ</span><span className="text-xl font-bold text-purple-400">฿{(totalEquity || 0).toLocaleString()}</span></div>
          </div>
          <div className="mt-6 p-3 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 text-center font-bold relative z-10">{isBalanced ? (<span className="text-green-400 flex items-center justify-center"><CheckCircle size={18} className="mr-2"/> สมการสมดุล</span>) : (<span className="text-red-400 flex items-center justify-center"><AlertCircle size={18} className="mr-2"/> ⚠️ สมการไม่สมดุล</span>)}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">สมุดบัญชีรายวัน</h3>
          <button onClick={() => setShowForm(!showForm)} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors ${showForm ? "bg-gray-200 text-gray-700" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"}`}>{showForm ? "ปิดหน้าต่าง" : (<><Plus size={16} className="mr-2" /> เพิ่มรายการ</>)}</button>
        </div>
        {showForm && (
          <div className="p-5 bg-indigo-50 border-b border-indigo-100">
            <form onSubmit={handleAddEntry} className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div><label className="block text-xs font-bold text-indigo-800 mb-1">วันที่</label><input required type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm outline-none focus:border-indigo-500" /></div>
              <div><label className="block text-xs font-bold text-indigo-800 mb-1">หมวดหมู่บัญชี</label><select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm outline-none focus:border-indigo-500 font-bold"><option value="asset">สินทรัพย์</option><option value="liability">หนี้สิน</option><option value="equity">ทุน</option><option value="revenue">รายได้</option><option value="expense">ค่าใช้จ่าย</option></select></div>
              <div className="md:col-span-2"><label className="block text-xs font-bold text-indigo-800 mb-1">รายละเอียดรายการ</label><input required type="text" placeholder="เช่น จ่ายค่าไฟ, รับเงินลงทุน..." value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm outline-none focus:border-indigo-500" /></div>
              <div><label className="block text-xs font-bold text-indigo-800 mb-1">จำนวนเงิน (บาท)</label><div className="flex gap-2"><input required type="number" min="0" placeholder="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm font-bold text-right outline-none focus:border-indigo-500" /><button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-lg font-bold shadow-sm transition-colors">บันทึก</button></div></div>
            </form>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm"><thead className="bg-white border-b"><tr><th className="p-4 font-bold text-gray-600">วันที่</th><th className="p-4 font-bold text-gray-600 text-center">หมวด</th><th className="p-4 font-bold text-gray-600">รายการ</th><th className="p-4 text-right font-bold text-gray-600">จำนวนเงิน</th><th className="p-4 text-center font-bold text-gray-600">ลบ</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filteredEntries.map((e) => (
                <tr key={e.id} className="hover:bg-indigo-50 transition-colors">
                  <td className="p-4 text-gray-500">{new Date(e.timestamp).toLocaleDateString("th-TH")}</td>
                  <td className="p-4 text-center"><span className={`px-3 py-1 rounded-md text-[10px] font-bold border ${typeColors[e.type]}`}>{typeLabels[e.type]}</span></td>
                  <td className="p-4 font-medium text-gray-800">{e.name}</td>
                  <td className="p-4 text-right font-bold text-gray-800 text-base">฿{(e.amount || 0).toLocaleString()}</td>
                  <td className="p-4 text-center"><button onClick={() => { if(window.confirm("ยืนยันการลบรายการบัญชีนี้?")) deleteAccounting(e.id); }} className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"><Trash2 size={16} /></button></td>
                </tr>
              ))}
              {filteredEntries.length === 0 && <tr><td colSpan="5" className="p-12 text-center text-gray-400">ไม่มีประวัติลงบัญชี</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------
// 6. ประวัติการขาย (History) - คืนสต๊อก & วันที่
// ------------------------------------------
function SalesHistory({ salesHistory, currentUser, updateSale, onVoidSale }) {
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [editModal, setEditModal] = useState(null);

  const isEmployee = currentUser.role === "employee";

  const checkFilter = (timestamp) => {
    const d = new Date(timestamp); d.setHours(0,0,0,0);
    const s = new Date(startDate); s.setHours(0,0,0,0);
    const e = new Date(endDate); e.setHours(23,59,59,999);
    return d >= s && d <= e;
  };

  const filteredSales = [...(salesHistory || [])].filter((s) => checkFilter(s.timestamp));
  
  // 🌟 คำนวณสรุปยอดแยกประเภท
  const totalCash = filteredSales.filter(s => s.paymentMethod === 'cash').reduce((a,b) => a+b.total, 0);
  const totalTransfer = filteredSales.filter(s => s.paymentMethod === 'transfer').reduce((a,b) => a+b.total, 0);
  const totalCredit = filteredSales.filter(s => s.paymentMethod === 'credit').reduce((a,b) => a+b.total, 0);
  const totalSum = filteredSales.reduce((a, b) => a + b.total, 0);

  const headers = ["วัน-เวลา", "เลขที่บิล", "ลูกค้า", "วิธีชำระ", "ยอดสุทธิ"];
  const rows = filteredSales.map((s) => [s.date, s.id, s.customer, s.paymentMethod === "cash" ? "เงินสด" : s.paymentMethod === "credit" ? "เงินเชื่อ" : "เงินโอน", s.total]);

  const handleSaveEdit = (e) => {
    e.preventDefault();
    updateSale(editModal);
    setEditModal(null);
    alert("บันทึกการแก้ไขบิลเรียบร้อยแล้ว");
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden bg-gray-50 w-full relative">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center"><History className="mr-2 text-indigo-600"/> ประวัติการขาย (คืนสต๊อกได้)</h2>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center w-full xl:w-auto">
          
          <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm w-full sm:w-auto">
             <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-1 border-b border-gray-300 outline-none focus:border-indigo-500 text-xs md:text-sm font-bold text-gray-700 w-full" />
             <span className="text-gray-400 font-bold">-</span>
             <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-1 border-b border-gray-300 outline-none focus:border-indigo-500 text-xs md:text-sm font-bold text-gray-700 w-full" />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <ExportButtons onCSV={() => exportToCSV(headers, rows, "Sales_History")} onPDF={() => exportToPDF("ประวัติการขาย", headers, rows)} />
          </div>
        </div>
      </div>

      {/* 🌟 แผงสรุปยอดรวมด้านบน */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <div className="text-xs text-gray-500 font-bold mb-1">ยอดเงินสด</div>
           <div className="text-xl font-black text-blue-600">฿{totalCash.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <div className="text-xs text-gray-500 font-bold mb-1">ยอดเงินโอน</div>
           <div className="text-xl font-black text-purple-600">฿{totalTransfer.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <div className="text-xs text-gray-500 font-bold mb-1">ค้างจ่าย (เงินเชื่อ)</div>
           <div className="text-xl font-black text-orange-500">฿{totalCredit.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl shadow-md border border-slate-700">
           <div className="text-xs text-slate-300 font-bold mb-1">รวมสุทธิตามตัวกรอง</div>
           <div className="text-2xl font-black text-green-400">฿{totalSum.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm"><thead className="bg-gray-50 border-b border-gray-100"><tr><th className="p-4 font-bold text-gray-600">เวลา</th><th className="p-4 font-bold text-gray-600">บิลเลขที่ / รายการสินค้า</th><th className="p-4 font-bold text-gray-600">ลูกค้า</th><th className="p-4 text-center font-bold text-gray-600">ช่องทางรับชำระ</th><th className="p-4 text-right font-bold text-gray-600">ยอดสุทธิ</th><th className="p-4 text-center font-bold text-gray-600">แก้ไข</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSales.sort((a, b) => b.timestamp - a.timestamp).map((s) => (
                  <tr key={s.id} className="hover:bg-blue-50 transition-colors">
                    <td className="p-4 text-gray-500 font-medium whitespace-nowrap">{s.date}</td>
                    <td className="p-4">
                      <div className="font-black text-blue-700 mb-1 text-base">{s.id}</div>
                      {/* 🌟 แสดงรายการสินค้าในบิล */}
                      <div className="text-xs text-gray-500 font-medium leading-relaxed bg-gray-50 p-1.5 rounded border border-gray-100 inline-block w-max max-w-[250px] truncate">
                        {(s.items || []).map(item => `${item.name} (x${item.qty})`).join(', ')}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-gray-800">{s.customer}</td>
                    <td className="p-4 text-center"><span className={`px-3 py-1 rounded-md text-[10px] font-bold border ${s.paymentMethod === "cash" ? "bg-blue-50 text-blue-700 border-blue-200" : s.paymentMethod === "credit" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>{s.paymentMethod === "cash" ? "เงินสด" : s.paymentMethod === "credit" ? "ติดไว้ก่อน" : "เงินโอน"}</span></td>
                    <td className="p-4 text-right font-black text-green-600 text-base">฿{(s.total || 0).toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => setEditModal(s)} className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors border border-indigo-100 flex items-center justify-center mx-auto"><Edit size={14} className="mr-1"/> แก้ไข/ยกเลิก</button>
                    </td>
                  </tr>
                ))}
              {filteredSales.length === 0 && (<tr><td colSpan="6" className="p-12 text-center text-gray-400"><History size={48} className="mx-auto opacity-20 mb-3"/>ไม่มีประวัติการขายในช่วงเวลานี้</td></tr>)}
            </tbody>
            {/* 🌟 สรุปยอดด้านล่างตาราง */}
            <tfoot className="bg-slate-800 text-white font-bold">
               <tr>
                 <td colSpan="4" className="p-4 text-right border-r border-slate-700 text-sm">
                   สด: <span className="text-blue-300">฿{totalCash.toLocaleString()}</span> | 
                   โอน: <span className="text-purple-300">฿{totalTransfer.toLocaleString()}</span> | 
                   รวมทั้งหมด:
                 </td>
                 <td className="p-4 text-right text-green-400 text-xl">฿{(totalSum || 0).toLocaleString()}</td>
                 <td className="p-4"></td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 🌟 Modal แก้ไขและลบบิล */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border-t-4 border-indigo-500">
            <h3 className="text-lg font-bold mb-4 flex items-center text-gray-800"><Edit className="mr-2 text-indigo-500" /> แก้ไขบิล {editModal.id}</h3>
            
            <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
               <div className="flex justify-between mb-1"><span className="text-gray-500">ยอดสุทธิ:</span><span className="font-bold text-green-600">฿{editModal.total.toLocaleString()}</span></div>
               <div className="flex justify-between"><span className="text-gray-500">ลูกค้า:</span><span className="font-bold">{editModal.customer}</span></div>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">แก้ไขช่องทางรับชำระ</label>
                <select value={editModal.paymentMethod} onChange={(e) => setEditModal({...editModal, paymentMethod: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 outline-none focus:border-indigo-500 bg-white">
                  <option value="cash">เงินสด</option>
                  <option value="transfer">เงินโอน</option>
                  <option value="credit">ติดไว้ก่อน (เงินเชื่อ)</option>
                </select>
              </div>
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditModal(null)} className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-lg font-bold hover:bg-gray-50 transition-colors">ยกเลิก</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition-colors">บันทึก</button>
              </div>
            </form>
            
            {/* ปุ่มยกเลิกบิล ให้สิทธิ์เฉพาะแอดมินหรือระบบที่ต้องการ */}
            {!isEmployee && (
              <div className="mt-6 pt-4 border-t border-red-100 text-center">
                <button type="button" onClick={() => { onVoidSale(editModal); setEditModal(null); }} className="text-red-500 font-bold text-sm flex items-center justify-center mx-auto hover:bg-red-50 px-4 py-2 rounded-lg transition-colors border border-red-100"><RotateCcw size={16} className="mr-2"/> ยกเลิกบิลนี้ และ คืนสต๊อก</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------
// 7. รายงานการขายรายวัน (Sales Report) - เลือกวันที่ได้
// ------------------------------------------
function SalesReport({ salesHistory, currentUser, currentBranch }) {
  const isEmployee = currentUser?.role === "employee";
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const checkFilter = (timestamp) => {
    const d = new Date(timestamp); d.setHours(0,0,0,0);
    const s = new Date(startDate); s.setHours(0,0,0,0);
    const e = new Date(endDate); e.setHours(23,59,59,999);
    return d >= s && d <= e;
  };

  const filteredSales = [...(salesHistory || [])].filter((s) => checkFilter(s.timestamp));

  const groupedSales = filteredSales.reduce((acc, sale) => {
    const dateKey = new Date(sale.timestamp).toLocaleDateString("th-TH");
    if (!acc[dateKey]) acc[dateKey] = { date: dateKey, bills: 0, items: 0, total: 0, cost: 0, profit: 0, timestamp: sale.timestamp };
    const itemsCount = sale.items.reduce((sum, item) => sum + item.qty, 0);
    acc[dateKey].bills += 1; acc[dateKey].items += itemsCount; acc[dateKey].total += sale.total; acc[dateKey].cost += sale.totalCost; acc[dateKey].profit += sale.total - sale.totalCost;
    return acc;
  }, {});
  const reportData = Object.values(groupedSales).sort((a, b) => b.timestamp - a.timestamp);

  const totalBills = reportData.reduce((sum, r) => sum + r.bills, 0);
  const totalItems = reportData.reduce((sum, r) => sum + r.items, 0);
  const totalSales = reportData.reduce((sum, r) => sum + r.total, 0);
  const totalCost = reportData.reduce((sum, r) => sum + r.cost, 0);
  const totalProfit = reportData.reduce((sum, r) => sum + r.profit, 0);

  const headers = isEmployee ? ["วันที่", "บิล", "จำนวน(ชิ้น)", "ยอดขายรวม"] : ["วันที่", "บิล", "จำนวน(ชิ้น)", "ทุน", "ยอดขายรวม", "กำไร"];
  const rows = reportData.map((r) => isEmployee ? [r.date, r.bills, r.items, r.total] : [r.date, r.bills, r.items, r.cost, r.total, r.profit]);
  const footerHtml = isEmployee ? `รวมจำนวนชิ้น: ${(totalItems || 0).toLocaleString()} | ยอดขายรวม: ฿${(totalSales || 0).toLocaleString()}` : `รวมจำนวนชิ้น: ${(totalItems || 0).toLocaleString()} | ต้นทุนรวม: ฿${(totalCost || 0).toLocaleString()}<br>ยอดขายรวม: ฿${(totalSales || 0).toLocaleString()} | กำไรรวม: ฿${(totalProfit || 0).toLocaleString()}`;

  return (
    <div className="p-4 md:p-6 h-full flex flex-col bg-gray-50 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center"><FileText className="mr-2 text-indigo-600"/> รายงานการขายรายวัน <span className="ml-3 px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-lg border border-indigo-200">สาขา {currentBranch}</span></h2>
        
        <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm w-full md:w-auto">
             <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-1 border-b border-gray-300 outline-none focus:border-indigo-500 text-xs md:text-sm font-bold text-gray-700 w-full" />
             <span className="text-gray-400 font-bold">-</span>
             <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-1 border-b border-gray-300 outline-none focus:border-indigo-500 text-xs md:text-sm font-bold text-gray-700 w-full" />
        </div>

        <ExportButtons onCSV={() => exportToCSV(headers, rows, "Daily_Sales_Report")} onPDF={() => exportToPDF("รายงานการขายรายวัน", headers, rows, footerHtml)} />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 overflow-auto">
        <table className="w-full text-left text-sm"><thead className="bg-gray-50 border-b border-gray-100"><tr><th className="p-4 font-bold text-gray-600">วันที่</th><th className="p-4 text-center font-bold text-gray-600">บิล</th><th className="p-4 text-center font-bold text-gray-600">จำนวน(ชิ้น)</th>{!isEmployee && <th className="p-4 text-right font-bold text-gray-600">ทุนรวม</th>}<th className="p-4 text-right font-bold text-gray-600">ยอดขายรวม</th>{!isEmployee && <th className="p-4 text-right font-bold text-gray-600">กำไร</th>}</tr></thead><tbody className="divide-y divide-gray-50">
            {reportData.map((row, idx) => (
              <tr key={idx} className="hover:bg-indigo-50 transition-colors">
                <td className="p-4 font-bold text-gray-800">{row.date}</td><td className="p-4 text-center font-medium">{row.bills}</td><td className="p-4 text-center text-blue-600 font-bold bg-blue-50/50">{(row.items || 0).toLocaleString()}</td>
                {!isEmployee && (<td className="p-4 text-right text-gray-500">฿{(row.cost || 0).toLocaleString()}</td>)}<td className="p-4 text-right font-black text-green-600 text-base">฿{(row.total || 0).toLocaleString()}</td>{!isEmployee && (<td className="p-4 text-right font-black text-indigo-600 text-base bg-indigo-50/50">฿{(row.profit || 0).toLocaleString()}</td>)}
              </tr>
            ))}
            {reportData.length === 0 && (<tr><td colSpan={isEmployee ? "4" : "6"} className="p-12 text-center text-gray-400">ยังไม่มีข้อมูลการขายในช่วงนี้</td></tr>)}
          </tbody>
          <tfoot className="bg-slate-800 text-white font-bold"><tr><td className="p-4 text-right border-r border-slate-700">รวมทั้งหมด:</td><td className="p-4 text-center border-r border-slate-700">{(totalBills || 0).toLocaleString()}</td><td className="p-4 text-center text-blue-300 border-r border-slate-700">{(totalItems || 0).toLocaleString()}</td>{!isEmployee && (<td className="p-4 text-right text-slate-300 border-r border-slate-700">฿{(totalCost || 0).toLocaleString()}</td>)}<td className="p-4 text-right text-green-400 text-xl border-r border-slate-700">฿{(totalSales || 0).toLocaleString()}</td>{!isEmployee && (<td className="p-4 text-right text-indigo-300 text-xl">฿{(totalProfit || 0).toLocaleString()}</td>)}</tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------
// 11. ระบบรับเข้าสินค้า (Goods Receipt) - แอดมิน
// ------------------------------------------
function GoodsReceiptManager({ products, updateProduct, addReceipt, currentUser, suppliers, addSupplier, deleteSupplier }) {
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [supplier, setSupplier] = useState("");
  const [mobileView, setMobileView] = useState(0);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  const rawCategories = Array.from(new Set([...(products || [])].map((p) => (p.category || "").trim()).filter(Boolean)));
  const sortedCategories = rawCategories.includes("ข้าวโล") ? ["ข้าวโล", ...rawCategories.filter(c => c !== "ข้าวโล")] : rawCategories;
  const categories = ["ทั้งหมด", ...sortedCategories];
  
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalCost = cart.reduce((sum, item) => sum + item.receiveCost * item.qty, 0);

  const filteredProducts = [...(products || [])].filter((p) => (p.name.includes(searchTerm) || p.barcode.includes(searchTerm)) && (selectedCategory === "ทั้งหมด" || (p.category || "").trim() === selectedCategory));

  const handleAddSupplier = (e) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    const exist = (suppliers || []).find((s) => s.name === newSupplierName.trim());
    if (exist) return alert("มีชื่อผู้จำหน่ายนี้แล้ว");
    addSupplier({ id: Date.now(), name: newSupplierName.trim() });
    setNewSupplierName("");
  };

  const handleDeleteSupplier = (id) => {
    if (window.confirm("ต้องการลบผู้จำหน่ายรายนี้?")) {
      deleteSupplier(id);
      if ((suppliers || []).find((s) => s.id === id)?.name === supplier) setSupplier("");
    }
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) return prev.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1, receiveCost: product.cost }];
    });
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((item) => item.id !== id));
  const updateQty = (id, delta) => setCart((prev) => prev.map((item) => {
        if (item.id === id) { const n = item.qty + delta; if (n > 0) return { ...item, qty: n }; }
        return item;
      }));

  const updateCost = (id, newCost) => setCart((prev) => prev.map((item) => {
        if (item.id === id) return { ...item, receiveCost: Number(newCost) || 0 };
        return item;
      }));

  const handleConfirm = () => {
    if (cart.length === 0) return alert("กรุณาเลือกสินค้าที่ต้องการรับเข้า");
    if (!supplier) return alert("กรุณาระบุชื่อผู้จำหน่าย / แหล่งที่มา");

    cart.forEach((item) => {
      const p = (products || []).find((x) => x.id === item.id);
      if (p) { updateProduct({ ...p, stock: p.stock + item.qty, cost: item.receiveCost }); }
    });

    const receiptRecord = {
      id: "GR-" + Date.now().toString().slice(-6), timestamp: Date.now(), date: new Date().toLocaleString("th-TH"),
      receiver: currentUser.name || currentUser.username, supplier: supplier,
      items: cart.map((i) => ({ id: i.id, name: i.name, qty: i.qty, cost: i.receiveCost })),
      totalItems, totalCost, paymentMethod,
    };

    addReceipt(receiptRecord);
    alert("บันทึกรับเข้าสินค้าเรียบร้อยแล้ว สต๊อกและต้นทุนได้รับการอัปเดต!");
    setCart([]); setSupplier(""); setPaymentMethod("cash"); setMobileView(0); setSearchTerm("");
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full w-full overflow-hidden relative">
      <div className="md:hidden flex bg-white border-b shadow-sm z-10 shrink-0"><button onClick={() => setMobileView(0)} className={`flex-1 py-3 font-bold ${mobileView === 0 ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}>เลือกสินค้า</button><button onClick={() => setMobileView(1)} className={`flex-1 py-3 font-bold ${mobileView === 1 ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}>รายการรับเข้า ({cart.length})</button></div>
      <div className={`flex-1 flex flex-col bg-gray-50 md:border-r h-full ${mobileView === 0 ? "block" : "hidden md:flex"}`}>
        <div className="p-4 bg-slate-800 text-white font-bold flex justify-between shrink-0"><div className="flex items-center"><Truck className="mr-2" /> ระบบรับเข้าสินค้า (Goods Receipt)</div></div>
        <div className="p-3 bg-white shadow-sm flex items-center gap-4 z-10"><Search className="text-gray-400" size={20} /><input type="text" placeholder="ค้นหาสินค้าที่จะนำเข้าสต๊อก..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-2 outline-none" /></div>
        <div className="bg-white flex items-center px-3 py-2 overflow-x-auto border-b hide-scrollbar"><div className="flex gap-2">{categories.map((cat, i) => (<button key={i} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? "bg-blue-100 text-blue-800 border border-blue-200" : "bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200"}`}>{cat}</button>))}</div></div>
        <div className="flex-1 overflow-y-auto p-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filteredProducts.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left hover:border-blue-500 hover:shadow-md active:scale-95 transition-all">
                <div className="text-[10px] text-gray-400 font-mono mb-1">{p.barcode}</div><div className="font-bold text-gray-900 line-clamp-2 min-h-[40px] text-sm md:text-base leading-tight mb-2">{p.name}</div>
                <div className="w-full flex justify-between items-end mt-auto"><span className="text-gray-500 text-xs">ทุนเดิม: ฿{(p.cost || 0).toLocaleString()}</span><span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-bold text-gray-600 border border-gray-200">มีในคลัง: {p.stock}</span></div>
              </button>
            ))}
          </div></div>
      </div>
      <div className={`w-full md:w-[450px] bg-white flex flex-col shadow-2xl md:shadow-none border-l z-10 h-full ${mobileView === 1 ? "block" : "hidden md:flex"}`}>
        <div className="p-4 bg-slate-800 text-white font-bold flex justify-between items-center shrink-0"><div className="flex items-center"><ClipboardList className="mr-2" /> รายการรับเข้า</div><span className="bg-slate-700 px-2 py-0.5 rounded text-sm">{totalItems} ชิ้น</span></div>
        <div className="flex-1 overflow-y-auto p-3 bg-gray-50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3"><Truck size={56} className="opacity-20 text-slate-500" /><p className="font-medium">ยังไม่ได้เลือกสินค้ารับเข้า</p></div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="bg-white p-3 mb-3 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-2 relative animate-in slide-in-from-right-4">
                <div className="font-bold text-gray-800 pr-6 leading-tight">{item.name}</div>
                <div className="flex gap-3 mt-1">
                  <div className="flex-1"><label className="text-[10px] text-gray-500 font-bold block mb-1 uppercase tracking-wider">ราคาทุน/ชิ้น (อัปเดตได้)</label><div className="relative"><span className="absolute left-2 top-2 text-gray-500 text-sm">฿</span><input type="number" min="0" value={item.receiveCost} onChange={(e) => updateCost(item.id, e.target.value)} className="w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-gray-50 font-bold outline-none focus:border-blue-500" /></div></div>
                  <div><label className="text-[10px] text-gray-500 font-bold block mb-1 uppercase tracking-wider">จำนวนรับเข้า</label><div className="flex bg-gray-50 border border-gray-300 rounded-lg overflow-hidden"><button onClick={() => updateQty(item.id, -1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 font-bold text-gray-600 transition-colors">-</button><span className="w-10 flex items-center justify-center font-bold text-gray-800 bg-white">{item.qty}</span><button onClick={() => updateQty(item.id, 1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 font-bold text-gray-600 transition-colors">+</button></div></div>
                </div>
                <div className="text-right text-sm font-black text-blue-700 bg-blue-50 p-2 rounded-lg mt-1 border border-blue-100">รวมทุน ฿{((item.receiveCost || 0) * (item.qty || 0)).toLocaleString()}</div><button onClick={() => removeFromCart(item.id)} className="absolute -top-2 -right-2 p-1.5 text-red-500 bg-white border border-red-100 shadow-sm rounded-full hover:bg-red-50 transition-colors"><X size={14} /></button>
              </div>
            ))
          )}
        </div>
        <div className="p-5 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shrink-0 z-20">
          <div className="flex justify-between font-black text-xl border-b-2 border-dashed border-gray-200 pb-3 mb-4"><span>ยอดรวมต้นทุน</span><span className="text-blue-700">฿{(totalCost || 0).toLocaleString()}</span></div>
          <div className="mb-4"><label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">ผู้จำหน่าย / แหล่งที่มา <span className="text-red-500">*</span></label>
            <div className="flex gap-2"><select required value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 outline-none focus:border-blue-500 bg-gray-50"><option value="">-- เลือกซัพพลายเออร์ --</option>{(suppliers || []).map((s) => (<option key={s.id} value={s.name}>{s.name}</option>))}</select><button onClick={() => setShowSupplierModal(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-4 rounded-lg text-sm font-bold whitespace-nowrap transition-colors shadow-sm">จัดการ</button></div>
          </div>
          <div className="mb-4"><label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">วิธีชำระเงินค่าสินค้า</label>
            <div className="grid grid-cols-3 gap-2"><button onClick={() => setPaymentMethod("cash")} className={`py-2.5 rounded-lg font-bold border-2 text-xs transition-all ${paymentMethod === "cash" ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-gray-200 text-gray-500 hover:border-blue-200"}`}>เงินสด</button><button onClick={() => setPaymentMethod("transfer")} className={`py-2.5 rounded-lg font-bold border-2 text-xs transition-all ${paymentMethod === "transfer" ? "bg-purple-50 border-purple-500 text-purple-700 shadow-sm" : "bg-white border-gray-200 text-gray-500 hover:border-purple-200"}`}>เงินโอน</button><button onClick={() => setPaymentMethod("credit")} className={`py-2.5 rounded-lg font-bold border-2 text-xs transition-all ${paymentMethod === "credit" ? "bg-orange-50 border-orange-500 text-orange-700 shadow-sm" : "bg-white border-gray-200 text-gray-500 hover:border-orange-200"}`}>ค้างจ่าย</button></div>
          </div>
          <button onClick={handleConfirm} disabled={cart.length === 0} className={`w-full py-4 mt-2 font-bold rounded-xl shadow-lg text-lg flex items-center justify-center transition-all ${cart.length === 0 ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"}`}><CheckCircle size={20} className="mr-2"/> บันทึกรับเข้าสินค้า</button>
        </div>
      </div>
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-6 flex items-center text-gray-800"><Truck className="mr-2 text-blue-600" /> จัดการผู้จัดจำหน่าย (Supplier)</h3>
            <form onSubmit={handleAddSupplier} className="flex gap-2 mb-6"><input type="text" required placeholder="พิมพ์ชื่อซัพพลายเออร์ใหม่..." value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} className="flex-1 p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 text-sm bg-gray-50" /><button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-lg font-bold shadow-md transition-colors">เพิ่ม</button></form>
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50">
              {[...(suppliers || [])].map((s) => (<div key={s.id} className="flex justify-between items-center p-3.5 hover:bg-blue-50 transition-colors bg-white"><span className="text-sm font-bold text-gray-800">{s.name}</span><button onClick={() => handleDeleteSupplier(s.id)} className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"><Trash2 size={16} /></button></div>))}
              {(!suppliers || (suppliers||[]).length === 0) && (<div className="p-6 text-center text-sm text-gray-400 font-medium">ยังไม่มีรายชื่อผู้จำหน่าย</div>)}
            </div>
            <button onClick={() => setShowSupplierModal(false)} className="w-full mt-6 py-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg font-bold transition-colors">ปิดหน้าต่าง</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------
// 12. รายงานรับเข้าสินค้า (Receipt Report) - เลือกวันที่ได้
// ------------------------------------------
function ReceiptReport({ receipts, currentUser, currentBranch }) {
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState("history");
  const isEmployee = currentUser?.role === "employee";

  const checkFilter = (timestamp) => {
    const d = new Date(timestamp); d.setHours(0,0,0,0);
    const s = new Date(startDate); s.setHours(0,0,0,0);
    const e = new Date(endDate); e.setHours(23,59,59,999);
    return d >= s && d <= e;
  };

  const filteredReceipts = [...(receipts || [])].filter((r) => checkFilter(r.timestamp));
  const totalCost = filteredReceipts.reduce((a, b) => a + b.totalCost, 0);
  const totalItems = filteredReceipts.reduce((a, b) => a + b.totalItems, 0);

  let reportData = [];
  if (viewMode === "daily") {
    const grouped = filteredReceipts.reduce((acc, r) => {
      const dateStr = r.date.split(" ")[0];
      if (!acc[dateStr]) acc[dateStr] = { key: dateStr, bills: 0, items: 0, cost: 0, timestamp: r.timestamp };
      acc[dateStr].bills += 1; acc[dateStr].items += r.totalItems; acc[dateStr].cost += r.totalCost;
      return acc;
    }, {});
    reportData = Object.values(grouped).sort((a, b) => b.timestamp - a.timestamp);
  } else if (viewMode === "supplier") {
    const grouped = filteredReceipts.reduce((acc, r) => {
      const sup = r.supplier || "ไม่ระบุ";
      if (!acc[sup]) acc[sup] = { key: sup, bills: 0, items: 0, cost: 0 };
      acc[sup].bills += 1; acc[sup].items += r.totalItems; acc[sup].cost += r.totalCost;
      return acc;
    }, {});
    reportData = Object.values(grouped).sort((a, b) => b.cost - a.cost);
  } else if (viewMode === "item") {
    const grouped = filteredReceipts.reduce((acc, r) => {
      r.items.forEach((item) => {
        const itemName = item.name || "ไม่ทราบชื่อ";
        if (!acc[itemName]) acc[itemName] = { key: itemName, bills: 0, items: 0, cost: 0 };
        acc[itemName].bills += 1; acc[itemName].items += item.qty; acc[itemName].cost += item.cost * item.qty;
      });
      return acc;
    }, {});
    reportData = Object.values(grouped).sort((a, b) => b.items - a.items);
  }

  const getHeaders = () => {
    if (viewMode === "history") return ["วัน-เวลา", "เลขที่อ้างอิง", "ผู้จำหน่าย", "วิธีชำระ", "จำนวน(ชิ้น)", "ยอดรวม(ทุน)"];
    if (viewMode === "daily") return ["วันที่", "จำนวนบิล", "จำนวน(ชิ้น)", "ยอดรวม(ทุน)"];
    if (viewMode === "supplier") return ["ผู้จำหน่าย", "จำนวนบิล", "จำนวน(ชิ้น)", "ยอดรวม(ทุน)"];
    if (viewMode === "item") return ["รายการสินค้า", "รับเข้า(ครั้ง)", "รวมจำนวน(ชิ้น)", "รวมมูลค่า(ทุน)"];
  };

  const getRows = () => {
    if (viewMode === "history") return filteredReceipts.map((r) => [r.date, r.id, r.supplier, r.paymentMethod === "cash" ? "เงินสด" : r.paymentMethod === "credit" ? "ค้างจ่าย" : "เงินโอน", r.totalItems, r.totalCost]);
    return reportData.map((r) => [r.key, r.bills, r.items, r.cost]);
  };
  const footerHtml = `รวมจำนวนสินค้ารับเข้า: ${(totalItems || 0).toLocaleString()} ชิ้น | ยอดรวมต้นทุน: ฿${(totalCost || 0).toLocaleString()}`;

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden bg-gray-50 w-full">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-4"><h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center"><ClipboardList className="mr-2 text-blue-600"/> รายงานการรับเข้าสินค้า <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg border border-blue-200">สาขา {currentBranch}</span></h2>
        <div className="flex gap-2 w-full sm:w-auto justify-end"><ExportButtons onCSV={() => exportToCSV(getHeaders(), getRows(), "Receipt_Report")} onPDF={() => exportToPDF("รายงานการรับเข้าสินค้า", getHeaders(), getRows(), footerHtml)} /></div>
      </div>
      <div className="flex flex-col lg:flex-row gap-4 mb-6 items-start lg:items-center justify-between">
        <div className="flex flex-wrap bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm w-full lg:w-auto">
          <button onClick={() => setViewMode("history")} className={`flex-1 px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-colors ${viewMode === "history" ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-100"}`}>ประวัติรับเข้า</button>
          <button onClick={() => setViewMode("daily")} className={`flex-1 px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-colors ${viewMode === "daily" ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-100"}`}>สรุปรายวัน</button>
          <button onClick={() => setViewMode("supplier")} className={`flex-1 px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-colors ${viewMode === "supplier" ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-100"}`}>ผู้จำหน่าย</button>
          <button onClick={() => setViewMode("item")} className={`flex-1 px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-colors ${viewMode === "item" ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-100"}`}>แยกตามสินค้า</button>
        </div>
        
        <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm w-full md:w-auto">
             <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-1 border-b border-gray-300 outline-none focus:border-indigo-500 text-xs md:text-sm font-bold text-gray-700 w-full" />
             <span className="text-gray-400 font-bold">-</span>
             <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-1 border-b border-gray-300 outline-none focus:border-indigo-500 text-xs md:text-sm font-bold text-gray-700 w-full" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              {viewMode === "history" ? (<tr><th className="p-4 font-bold text-gray-600">วัน-เวลา</th><th className="p-4 font-bold text-gray-600">เลขที่อ้างอิง</th><th className="p-4 font-bold text-gray-600">ผู้จำหน่าย</th><th className="p-4 text-center font-bold text-gray-600">วิธีชำระ</th><th className="p-4 text-center font-bold text-gray-600">จำนวน(ชิ้น)</th><th className="p-4 text-right font-bold text-gray-600">ยอดรวม(ทุน)</th></tr>) : (<tr><th className="p-4 font-bold text-gray-600">{viewMode === "daily" ? "วันที่" : viewMode === "supplier" ? "ผู้จำหน่าย" : "รายการสินค้า"}</th><th className="p-4 text-center font-bold text-gray-600">{viewMode === "item" ? "รับเข้า(ครั้ง)" : "จำนวนบิล"}</th><th className="p-4 text-center font-bold text-gray-600">รวมจำนวน(ชิ้น)</th><th className="p-4 text-right font-bold text-gray-600">รวมมูลค่า(ทุน)</th></tr>)}
            </thead>
            <tbody className="divide-y divide-gray-50">
              {viewMode === "history" && filteredReceipts.map((r) => (
                  <tr key={r.id} className="hover:bg-blue-50 transition-colors"><td className="p-4 text-gray-500 font-medium">{r.date}</td><td className="p-4 font-bold text-blue-600">{r.id}</td><td className="p-4 font-bold text-gray-800">{r.supplier}</td><td className="p-4 text-center"><span className={`px-3 py-1 rounded-md text-[10px] font-bold border ${r.paymentMethod === "cash" ? "bg-blue-50 text-blue-700 border-blue-200" : r.paymentMethod === "credit" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>{r.paymentMethod === "cash" ? "เงินสด" : r.paymentMethod === "credit" ? "ค้างจ่าย" : "เงินโอน"}</span></td><td className="p-4 text-center font-black text-blue-600 text-base">{(r.totalItems || 0).toLocaleString()}</td><td className="p-4 text-right font-black text-gray-800 text-base">฿{(r.totalCost || 0).toLocaleString()}</td></tr>
                ))}
              {viewMode !== "history" && reportData.map((r, idx) => (
                  <tr key={idx} className="hover:bg-blue-50 transition-colors"><td className="p-4 font-bold text-gray-800">{r.key}</td><td className="p-4 text-center font-medium">{r.bills}</td><td className="p-4 text-center font-black text-blue-600 text-base bg-blue-50/50">{(r.items || 0).toLocaleString()}</td><td className="p-4 text-right font-black text-gray-800 text-base">฿{(r.cost || 0).toLocaleString()}</td></tr>
                ))}
              {((viewMode === "history" && filteredReceipts.length === 0) || (viewMode !== "history" && reportData.length === 0)) && (<tr><td colSpan="6" className="p-12 text-center text-gray-400"><ClipboardList size={48} className="mx-auto opacity-20 mb-3"/>ไม่มีข้อมูลในช่วงเวลานี้</td></tr>)}
            </tbody>
            <tfoot className="bg-slate-800 text-white font-bold"><tr><td colSpan={viewMode === "history" ? "4" : "2"} className="p-4 text-right border-r border-slate-700">สรุปรวมตามตัวกรอง:</td><td className="p-4 text-center text-blue-300 text-xl border-r border-slate-700">{(totalItems || 0).toLocaleString()} ชิ้น</td><td className="p-4 text-right text-blue-300 text-xl">฿{(totalCost || 0).toLocaleString()}</td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------
// 8. การตั้งค่า (Settings) - 🌟 เพิ่มฮาร์ดแวร์ บาร์โค้ด ไวไฟ ปริ้นเตอร์
// ------------------------------------------
function SettingsPanel({ settings, setSettings, currentBranch }) {
  const [localSettings, setLocalSettings] = useState(
    settings || { 
      printerSize: "80mm", 
      autoPrint: false, 
      pointSystem: { qtyPerPoint: 100, bahtPerPoint: 10 },
      hardware: { scannerEnabled: true, scannerDriver: "", wirelessPrinterIp: "", printerDriver: "", qrWalletEnabled: false }
    }
  );

  const handleSave = (e) => {
    e.preventDefault();
    setSettings(localSettings);
    alert(`บันทึกการตั้งค่า สำหรับ สาขาที่ ${currentBranch} เรียบร้อยแล้ว`);
  };

  return (
    <div className="p-4 md:p-6 h-full bg-gray-50 w-full overflow-y-auto">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <Settings className="mr-2 text-slate-600" /> การตั้งค่าระบบ <span className="ml-3 px-2 py-1 bg-slate-200 text-slate-700 text-sm rounded-lg border border-slate-300">สาขา {currentBranch}</span>
      </h2>
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm max-w-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-600"></div>
        <form onSubmit={handleSave}>
          
          {/* 🌟 หมวดหมู่ ฮาร์ดแวร์ */}
          <h3 className="font-bold text-lg mb-5 flex items-center text-gray-800">
            <ScanLine className="mr-2 text-indigo-500" /> อุปกรณ์ฮาร์ดแวร์ (Hardware)
          </h3>
          <div className="mb-5 bg-indigo-50 p-5 rounded-xl border border-indigo-100 space-y-4">
            
            <div className="flex items-center justify-between">
              <label className="font-bold text-indigo-900 cursor-pointer">
                 เปิดใช้ระบบรับค่าจากเครื่องสแกนบาร์โค้ด
              </label>
              <input type="checkbox" checked={localSettings.hardware?.scannerEnabled ?? true} onChange={(e) => setLocalSettings({...localSettings, hardware: {...localSettings.hardware, scannerEnabled: e.target.checked}})} className="w-5 h-5 accent-indigo-600 cursor-pointer" />
            </div>

            <div className="pt-4 border-t border-indigo-200">
              <label className="block text-sm font-bold text-indigo-900 mb-2">ไดรเวอร์ / พอร์ต เครื่องสแกน (ถ้ามี)</label>
              <input type="text" value={localSettings.hardware?.scannerDriver || ""} onChange={(e) => setLocalSettings({...localSettings, hardware: {...localSettings.hardware, scannerDriver: e.target.value}})} placeholder="เช่น COM3 หรือ Driver Name" className="w-full p-3 border border-indigo-200 rounded-lg outline-none focus:border-indigo-500 text-sm" />
            </div>
            
            <div className="pt-4 border-t border-indigo-200">
              <label className="block text-sm font-bold text-indigo-900 mb-2">IP Address เครื่องพิมพ์ไร้สาย (Wi-Fi Printer)</label>
              <input type="text" value={localSettings.hardware?.wirelessPrinterIp || ""} onChange={(e) => setLocalSettings({...localSettings, hardware: {...localSettings.hardware, wirelessPrinterIp: e.target.value}})} placeholder="เช่น 192.168.1.100" className="w-full p-3 border border-indigo-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-sm" />
            </div>

            <div className="pt-4 border-t border-indigo-200">
              <label className="block text-sm font-bold text-indigo-900 mb-2">ไดรเวอร์ เครื่องพิมพ์ (Printer Driver)</label>
              <input type="text" value={localSettings.hardware?.printerDriver || ""} onChange={(e) => setLocalSettings({...localSettings, hardware: {...localSettings.hardware, printerDriver: e.target.value}})} placeholder="ชื่อไดรเวอร์เครื่องปริ้นในระบบ" className="w-full p-3 border border-indigo-200 rounded-lg outline-none focus:border-indigo-500 text-sm" />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-indigo-200">
              <label className="font-bold text-indigo-900 cursor-pointer flex items-center">
                 แสดง QR Code Wallet / โอนเงิน บนสลิป <QrCode size={16} className="ml-2"/>
              </label>
              <input type="checkbox" checked={localSettings.hardware?.qrWalletEnabled ?? false} onChange={(e) => setLocalSettings({...localSettings, hardware: {...localSettings.hardware, qrWalletEnabled: e.target.checked}})} className="w-5 h-5 accent-indigo-600 cursor-pointer" />
            </div>

          </div>

          <h3 className="font-bold text-lg mb-5 flex items-center pt-6 border-t border-gray-100 text-gray-800">
            <Printer className="mr-2 text-blue-500" /> เครื่องพิมพ์ใบเสร็จทั่วไป
          </h3>
          <div className="mb-5 bg-gray-50 p-5 rounded-xl border border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-3">ขนาดกระดาษ</label>
            <select
              value={localSettings.printerSize || "80mm"}
              onChange={(e) => setLocalSettings({ ...localSettings, printerSize: e.target.value })}
              className="w-full md:w-1/2 p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-white text-sm font-bold"
            >
              <option value="58mm">สลิป 58mm</option>
              <option value="80mm">สลิป 80mm</option>
              <option value="A4">A4 ทั่วไป</option>
            </select>
          </div>
          <div className="flex items-center mb-8 bg-blue-50 p-5 rounded-xl border border-blue-100">
            <input
              type="checkbox"
              id="autoPrint"
              checked={localSettings.autoPrint || false}
              onChange={(e) => setLocalSettings({ ...localSettings, autoPrint: e.target.checked })}
              className="w-5 h-5 mr-3 cursor-pointer accent-blue-600"
            />
            <label htmlFor="autoPrint" className="font-bold text-blue-900 cursor-pointer">
              สั่งพิมพ์อัตโนมัติเมื่อกดชำระเงินสำเร็จ
            </label>
          </div>

          <h3 className="font-bold text-lg mb-5 flex items-center pt-6 border-t border-gray-100 text-gray-800">
            <Sparkles className="mr-2 text-orange-500" /> ตั้งค่าระบบแต้มสะสม
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <div className="bg-orange-50 p-5 rounded-xl border border-orange-100">
              <label className="block text-sm font-bold text-orange-900 mb-3">ซื้อสะสมกี่กิโลกรัม (ได้ 1 แต้ม)</label>
              <input
                type="number"
                min="1"
                value={localSettings.pointSystem?.qtyPerPoint || 100}
                onChange={(e) => setLocalSettings({ ...localSettings, pointSystem: { ...localSettings.pointSystem, qtyPerPoint: Number(e.target.value) } })}
                className="w-full p-3 border border-orange-200 rounded-lg font-black text-center outline-none focus:border-orange-500 text-lg text-orange-700"
              />
            </div>
            <div className="bg-orange-50 p-5 rounded-xl border border-orange-100">
              <label className="block text-sm font-bold text-orange-900 mb-3">1 แต้ม เป็นส่วนลด (บาท)</label>
              <input
                type="number"
                min="1"
                value={localSettings.pointSystem?.bahtPerPoint || 10}
                onChange={(e) => setLocalSettings({ ...localSettings, pointSystem: { ...localSettings.pointSystem, bahtPerPoint: Number(e.target.value) } })}
                className="w-full p-3 border border-orange-200 rounded-lg font-black text-center outline-none focus:border-orange-500 text-lg text-orange-700"
              />
            </div>
          </div>

          <button type="submit" className="w-full sm:w-auto bg-slate-800 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-slate-900 transition-colors flex items-center justify-center">
            <Save size={20} className="mr-2"/> บันทึกการตั้งค่า (สาขา {currentBranch})
          </button>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------
// 9. จัดการผู้ใช้งาน (User Management)
// ------------------------------------------
function UserManagement({ currentUser, admins, addAdmin, deleteAdmin, employees, addEmployee, deleteEmployee }) {
  const isOwner = currentUser.role === "owner";
  const [empName, setEmpName] = useState("");
  const [empPin, setEmpPin] = useState("");
  const [empBranch, setEmpBranch] = useState("1"); 
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const handleAddEmployee = (e) => {
    e.preventDefault();
    if (!empPin || empPin.length !== 5) return alert("รหัส PIN ต้องมี 5 หลักพอดี");
    if ((employees || []).find(emp => emp.pin === empPin)) return alert("มีรหัส PIN นี้ในระบบแล้ว");
    addEmployee({ pin: empPin, name: empName, branch: empBranch });
    setEmpName("");
    setEmpPin("");
    alert("เพิ่มพนักงานเรียบร้อยแล้ว");
  };

  const handleAddAdmin = (e) => {
    e.preventDefault();
    if (!adminUsername || !adminPassword) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    if ((admins || []).find(adm => adm.username === adminUsername)) return alert("มี Username นี้ในระบบแล้ว");
    addAdmin({ username: adminUsername, password: adminPassword });
    setAdminUsername("");
    setAdminPassword("");
    alert("เพิ่มแอดมินเรียบร้อยแล้ว");
  };

  return (
    <div className="p-4 md:p-6 h-full bg-gray-50 w-full overflow-y-auto">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6">จัดการผู้ใช้งาน (รวมทุกสาขา)</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>
          <div className="bg-green-50 p-5 border-b border-green-100 font-bold text-green-800 flex items-center text-lg">
            <Users className="mr-2 text-green-600" size={24}/> พนักงาน (ล็อกสาขา)
          </div>
          <div className="p-5">
            <form onSubmit={handleAddEmployee} className="flex flex-col gap-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex flex-col sm:flex-row gap-3">
                 <input required placeholder="ชื่อพนักงาน" value={empName} onChange={(e) => setEmpName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-green-500 text-sm font-bold text-gray-700" />
                 <input required type="tel" placeholder="PIN 5 หลัก" maxLength={5} value={empPin} onChange={(e) => setEmpPin(e.target.value.replace(/\D/g, ""))} className="w-full sm:w-32 p-3 border border-gray-300 rounded-lg text-center font-mono outline-none focus:border-green-500 text-sm font-bold text-gray-700 tracking-widest" />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                 <div className="w-full">
                   <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">ประจำสาขา</label>
                   <select value={empBranch} onChange={(e) => setEmpBranch(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-green-500 text-sm font-bold text-gray-700 bg-white">
                      <option value="1">สาขาที่ 1</option>
                      <option value="2">สาขาที่ 2</option>
                   </select>
                 </div>
                 <button type="submit" className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-md h-min whitespace-nowrap">เพิ่มพนักงาน</button>
              </div>
            </form>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left text-sm bg-white">
                <thead><tr className="text-gray-500 border-b border-gray-100 bg-gray-50"><th className="p-3 font-bold">ชื่อพนักงาน</th><th className="p-3 font-bold text-center">สาขา</th><th className="p-3 font-bold">PIN</th><th className="p-3 text-center font-bold">ลบ</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {[...(employees || [])].map((emp) => (
                    <tr key={emp.pin} className="hover:bg-green-50 transition-colors">
                      <td className="p-3 font-bold text-gray-800">{emp.name}</td>
                      <td className="p-3 text-center"><span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold border border-emerald-200">สาขา {emp.branch || "1"}</span></td>
                      <td className="p-3 font-mono text-gray-500">{emp.pin}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => { if(window.confirm("ยืนยันการลบพนักงาน?")) deleteEmployee(emp.pin); }} className="text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {(!employees || employees.length === 0) && <tr><td colSpan="4" className="py-8 text-center text-gray-400">ยังไม่มีข้อมูลพนักงาน</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
            <div className="bg-blue-50 p-5 border-b border-blue-100 font-bold text-blue-800 flex items-center text-lg">
              <Lock className="mr-2 text-blue-600" size={24}/> แอดมิน (เข้าได้ทุกสาขา)
            </div>
            <div className="p-5">
              <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <input required placeholder="Username" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 text-sm font-bold text-gray-700" />
                <input required type="text" placeholder="Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 text-sm font-bold text-gray-700" />
                <button type="submit" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-md whitespace-nowrap">เพิ่มแอดมิน</button>
              </form>
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left text-sm bg-white">
                  <thead><tr className="text-gray-500 border-b border-gray-100 bg-gray-50"><th className="p-3 font-bold">Username</th><th className="p-3 text-center font-bold">จัดการ</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...(admins || [])].map((adm) => (
                      <tr key={adm.username} className="hover:bg-blue-50 transition-colors">
                        <td className="p-3 font-bold text-blue-700">{adm.username}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => { if(window.confirm("ยืนยันการลบแอดมิน?")) deleteAdmin(adm.username); }} className="text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    {(!admins || admins.length === 0) && <tr><td colSpan="2" className="py-8 text-center text-gray-400">ยังไม่มีข้อมูลแอดมิน</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------
// 10. ระบบจัดการฐานข้อมูล (Database Manager)
// ------------------------------------------
function DatabaseManager({ onSeedData, onFullRestore, allData, addProduct, updateProduct, addCustomer, updateCustomer, currentBranch }) {
  const jsonFileRef = useRef(null);
  const productCsvRef = useRef(null);
  const customerCsvRef = useRef(null);

  // --- ดาวน์โหลด Full Backup JSON ---
  const handleDownloadJSON = () => {
    const backupData = { timestamp: new Date().toISOString(), ...allData };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; 
    a.download = `sUriYaN_Backup_Branch${currentBranch}_${new Date().toISOString().split("T")[0]}.json`;
    a.click(); 
    URL.revokeObjectURL(url);
  };

  // --- อัปโหลด Full Backup JSON ---
  const handleRestoreJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        onFullRestore(parsed);
      } catch (err) {
        alert("ไฟล์ JSON ไม่ถูกต้อง หรือเสียหาย");
      }
      e.target.value = null;
    };
    reader.readAsText(file);
  };

  // --- ตัวช่วยอ่านไฟล์ CSV ---
  const parseCSVRow = (str) => {
    const result = []; let cur = ""; let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '"') { if (inQuotes && str[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; } }
      else if (char === "," && !inQuotes) { result.push(cur); cur = ""; } else { cur += char; }
    }
    result.push(cur); return result;
  };

  // --- ฟังก์ชันนำเข้าสินค้า (CSV) ---
  const handleImportProducts = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
        if (lines.length < 2) return alert("ไฟล์ไม่มีข้อมูล หรือมีแค่หัวตาราง");

        let added = 0; let updated = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVRow(lines[i]).map(c => c.trim());
          if (cols.length >= 6) {
            const barcode = cols[0]; const name = cols[1]; const category = cols[2] || "ทั่วไป";
            const cost = parseFloat(cols[3].replace(/,/g, "")) || 0; const price = parseFloat(cols[4].replace(/,/g, "")) || 0; const stock = parseInt(cols[5].replace(/,/g, ""), 10) || 0;
            if (barcode && name) {
              const existingP = (allData.products || []).find((p) => p.barcode === barcode);
              const newData = { barcode, name, category, cost, price, stock, lastChecked: null };
              if (existingP) { updateProduct({ ...existingP, ...newData }); updated++; } 
              else { addProduct({ id: Date.now() + i, ...newData }); added++; }
            }
          }
        }
        alert(`นำเข้าคลังสินค้าสาขาที่ ${currentBranch} สำเร็จ!\nเพิ่มใหม่: ${added} รายการ\nอัปเดตของเดิม: ${updated} รายการ`);
      } catch (err) { alert("ไฟล์ Excel(CSV) ไม่ถูกต้อง กรุณาตรวจสอบรูปแบบไฟล์ครับ"); }
      e.target.value = null;
    };
    reader.readAsText(file, "utf-8");
  };

  // --- ฟังก์ชันนำเข้าลูกค้า (CSV) ---
  const handleImportCustomers = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
        if (lines.length < 2) return alert("ไฟล์ไม่มีข้อมูล หรือมีแค่หัวตาราง");

        let added = 0; let updated = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVRow(lines[i]).map(c => c.trim());
          if (cols.length >= 4) {
            const phone = cols[0]; const name = cols[1]; const type = cols[2] || "Member";
            const totalSpent = parseFloat(cols[3].replace(/,/g, "")) || 0;
            if (phone && name) {
              const existingC = (allData.customers || []).find((c) => c.phone === phone);
              if (existingC) { updateCustomer({ ...existingC, name, type, totalSpent }); updated++; } 
              else { addCustomer({ id: Date.now() + i, phone, name, type, totalSpent, points: 0, accumulatedQty: 0, lastVisit: Date.now() }); added++; }
            }
          }
        }
        alert(`นำเข้าลูกค้าสำเร็จ!\nเพิ่มใหม่: ${added} รายการ\nอัปเดตของเดิม: ${updated} รายการ`);
      } catch (err) { alert("ไฟล์ Excel(CSV) ไม่ถูกต้อง กรุณาตรวจสอบรูปแบบไฟล์ครับ"); }
      e.target.value = null;
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <div className="p-4 md:p-6 h-full overflow-y-auto bg-gray-50 w-full">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 flex items-center"><Database className="mr-2 text-blue-600"/> จัดการและสำรองฐานข้อมูล <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg border border-blue-200">สาขา {currentBranch}</span></h2>
      
      {/* 1. Full Backup / Restore (JSON) */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-800"></div>
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><Save className="mr-2"/> 1. สำรองและกู้คืนระบบทั้งหมด</h3>
        <p className="text-sm text-gray-500 mb-5 leading-relaxed">สำรองข้อมูลทั้งหมดที่มองเห็นของสาขานี้ และข้อมูลลูกค้าส่วนกลาง เพื่อเก็บเป็นไฟล์ <b>.json</b> และสามารถใช้ไฟล์นั้นมากู้คืนระบบได้</p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={handleDownloadJSON} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-4 px-4 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md">
            <Download size={20} className="mr-2"/> ดาวน์โหลด Backup (JSON)
          </button>

          <input type="file" accept=".json" className="hidden" ref={jsonFileRef} onChange={handleRestoreJSON} />
          <button onClick={() => jsonFileRef.current.click()} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-4 px-4 rounded-xl font-bold flex items-center justify-center transition-colors shadow-sm">
            <Upload size={20} className="mr-2"/> กู้คืนระบบ (JSON Restore)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 2. Import CSV */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
          <h3 className="font-bold text-lg text-orange-700 mb-4 flex items-center"><Upload className="mr-2"/> 2. นำเข้าข้อมูลด่วนจาก Excel (CSV)</h3>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">อัปโหลดตารางสินค้า (แยกเข้าสาขานี้) หรือ รายชื่อลูกค้า (เข้าส่วนกลาง) ผ่านไฟล์ CSV</p>
          
          <div className="space-y-3">
            <input type="file" accept=".csv" className="hidden" ref={productCsvRef} onChange={handleImportProducts} />
            <button onClick={() => productCsvRef.current.click()} className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-4 px-4 rounded-xl font-bold flex items-center justify-between transition-colors shadow-sm">
              <span className="flex items-center"><Package size={20} className="mr-3 text-orange-500"/> นำเข้าสินค้า (สาขา {currentBranch})</span> <Upload size={20}/>
            </button>

            <input type="file" accept=".csv" className="hidden" ref={customerCsvRef} onChange={handleImportCustomers} />
            <button onClick={() => customerCsvRef.current.click()} className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-4 px-4 rounded-xl font-bold flex items-center justify-between transition-colors shadow-sm">
              <span className="flex items-center"><Users size={20} className="mr-3 text-orange-500"/> นำเข้าสมาชิกลูกค้า (ส่วนกลาง)</span> <Upload size={20}/>
            </button>
          </div>
        </div>

        {/* 3. Export CSV/PDF แยกหมวดหมู่ */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
          <h3 className="font-bold text-lg text-emerald-700 mb-4 flex items-center"><Download className="mr-2"/> 3. ส่งออกรายงานแยกหมวดหมู่</h3>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">ดาวน์โหลดข้อมูลแยกตามหมวดหมู่เพื่อนำไปปริ้นท์ หรือนำไปทำรายงานบัญชีต่อบน Excel</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3.5 border border-gray-100 rounded-xl bg-gray-50">
              <span className="font-bold text-sm text-gray-700 flex items-center"><Package size={18} className="mr-2 text-emerald-500"/> คลังสินค้า</span>
              <ExportButtons 
                onCSV={() => exportToCSV(["รหัส", "ชื่อสินค้า", "หมวดหมู่", "ราคาทุน", "ราคาขาย", "คงเหลือ"], (allData.products || []).map((p) => [p.barcode, p.name, p.category, p.cost, p.price, p.stock]), `Products_Branch${currentBranch}`)} 
                onPDF={() => exportToPDF(`รายงานคลังสินค้า (สาขา ${currentBranch})`, ["รหัส", "ชื่อสินค้า", "หมวดหมู่", "ราคาทุน", "ราคาขาย", "คงเหลือ"], (allData.products || []).map((p) => [p.barcode, p.name, p.category, p.cost, p.price, p.stock]))} 
              />
            </div>
            <div className="flex justify-between items-center p-3.5 border border-gray-100 rounded-xl bg-gray-50">
              <span className="font-bold text-sm text-gray-700 flex items-center"><Users size={18} className="mr-2 text-emerald-500"/> สมาชิกลูกค้า</span>
              <ExportButtons 
                onCSV={() => exportToCSV(["เบอร์โทร", "ชื่อลูกค้า", "ประเภท", "ยอดซื้อสะสม (บาท)"], (allData.customers || []).map((c) => [c.phone, c.name, c.type, c.totalSpent]), "Customers_All")} 
                onPDF={() => exportToPDF("รายชื่อลูกค้าและสมาชิก (รวมทุกสาขา)", ["เบอร์โทร", "ชื่อลูกค้า", "ประเภท", "ยอดซื้อสะสม (บาท)"], (allData.customers || []).map((c) => [c.phone, c.name, c.type, c.totalSpent]))} 
              />
            </div>
            <div className="flex justify-between items-center p-3.5 border border-gray-100 rounded-xl bg-gray-50">
              <span className="font-bold text-sm text-gray-700 flex items-center"><History size={18} className="mr-2 text-emerald-500"/> ประวัติขาย</span>
              <ExportButtons 
                onCSV={() => exportToCSV(["วัน-เวลา", "เลขที่บิล", "ลูกค้า", "วิธีชำระ", "ยอดสุทธิ(บาท)"], (allData.salesHistory || []).map((s) => [s.date, s.id, s.customer, s.paymentMethod, s.total]), `Sales_Branch${currentBranch}`)} 
                onPDF={() => exportToPDF(`ประวัติการขาย (สาขา ${currentBranch})`, ["วัน-เวลา", "เลขที่บิล", "ลูกค้า", "วิธีชำระ", "ยอดสุทธิ(บาท)"], (allData.salesHistory || []).map((s) => [s.date, s.id, s.customer, s.paymentMethod, s.total]))} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Seed Data (สำหรับร้านใหม่) */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 rounded-2xl shadow-md text-white relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-20"></div>
        <h3 className="font-bold text-xl mb-3 flex items-center relative z-10"><Sparkles className="mr-2 text-blue-200"/> 4. โหลดข้อมูลตัวอย่าง (สำหรับสาขาใหม่)</h3>
        <p className="text-sm text-blue-100 mb-6 relative z-10 leading-relaxed max-w-3xl">กดปุ่มนี้เพื่อดึงข้อมูลสินค้า (ข้าวสารต่างๆ) เข้าสู่ระบบ <b>สาขาที่ {currentBranch}</b> อัตโนมัติ (เหมาะสำหรับทดสอบระบบ หรือตั้งร้านครั้งแรก)</p>
        <button onClick={onSeedData} className="bg-white text-blue-800 px-8 py-3.5 rounded-xl font-black hover:bg-blue-50 transition-colors shadow-lg w-full sm:w-auto flex items-center justify-center relative z-10">
          <Database size={20} className="mr-2"/> โหลดข้อมูลสินค้าตัวอย่าง เข้าสาขา {currentBranch}
        </button>
      </div>
    </div>
  );
}