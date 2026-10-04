// CafeQueue – simple café order board (data saved in LocalStorage)
const KEY = "cafequeue-data";
const STAGES = ["New","Preparing","Ready","Completed"];
const money = n => "₱" + n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtTime = iso => new Date(iso).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});

function sampleData(){
  const menu = [
    { id:1, name:"Caffe Latte", category:"Coffee", price:140 },
    { id:2, name:"Americano", category:"Coffee", price:110 },
    { id:3, name:"Cappuccino", category:"Coffee", price:140 },
    { id:4, name:"Matcha Latte", category:"Non-Coffee", price:150 },
    { id:5, name:"Iced Chocolate", category:"Non-Coffee", price:130 },
    { id:6, name:"Croissant", category:"Pastry", price:95 },
    { id:7, name:"Blueberry Muffin", category:"Pastry", price:85 },
    { id:8, name:"Club Sandwich", category:"Snack", price:165 }
  ];
  const now = Date.now();
  const mk = (id, table, items, stage, minsAgo) => ({
    id, table, stage,
    items: items.map(([name, qty]) => ({ name, qty, price: menu.find(m=>m.name===name).price })),
    time: new Date(now - minsAgo*60000).toISOString()
  });
  const orders = [
    mk(1,"Table 2",[["Caffe Latte",2],["Croissant",1]],"New",2),
    mk(2,"Table 5",[["Americano",1]],"Preparing",6),
    mk(3,"Mika (pickup)",[["Matcha Latte",1],["Blueberry Muffin",2]],"Preparing",9),
    mk(4,"Table 1",[["Cappuccino",1],["Club Sandwich",1]],"Ready",14),
    mk(5,"Table 3",[["Iced Chocolate",2]],"Completed",40),
    mk(6,"Table 4",[["Caffe Latte",1],["Blueberry Muffin",1]],"Completed",55)
  ];
  return { menu, orders };
}
function loadData(){
  try{ const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.menu) && Array.isArray(s.orders)) return s; }catch(e){}
  const fresh = sampleData(); localStorage.setItem(KEY, JSON.stringify(fresh)); return fresh;
}
let data = loadData();
const save = () => localStorage.setItem(KEY, JSON.stringify(data));
const nextId = list => list.reduce((m,x)=>Math.max(m,x.id),0)+1;
const orderTotal = o => o.items.reduce((s,i)=>s+i.qty*i.price,0);

const $ = id => document.getElementById(id);
const esc = t => { const d=document.createElement("div"); d.textContent=t??""; return d.innerHTML; };
let toastTimer;
function toast(msg){ $("toast").textContent=msg; $("toast").classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2200); }

document.querySelectorAll(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".nav-btn,.view").forEach(el=>el.classList.remove("active"));
  btn.classList.add("active"); $(btn.dataset.view).classList.add("active");
}));

// ---------- Order board ----------
function renderStats(){
  const todayOrders = data.orders.length;
  const inQueue = data.orders.filter(o=>o.stage==="New"||o.stage==="Preparing").length;
  const ready = data.orders.filter(o=>o.stage==="Ready").length;
  const sales = data.orders.filter(o=>o.stage==="Completed").reduce((s,o)=>s+orderTotal(o),0);
  $("stats").innerHTML = [["Today's Orders",todayOrders],["In Queue",inQueue],["Ready",ready],["Today's Sales",money(sales)]]
    .map(([l,n])=>`<div class="card"><span>${l}</span><strong>${n}</strong></div>`).join("");
}

function renderBoard(){
  const q = $("searchOrder").value.trim().toLowerCase();
  STAGES.forEach(stage=>{
    const orders = data.orders.filter(o=>o.stage===stage && (o.table.toLowerCase().includes(q) || String(o.id).includes(q)))
      .sort((a,b)=>new Date(a.time)-new Date(b.time));
    $("c"+stage).textContent = orders.length;
    $("col"+stage).innerHTML = orders.length ? orders.map(o=>{
      const itemsText = o.items.map(i=>`${i.qty}× ${esc(i.name)}`).join(", ");
      const nextStage = STAGES[STAGES.indexOf(stage)+1];
      return `<div class="ticket">
        <div class="t-head"><span>#${o.id} · ${esc(o.table)}</span></div>
        <div class="t-items">${itemsText}</div>
        <div class="t-total">${money(orderTotal(o))}</div>
        <div class="t-time">${fmtTime(o.time)}</div>
        <div class="tools">
          ${nextStage ? `<button class="small" data-advance="${o.id}">${nextStage==="Preparing"?"Start preparing":nextStage==="Ready"?"Mark ready":"Mark served"}</button>` : ""}
          <button class="small del" data-del="${o.id}">Delete</button>
        </div>
      </div>`;
    }).join("") : `<p class="empty">No orders here.</p>`;
  });
}

document.querySelectorAll(".col-body").forEach(col=>col.addEventListener("click", e=>{
  const t = e.target;
  if (t.dataset.advance){
    const o = data.orders.find(x=>x.id==t.dataset.advance);
    const next = STAGES[STAGES.indexOf(o.stage)+1];
    if (next){ o.stage = next; save(); renderAll(); toast(`Order #${o.id} moved to ${next}`); }
  }
  if (t.dataset.del && confirm("Delete this order?")){
    data.orders = data.orders.filter(x=>x.id!=t.dataset.del);
    save(); renderAll(); toast("Order deleted");
  }
}));
$("searchOrder").addEventListener("input", renderBoard);

// ---------- New order modal ----------
function buildItemPicker(){
  $("itemPicker").innerHTML = data.menu.map(m=>`
    <div class="pick-row">
      <span class="pname">${esc(m.name)}</span>
      <span class="pprice">${money(m.price)}</span>
      <input type="number" min="0" value="0" data-qty="${m.id}" aria-label="Quantity of ${esc(m.name)}">
    </div>`).join("");
  $("itemPicker").querySelectorAll("input").forEach(i=>i.addEventListener("input", updateOrderTotal));
  updateOrderTotal();
}
function updateOrderTotal(){
  let total = 0;
  $("itemPicker").querySelectorAll("input").forEach(inp=>{
    const item = data.menu.find(m=>m.id==inp.dataset.qty);
    total += (parseInt(inp.value)||0) * item.price;
  });
  $("o_total").textContent = money(total);
}
$("addOrderBtn").addEventListener("click", ()=>{
  if (data.menu.length===0) return toast("Add a menu item first");
  $("o_table").value = "";
  buildItemPicker();
  $("orderModal").hidden = false; $("o_table").focus();
});

$("orderForm").addEventListener("submit", e=>{
  e.preventDefault();
  const table = $("o_table").value.trim();
  if (!table) return toast("Please enter a table or customer name");
  const items = [];
  $("itemPicker").querySelectorAll("input").forEach(inp=>{
    const qty = parseInt(inp.value) || 0;
    if (qty > 0){ const m = data.menu.find(x=>x.id==inp.dataset.qty); items.push({ name:m.name, qty, price:m.price }); }
  });
  if (items.length===0) return toast("Select at least one item");
  data.orders.push({ id: nextId(data.orders), table, stage:"New", items, time: new Date().toISOString() });
  save(); closeModals(); renderAll(); toast("Order placed");
});

// ---------- Menu ----------
let editingItemId = null;
function renderMenu(){
  $("menuGrid").innerHTML = data.menu.length ? data.menu.map(m=>`
    <div class="menu-item">
      <span class="badge">${m.category}</span>
      <h3>${esc(m.name)}</h3>
      <div class="price">${money(m.price)}</div>
      <div class="tools">
        <button class="small" data-edit-item="${m.id}">Edit</button>
        <button class="small del" data-del-item="${m.id}">Delete</button>
      </div>
    </div>`).join("") : `<p class="empty">No menu items yet. Add one to start taking orders.</p>`;
}
function openItemForm(item){
  editingItemId = item ? item.id : null;
  $("itemTitle").textContent = item ? "Edit Item" : "Add Item";
  $("i_name").value = item ? item.name : "";
  $("i_category").value = item ? item.category : "Coffee";
  $("i_price").value = item ? item.price : "";
  $("itemModal").hidden = false; $("i_name").focus();
}
$("addItemBtn").addEventListener("click", ()=>openItemForm());
$("menuGrid").addEventListener("click", e=>{
  const t = e.target;
  if (t.dataset.editItem) openItemForm(data.menu.find(m=>m.id==t.dataset.editItem));
  if (t.dataset.delItem){
    if (!confirm("Delete this menu item?")) return;
    data.menu = data.menu.filter(m=>m.id!=t.dataset.delItem);
    save(); renderAll(); toast("Item deleted");
  }
});
$("itemForm").addEventListener("submit", e=>{
  e.preventDefault();
  const name = $("i_name").value.trim();
  const price = parseFloat($("i_price").value);
  if (!name) return toast("Please enter an item name");
  if (!(price >= 0)) return toast("Enter a valid price");
  const values = { name, category: $("i_category").value, price };
  if (editingItemId){ Object.assign(data.menu.find(m=>m.id===editingItemId), values); toast("Item updated"); }
  else { data.menu.push({ id: nextId(data.menu), ...values }); toast("Item added"); }
  save(); closeModals(); renderAll();
});

// ---------- Modal helpers ----------
function closeModals(){ document.querySelectorAll(".modal").forEach(m=>m.hidden=true); editingItemId=null; }
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click", closeModals));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click", e=>{ if(e.target===m) closeModals(); }));
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModals(); });

function renderAll(){ renderStats(); renderBoard(); renderMenu(); }
renderAll();
