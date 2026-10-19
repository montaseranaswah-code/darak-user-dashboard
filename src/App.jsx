import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, Navigate, useSearchParams, useLocation } from 'react-router-dom'
import { api } from './api'
import './App.css'

// ============ إعدادات المتجر (عدّلها براحتك) ============
const STORE = {
  name: 'بيتك',
  whatsapp: '', // رقم واتساب بالصيغة الدولية بدون + ، مثال: 962791234567 (إذا فاضي ما بيظهر زر واتساب)
  phone: '',    // رقم الهاتف اللي بيظهر بالفوتر
  city: 'عمّان، الأردن',
}
const PERKS = [
  ['🚚', 'توصيل لباب بيتك'],
  ['💳', 'الدفع عند الاستلام'],
  ['💬', 'متابعة طلبك عبر واتساب'],
  ['⭐', 'تقييمات حقيقية من زبائننا'],
]
// =========================================================

const Ctx = createContext()
const useApp = () => useContext(Ctx)
const money = (n) => Number(n).toFixed(2) + ' د.أ'
const STATUS = { pending: 'قيد المراجعة', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' }
const FLOW = ['pending', 'processing', 'shipped', 'delivered']

// تحديث تلقائي: بينفّذ الدالة كل فترة، وكمان لما ترجع للتبويب
function useAutoRefresh(fn, ms = 15000) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const run = () => { if (!document.hidden) ref.current() }
    const t = setInterval(run, ms)
    document.addEventListener('visibilitychange', run)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', run) }
  }, [ms])
}


function Provider({ children }) {
  const [user, setUser] = useState(null)
  const [toast, setToast] = useState('')
  const [unread, setUnread] = useState(0)
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cart') || '[]') } catch { return [] }
  })

  useEffect(() => { localStorage.setItem('cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => {
    if (localStorage.getItem('token')) api('/me').then(setUser).catch(() => localStorage.removeItem('token'))
  }, [])

  const refreshMsgs = () => {
    if (!localStorage.getItem('token')) return setUnread(0)
    api('/messages/unread-count').then((d) => setUnread(d.unread)).catch(() => {})
  }
  useEffect(() => {
    refreshMsgs()
    const t = setInterval(refreshMsgs, 15000)
    document.addEventListener('visibilitychange', refreshMsgs)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', refreshMsgs) }
  }, [user])

  const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 2200) }
  const add = (p, q = 1) => {
    setCart((c) => {
      const i = c.find((x) => x.id === p.id)
      if (i) return c.map((x) => (x.id === p.id ? { ...x, qty: Math.min(x.qty + q, p.stock) } : x))
      return [...c, { id: p.id, name: p.name, price: Number(p.price), image: p.image_url, stock: p.stock, qty: q }]
    })
    notify('✓ تمت الإضافة إلى السلة')
  }
  const setQty = (id, qty) => setCart((c) => c.map((x) => (x.id === id ? { ...x, qty: Math.max(1, Math.min(qty, x.stock)) } : x)))
  const remove = (id) => setCart((c) => c.filter((x) => x.id !== id))
  const clear = () => setCart([])
  const login = (d) => { localStorage.setItem('token', d.token); setUser(d.user) }
  const logout = () => { api('/logout', { method: 'POST' }).catch(() => {}); localStorage.removeItem('token'); setUser(null) }
  const total = cart.reduce((s, x) => s + x.price * x.qty, 0)

  return (
    <Ctx.Provider value={{ user, cart, add, setQty, remove, clear, login, logout, total, notify, unread, refreshMsgs }}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </Ctx.Provider>
  )
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function Stars({ value = 0, size = 16 }) {
  const v = Number(value) || 0
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${v} من 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const p = Math.max(0, Math.min(1, v - i)) * 100
        return <i key={i} style={{ background: `linear-gradient(270deg,#f59e0b ${p}%,#d6dbe4 ${p}%)`, WebkitBackgroundClip: 'text' }}>★</i>
      })}
    </span>
  )
}

function Header() {
  const { user, cart, logout, unread } = useApp()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState(false)
  const n = cart.reduce((s, x) => s + x.qty, 0)
  const go = (e) => { e.preventDefault(); nav('/shop?q=' + encodeURIComponent(q)); setMenu(false) }
  return (
    <>
      <div className="topbar">🚚 توصيل لجميع المحافظات &nbsp;•&nbsp; 💳 الدفع عند الاستلام</div>
      <header className="hdr"><div className="wrap hdr-in">
        <Link to="/" className="logo">🏠 {STORE.name}</Link>
        <nav className={menu ? 'open' : ''} onClick={() => setMenu(false)}>
          <Link to="/">الرئيسية</Link>
          <Link to="/shop?type=appliance">الأجهزة الكهربائية</Link>
          <Link to="/shop?type=bedroom">غرف النوم الجاهزة</Link>
          <Link to="/shop">كل المنتجات</Link>
        </nav>
        <form className="hsearch" onSubmit={go}>
          <input placeholder="ابحث عن منتج..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button aria-label="بحث">🔍</button>
        </form>
        <div className="hdr-act">
          <Link to="/cart" className="cartbtn">🛒 السلة {n > 0 && <b>{n}</b>}</Link>
          {user && <Link to="/messages" className="bell" aria-label="رسائلي">🔔{unread > 0 && <b>{unread}</b>}</Link>}
          {user ? (<><Link to="/orders">طلباتي</Link><button className="lnk" onClick={logout}>خروج</button></>)
            : <Link to="/login" className="btn sm">دخول</Link>}
          <button className="burger" onClick={() => setMenu(!menu)} aria-label="القائمة">☰</button>
        </div>
      </div></header>
    </>
  )
}

function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap ftr-g">
        <div>
          <h4>🏠 {STORE.name}</h4>
          <p>أجهزة كهربائية منزلية وغرف نوم جاهزة بأفضل الأسعار، مع التوصيل لباب بيتك والدفع عند الاستلام.</p>
        </div>
        <div>
          <h4>روابط سريعة</h4>
          <Link to="/shop?type=appliance">الأجهزة الكهربائية</Link>
          <Link to="/shop?type=bedroom">غرف النوم الجاهزة</Link>
          <Link to="/orders">طلباتي</Link>
          <Link to="/cart">السلة</Link>
        </div>
        <div>
          <h4>تواصل معنا</h4>
          <p>📍 {STORE.city}</p>
          {STORE.phone && <a href={'tel:' + STORE.phone}>📞 {STORE.phone}</a>}
          {STORE.whatsapp && <a href={'https://wa.me/' + STORE.whatsapp} target="_blank" rel="noreferrer">💬 واتساب</a>}
        </div>
      </div>
      <div className="ftr-b">© {new Date().getFullYear()} {STORE.name} — جميع الحقوق محفوظة</div>
    </footer>
  )
}

function Card({ p }) {
  const { add } = useApp()
  const off = p.old_price && Number(p.old_price) > Number(p.price) ? Math.round((1 - p.price / p.old_price) * 100) : 0
  return (
    <div className="card">
      <Link to={'/product/' + p.id} className="cimg">
        {off > 0 && <span className="off">-{off}%</span>}
        {p.stock > 0 && p.stock <= 3 && <span className="low">آخر {p.stock} قطع</span>}
        <img loading="lazy" src={p.image_url} alt={p.name} />
      </Link>
      <div className="cb">
        <small>{p.category?.name}{p.brand ? ' • ' + p.brand : ''}</small>
        <Link to={'/product/' + p.id}><h3>{p.name}</h3></Link>
        <div className="rate">
          <Stars value={p.reviews_avg_rating} size={14} />
          <span>{p.reviews_count > 0 ? `(${p.reviews_count})` : 'لا تقييمات'}</span>
        </div>
        <div className="pr"><b>{money(p.price)}</b>{p.old_price && <del>{money(p.old_price)}</del>}</div>
        <button className="btn" disabled={p.stock < 1} onClick={() => add(p)}>{p.stock < 1 ? 'نفدت الكمية' : 'أضف إلى السلة'}</button>
      </div>
    </div>
  )
}

function Grid({ items }) {
  if (!items) return <div className="grid">{[1, 2, 3, 4].map((i) => <div key={i} className="skel" />)}</div>
  if (!items.length) return <p className="empty">لا توجد منتجات بعد</p>
  return <div className="grid">{items.map((p) => <Card key={p.id} p={p} />)}</div>
}

function Section({ title, to, children }) {
  return (
    <section className="sec">
      <div className="sec-h"><h2>{title}</h2>{to && <Link to={to}>عرض الكل ←</Link>}</div>
      {children}
    </section>
  )
}

function Home() {
  const [feat, setFeat] = useState(null)
  const [apps, setApps] = useState(null)
  const [beds, setBeds] = useState(null)
  useEffect(() => {
    api('/products?featured=1').then((d) => setFeat(d.data.slice(0, 8)))
    api('/products?type=appliance').then((d) => setApps(d.data.slice(0, 4)))
    api('/products?type=bedroom').then((d) => setBeds(d.data.slice(0, 4)))
  }, [])
  return (
    <>
      <section className="hero">
        {/* ضع ملف الفيديو في: user-dashboard/public/hero.mp4 (وصورة اختيارية hero-poster.jpg) */}
        <video className="hero-video" autoPlay muted loop playsInline preload="auto" poster="/hero-poster.jpg">
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay" />
        <div className="wrap hero-in">
          <span className="pill">✨ تشكيلة جديدة وصلت</span>
          <h1>اجعل بيتك <em>أجمل وأريح</em></h1>
          <p>أجهزة كهربائية منزلية وغرف نوم جاهزة بأفضل الأسعار، توصيل لباب بيتك والدفع عند الاستلام.</p>
          <div className="hero-cta">
            <Link to="/shop?type=appliance" className="btn alt lg">تسوق الأجهزة</Link>
            <Link to="/shop?type=bedroom" className="btn out lg">شاهد غرف النوم</Link>
          </div>
        </div>
        <span className="scroll-hint">⌄</span>
      </section>

      <div className="wrap">
        <div className="perks">{PERKS.map(([i, t]) => <div className="perk" key={t}><span>{i}</span>{t}</div>)}</div>

        <section className="sec two">
          <Link to="/shop?type=appliance" className="big a" data-icon="🧊">الأجهزة الكهربائية<small>ثلاجات، غسالات، مكيفات وأكثر</small></Link>
          <Link to="/shop?type=bedroom" className="big b" data-icon="🛏">غرف النوم الجاهزة<small>غرف رئيسية وغرف أطفال كاملة</small></Link>
        </section>

        <Section title="منتجات مميزة" to="/shop"><Grid items={feat} /></Section>
        <Section title="أحدث الأجهزة الكهربائية" to="/shop?type=appliance"><Grid items={apps} /></Section>
        <Section title="غرف نوم جاهزة" to="/shop?type=bedroom"><Grid items={beds} /></Section>
      </div>
    </>
  )
}

function Shop() {
  const [sp, setSp] = useSearchParams()
  const [cats, setCats] = useState([])
  const [data, setData] = useState(null)
  const type = sp.get('type') || '', category = sp.get('category') || '', q = sp.get('q') || '', sort = sp.get('sort') || '', page = sp.get('page') || '1'

  useEffect(() => { api('/categories').then(setCats) }, [])
  useEffect(() => {
    setData(null)
    api('/products?' + new URLSearchParams({ type, category, q, sort, page })).then(setData)
  }, [type, category, q, sort, page])

  const set = (k, v) => {
    const n = new URLSearchParams(sp)
    v ? n.set(k, v) : n.delete(k)
    if (k !== 'page') n.delete('page')
    setSp(n)
  }
  const setType = (t) => { const n = new URLSearchParams(sp); t ? n.set('type', t) : n.delete('type'); n.delete('category'); n.delete('page'); setSp(n) }

  return (
    <div className="wrap shop">
      <aside className="side">
        <h4>النوع</h4>
        <button className={!type ? 'on' : ''} onClick={() => setType('')}>الكل</button>
        <button className={type === 'appliance' ? 'on' : ''} onClick={() => setType('appliance')}>أجهزة كهربائية</button>
        <button className={type === 'bedroom' ? 'on' : ''} onClick={() => setType('bedroom')}>غرف نوم</button>
        <h4>الأقسام</h4>
        {cats.filter((c) => !type || c.type === type).map((c) => (
          <button key={c.id} className={category == c.id ? 'on' : ''} onClick={() => set('category', category == c.id ? '' : c.id)}>{c.name}</button>
        ))}
      </aside>
      <main>
        <div className="bar">
          <select value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="">الأحدث</option>
            <option value="rating">الأعلى تقييماً</option>
            <option value="price_asc">السعر: الأقل أولاً</option>
            <option value="price_desc">السعر: الأعلى أولاً</option>
          </select>
        </div>
        {q && <p className="count">نتائج البحث عن «{q}» <button className="lnk" style={{ color: 'var(--p)' }} onClick={() => set('q', '')}>(مسح)</button></p>}
        {!data ? <Grid items={null} /> : data.data.length === 0 ? <p className="empty">لا توجد منتجات مطابقة</p> : (
          <>
            <p className="count">{data.total} منتج</p>
            <div className="grid">{data.data.map((p) => <Card key={p.id} p={p} />)}</div>
            {data.last_page > 1 && (
              <div className="pager">
                {Array.from({ length: data.last_page }, (_, i) => i + 1).map((i) => (
                  <button key={i} className={i === data.current_page ? 'on' : ''} onClick={() => set('page', i)}>{i}</button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function Reviews({ productId, onChange }) {
  const { user } = useApp()
  const [d, setD] = useState(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => api(`/products/${productId}/reviews`).then(setD)
  useEffect(() => { load() }, [productId])

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!rating) return setErr('اختر عدد النجوم أولاً')
    setBusy(true)
    try {
      await api(`/products/${productId}/reviews`, { method: 'POST', body: { rating, comment } })
      setRating(0); setComment(''); await load(); onChange?.()
    } catch (er) { setErr(er.message) } finally { setBusy(false) }
  }

  if (!d) return null
  const { summary, data } = d
  return (
    <section className="sec" id="reviews">
      <div className="sec-h"><h2>تقييمات الزبائن</h2></div>
      <div className="rev">
        <div className="box sum">
          <div className="avg">{summary.count ? summary.average : '—'}</div>
          <Stars value={summary.average} size={24} />
          <p style={{ color: 'var(--mut)', marginTop: 4 }}>{summary.count} تقييم</p>
          <div className="brk">
            {[5, 4, 3, 2, 1].map((s) => (
              <div key={s}><span>{s}★</span>
                <span className="tr"><span className="fl" style={{ display: 'block', width: summary.count ? (summary.breakdown[s] / summary.count) * 100 + '%' : 0 }} /></span>
                <span>{summary.breakdown[s]}</span></div>
            ))}
          </div>
        </div>
        <div>
          <form className="box" onSubmit={submit} style={{ marginBottom: 16 }}>
            <h3>أضف تقييمك</h3>
            {!user ? (
              <p style={{ marginTop: 8 }}><Link to="/login" state={{ from: '/product/' + productId }} style={{ color: 'var(--p)', fontWeight: 700 }}>سجّل دخولك</Link> لتقييم هذا المنتج.</p>
            ) : (
              <>
                <div className="pick" onMouseLeave={() => {}}>
                  {[1, 2, 3, 4, 5].map((i) => <button type="button" key={i} className={i <= rating ? 'on' : ''} onClick={() => setRating(i)} aria-label={i + ' نجوم'}>★</button>)}
                </div>
                {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
                <textarea rows="3" placeholder="اكتب رأيك بالمنتج (اختياري)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
                <button className="btn" style={{ marginTop: 10 }} disabled={busy}>{busy ? 'جاري الإرسال...' : 'نشر التقييم'}</button>
                <p style={{ color: 'var(--mut)', fontSize: 13, marginTop: 8 }}>إذا قيّمت هذا المنتج سابقاً، تقييمك الجديد بيحل مكان القديم.</p>
              </>
            )}
          </form>
          <div className="box">
            {data.length === 0 ? <p className="empty" style={{ padding: 24 }}>كن أول من يقيّم هذا المنتج</p> : data.map((r) => (
              <div className="rv" key={r.id}>
                <div className="rv-h">
                  <span className="av">{r.name[0]}</span><b>{r.name}</b>
                  <Stars value={r.rating} size={15} />
                  {r.verified && <span className="ver">✓ مشتري موثّق</span>}
                  <span className="date">{new Date(r.created_at).toLocaleDateString('ar-JO')}</span>
                </div>
                {r.comment && <p>{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ProductPage() {
  const { id } = useParams()
  const { add } = useApp()
  const [p, setP] = useState(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [sim, setSim] = useState(null)
  const loadP = () => api('/products/' + id).then(setP).catch(() => setP(false))
  useEffect(() => { setP(null); setQty(1); setAdded(false); setSim(null); loadP() }, [id])
  useEffect(() => {
    if (p && p.category_id) api(`/products?category=${p.category_id}&exclude=${p.id}`).then((d) => setSim(d.data.slice(0, 4)))
  }, [p?.id])

  if (p === false) return <p className="empty">المنتج غير موجود</p>
  if (!p) return <div className="wrap" style={{ padding: '40px 18px' }}><div className="skel" style={{ height: 420 }} /></div>
  const off = p.old_price && Number(p.old_price) > Number(p.price) ? Math.round((1 - p.price / p.old_price) * 100) : 0
  return (
    <div className="wrap">
      <div className="crumbs"><Link to="/">الرئيسية</Link> / <Link to={'/shop?type=' + p.type}>{p.type === 'bedroom' ? 'غرف النوم' : 'الأجهزة الكهربائية'}</Link> / {p.name}</div>
      <div className="pd">
        <div className="pd-img"><img src={p.image_url} alt={p.name} /></div>
        <div>
          <small style={{ color: 'var(--mut)' }}>{p.category?.name}{p.brand ? ' • ' + p.brand : ''}</small>
          <h1>{p.name}</h1>
          <a href="#reviews" className="rate" style={{ fontSize: 15 }}>
            <Stars value={p.reviews_avg_rating} size={18} />
            <span>{p.reviews_count > 0 ? `${Number(p.reviews_avg_rating).toFixed(1)} (${p.reviews_count} تقييم)` : 'لا توجد تقييمات بعد'}</span>
          </a>
          <div className="pr" style={{ margin: '14px 0' }}>
            <span className="big-pr">{money(p.price)}</span>
            {p.old_price && <del>{money(p.old_price)}</del>}
            {off > 0 && <span className="off" style={{ position: 'static' }}>وفّر {off}%</span>}
          </div>
          <p className={p.stock > 0 ? 'stock-ok' : 'stock-no'}>{p.stock > 0 ? (p.stock <= 3 ? `متوفر — بقي ${p.stock} فقط!` : 'متوفر في المخزون') : 'نفدت الكمية'}</p>
          {p.description && <p className="desc">{p.description}</p>}
          {p.stock > 0 && (
            <div className="buy">
              <div className="qty">
                <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button><b>{qty}</b><button onClick={() => setQty(Math.min(p.stock, qty + 1))}>+</button>
              </div>
              <button className="btn lg" onClick={() => { add(p, qty); setAdded(true) }}>🛒 أضف إلى السلة</button>
              {added && <Link to="/cart" className="btn line lg">إتمام الشراء ←</Link>}
            </div>
          )}
          <div className="mini-perks">{PERKS.map(([i, t]) => <div key={t}>{i} {t}</div>)}</div>
        </div>
      </div>
      <Reviews productId={p.id} onChange={loadP} />
      {sim && sim.length > 0 && <Section title="منتجات مشابهة"><Grid items={sim} /></Section>}
    </div>
  )
}

function Cart() {
  const { cart, setQty, remove, total } = useApp()
  if (!cart.length) return <div className="empty"><p style={{ fontSize: 48 }}>🛒</p><p>السلة فارغة</p><br /><Link to="/shop" className="btn">تسوق الآن</Link></div>
  return (
    <div className="wrap sec">
      <div className="sec-h"><h2>سلة المشتريات</h2></div>
      <div className="box" style={{ overflowX: 'auto' }}><table>
        <thead><tr><th></th><th>المنتج</th><th>السعر</th><th>الكمية</th><th>المجموع</th><th></th></tr></thead>
        <tbody>{cart.map((x) => (
          <tr key={x.id}>
            <td><img className="thumb" src={x.image} alt="" /></td><td>{x.name}</td><td>{money(x.price)}</td>
            <td><div className="qty"><button onClick={() => setQty(x.id, x.qty - 1)}>−</button><b>{x.qty}</b><button onClick={() => setQty(x.id, x.qty + 1)}>+</button></div></td>
            <td><b>{money(x.price * x.qty)}</b></td><td><button className="lnk" onClick={() => remove(x.id)} aria-label="حذف">🗑</button></td>
          </tr>))}</tbody>
      </table>
        <h3 style={{ margin: '18px 0' }}>الإجمالي: {money(total)}</h3>
        <Link to="/checkout" className="btn lg">إتمام الطلب</Link>
      </div>
    </div>
  )
}

function Checkout() {
  const { user, cart, total, clear } = useApp()
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', phone: '', city: '', address: '', notes: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (user) setF((o) => ({ ...o, name: o.name || user.name, phone: o.phone || user.phone || '' })) }, [user])
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace state={{ from: '/checkout' }} />
  if (!cart.length) return <Navigate to="/cart" replace />
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      await api('/orders', { method: 'POST', body: { ...f, items: cart.map((x) => ({ product_id: x.id, quantity: x.qty })) } })
      clear(); nav('/orders')
    } catch (er) { setErr(er.message) } finally { setBusy(false) }
  }
  return (
    <form className="wrap form2" onSubmit={submit}>
      <div className="box">
        <h2 style={{ marginBottom: 16 }}>بيانات التوصيل</h2>
        {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
        <div className="fld"><label>الاسم</label><input required value={f.name} onChange={on('name')} /></div>
        <div className="fld"><label>رقم الهاتف (واتساب)</label><input required value={f.phone} onChange={on('phone')} placeholder="07XXXXXXXX" /></div>
        <div className="fld"><label>المدينة</label><input required value={f.city} onChange={on('city')} /></div>
        <div className="fld"><label>العنوان التفصيلي</label><input required value={f.address} onChange={on('address')} /></div>
        <div className="fld"><label>ملاحظات</label><textarea rows="3" value={f.notes} onChange={on('notes')} /></div>
      </div>
      <div className="box">
        <h3 style={{ marginBottom: 12 }}>ملخص الطلب</h3>
        {cart.map((x) => <p key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{x.name} ×{x.qty}</span><span>{money(x.price * x.qty)}</span></p>)}
        <hr style={{ margin: '12px 0', borderColor: 'var(--bd)' }} />
        <h3>الإجمالي: {money(total)}</h3>
        <p style={{ color: 'var(--mut)', margin: '8px 0 16px' }}>💳 الدفع عند الاستلام</p>
        <button className="btn lg" style={{ width: '100%' }} disabled={busy}>{busy ? 'جاري الإرسال...' : 'تأكيد الطلب'}</button>
      </div>
    </form>
  )
}

function Auth({ register }) {
  const { login } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' })
  const [err, setErr] = useState('')
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    try { login(await api(register ? '/register' : '/login', { method: 'POST', body: f })); nav(loc.state?.from || '/') }
    catch (er) { setErr(er.message) }
  }
  return (
    <form className="box form" onSubmit={submit}>
      <h2>{register ? 'إنشاء حساب' : 'تسجيل الدخول'}</h2>
      {err && <div className="err">{err}</div>}
      {register && <input placeholder="الاسم" required value={f.name} onChange={on('name')} />}
      <input type="email" placeholder="البريد الإلكتروني" required value={f.email} onChange={on('email')} />
      {register && <input placeholder="رقم الهاتف" value={f.phone} onChange={on('phone')} />}
      <input type="password" placeholder="كلمة المرور" required value={f.password} onChange={on('password')} />
      <button className="btn lg">{register ? 'تسجيل' : 'دخول'}</button>
      <Link to={register ? '/login' : '/register'} state={loc.state} style={{ color: 'var(--p)', textAlign: 'center', fontWeight: 600 }}>{register ? 'لديك حساب؟ سجّل دخولك' : 'ليس لديك حساب؟ أنشئ حساباً'}</Link>
    </form>
  )
}

function Orders() {
  const [list, setList] = useState(null)
  useEffect(() => { if (localStorage.getItem('token')) api('/orders').then(setList).catch(() => setList([])) }, [])
  useAutoRefresh(() => { if (localStorage.getItem('token')) api('/orders').then(setList).catch(() => {}) })
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace state={{ from: '/orders' }} />
  if (!list) return <p className="empty">جاري التحميل...</p>
  return (
    <div className="wrap sec">
      <div className="sec-h"><h2>طلباتي</h2></div>
      {list.length === 0 && <p className="empty">لا توجد طلبات بعد</p>}
      {list.map((o) => {
        const idx = FLOW.indexOf(o.status)
        return (
          <div className="box" key={o.id} style={{ marginBottom: 14 }}>
            <p style={{ display: 'flex', justifyContent: 'space-between' }}>
              <b>طلب #{o.id}</b><span className={'badge ' + o.status}>{STATUS[o.status]}</span>
            </p>
            <p style={{ color: 'var(--mut)', fontSize: 14 }}>{new Date(o.created_at).toLocaleDateString('ar-JO')} • {o.city} - {o.address}</p>
            {o.status !== 'cancelled' && (
              <div className="steps">{FLOW.map((s, i) => <div key={s} className={i <= idx ? 'done' : ''}>{STATUS[s]}</div>)}</div>
            )}
            {o.items.map((i) => <p key={i.id}>{i.product_name} ×{i.quantity} — {money(i.price * i.quantity)}</p>)}
            <b>الإجمالي: {money(o.total)}</b>
          </div>
        )
      })}
    </div>
  )
}

function Messages() {
  const { refreshMsgs } = useApp()
  const nav = useNavigate()
  const [d, setD] = useState(null)
  const load = () => api('/messages').then((x) => { setD(x); refreshMsgs() })
  useEffect(() => { if (localStorage.getItem('token')) load() }, [])
  useAutoRefresh(() => { if (localStorage.getItem('token')) load() })
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace state={{ from: '/messages' }} />
  if (!d) return <p className="empty">جاري التحميل...</p>

  const open = async (m) => {
    if (!m.read_at) await api(`/messages/${m.id}/read`, { method: 'POST' })
    refreshMsgs()
    nav('/orders')
  }
  const readAll = async () => { await api('/messages/read-all', { method: 'POST' }); load() }

  return (
    <div className="wrap sec">
      <div className="sec-h">
        <h2>رسائلي</h2>
        {d.unread > 0 && <button className="btn sm line" onClick={readAll}>تعليم الكل كمقروء</button>}
      </div>
      {d.data.length === 0 ? (
        <div className="empty"><p style={{ fontSize: 48 }}>📭</p><p>لا توجد رسائل بعد. رح توصلك هون تحديثات طلباتك.</p></div>
      ) : (
        <div className="msgs">
          {d.data.map((m) => (
            <button key={m.id} className={'msg' + (m.read_at ? '' : ' new')} onClick={() => open(m)}>
              <span className="dot" />
              <span className="mb">
                <b>{m.title}</b>
                <span>{m.body}</span>
                <small>{new Date(m.created_at).toLocaleString('ar-JO', { dateStyle: 'medium', timeStyle: 'short' })}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Provider>
        <ScrollTop />
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/messages" element={<Messages />} />
        </Routes>
        <Footer />
        {STORE.whatsapp && <a className="wa" href={'https://wa.me/' + STORE.whatsapp} target="_blank" rel="noreferrer" aria-label="واتساب">💬</a>}
      </Provider>
    </BrowserRouter>
  )
}
