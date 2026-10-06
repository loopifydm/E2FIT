const supabaseClient=window.supabase.createClient(window.E2FIT_SUPABASE_URL,window.E2FIT_SUPABASE_KEY);
const login=document.getElementById("login"),app=document.getElementById("app");let orders=[];
async function isAdmin(){
  const {data:{user}}=await supabaseClient.auth.getUser();if(!user)return false;
  const {data,error}=await supabaseClient.from("profiles").select("role").eq("id",user.id).maybeSingle();
  return !error&&data?.role==="admin";
}
async function boot(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session){showLogin();return;}
  if(!(await isAdmin())){await supabaseClient.auth.signOut();showLogin("This account does not have E2FIT admin access.");return;}
  showApp();await refresh();
}
function showLogin(message=""){login.classList.remove("hidden");app.classList.add("hidden");if(message)document.getElementById("loginError").textContent=message;}
function showApp(){login.classList.add("hidden");app.classList.remove("hidden");}
document.getElementById("loginBtn").onclick=async()=>{
  const email=document.getElementById("adminEmail").value.trim(),password=document.getElementById("adminPass").value,errorBox=document.getElementById("loginError");
  errorBox.textContent="";if(!email||!password){errorBox.textContent="Enter your admin email and password.";return;}
  const button=document.getElementById("loginBtn");button.disabled=true;button.textContent="Signing in…";
  const {error}=await supabaseClient.auth.signInWithPassword({email,password});
  button.disabled=false;button.textContent="Sign in →";
  if(error){errorBox.textContent=error.message;return;}
  if(!(await isAdmin())){await supabaseClient.auth.signOut();errorBox.textContent="Signed in, but this account is not an E2FIT admin.";return;}
  showApp();await refresh();
};
document.getElementById("logout").onclick=async()=>{await supabaseClient.auth.signOut();location.reload();};
async function refresh(){await generateToday();await loadOrders();await loadCustomers();}
async function generateToday(){const {error}=await supabaseClient.rpc("e2fit_generate_today_deliveries");if(error)console.warn("Delivery generation:",error.message);}
async function loadOrders(){
  const today=new Date().toISOString().slice(0,10);
  const {data,error}=await supabaseClient.from("e2fit_deliveries").select("*, e2fit_customers(name,phone,address)").eq("delivery_date",today).order("delivery_time",{ascending:true}).order("created_at",{ascending:false});
  if(error){console.error(error);alert("Could not load deliveries: "+error.message);return;}orders=data||[];render();
}
async function loadCustomers(){
  const {data,error}=await supabaseClient.from("e2fit_subscriptions").select("id,box,plan,delivery_time,status,start_date,end_date,e2fit_customers(name,phone)").eq("status","active").order("created_at",{ascending:false});
  if(error){console.error(error);return;}
  document.getElementById("customerRows").innerHTML=(data||[]).map(s=>{const c=s.e2fit_customers||{};return "<tr><td><strong>"+escapeHtml(c.name||"—")+"</strong><small>"+escapeHtml(c.phone||"")+"</small></td><td>"+escapeHtml(s.box)+"</td><td>"+escapeHtml(s.plan)+"</td><td>"+escapeHtml(s.delivery_time)+"</td><td><span class='pill Active'>Active</span></td></tr>";}).join("")||"<tr><td colspan='5'>No active subscriptions yet.</td></tr>";
}
function render(){
  const filter=document.getElementById("filter").value,visible=filter==="All"?orders:orders.filter(o=>o.status===filter);
  document.getElementById("total").textContent=orders.length;document.getElementById("preparing").textContent=orders.filter(o=>o.status==="Preparing").length;
  document.getElementById("out").textContent=orders.filter(o=>o.status==="Out for Delivery").length;document.getElementById("delivered").textContent=orders.filter(o=>o.status==="Delivered").length;
  document.getElementById("orders").innerHTML=visible.map(o=>{
    const c=o.e2fit_customers||{},next=o.status==="Pending"?"Preparing":o.status==="Preparing"?"Out for Delivery":o.status==="Out for Delivery"?"Delivered":null;
    return "<div class='order'><div class='customer'><strong>"+escapeHtml(c.name||"Customer")+"</strong><small>"+escapeHtml(c.phone||"")+" · "+escapeHtml(o.address||c.address||"")+"</small></div><div><strong>"+escapeHtml(o.box)+"</strong><div class='muted'>"+escapeHtml(o.delivery_time)+"</div></div><div><strong>"+escapeHtml(o.status)+"</strong><div class='muted'>"+escapeHtml(o.delivery_date)+"</div></div><div class='status-action'><span class='pill "+statusClass(o.status)+"'>"+escapeHtml(o.status)+"</span> "+(next?"<button class='status-btn' onclick=\"advance('"+o.id+"','"+next+"')\">Next →</button>":"")+"</div></div>";
  }).join("")||"<div style='padding:30px;color:#879189'>No deliveries found.</div>";
}
function statusClass(status){return status==="Out for Delivery"?"Out":status.replaceAll(" ","");}
async function advance(id,next){const {error}=await supabaseClient.from("e2fit_deliveries").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);if(error){alert("Could not update delivery: "+error.message);return;}await loadOrders();}
document.getElementById("filter").onchange=render;
const modal=document.getElementById("orderModal");document.getElementById("newOrder").onclick=()=>modal.classList.remove("hidden");document.getElementById("closeModal").onclick=()=>modal.classList.add("hidden");
document.getElementById("saveOrder").onclick=async()=>{
  const button=document.getElementById("saveOrder"),name=document.getElementById("name").value.trim(),phone=document.getElementById("phone").value.trim(),box=document.getElementById("box").value,plan=document.getElementById("plan").value,delivery=document.getElementById("delivery").value,address=document.getElementById("address").value.trim();
  if(!name||!phone||!address){alert("Name, phone and address are required.");return;}button.disabled=true;button.textContent="Saving…";
  try{
    const prices={"Mixed Box":[60,1499],"Medium Box":[80,1999],"Premium Box":[100,2499],"Premium Pro Box":[120,2999]},today=new Date().toISOString().slice(0,10);
    const {data:customer,error:e1}=await supabaseClient.from("e2fit_customers").insert({name,phone,address}).select("id").single();if(e1)throw e1;
    const {data:subscription,error:e2}=await supabaseClient.from("e2fit_subscriptions").insert({customer_id:customer.id,box,plan,daily_price:prices[box][0],monthly_price:prices[box][1],start_date:today,end_date:plan==="Monthly"?new Date(Date.now()+25*86400000).toISOString().slice(0,10):today,delivery_time:delivery}).select("id").single();if(e2)throw e2;
    const {error:e3}=await supabaseClient.from("e2fit_deliveries").insert({customer_id:customer.id,subscription_id:subscription.id,delivery_date:today,delivery_time:delivery,box,address});if(e3)throw e3;
    modal.classList.add("hidden");document.querySelectorAll("#orderModal input").forEach(i=>i.value="");await refresh();
  }catch(error){alert("Could not save order: "+error.message);}finally{button.disabled=false;button.textContent="Save Order";}
};
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
boot();