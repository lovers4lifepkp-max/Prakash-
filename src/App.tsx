import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  FileText, 
  Plus, 
  LogIn, 
  LogOut, 
  CheckCircle2, 
  XCircle,
  Phone,
  BarChart3,
  Search,
  ArrowRight,
  Camera,
  Send,
  MessageSquare,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { Worker, AttendanceRecord, OperationType, WorkReport } from './types';
import { handleFirestoreError } from './lib/firestoreUtils';

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon: Icon, type = 'button' }: any) => {
  const base = "bento-button flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-50 disabled:pointer-events-none";
  const variants: any = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "bg-white text-slate-900",
    danger: "bg-red-100 text-red-600 border-red-600",
    ghost: "border-transparent bg-transparent shadow-none hover:bg-slate-100",
  };
  
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={16} strokeWidth={3} />}
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }: any) => (
  <div className={`bento-card overflow-hidden ${className}`}>
    {children}
  </div>
);

const ReportModal = ({ attendance, onClose, onComplete }: { attendance: AttendanceRecord, onClose: () => void, onComplete: () => void }) => {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selected = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content) return;
    setIsUploading(true);

    try {
      await addDoc(collection(db, 'reports'), {
        attendanceId: attendance.id,
        workerId: attendance.workerId,
        content,
        imageUrl: previewUrl || '',
        createdAt: serverTimestamp()
      });

      if (attendance.id) {
        await updateDoc(doc(db, 'attendance', attendance.id), {
          hasReport: true
        });
      }

      onComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reports');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg bg-white border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] p-6"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black uppercase tracking-tighter">Day Report</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors">
            <XCircle size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Worker Activity Details</label>
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="bento-input min-h-[150px] resize-none"
              placeholder="SUMMARY OF WORK COMPLETED, ISSUES ENCOUNTERED..."
              required
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual Evidence (Optional)</label>
            <div className="relative">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="report-image"
              />
              <label 
                htmlFor="report-image"
                className="flex items-center justify-center gap-3 w-full py-4 border-2 border-dashed border-slate-300 hover:border-indigo-600 hover:bg-slate-50 cursor-pointer transition-all bg-white"
              >
                {previewUrl ? (
                  <img src={previewUrl} className="h-20 w-auto border-2 border-slate-900" alt="Preview" />
                ) : (
                  <>
                    <Camera size={20} />
                    <span className="text-xs font-black uppercase tracking-widest">Attach Photo</span>
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="pt-4 flex gap-4">
             <Button 
                type="submit" 
                className="flex-1 bg-indigo-600 text-white" 
                disabled={isUploading || !content}
                icon={isUploading ? Clock : Send}
             >
                {isUploading ? 'TRANSMITTING...' : 'COMMIT REPORT'}
             </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const NavLink = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-3 transition-all ${active ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
  >
    <Icon size={24} strokeWidth={active ? 3 : 2} />
    <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
    {active && <motion.div layoutId="nav-pill" className="w-6 h-1 bg-indigo-600 mt-1" />}
  </button>
);

// --- App Logic ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'workers' | 'reports'>('dashboard');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to workers
    const workersUnsub = onSnapshot(collection(db, 'workers'), (snapshot) => {
      setWorkers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Worker)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'workers'));

    // Listen to today's attendance
    const today = new Date().toISOString().split('T')[0];
    const attendanceQuery = query(collection(db, 'attendance'), where('date', '==', today));
    const attendanceUnsub = onSnapshot(attendanceQuery, (snapshot) => {
      setAttendance(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'attendance'));

    return () => {
      workersUnsub();
      attendanceUnsub();
    };
  }, [user]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    }
  };

  const logout = () => auth.signOut();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfbfb]">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-indigo-600 border-4 border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center text-white mb-8">
          <Clock size={40} strokeWidth={3} />
        </div>
        <h1 className="text-5xl font-black uppercase tracking-tighter mb-4 text-slate-900">ShiftMaster</h1>
        <p className="text-slate-500 mb-10 max-w-sm font-medium">
          PRO-GRADE ATTENDANCE & OVERTIME TRACKING SYSTEM. 12H LIMIT ENABLED.
        </p>
        <Button onClick={login} icon={LogIn} className="w-full max-w-xs text-sm">
          Authorize Google Access
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row p-0 md:p-6 md:gap-6">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-2 border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] p-6">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-12 h-12 bg-indigo-600 border-2 border-slate-900 flex items-center justify-center text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            <span className="font-black text-2xl">S</span>
          </div>
          <span className="font-black text-2xl uppercase tracking-tighter">ShiftMaster</span>
        </div>

        <nav className="flex-1 space-y-4">
          <SidebarLink active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={Clock} label="LIVE FEED" />
          <SidebarLink active={view === 'workers'} onClick={() => setView('workers')} icon={Users} label="PERSONNEL" />
          <SidebarLink active={view === 'reports'} onClick={() => setView('reports')} icon={FileText} label="DATA LOGS" />
        </nav>

        <div className="mt-auto pt-6 border-t-2 border-slate-900">
          <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 border-2 border-slate-900">
            <img src={user.photoURL || ''} className="w-10 h-10 border-2 border-slate-900" alt="" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase truncate leading-none mb-1">{user.displayName}</p>
              <p className="text-[10px] font-mono text-slate-500 truncate uppercase">{user.email}</p>
            </div>
          </div>
          <Button variant="danger" onClick={logout} icon={LogOut} className="w-full">
            Terminal Exit
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen md:h-auto overflow-hidden md:overflow-visible">
        <header className="md:hidden flex items-center justify-between p-4 bg-white border-b-2 border-slate-900 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="text-indigo-600" size={28} strokeWidth={3} />
            <span className="font-black uppercase tracking-tighter text-lg">ShiftMaster</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-1.5 border-2 border-slate-900 bg-white font-mono font-bold text-xs">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto md:overflow-visible p-4 md:p-0">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && <div key="dashboard"><Dashboard workers={workers} attendance={attendance} /></div>}
            {view === 'workers' && <div key="workers"><WorkerManagement workers={workers} /></div>}
            {view === 'reports' && <div key="reports"><Reports workers={workers} /></div>}
          </AnimatePresence>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex justify-around bg-white border-t-2 border-slate-900 pb-safe shadow-[0_-4px_0_0_rgba(15,23,42,0.05)]">
          <NavLink active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={Clock} label="Live" />
          <NavLink active={view === 'workers'} onClick={() => setView('workers')} icon={Users} label="Team" />
          <NavLink active={view === 'reports'} onClick={() => setView('reports')} icon={FileText} label="Logs" />
        </nav>
      </main>
    </div>
  );
}

function SidebarLink({ active, onClick, icon: Icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-4 w-full px-5 py-4 transition-all border-2 ${
        active 
          ? 'bg-indigo-600 text-white border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] translate-x-1 translate-y-[-2px]' 
          : 'text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon size={20} strokeWidth={active ? 3 : 2} />
      <span className="font-black uppercase tracking-widest text-xs">{label}</span>
    </button>
  );
}

// --- Views ---

function Dashboard({ workers, attendance }: { workers: Worker[], attendance: AttendanceRecord[] }) {
  const [search, setSearch] = useState('');
  const [activeReport, setActiveReport] = useState<AttendanceRecord | null>(null);
  
  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: workers.length,
    present: attendance.length,
    pending: workers.length - attendance.length
  };

  const handleCheckIn = async (worker: Worker) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await addDoc(collection(db, 'attendance'), {
        workerId: worker.id,
        workerName: worker.name,
        date: today,
        inTime: serverTimestamp(),
        status: 'present',
        hasReport: false
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  const handleCheckOut = async (record: AttendanceRecord) => {
    if (!record.id) return;
    try {
      const now = new Date();
      const inTime = record.inTime.toDate();
      const diffMs = now.getTime() - inTime.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      const workHoursLimit = 12 * 60; // 12 hours in minutes
      const overtime = Math.max(0, diffMins - workHoursLimit);

      await updateDoc(doc(db, 'attendance', record.id), {
        outTime: serverTimestamp(),
        totalMinutes: diffMins,
        overtimeMinutes: overtime
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-12 gap-6"
    >
      <AnimatePresence>
        {activeReport && (
          <ReportModal 
            attendance={activeReport} 
            onClose={() => setActiveReport(null)} 
            onComplete={() => setActiveReport(null)} 
          />
        )}
      </AnimatePresence>
      {/* Stats Bento Cards */}
      <div className="col-span-12 md:col-span-4 grid grid-cols-2 gap-4 h-fit">
        <Card className="col-span-2 p-6 bg-indigo-600 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Personnel On-Site</p>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-black">{stats.present}</span>
            <span className="text-xl font-bold opacity-40">/ {stats.total}</span>
          </div>
          <div className="mt-6 h-3 bg-indigo-800 border-2 border-slate-900 rounded-none overflow-hidden">
             <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(stats.present/stats.total)*100}%` }}
                className="h-full bg-white" 
             />
          </div>
        </Card>
        
        <Card className="p-4 bg-emerald-100 flex flex-col justify-center border-emerald-900 shadow-[4px_4px_0px_0px_#064e3b]">
          <p className="text-[9px] font-black uppercase tracking-tighter mb-1 text-emerald-900">Active</p>
          <p className="text-2xl font-black text-emerald-900 font-mono tracking-tighter">{stats.present}</p>
        </Card>

        <Card className="p-4 bg-amber-100 flex flex-col justify-center border-amber-900 shadow-[4px_4px_0px_0px_#78350f]">
          <p className="text-[9px] font-black uppercase tracking-tighter mb-1 text-amber-900">Pending</p>
          <p className="text-2xl font-black text-amber-900 font-mono tracking-tighter">{stats.pending}</p>
        </Card>

        <Card className="col-span-2 p-4 bg-slate-900 text-white flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 border border-white flex items-center justify-center">
                 <Clock size={16} strokeWidth={3} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Working Shift</p>
                <p className="text-xs font-bold">12H FIXED LIMIT</p>
              </div>
           </div>
           <div className="text-xs font-mono font-bold text-indigo-300">
              {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short' }).toUpperCase()}
           </div>
        </Card>
      </div>

      {/* Attendance Feed - Spans 8 cols */}
      <div className="col-span-12 md:col-span-8 flex flex-col gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter">Attendance Feed</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Shift Activity</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} strokeWidth={3} />
              <input 
                type="text" 
                placeholder="BY NAME..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border-2 border-slate-900 text-xs font-black uppercase tracking-widest focus:outline-none focus:bg-slate-50 w-48"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredWorkers.map(worker => {
              const record = attendance.find(a => a.workerId === worker.id);
              const isCheckedIn = !!record;
              const isCheckedOut = !!record?.outTime;

              return (
                <div key={worker.id} className="group p-4 border-2 border-slate-900 bg-white hover:bg-slate-50 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 border-2 border-slate-900 flex items-center justify-center text-lg font-black ${
                        isCheckedIn ? 'bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {worker.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-black uppercase tracking-tighter text-base leading-none mb-1">{worker.name}</h3>
                        <div className="flex gap-2">
                           <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-slate-100 border border-slate-900">{worker.role}</span>
                           {isCheckedIn && !isCheckedOut && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-900">Active</span>
                           )}
                           {record?.hasReport && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-900 flex items-center gap-1">
                                <FileText size={10} /> Report OK
                              </span>
                           )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {!isCheckedIn ? (
                        <Button onClick={() => handleCheckIn(worker)} icon={LogIn} variant="secondary" className="hover:bg-emerald-50">
                          Clock In
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          {!record.hasReport && (
                            <Button onClick={() => setActiveReport(record)} icon={MessageSquare} variant="secondary" className="bg-amber-50 border-amber-900 text-amber-900">
                              Report
                            </Button>
                          )}
                          {!isCheckedOut ? (
                            <Button onClick={() => handleCheckOut(record)} icon={LogOut} variant="danger">
                              Out
                            </Button>
                          ) : (
                            <div className="bg-slate-900 text-white px-4 py-2 font-black uppercase tracking-widest text-[10px]">
                              Complete
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isCheckedIn && (
                    <div className="mt-4 pt-4 border-t-2 border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50 p-2 border border-slate-200">
                        <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Signed In</p>
                        <p className="text-xs font-mono font-black">{record.inTime?.toDate ? record.inTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}</p>
                      </div>
                      {isCheckedOut && (
                        <>
                          <div className="bg-slate-50 p-2 border border-slate-200">
                            <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Signed Out</p>
                            <p className="text-xs font-mono font-black">{record.outTime?.toDate ? record.outTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}</p>
                          </div>
                          <div className="bg-slate-50 p-2 border border-slate-200">
                            <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Work Load</p>
                            <p className="text-xs font-mono font-black">{Math.floor(record.totalMinutes! / 60)}H {record.totalMinutes! % 60}M</p>
                          </div>
                          <div className={`p-2 border ${record.overtimeMinutes ? 'bg-amber-50 border-amber-900' : 'bg-slate-50 border-slate-200'}`}>
                            <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Overtime</p>
                            <p className={`text-xs font-mono font-black ${record.overtimeMinutes ? 'text-amber-900' : ''}`}>
                              {record.overtimeMinutes ? `${Math.floor(record.overtimeMinutes / 60)}H ${record.overtimeMinutes % 60}M` : '00:00'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function WorkerManagement({ workers }: { workers: Worker[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');

  const addWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !role) return;

    try {
      await addDoc(collection(db, 'workers'), {
        name,
        phone,
        role,
        createdAt: serverTimestamp()
      });
      setName('');
      setPhone('');
      setRole('');
      setShowAdd(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'workers');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="grid grid-cols-1 md:grid-cols-12 gap-6"
    >
      <div className="col-span-12 md:col-span-4 self-start">
        <Card className="p-6 bg-slate-900 text-white">
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Team Core</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Database Management</p>
          <Button onClick={() => setShowAdd(!showAdd)} icon={showAdd ? XCircle : Plus} className="w-full">
            {showAdd ? 'Abort Action' : 'Enroll Personnel'}
          </Button>
        </Card>

        {showAdd && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-6"
          >
            <Card className="p-6 bg-amber-300">
              <h3 className="text-xs font-black uppercase mb-4 tracking-widest">Entry Credentials</h3>
              <form onSubmit={addWorker} className="space-y-4">
                <input 
                  type="text" 
                  value={name}
                  required
                  onChange={(e) => setName(e.target.value)}
                  className="bento-input"
                  placeholder="FULL NAME"
                />
                <input 
                  type="tel" 
                  value={phone}
                  required
                  onChange={(e) => setPhone(e.target.value)}
                  className="bento-input"
                  placeholder="CONTACT #"
                />
                <input 
                  type="text" 
                  value={role}
                  required
                  onChange={(e) => setRole(e.target.value)}
                  className="bento-input"
                  placeholder="ASSIGNED ROLE"
                />
                <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800">Commit Record</Button>
              </form>
            </Card>
          </motion.div>
        )}
      </div>

      <div className="col-span-12 md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {workers.map(worker => (
          <Card key={worker.id} className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-slate-100 border-2 border-slate-900 flex items-center justify-center font-black text-xl text-slate-400">
                {worker.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black uppercase tracking-tight truncate leading-none mb-1">{worker.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{worker.role}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t-2 border-slate-50 mt-auto">
              <div className="flex items-center gap-2 text-indigo-600 font-mono font-bold text-xs bg-indigo-50 px-3 py-1.5 border border-indigo-600">
                <Phone size={14} strokeWidth={3} />
                {worker.phone}
              </div>
              <div className="text-[9px] font-black uppercase text-slate-300">Active Status</div>
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

function Reports({ workers }: { workers: Worker[] }) {
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewingReport, setViewingReport] = useState<WorkReport | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'attendance'), where('date', '==', selectedDate));
    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'attendance'));
    return unsub;
  }, [selectedDate]);

  useEffect(() => {
    const q = query(collection(db, 'reports'));
    const unsub = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WorkReport)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'reports'));
    return unsub;
  }, []);

  const shareReport = () => {
    const day = new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    let text = `*WorkFlow Attendance Report - ${day}*\n\n`;
    
    logs.forEach(log => {
      const inT = log.inTime?.toDate ? log.inTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const outT = (log.outTime?.toDate) ? log.outTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending';
      const ot = log.overtimeMinutes ? `${Math.floor(log.overtimeMinutes / 60)}h ${log.overtimeMinutes % 60}m` : '0';
      
      text += `👤 ${log.workerName}\n🕒 In: ${inT} | Out: ${outT}\n⌛ OT: ${ot}\n------------------\n`;
    });

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 md:grid-cols-12 gap-6"
    >
      <AnimatePresence>
        {viewingReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="w-full max-w-lg bg-white border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] p-6"
             >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black uppercase">Report Detail</h3>
                  <button onClick={() => setViewingReport(null)}><XCircle size={24}/></button>
                </div>
                <div className="space-y-6">
                   {viewingReport.imageUrl && (
                      <div className="border-4 border-slate-900">
                         <img src={viewingReport.imageUrl} className="w-full h-48 object-cover" alt="Report" />
                      </div>
                   )}
                   <p className="bg-slate-50 p-4 border-2 border-slate-900 font-medium whitespace-pre-wrap">{viewingReport.content}</p>
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                      <Clock size={12}/> {viewingReport.createdAt?.toDate().toLocaleString()}
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="col-span-12 md:col-span-4 h-fit md:sticky md:top-0">
        <Card className="p-6 bg-amber-300">
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Data Center</h2>
          <p className="text-[10px] font-bold text-amber-900 uppercase tracking-widest mb-8">Shift Logs & Reports</p>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest">Select Target Date</label>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bento-input font-bold"
              />
            </div>

            <Card className="p-4 bg-white border-2 border-slate-900 shadow-none">
               <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase">Report Config</span>
                  <span className="text-[8px] font-bold px-1 py-0.5 bg-emerald-100 border border-emerald-900">READY</span>
               </div>
               <p className="text-xs font-medium text-slate-500 mb-6">
                 GENERATE FULL SHIFT REPORT FOR {new Date(selectedDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }).toUpperCase()}
               </p>
               <Button onClick={shareReport} icon={BarChart3} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                Push Report to SMS
               </Button>
            </Card>
          </div>
        </Card>
      </div>

      <div className="col-span-12 md:col-span-8">
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b-2 border-slate-900 bg-slate-50 flex items-center justify-between">
             <h3 className="text-sm font-black uppercase lg:tracking-widest italic">Archived Records Feed</h3>
             <span className="text-[10px] font-black uppercase bg-white border border-slate-900 px-2 py-1">{logs.length} RECORDS</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b-2 border-slate-900">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Worker</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Details</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Hrs</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">OT</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Docs</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                      [ NO DATA RECORDED FOR THIS SECTOR ]
                    </td>
                  </tr>
                ) : (
                  logs.map(log => {
                    const report = reports.find(r => r.attendanceId === log.id);
                    return (
                    <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-5 font-black uppercase text-xs truncate max-w-[150px]">{log.workerName}</td>
                      <td className="px-6 py-5">
                         <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-mono text-slate-400">IN: {log.inTime?.toDate ? log.inTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}</span>
                            <span className="text-[9px] font-mono text-slate-400">OUT: {log.outTime?.toDate ? log.outTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'ACTIVE'}</span>
                         </div>
                      </td>
                      <td className="px-6 py-5 font-mono text-xs font-bold">
                        {log.totalMinutes ? `${Math.floor(log.totalMinutes / 60)}H` : '--'}
                      </td>
                      <td className="px-6 py-5">
                        {log.overtimeMinutes ? (
                           <span className="bg-red-100 text-red-600 border border-red-600 px-2 py-0.5 font-black text-[10px] uppercase">
                             {Math.floor(log.overtimeMinutes / 60)}H {log.overtimeMinutes % 60}M
                           </span>
                        ) : (
                           <span className="text-slate-200 font-bold text-[10px]">0H</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        {report ? (
                           <button 
                             onClick={() => setViewingReport(report)}
                             className="p-2 border-2 border-slate-900 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-[2px_2px_0px_0px_#1e1b4b]"
                           >
                             <FileText size={16} strokeWidth={3} />
                           </button>
                        ) : (
                           <span className="text-slate-200 font-black italic text-[9px]">EMPTY</span>
                        )}
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
