import { useState, useEffect, useRef } from "react";
import { collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, getSavedUsername, saveUsername, clearUsername } from "./firebase";

// ─── Constants ────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: "work",         label: "Work",                             color: "#3B82F6", icon: "💼" },
  { id: "exercise",     label: "Exercise",                         color: "#10B981", icon: "🏃" },
  { id: "reading",      label: "Reading Book",                     color: "#8B5CF6", icon: "📚" },
  { id: "social_media", label: "Social Media",                     color: "#F59E0B", icon: "📱" },
  { id: "restaurant",   label: "Restaurant",                       color: "#EF4444", icon: "🍽️" },
  { id: "movie",        label: "Movie",                            color: "#EC4899", icon: "🎬" },
  { id: "park",         label: "Park",                             color: "#84CC16", icon: "🌳" },
  { id: "celebration",  label: "Marriage/Engagement/Housewarming", color: "#F97316", icon: "🎉" },
  { id: "trip",         label: "Trip",                             color: "#06B6D4", icon: "✈️" },
  { id: "friends",      label: "Friends Gathering",                color: "#A78BFA", icon: "👥" },
  { id: "sleep",        label: "Sleep",                            color: "#6366F1", icon: "😴" },
  { id: "others",       label: "Others",                           color: "#6B7280", icon: "📌" },
];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Smart icon suggestions based on keywords
const guessIcon = (label) => {
  const l = label.toLowerCase();
  if (l.includes("sleep") || l.includes("rest") || l.includes("nap")) return "😴";
  if (l.includes("eat") || l.includes("food") || l.includes("lunch") || l.includes("dinner") || l.includes("breakfast")) return "🍽️";
  if (l.includes("gym") || l.includes("run") || l.includes("walk") || l.includes("sport") || l.includes("yoga") || l.includes("exercise") || l.includes("workout")) return "🏃";
  if (l.includes("read") || l.includes("book")) return "📚";
  if (l.includes("work") || l.includes("office") || l.includes("meeting") || l.includes("job")) return "💼";
  if (l.includes("movie") || l.includes("film") || l.includes("cinema") || l.includes("watch")) return "🎬";
  if (l.includes("trip") || l.includes("travel") || l.includes("flight") || l.includes("vacation")) return "✈️";
  if (l.includes("friend") || l.includes("party") || l.includes("gather")) return "👥";
  if (l.includes("park") || l.includes("garden") || l.includes("nature") || l.includes("outdoor")) return "🌳";
  if (l.includes("social") || l.includes("instagram") || l.includes("twitter") || l.includes("facebook")) return "📱";
  if (l.includes("wedding") || l.includes("marriage") || l.includes("engagement") || l.includes("housewarming") || l.includes("celebration")) return "🎉";
  if (l.includes("shop") || l.includes("mall") || l.includes("buy")) return "🛍️";
  if (l.includes("music") || l.includes("concert") || l.includes("song")) return "🎵";
  if (l.includes("doctor") || l.includes("hospital") || l.includes("health") || l.includes("medical")) return "🏥";
  if (l.includes("study") || l.includes("school") || l.includes("college") || l.includes("learn")) return "🎓";
  if (l.includes("game") || l.includes("play") || l.includes("cricket") || l.includes("football")) return "🎮";
  if (l.includes("cook") || l.includes("kitchen") || l.includes("bake")) return "👨‍🍳";
  if (l.includes("drive") || l.includes("car") || l.includes("bike") || l.includes("commute")) return "🚗";
  if (l.includes("family") || l.includes("home") || l.includes("house")) return "🏠";
  return "📌";
};

const toDatetimeLocal = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Format time in 12hr format
const fmt12 = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

const fmt12Date = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
};

const formatDuration = (ms) => {
  if (!ms || ms <= 0) return "";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// Export to CSV/Excel
const exportToExcel = (events, categories) => {
  const getCat = (id) => categories.find(c => c.id === id) || { label: id };
  const headers = ["Event Name","Category","Location","Start Time","End Time","Duration","Comments"];
  const rows = events
    .sort((a,b) => a.startDate > b.startDate ? 1 : -1)
    .map(ev => {
      const dur = ev.startDate && ev.endDate ? new Date(ev.endDate) - new Date(ev.startDate) : 0;
      return [
        ev.name || "",
        getCat(ev.category).label,
        ev.location || "",
        ev.startDate ? new Date(ev.startDate).toLocaleString() : "",
        ev.endDate   ? new Date(ev.endDate).toLocaleString()   : "",
        formatDuration(dur),
        ev.comments || ""
      ];
    });
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `daily-events-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── App ──────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]                       = useState("today");
  const [events, setEvents]                 = useState([]);
  const [categories, setCategories]         = useState(DEFAULT_CATEGORIES);
  const [showForm, setShowForm]             = useState(false);
  const [editingEvent, setEditingEvent]     = useState(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [userId, setUserId]                 = useState(null);
  const [loading, setLoading]               = useState(true);
  const [historySearch, setHistorySearch]   = useState("");
  const [historyFilter, setHistoryFilter]   = useState("all");
  const [expandedEvent, setExpandedEvent]   = useState(null);
  const [statsCatFilter, setStatsCatFilter] = useState(null);

  useEffect(() => {
    const saved = getSavedUsername();
    if (saved) setUserId(saved);
    setLoading(false);
  }, []);

  const handleSetUsername = (username) => {
    saveUsername(username);
    setUserId(username.trim().toLowerCase());
  };

  const handleSwitchUser = () => {
    clearUsername();
    setUserId(null);
    setEvents([]);
    setCategories(DEFAULT_CATEGORIES);
  };

  useEffect(() => {
    if (!userId) return;
    const eventsUnsub = onSnapshot(collection(db, "userdata", userId, "events"), (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const catUnsub = onSnapshot(doc(db, "userdata", userId, "settings", "categories"), (snap) => {
      if (snap.exists()) setCategories(snap.data().list);
    });
    return () => { eventsUnsub(); catUnsub(); };
  }, [userId]);

  // Auto-create sleep events between last event and midnight/first event next day
  useEffect(() => {
    if (!userId || events.length === 0) return;
    const sortedByDate = [...events].sort((a,b) => a.startDate > b.startDate ? 1 : -1);
    const grouped = {};
    sortedByDate.forEach(ev => {
      if (!ev.startDate) return;
      const d = ev.startDate.split("T")[0];
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(ev);
    });

    const dates = Object.keys(grouped).sort();
    const sleepToCreate = [];

    for (let i = 0; i < dates.length - 1; i++) {
      const date      = dates[i];
      const nextDate  = dates[i+1];
      const dayEvents = grouped[date].filter(e => !e.isSleep);
      if (dayEvents.length === 0) continue;
      const lastEv    = [...dayEvents].sort((a,b) => a.endDate > b.endDate ? -1 : 1)[0];
      if (!lastEv?.endDate) continue;
      const nextDayEvents = grouped[nextDate].filter(e => !e.isSleep);
      const firstNextEv   = nextDayEvents.sort((a,b) => a.startDate > b.startDate ? 1 : -1)[0];
      if (!firstNextEv?.startDate) continue;
      const sleepStart = lastEv.endDate;
      const sleepEnd   = firstNextEv.startDate;
      if (new Date(sleepEnd) <= new Date(sleepStart)) continue;

      // Check if sleep event already exists for this slot
      const existingSleep = events.find(e => e.isSleep && e.startDate === sleepStart);
      if (!existingSleep) {
        sleepToCreate.push({ sleepStart, sleepEnd, date });
      }
    }

    sleepToCreate.forEach(({ sleepStart, sleepEnd }) => {
      const id = "sleep_" + sleepStart.replace(/[^0-9]/g,"");
      setDoc(doc(db, "userdata", userId, "events", id), {
        id, name: "Sleep", category: "sleep", location: "",
        startDate: sleepStart, endDate: sleepEnd,
        comments: "Auto-created", isSleep: true
      });
    });
  }, [events, userId]);

  const saveEvent = async (ev) => {
    const id = ev.id || Date.now().toString();
    await setDoc(doc(db, "userdata", userId, "events", id), { ...ev, id });
    setShowForm(false);
    setEditingEvent(null);
  };

  const deleteEvent = async (id) => {
    await deleteDoc(doc(db, "userdata", userId, "events", id));
    setExpandedEvent(null);
  };

  const saveCategories = async (newCats) => {
    setCategories(newCats);
    await setDoc(doc(db, "userdata", userId, "settings", "categories"), { list: newCats });
  };

  const now      = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const todayEvents = events.filter((e) => e.startDate?.startsWith(todayStr));
  const getCat = (id) => categories.find((c) => c.id === id) || { label: id, color: "#6B7280", icon: "📌" };

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0F0F14", color:"#E8C97E", fontFamily:"Georgia, serif", gap:16 }}>
      <div style={{ fontSize:40 }}>📅</div>
      <div style={{ fontSize:16, letterSpacing:2 }}>Loading…</div>
    </div>
  );

  // ── Login Screen ───  // Username screen handled by UsernameScreen component
  if (!userId) return <UsernameScreen onConfirm={handleSetUsername} />;

  return (
    <div style={{ fontFamily:"'Georgia', serif", background:"#0F0F14", minHeight:"100vh", color:"#F0EDE8", width:"100%", maxWidth:"100vw", position:"relative", paddingBottom:80 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; overflow-x: hidden; }
        input, textarea, select { font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        @keyframes slideUp { from { transform: translateY(30px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        .event-card { animation: slideUp 0.25s ease forwards; }
        .tab-active { border-bottom: 2px solid #E8C97E !important; color: #E8C97E !important; }
        .content-wrap { max-width: 680px; margin: 0 auto; padding: 0 16px; }
        @media (max-width: 600px) { .content-wrap { padding: 0 10px; } }
      `}</style>

      {/* Header */}
      <div style={{ background:"#1A1A24", borderBottom:"1px solid #2A2A38" }}>
        <div className="content-wrap" style={{ padding:"20px 16px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:11, letterSpacing:3, color:"#888", textTransform:"uppercase" }}>Daily Journal</div>
              <div style={{ fontSize:20, color:"#E8C97E", fontStyle:"italic" }}>
                {now.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
              </div>
            </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <button onClick={() => exportToExcel(events, categories)}
                style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", padding:"6px 10px", cursor:"pointer", fontSize:12 }}>
                📥
              </button>
              <button onClick={() => setShowCatManager(true)}
                style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", padding:"6px 10px", cursor:"pointer", fontSize:12 }}>
                ⚙️
              </button>
              <button onClick={handleSwitchUser} title={userId}
                style={{ background:"#252535", border:"1px solid #333", borderRadius:8, color:"#E8C97E", padding:"6px 10px", cursor:"pointer", fontSize:12, maxWidth:80, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                👤 {userId}
              </button>
            </div>
          </div>
          <div style={{ display:"flex" }}>
            {[["today","Today"],["history","History"],["stats","Stats"]].map(([id,label]) => (
              <button key={id} onClick={() => setTab(id)} className={tab===id ? "tab-active" : ""}
                style={{ flex:1, background:"none", border:"none", borderBottom:"2px solid transparent", color:"#666", padding:"10px 0", cursor:"pointer", fontSize:14, letterSpacing:1, transition:"all 0.2s" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TODAY */}
      {tab === "today" && (
        <div className="content-wrap" style={{ paddingTop:16, paddingBottom:16, animation:"fadeIn 0.3s ease" }}>
          {todayEvents.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#444" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
              <div style={{ fontSize:16, color:"#555" }}>No events today</div>
              <div style={{ fontSize:12, color:"#333", marginTop:6 }}>Tap + to add your first event</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[...todayEvents].sort((a,b) => a.startDate > b.startDate ? 1:-1).map((ev) => (
                <EventCard key={ev.id} ev={ev} getCat={getCat}
                  expanded={expandedEvent===ev.id}
                  onToggle={() => setExpandedEvent(expandedEvent===ev.id ? null : ev.id)}
                  onEdit={() => { setEditingEvent(ev); setShowForm(true); }}
                  onDelete={() => deleteEvent(ev.id)} />
              ))}
            </div>
          )}
          <button onClick={() => { setEditingEvent(null); setShowForm(true); }}
            style={{ position:"fixed", bottom:90, right:24, width:56, height:56, borderRadius:"50%", background:"#E8C97E", color:"#0F0F14", fontSize:28, border:"none", cursor:"pointer", boxShadow:"0 4px 20px rgba(232,201,126,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold", zIndex:50 }}>
            +
          </button>
        </div>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <div className="content-wrap" style={{ paddingTop:16, paddingBottom:16, animation:"fadeIn 0.3s ease" }}>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search events…"
              style={{ flex:1, background:"#1A1A24", border:"1px solid #2A2A38", borderRadius:8, padding:"8px 12px", color:"#F0EDE8", fontSize:14 }} />
            <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}
              style={{ background:"#1A1A24", border:"1px solid #2A2A38", borderRadius:8, padding:"8px", color:"#F0EDE8", fontSize:13 }}>
              <option value="all">All</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {(() => {
            const filtered = events
              .filter((ev) => {
                const s = historySearch.toLowerCase();
                return (!s || ev.name?.toLowerCase().includes(s) || ev.location?.toLowerCase().includes(s))
                  && (historyFilter==="all" || ev.category===historyFilter);
              })
              .sort((a,b) => a.startDate > b.startDate ? 1:-1); // ascending by time
            if (filtered.length === 0) return (
              <div style={{ textAlign:"center", padding:40, color:"#444" }}>No events found</div>
            );
            const grouped = {};
            filtered.forEach((ev) => {
              const d = ev.startDate?.split("T")[0] || "Unknown";
              if (!grouped[d]) grouped[d] = [];
              grouped[d].push(ev);
            });
            // Show dates ascending too
            return Object.entries(grouped).sort((a,b)=>a[0]>b[0]?1:-1).map(([date, evs]) => (
              <div key={date} style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, letterSpacing:2, color:"#666", textTransform:"uppercase", marginBottom:8, paddingLeft:4 }}>
                  {date===todayStr ? "Today" : new Date(date+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {evs.map((ev) => (
                    <EventCard key={ev.id} ev={ev} getCat={getCat}
                      expanded={expandedEvent===ev.id}
                      onToggle={() => setExpandedEvent(expandedEvent===ev.id ? null : ev.id)}
                      onEdit={() => { setEditingEvent(ev); setShowForm(true); }}
                      onDelete={() => deleteEvent(ev.id)} />
                  ))}
                </div>
              </div>
            ));
          })()}
          {/* Add button in history tab too */}
          <button onClick={() => { setEditingEvent(null); setShowForm(true); }}
            style={{ position:"fixed", bottom:90, right:24, width:56, height:56, borderRadius:"50%", background:"#E8C97E", color:"#0F0F14", fontSize:28, border:"none", cursor:"pointer", boxShadow:"0 4px 20px rgba(232,201,126,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold", zIndex:50 }}>
            +
          </button>
        </div>
      )}

      {/* STATS */}
      {tab === "stats" && (
        <StatsTab events={events} categories={categories} getCat={getCat}
          statsCatFilter={statsCatFilter} setStatsCatFilter={setStatsCatFilter} />
      )}

      {showForm && (
        <EventForm initial={editingEvent} categories={categories} onSave={saveEvent}
          onClose={() => { setShowForm(false); setEditingEvent(null); }} />
      )}
      {showCatManager && (
        <CategoryManager categories={categories} onSave={saveCategories} onClose={() => setShowCatManager(false)} />
      )}

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#1A1A24", borderTop:"1px solid #2A2A38", display:"flex", padding:"8px 0", zIndex:40 }}>
        {[["today","📅","Today"],["history","🗂","History"],["stats","📊","Stats"]].map(([id,icon,label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex:1, background:"none", border:"none", color:tab===id?"#E8C97E":"#555", cursor:"pointer", padding:"6px 0", fontSize:11, letterSpacing:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <span style={{ fontSize:20 }}>{icon}</span>{label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── EventCard ────────────────────────────────────────────────────
function EventCard({ ev, getCat, expanded, onToggle, onEdit, onDelete }) {
  const cat      = getCat(ev.category);
  const start    = ev.startDate ? new Date(ev.startDate) : null;
  const end      = ev.endDate   ? new Date(ev.endDate)   : null;
  const duration = start && end  ? end - start : null;
  return (
    <div className="event-card" style={{ background:"#1A1A24", borderRadius:12, overflow:"hidden", border:"1px solid #2A2A38", borderLeft:`3px solid ${cat.color}` }}>
      <div onClick={onToggle} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontSize:22, minWidth:30, textAlign:"center" }}>{cat.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:"bold", fontSize:15, color:"#F0EDE8", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ev.name}</div>
          <div style={{ fontSize:12, color:"#666", marginTop:2 }}>{cat.label}{ev.location && <span> · 📍{ev.location}</span>}</div>
        </div>
        <div style={{ textAlign:"right", minWidth:"fit-content" }}>
          {start    && <div style={{ fontSize:12, color:"#888" }}>{fmt12(ev.startDate)}</div>}
          {duration && duration > 0 && <div style={{ fontSize:11, color:cat.color }}>{formatDuration(duration)}</div>}
        </div>
      </div>
      {expanded && (
        <div style={{ padding:"0 14px 12px", borderTop:"1px solid #2A2A38", animation:"slideUp 0.2s ease" }}>
          {ev.location && <div style={{ fontSize:13, color:"#888", marginTop:10 }}>📍 {ev.location}</div>}
          {start && (
            <div style={{ fontSize:13, color:"#888", marginTop:6 }}>
              🕐 {fmt12Date(ev.startDate)}{end ? ` → ${fmt12(ev.endDate)}` : ""}
              {duration && duration > 0 && <span style={{ color: cat.color }}> ({formatDuration(duration)})</span>}
            </div>
          )}
          {ev.comments && !ev.isSleep && <div style={{ fontSize:13, color:"#aaa", marginTop:8, fontStyle:"italic", lineHeight:1.5 }}>{ev.comments}</div>}
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <button onClick={onEdit}   style={{ flex:1, background:"#252535", border:"none", borderRadius:8, color:"#E8C97E", padding:"8px", cursor:"pointer", fontSize:13 }}>Edit</button>
            <button onClick={onDelete} style={{ flex:1, background:"#2A1A1A", border:"none", borderRadius:8, color:"#EF4444", padding:"8px", cursor:"pointer", fontSize:13 }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EventForm ────────────────────────────────────────────────────
function EventForm({ initial, categories, onSave, onClose }) {
  const now = new Date();
  const [form, setForm] = useState({
    name:      initial?.name      || "",
    category:  initial?.category  || categories[0]?.id || "",
    location:  initial?.location  || "",
    startDate: initial?.startDate || toDatetimeLocal(now),
    endDate:   initial?.endDate   || toDatetimeLocal(new Date(now.getTime()+3600000)),
    comments:  initial?.comments  || "",
    id:        initial?.id        || null,
  });
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  const set = (k,v) => setForm((p) => ({ ...p, [k]:v }));

  // Scroll focused field into view above keyboard
  const handleFocus = (e) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Event name is required"); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const inputStyle = {
    width:"100%", background:"#252535", border:"1px solid #333", borderRadius:8,
    padding:"10px 12px", color:"#F0EDE8", fontSize:16, marginTop:6  // font-size 16 prevents iOS zoom
  };
  const labelStyle = { fontSize:12, color:"#888", letterSpacing:1, textTransform:"uppercase" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:100, display:"flex", alignItems:"flex-end", animation:"fadeIn 0.2s ease" }}>
      <div ref={formRef} style={{ background:"#1A1A24", width:"100%", maxWidth:680, margin:"0 auto", borderRadius:"20px 20px 0 0", padding:20, maxHeight:"92vh", overflowY:"auto", paddingBottom:40 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:18, color:"#E8C97E", fontStyle:"italic" }}>{initial ? "Edit Event" : "New Event"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#666", fontSize:24, cursor:"pointer" }}>×</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <div style={labelStyle}>Event Name *</div>
            <input value={form.name} onChange={(e) => set("name",e.target.value)}
              onFocus={handleFocus} placeholder="What did you do?" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Category</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
              {categories.map((c) => (
                <button key={c.id} onClick={() => set("category",c.id)}
                  style={{ padding:"6px 10px", borderRadius:20, border:`1px solid ${form.category===c.id?c.color:"#333"}`, background:form.category===c.id?c.color+"22":"transparent", color:form.category===c.id?c.color:"#666", fontSize:12, cursor:"pointer", transition:"all 0.2s" }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Location</div>
            <input value={form.location} onChange={(e) => set("location",e.target.value)}
              onFocus={handleFocus} placeholder="Where?" style={inputStyle} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <div style={labelStyle}>Start</div>
              <input type="datetime-local" value={form.startDate} onChange={(e) => set("startDate",e.target.value)}
                onFocus={handleFocus} style={{ ...inputStyle, colorScheme:"dark" }} />
            </div>
            <div>
              <div style={labelStyle}>End</div>
              <input type="datetime-local" value={form.endDate} onChange={(e) => set("endDate",e.target.value)}
                onFocus={handleFocus} style={{ ...inputStyle, colorScheme:"dark" }} />
            </div>
          </div>
          <div>
            <div style={labelStyle}>Comments</div>
            <textarea value={form.comments} onChange={(e) => set("comments",e.target.value)}
              onFocus={handleFocus} placeholder="Any notes…" rows={3}
              style={{ ...inputStyle, resize:"none", lineHeight:1.5 }} />
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ background:saving?"#a0924f":"#E8C97E", color:"#0F0F14", border:"none", borderRadius:10, padding:"14px", fontSize:15, fontWeight:"bold", cursor:saving?"wait":"pointer", letterSpacing:1, marginTop:4 }}>
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── StatsTab ─────────────────────────────────────────────────────
function StatsTab({ events, categories, getCat, statsCatFilter, setStatsCatFilter }) {
  const now = new Date();

  // If a category is selected, show drill-down
  if (statsCatFilter) {
    const cat = getCat(statsCatFilter);
    const catEvents = events
      .filter(e => e.category === statsCatFilter)
      .sort((a,b) => a.startDate > b.startDate ? 1:-1);
    return (
      <div className="content-wrap" style={{ paddingTop:16, paddingBottom:16, animation:"fadeIn 0.3s ease" }}>
        <button onClick={() => setStatsCatFilter(null)}
          style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", padding:"6px 12px", cursor:"pointer", fontSize:13, marginBottom:16 }}>
          ← Back to Stats
        </button>
        <div style={{ background:"#1A1A24", borderRadius:12, padding:16, border:"1px solid #2A2A38", borderLeft:`4px solid ${cat.color}`, marginBottom:14 }}>
          <div style={{ fontSize:22 }}>{cat.icon} <span style={{ color:cat.color, fontSize:18 }}>{cat.label}</span></div>
          <div style={{ fontSize:13, color:"#666", marginTop:4 }}>{catEvents.length} events total</div>
        </div>
        {catEvents.length === 0 ? (
          <div style={{ textAlign:"center", padding:40, color:"#444" }}>No events in this category</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {catEvents.map(ev => {
              const start = ev.startDate ? new Date(ev.startDate) : null;
              const end   = ev.endDate   ? new Date(ev.endDate)   : null;
              const dur   = start && end  ? end - start : null;
              return (
                <div key={ev.id} style={{ background:"#1A1A24", borderRadius:12, padding:"12px 14px", border:"1px solid #2A2A38", borderLeft:`3px solid ${cat.color}` }}>
                  <div style={{ fontWeight:"bold", fontSize:15, color:"#F0EDE8" }}>{ev.name}</div>
                  {ev.location && <div style={{ fontSize:12, color:"#666", marginTop:3 }}>📍 {ev.location}</div>}
                  <div style={{ fontSize:12, color:"#888", marginTop:4 }}>
                    {start && fmt12Date(ev.startDate)}
                    {end   && ` → ${fmt12(ev.endDate)}`}
                    {dur && dur > 0 && <span style={{ color:cat.color }}> · {formatDuration(dur)}</span>}
                  </div>
                  {ev.comments && <div style={{ fontSize:12, color:"#aaa", marginTop:6, fontStyle:"italic" }}>{ev.comments}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const monthlyCounts = {};
  events.forEach((ev) => {
    if (!ev.startDate) return;
    const d   = new Date(ev.startDate);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
  });
  const currentMonthKey   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const currentMonthCount = monthlyCounts[currentMonthKey] || 0;
  const highestMonth      = Object.entries(monthlyCounts).sort((a,b) => b[1]-a[1])[0];

  const catTime = {};
  events.forEach((ev) => {
    if (!ev.startDate||!ev.endDate) return;
    const ms = new Date(ev.endDate)-new Date(ev.startDate);
    if (ms<=0) return;
    catTime[ev.category] = (catTime[ev.category]||0) + ms;
  });

  const catCounts = {};
  events.forEach((ev) => { catCounts[ev.category] = (catCounts[ev.category]||0)+1; });

  const maxCatTime  = Math.max(...Object.values(catTime),1);
  const maxCatCount = Math.max(...Object.values(catCounts),1);

  const last6 = [];
  for (let i=5;i>=0;i--) {
    const d   = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    last6.push({ key, label:MONTH_NAMES[d.getMonth()], count:monthlyCounts[key]||0 });
  }

  const cardStyle = { background:"#1A1A24", borderRadius:12, padding:16, border:"1px solid #2A2A38" };

  if (events.length===0) return (
    <div style={{ textAlign:"center", padding:60, color:"#444", animation:"fadeIn 0.3s ease" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
      <div>Add some events to see stats</div>
    </div>
  );

  return (
    <div className="content-wrap" style={{ paddingTop:16, paddingBottom:16, animation:"fadeIn 0.3s ease", display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ ...cardStyle, textAlign:"center" }}>
          <div style={{ fontSize:32, fontWeight:"bold", color:"#E8C97E" }}>{currentMonthCount}</div>
          <div style={{ fontSize:11, color:"#666", letterSpacing:1, textTransform:"uppercase", marginTop:4 }}>This Month</div>
        </div>
        <div style={{ ...cardStyle, textAlign:"center" }}>
          <div style={{ fontSize:32, fontWeight:"bold", color:"#E8C97E" }}>{events.length}</div>
          <div style={{ fontSize:11, color:"#666", letterSpacing:1, textTransform:"uppercase", marginTop:4 }}>Total Events</div>
        </div>
        {highestMonth && (
          <div style={{ ...cardStyle, gridColumn:"1/-1" }}>
            <div style={{ fontSize:11, color:"#666", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>🏆 Best Month</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:16, color:"#F0EDE8" }}>
                {(() => { const [y,m]=highestMonth[0].split("-"); return `${MONTH_NAMES[parseInt(m)-1]} ${y}`; })()}
              </div>
              <div style={{ fontSize:22, fontWeight:"bold", color:"#E8C97E" }}>{highestMonth[1]} events</div>
            </div>
          </div>
        )}
      </div>

      {last6.some((m) => m.count>0) && (
        <div style={cardStyle}>
          <div style={{ fontSize:12, color:"#888", letterSpacing:1, textTransform:"uppercase", marginBottom:14 }}>Events per Month</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:90 }}>
            {last6.map((m) => {
              const barH = Math.max((m.count/Math.max(...last6.map((x)=>x.count),1))*64, m.count>0?4:0);
              return (
                <div key={m.key} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <div style={{ fontSize:11, color:"#E8C97E", minHeight:16 }}>{m.count||""}</div>
                  <div style={{ width:"100%", background:m.key===currentMonthKey?"#E8C97E":"#3A3A4A", borderRadius:"4px 4px 0 0", height:barH, transition:"height 0.5s ease" }} />
                  <div style={{ fontSize:10, color:"#555" }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time by category — clickable */}
      {Object.keys(catTime).length>0 && (
        <div style={cardStyle}>
          <div style={{ fontSize:12, color:"#888", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>Time Spent by Category</div>
          <div style={{ fontSize:11, color:"#555", marginBottom:12 }}>Tap a category to see all entries</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {Object.entries(catTime).sort((a,b)=>b[1]-a[1]).map(([id,ms]) => {
              const cat = getCat(id);
              return (
                <div key={id} onClick={() => setStatsCatFilter(id)} style={{ cursor:"pointer" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, color:"#ccc" }}>{cat.icon} {cat.label}</span>
                    <span style={{ fontSize:13, color:cat.color, fontWeight:"bold" }}>{formatDuration(ms)} →</span>
                  </div>
                  <div style={{ height:6, background:"#252535", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(ms/maxCatTime)*100}%`, background:cat.color, borderRadius:3, transition:"width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Events by category — clickable */}
      {Object.keys(catCounts).length>0 && (
        <div style={cardStyle}>
          <div style={{ fontSize:12, color:"#888", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>Events by Category</div>
          <div style={{ fontSize:11, color:"#555", marginBottom:12 }}>Tap a category to see all entries</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).map(([id,count]) => {
              const cat = getCat(id);
              return (
                <div key={id} onClick={() => setStatsCatFilter(id)}
                  style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", padding:"4px 0" }}>
                  <div style={{ width:130, fontSize:12, color:"#aaa", display:"flex", alignItems:"center", gap:6 }}>
                    <span>{cat.icon}</span>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cat.label}</span>
                  </div>
                  <div style={{ flex:1, height:6, background:"#252535", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(count/maxCatCount)*100}%`, background:cat.color, borderRadius:3 }} />
                  </div>
                  <div style={{ fontSize:13, color:cat.color, fontWeight:"bold", minWidth:24, textAlign:"right" }}>{count} →</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CategoryManager ──────────────────────────────────────────────
function CategoryManager({ categories, onSave, onClose }) {
  const [list, setList]         = useState(categories);
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon]   = useState("📌");
  const [newColor, setNewColor] = useState("#6B7280");
  const [saving, setSaving]     = useState(false);

  // Auto-suggest icon as user types
  const handleLabelChange = (val) => {
    setNewLabel(val);
    setNewIcon(guessIcon(val));
  };

  const addCat = () => {
    if (!newLabel.trim()) return;
    const id = newLabel.toLowerCase().replace(/\s+/g,"_")+"_"+Date.now();
    setList((p) => [...p, { id, label:newLabel.trim(), icon:newIcon, color:newColor }]);
    setNewLabel(""); setNewIcon("📌"); setNewColor("#6B7280");
  };
  const removeCat = (id) => { if (list.length<=1) return; setList((p) => p.filter((c) => c.id!==id)); };
  const handleSave = async () => { setSaving(true); await onSave(list); setSaving(false); onClose(); };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"flex-end", animation:"fadeIn 0.2s ease" }}>
      <div style={{ background:"#1A1A24", width:"100%", maxWidth:680, margin:"0 auto", borderRadius:"20px 20px 0 0", padding:20, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:18, color:"#E8C97E", fontStyle:"italic" }}>Manage Categories</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#666", fontSize:24, cursor:"pointer" }}>×</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
          {list.map((c) => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#252535", borderRadius:10, padding:"10px 12px", borderLeft:`3px solid ${c.color}` }}>
              <span style={{ fontSize:20 }}>{c.icon}</span>
              <span style={{ flex:1, fontSize:14, color:"#ccc" }}>{c.label}</span>
              <button onClick={() => removeCat(c.id)} style={{ background:"none", border:"none", color:"#555", fontSize:18, cursor:"pointer" }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ background:"#252535", borderRadius:12, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:12, color:"#888", letterSpacing:1, textTransform:"uppercase", marginBottom:12 }}>Add New Category</div>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="🏷"
                style={{ width:50, background:"#1A1A24", border:"1px solid #333", borderRadius:8, padding:"8px", color:"#F0EDE8", fontSize:20, textAlign:"center" }} />
              <div style={{ fontSize:9, color:"#555" }}>icon</div>
            </div>
            <input value={newLabel} onChange={(e) => handleLabelChange(e.target.value)} placeholder="Category name…"
              style={{ flex:1, background:"#1A1A24", border:"1px solid #333", borderRadius:8, padding:"8px 12px", color:"#F0EDE8", fontSize:14 }} />
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
              style={{ width:42, height:42, border:"1px solid #333", borderRadius:8, background:"none", cursor:"pointer", padding:2 }} />
          </div>
          <div style={{ fontSize:11, color:"#666", marginBottom:8 }}>💡 Icon auto-suggests based on name — you can change it</div>
          <button onClick={addCat}
            style={{ width:"100%", background:"#2A2A3A", color:"#E8C97E", border:"1px solid #E8C97E44", borderRadius:8, padding:"10px", fontSize:14, cursor:"pointer" }}>
            + Add to List
          </button>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ width:"100%", background:saving?"#a0924f":"#E8C97E", color:"#0F0F14", border:"none", borderRadius:10, padding:"14px", fontSize:15, fontWeight:"bold", cursor:saving?"wait":"pointer" }}>
          {saving ? "Saving…" : "Save Categories"}
        </button>
      </div>
    </div>
  );
}

// ─── UsernameScreen ───────────────────────────────────────────────
function UsernameScreen({ onConfirm }) {
  const [username, setUsername] = useState("");
  const [error, setError]       = useState("");

  const handle = () => {
    const u = username.trim().toLowerCase();
    if (u.length < 3) { setError("Username must be at least 3 characters"); return; }
    if (!/^[a-z0-9_]+$/.test(u)) { setError("Only letters, numbers and _ allowed"); return; }
    onConfirm(u);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0F0F14", fontFamily:"Georgia, serif", padding:24 }}>
      <div style={{ fontSize:56, marginBottom:16 }}>📅</div>
      <div style={{ fontSize:28, color:"#E8C97E", fontStyle:"italic", marginBottom:8 }}>Daily Events</div>
      <div style={{ fontSize:14, color:"#666", marginBottom:40, textAlign:"center" }}>
        Enter a username to access your data.<br/>
        Use the <strong style={{ color:"#aaa" }}>same username</strong> on all your devices to sync.
      </div>
      <div style={{ width:"100%", maxWidth:320 }}>
        <input
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handle()}
          placeholder="e.g. dinesh_raj"
          autoFocus
          style={{ width:"100%", background:"#1A1A24", border:"1px solid #333", borderRadius:10, padding:"14px 16px", color:"#F0EDE8", fontSize:18, textAlign:"center", letterSpacing:1, outline:"none" }}
        />
        {error && <div style={{ color:"#EF4444", fontSize:12, marginTop:8, textAlign:"center" }}>{error}</div>}
        <button onClick={handle}
          style={{ width:"100%", marginTop:14, background:"#E8C97E", color:"#0F0F14", border:"none", borderRadius:10, padding:"14px", fontSize:16, fontWeight:"bold", cursor:"pointer" }}>
          Let's Go →
        </button>
        <div style={{ fontSize:11, color:"#444", marginTop:16, textAlign:"center", lineHeight:1.6 }}>
          💡 This username is your key to your data.<br/>Write it down so you don't forget it.
        </div>
      </div>
    </div>
  );
}
