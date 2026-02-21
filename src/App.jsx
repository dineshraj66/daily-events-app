import { useState, useEffect } from "react";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot
} from "firebase/firestore";
import { db, initAuth } from "./firebase";

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
  { id: "others",       label: "Others",                           color: "#6B7280", icon: "📌" },
];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const toDatetimeLocal = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDuration = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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

  useEffect(() => {
    initAuth().then((user) => setUserId(user.uid));
  }, []);

  useEffect(() => {
    if (!userId) return;

    const eventsUnsub = onSnapshot(
      collection(db, "users", userId, "events"),
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );

    const catUnsub = onSnapshot(
      doc(db, "users", userId, "settings", "categories"),
      (snap) => { if (snap.exists()) setCategories(snap.data().list); }
    );

    return () => { eventsUnsub(); catUnsub(); };
  }, [userId]);

  const saveEvent = async (ev) => {
    const id = ev.id || Date.now().toString();
    await setDoc(doc(db, "users", userId, "events", id), { ...ev, id });
    setShowForm(false);
    setEditingEvent(null);
  };

  const deleteEvent = async (id) => {
    await deleteDoc(doc(db, "users", userId, "events", id));
    setExpandedEvent(null);
  };

  const saveCategories = async (newCats) => {
    setCategories(newCats);
    await setDoc(doc(db, "users", userId, "settings", "categories"), { list: newCats });
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

  return (
    <div style={{ fontFamily:"'Georgia', serif", background:"#0F0F14", minHeight:"100vh", color:"#F0EDE8", maxWidth:480, margin:"0 auto", position:"relative", paddingBottom:80 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea, select { font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        @keyframes slideUp { from { transform: translateY(30px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        .event-card { animation: slideUp 0.25s ease forwards; }
        .tab-active { border-bottom: 2px solid #E8C97E !important; color: #E8C97E !important; }
      `}</style>

      {/* Header */}
      <div style={{ background:"#1A1A24", padding:"20px 20px 0", borderBottom:"1px solid #2A2A38" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:3, color:"#888", textTransform:"uppercase" }}>Daily Journal</div>
            <div style={{ fontSize:22, color:"#E8C97E", fontStyle:"italic" }}>
              {now.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
            </div>
          </div>
          <button onClick={() => setShowCatManager(true)}
            style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", padding:"6px 10px", cursor:"pointer", fontSize:13 }}>
            ⚙️ Categories
          </button>
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

      {/* TODAY */}
      {tab === "today" && (
        <div style={{ padding:16, animation:"fadeIn 0.3s ease" }}>
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
            style={{ position:"fixed", bottom:90, right:"max(16px, calc(50% - 224px))", width:56, height:56, borderRadius:"50%", background:"#E8C97E", color:"#0F0F14", fontSize:28, border:"none", cursor:"pointer", boxShadow:"0 4px 20px rgba(232,201,126,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold" }}>
            +
          </button>
        </div>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <div style={{ padding:16, animation:"fadeIn 0.3s ease" }}>
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
              .sort((a,b) => b.startDate > a.startDate ? 1:-1);
            if (filtered.length === 0) return (
              <div style={{ textAlign:"center", padding:40, color:"#444" }}>No events found</div>
            );
            const grouped = {};
            filtered.forEach((ev) => {
              const d = ev.startDate?.split("T")[0] || "Unknown";
              if (!grouped[d]) grouped[d] = [];
              grouped[d].push(ev);
            });
            return Object.entries(grouped).map(([date, evs]) => (
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
        </div>
      )}

      {/* STATS */}
      {tab === "stats" && <StatsTab events={events} categories={categories} />}

      {showForm && (
        <EventForm initial={editingEvent} categories={categories} onSave={saveEvent}
          onClose={() => { setShowForm(false); setEditingEvent(null); }} />
      )}
      {showCatManager && (
        <CategoryManager categories={categories} onSave={saveCategories} onClose={() => setShowCatManager(false)} />
      )}

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"#1A1A24", borderTop:"1px solid #2A2A38", display:"flex", padding:"8px 0" }}>
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

function EventCard({ ev, getCat, expanded, onToggle, onEdit, onDelete }) {
  const cat      = getCat(ev.category);
  const start    = ev.startDate ? new Date(ev.startDate) : null;
  const end      = ev.endDate   ? new Date(ev.endDate)   : null;
  const duration = start && end  ? end - start : null;
  return (
    <div className="event-card" style={{ background:"#1A1A24", borderRadius:12, overflow:"hidden", border:"1px solid #2A2A38", borderLeft:`3px solid ${cat.color}` }}>
      <div onClick={onToggle} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontSize:24, minWidth:32, textAlign:"center" }}>{cat.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:"bold", fontSize:15, color:"#F0EDE8", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ev.name}</div>
          <div style={{ fontSize:12, color:"#666", marginTop:2 }}>{cat.label}{ev.location && <span> · 📍{ev.location}</span>}</div>
        </div>
        <div style={{ textAlign:"right", minWidth:"fit-content" }}>
          {start    && <div style={{ fontSize:12, color:"#888" }}>{start.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</div>}
          {duration && duration > 0 && <div style={{ fontSize:11, color:cat.color }}>{formatDuration(duration)}</div>}
        </div>
      </div>
      {expanded && (
        <div style={{ padding:"0 14px 12px", borderTop:"1px solid #2A2A38", animation:"slideUp 0.2s ease" }}>
          {ev.location && <div style={{ fontSize:13, color:"#888", marginTop:10 }}>📍 {ev.location}</div>}
          {start && <div style={{ fontSize:13, color:"#888", marginTop:6 }}>🕐 {start.toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}{end ? ` → ${end.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}` : ""}</div>}
          {ev.comments && <div style={{ fontSize:13, color:"#aaa", marginTop:8, fontStyle:"italic", lineHeight:1.5 }}>{ev.comments}</div>}
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <button onClick={onEdit}   style={{ flex:1, background:"#252535", border:"none", borderRadius:8, color:"#E8C97E", padding:"8px", cursor:"pointer", fontSize:13 }}>Edit</button>
            <button onClick={onDelete} style={{ flex:1, background:"#2A1A1A", border:"none", borderRadius:8, color:"#EF4444", padding:"8px", cursor:"pointer", fontSize:13 }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const set = (k,v) => setForm((p) => ({ ...p, [k]:v }));
  const handleSave = async () => {
    if (!form.name.trim()) { alert("Event name is required"); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };
  const inputStyle = { width:"100%", background:"#252535", border:"1px solid #333", borderRadius:8, padding:"10px 12px", color:"#F0EDE8", fontSize:14, marginTop:6 };
  const labelStyle = { fontSize:12, color:"#888", letterSpacing:1, textTransform:"uppercase" };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:100, display:"flex", alignItems:"flex-end", animation:"fadeIn 0.2s ease" }}>
      <div style={{ background:"#1A1A24", width:"100%", maxWidth:480, margin:"0 auto", borderRadius:"20px 20px 0 0", padding:20, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:18, color:"#E8C97E", fontStyle:"italic" }}>{initial ? "Edit Event" : "New Event"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#666", fontSize:24, cursor:"pointer" }}>×</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <div style={labelStyle}>Event Name *</div>
            <input value={form.name} onChange={(e) => set("name",e.target.value)} placeholder="What did you do?" style={inputStyle} />
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
            <input value={form.location} onChange={(e) => set("location",e.target.value)} placeholder="Where?" style={inputStyle} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <div style={labelStyle}>Start</div>
              <input type="datetime-local" value={form.startDate} onChange={(e) => set("startDate",e.target.value)} style={{ ...inputStyle, colorScheme:"dark" }} />
            </div>
            <div>
              <div style={labelStyle}>End</div>
              <input type="datetime-local" value={form.endDate} onChange={(e) => set("endDate",e.target.value)} style={{ ...inputStyle, colorScheme:"dark" }} />
            </div>
          </div>
          <div>
            <div style={labelStyle}>Comments</div>
            <textarea value={form.comments} onChange={(e) => set("comments",e.target.value)} placeholder="Any notes…" rows={3} style={{ ...inputStyle, resize:"none", lineHeight:1.5 }} />
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

function StatsTab({ events, categories }) {
  const now = new Date();
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
  const getCat      = (id) => categories.find((c) => c.id===id) || { label:id, color:"#6B7280", icon:"📌" };
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
    <div style={{ padding:16, animation:"fadeIn 0.3s ease", display:"flex", flexDirection:"column", gap:14 }}>
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
      {Object.keys(catTime).length>0 && (
        <div style={cardStyle}>
          <div style={{ fontSize:12, color:"#888", letterSpacing:1, textTransform:"uppercase", marginBottom:14 }}>Time Spent by Category</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {Object.entries(catTime).sort((a,b)=>b[1]-a[1]).map(([id,ms]) => {
              const cat = getCat(id);
              return (
                <div key={id}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, color:"#ccc" }}>{cat.icon} {cat.label}</span>
                    <span style={{ fontSize:13, color:cat.color, fontWeight:"bold" }}>{formatDuration(ms)}</span>
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
      {Object.keys(catCounts).length>0 && (
        <div style={cardStyle}>
          <div style={{ fontSize:12, color:"#888", letterSpacing:1, textTransform:"uppercase", marginBottom:14 }}>Events by Category</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).map(([id,count]) => {
              const cat = getCat(id);
              return (
                <div key={id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:130, fontSize:12, color:"#aaa", display:"flex", alignItems:"center", gap:6 }}>
                    <span>{cat.icon}</span>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cat.label}</span>
                  </div>
                  <div style={{ flex:1, height:6, background:"#252535", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(count/maxCatCount)*100}%`, background:cat.color, borderRadius:3 }} />
                  </div>
                  <div style={{ fontSize:13, color:cat.color, fontWeight:"bold", minWidth:24, textAlign:"right" }}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryManager({ categories, onSave, onClose }) {
  const [list, setList]       = useState(categories);
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon]   = useState("📌");
  const [newColor, setNewColor] = useState("#6B7280");
  const [saving, setSaving]     = useState(false);
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
      <div style={{ background:"#1A1A24", width:"100%", maxWidth:480, margin:"0 auto", borderRadius:"20px 20px 0 0", padding:20, maxHeight:"85vh", overflowY:"auto" }}>
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
            <input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="🏷"
              style={{ width:50, background:"#1A1A24", border:"1px solid #333", borderRadius:8, padding:"8px", color:"#F0EDE8", fontSize:20, textAlign:"center" }} />
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Category name…"
              style={{ flex:1, background:"#1A1A24", border:"1px solid #333", borderRadius:8, padding:"8px 12px", color:"#F0EDE8", fontSize:14 }} />
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
              style={{ width:42, height:42, border:"1px solid #333", borderRadius:8, background:"none", cursor:"pointer", padding:2 }} />
          </div>
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
