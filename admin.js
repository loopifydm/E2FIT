const supabaseClient=window.supabase.createClient(window.E2FIT_SUPABASE_URL,window.E2FIT_SUPABASE_KEY);
const login=document.getElementById("login"),app=document.getElementById("app");
let orders=[];

async function isAdmin(){
  const {data:{user}}=await supabaseClient.auth.getUser();
  if(!user)return false;
  const {data,error}=await supabaseClient.from("profiles").select("role").eq("id",user.id).maybeSingle();
  return !error&&data?.role==="admin";
}
function showLogin(message=""){login.classList.remove("hidden");app.classList.add("hidden");document.getElementById("loginError").textContent=message;}
function showApp(){login.classList.add("hidden");app.classList.remove("hidden");}
async function boot(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session){showLogin();return;}
  if(!(await isAdmin())){await supabaseClient.auth.signOut();showLogin("This account does not have E2FIT admin access.");return;}
  showApp();await refresh();
}

document.getElementById("loginBtn").addEventListener("click",signIn);
document.getElementById("adminPass").addEventListener("keydown",e=>{if(e.key==="Enter")signIn();});
async function signIn(){
  const username=document.getElementById("adminEmail").value.trim();
  const password=document.getElementById("adminPass").value;
  const errorBox=document.getElementById("loginError");
  if(!username||!password){errorBox.textContent="Enter your username and password.";return;}
  const button=document.getElementById("loginBtn");
  button.disabled=true;button.textContent="Signing in…";errorBox.textContent="";
  try{
    const email=username.toLowerCase()==="admin"?"admin@e2fit.local":username;
    const {error}=await supabaseClient.auth.signInWithPassword({email,password});
    if(error)throw error;
    if(!(await isAdmin())){await supabaseClient.auth.signOut();throw new Error("Signed in, but this account is not an E2FIT admin.");}
    showApp();await refresh();
  }catch(error){console.error(error);errorBox.textContent=error.message||"Unable to sign in.";}
  finally{button.disabled=false;button.textContent="Sign in →";}
}
document.getElementById("logout").addEventListener("click",async()=>{await supabaseClient.auth.signOut();location.reload();});

function monthlyEndDate(startDate){let d=new Date(startDate+"T00:00:00"),count=0;while(count<26){if(d.getDay()!==0)count++;if(count<26)d.setDate(d.getDate()+1);}return d.toISOString().slice(0,10);}
function weeklyEndDate(startDate){let d=new Date(startDate+"T00:00:00"),count=0;while(count<6){if(d.getDay()!==0)count++;if(count<6)d.setDate(d.getDate()+1);}return d.toISOString().slice(0,10);}
async function refresh(){await generateToday();await loadOrders();await loadCustomers();await loadSubscriptions();await loadMenu();}
async function generateToday(){const {error}=await supabaseClient.rpc("e2fit_generate_today_deliveries");if(error)console.warn(error.message);}
async function loadOrders(){
  const today=new Date().toISOString().slice(0,10);
  const {data,error}=await supabaseClient.from("e2fit_deliveries").select("*, e2fit_customers(name,phone,address)").eq("delivery_date",today).order("delivery_time").order("created_at",{ascending:false});
  if(error){console.error(error);alert("Could not load deliveries: "+error.message);return;}
  orders=data||[];render();
}
async function loadCustomers(){
  const {data,error}=await supabaseClient.from("e2fit_subscriptions").select("id,customer_id,box,plan,delivery_time,status,start_date,end_date,e2fit_customers(name,phone)").eq("status","active").order("created_at",{ascending:false});
  if(error){console.error(error);return;}
  document.getElementById("customerRows").innerHTML=(data||[]).map(s=>{const c=s.e2fit_customers||{};return `<tr><td><strong>${escapeHtml(c.name||"—")}</strong><small>${escapeHtml(c.phone||"")}</small></td><td>${escapeHtml(s.box)}</td><td>${escapeHtml(s.plan)}</td><td>${escapeHtml(s.delivery_time)}</td><td><span class="pill Active">Active</span></td><td><button class="status-btn" onclick="deleteCustomer('${s.customer_id}')">Delete</button></td></tr>`;}).join("")||"<tr><td colspan='6'>No active subscriptions yet.</td></tr>";
}
async function loadMenu(){
  const {data,error}=await supabaseClient.from("e2fit_weekly_menu").select("id,day_name,breakfast,lunch,sort_order").order("sort_order");
  if(error){console.error(error);document.getElementById("menuRows").innerHTML="<tr><td colspan='3'>Could not load weekly menu.</td></tr>";return;}
  document.getElementById("menuRows").innerHTML=(data||[]).map(row=>`<tr><td><strong>${escapeHtml(row.day_name)}</strong></td><td><input class="menu-input" data-id="${row.id}" data-field="breakfast" value="${escapeHtml(row.breakfast)}"></td><td><input class="menu-input" data-id="${row.id}" data-field="lunch" value="${escapeHtml(row.lunch)}"></td></tr>`).join("");
}
async function saveMenu(){
  const button=document.getElementById("saveMenu");
  const inputs=[...document.querySelectorAll(".menu-input")];
  const grouped={};
  inputs.forEach(input=>{grouped[input.dataset.id]??={id:input.dataset.id};grouped[input.dataset.id][input.dataset.field]=input.value.trim();});
  button.disabled=true;button.textContent="Saving…";
  try{
    for(const row of Object.values(grouped)){
      const {error}=await supabaseClient.from("e2fit_weekly_menu").update({breakfast:row.breakfast||"",lunch:row.lunch||"",updated_at:new Date().toISOString()}).eq("id",row.id);
      if(error)throw error;
    }
    button.textContent="Saved ✓";
    setTimeout(()=>{button.textContent="Save Menu";},1500);
  }catch(error){console.error(error);alert("Could not save weekly menu: "+(error.message||"Unknown error"));button.textContent="Save Menu";}
  finally{button.disabled=false;}
}

async function loadSubscriptions(){
  const {data,error}=await supabaseClient.from("e2fit_subscriptions").select("id,box,plan,delivery_time,status,start_date,end_date,e2fit_customers(name,phone)").order("created_at",{ascending:false});
  if(error){console.error(error);return;}
  document.getElementById("subscriptionRows").innerHTML=(data||[]).map(s=>{const c=s.e2fit_customers||{};return "<tr><td><strong>"+escapeHtml(c.name||"—")+"</strong><small>"+escapeHtml(c.phone||"")+"</small></td><td>"+escapeHtml(s.box)+"</td><td>"+escapeHtml(s.plan)+"</td><td>"+escapeHtml(s.delivery_time)+"</td><td>"+escapeHtml(s.start_date)+"</td><td>"+escapeHtml(s.end_date)+"</td><td><span class='pill "+escapeHtml(s.status)+"'>"+escapeHtml(s.status)+"</span></td></tr>";}).join("")||"<tr><td colspan='7'>No subscriptions yet.</td></tr>";
}
function render(){
  const filter=document.getElementById("filter").value,visible=filter==="All"?orders:orders.filter(o=>o.status===filter);
  document.getElementById("total").textContent=orders.length;
  document.getElementById("preparing").textContent=orders.filter(o=>o.status==="Preparing").length;
  document.getElementById("out").textContent=orders.filter(o=>o.status==="Out for Delivery").length;
  document.getElementById("delivered").textContent=orders.filter(o=>o.status==="Delivered").length;
  document.getElementById("orders").innerHTML=visible.map(o=>{const c=o.e2fit_customers||{},next=o.status==="Pending"?"Preparing":o.status==="Preparing"?"Out for Delivery":o.status==="Out for Delivery"?"Delivered":null;return `<div class="order"><div class="customer"><strong>${escapeHtml(c.name||"Customer")}</strong><small>${escapeHtml(c.phone||"")} · ${escapeHtml(o.address||c.address||"")}</small></div><div><strong>${escapeHtml(o.box)}</strong><div class="muted">${escapeHtml(o.delivery_time)}</div></div><div><strong>${escapeHtml(o.status)}</strong><div class="muted">${escapeHtml(o.delivery_date)}</div></div><div class="status-action"><span class="pill ${statusClass(o.status)}">${escapeHtml(o.status)}</span> ${next?`<button class="status-btn" onclick="advance('${o.id}','${next}')">Next →</button>`:""}</div></div>`;}).join("")||"<div style='padding:30px;color:#879189'>No deliveries found.</div>";
}
function statusClass(status){return status==="Out for Delivery"?"Out":status.replaceAll(" ","");}
async function advance(id,next){const {error}=await supabaseClient.from("e2fit_deliveries").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);if(error){alert("Could not update delivery: "+error.message);return;}await loadOrders();}
async function deleteCustomer(id){if(!id||!confirm("Delete this customer and all their subscriptions and deliveries?"))return;const {error}=await supabaseClient.from("e2fit_customers").delete().eq("id",id);if(error){alert("Could not delete customer: "+error.message);return;}await refresh();}

document.getElementById("filter").addEventListener("change",render);
const modal=document.getElementById("orderModal");
document.getElementById("newOrder").addEventListener("click",()=>modal.classList.remove("hidden"));
document.getElementById("closeModal").addEventListener("click",()=>modal.classList.add("hidden"));
document.getElementById("saveOrder").addEventListener("click",saveOrder);
document.getElementById("saveMenu").addEventListener("click",saveMenu);
async function saveOrder(){
  const fields={name:document.getElementById("name"),phone:document.getElementById("phone"),box:document.getElementById("box"),plan:document.getElementById("plan"),delivery:document.getElementById("delivery"),address:document.getElementById("address")};
  const button=document.getElementById("saveOrder");
  const name=fields.name.value.trim(),phone=fields.phone.value.trim(),box=fields.box.value,planLabel=fields.plan.value,plan=planLabel.startsWith("Weekly")?"Weekly":planLabel.startsWith("Monthly")?"Monthly":"Daily",delivery=fields.delivery.value,address=fields.address.value.trim();
  if(!name||!phone||!address){alert("Name, phone and address are required.");return;}
  button.disabled=true;button.textContent="Saving…";
  try{
    const prices={"Mixed Box":[60,1499],"Medium Box":[80,1999],"Premium Box":[100,2499],"Premium Pro Box":[120,2999]},today=new Date().toISOString().slice(0,10);
    const {data:customer,error:e1}=await supabaseClient.from("e2fit_customers").insert({name,phone,address}).select("id").single();if(e1)throw e1;
    const end=plan==="Monthly"?monthlyEndDate(today):plan==="Weekly"?weeklyEndDate(today):today;
    const {data:subscription,error:e2}=await supabaseClient.from("e2fit_subscriptions").insert({customer_id:customer.id,box,plan,daily_price:prices[box][0],monthly_price:prices[box][1],start_date:today,end_date:end,delivery_time:delivery}).select("id").single();if(e2)throw e2;
    const {error:e3}=await supabaseClient.from("e2fit_deliveries").insert({customer_id:customer.id,subscription_id:subscription.id,delivery_date:today,delivery_time:delivery,box,address});if(e3)throw e3;
    modal.classList.add("hidden");fields.name.value="";fields.phone.value="";fields.address.value="";await refresh();
  }catch(error){console.error(error);alert("Could not save order: "+(error.message||"Unknown error"));}finally{button.disabled=false;button.textContent="Save Order";}
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
document.querySelectorAll("aside nav a").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();const target=document.querySelector(a.getAttribute("href"));if(target){document.querySelectorAll("aside nav a").forEach(x=>x.classList.remove("active"));a.classList.add("active");target.scrollIntoView({behavior:"smooth",block:"start"});}}));
boot();