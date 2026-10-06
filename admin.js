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
async function refresh(){await generateToday();await loadOrders();await loadCustomers();await loadSubscriptions();await loadInvoices();}
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

const invoicePrices={"Mixed Box":{Daily:60,Weekly:360,Monthly:1499},"Medium Box":{Daily:80,Weekly:480,Monthly:1999},"Premium Box":{Daily:100,Weekly:600,Monthly:2499},"Premium Pro Box":{Daily:120,Weekly:720,Monthly:2999}};
async function loadInvoices(){
  const {data,error}=await supabaseClient.from("e2fit_invoices").select("*").order("created_at",{ascending:false});
  if(error){console.error(error);return;}
  document.getElementById("invoiceRows").innerHTML=(data||[]).map(i=>`<tr><td><strong>${escapeHtml(i.invoice_number)}</strong></td><td>${escapeHtml(i.customer_name)}<small>${escapeHtml(i.phone||"")}</small></td><td>${escapeHtml(i.box)} · ${escapeHtml(i.plan)}</td><td>₹${Number(i.amount||0).toLocaleString("en-IN")}</td><td>${escapeHtml(i.invoice_date)}</td><td><button class="status-btn" onclick="editInvoice('${i.id}')">Edit</button> <button class="status-btn" onclick="printSavedInvoice('${i.id}')">Print</button> <button class="status-btn" onclick="deleteInvoice('${i.id}')">Delete</button></td></tr>`).join("")||"<tr><td colspan='6'>No invoices generated yet.</td></tr>";
}
let editingInvoiceId=null,editingInvoiceNumber=null;
async function editInvoice(id){
  const {data,error}=await supabaseClient.from("e2fit_invoices").select("*").eq("id",id).single();if(error){alert(error.message);return;}
  editingInvoiceId=id;editingInvoiceNumber=data.invoice_number;
  document.getElementById("invoiceCustomer").value=data.customer_name||"";document.getElementById("invoicePhone").value=data.phone||"";document.getElementById("invoiceAddress").value=data.address||"";document.getElementById("invoiceBox").value=data.box||"Mixed Box";document.getElementById("invoicePlan").value=data.plan==="Weekly"?"Weekly (6 days)":data.plan==="Monthly"?"Monthly (26 days)":"Daily";document.getElementById("invoiceAmount").value=data.amount;document.getElementById("invoiceStartDate").value=data.start_date||data.invoice_date;document.getElementById("invoiceEndDate").value=data.end_date||data.invoice_date;document.getElementById("invoiceAdvance").value=data.advance_amount||0;document.getElementById("invoiceBalance").value=data.balance_amount??Math.max(0,Number(data.amount||0)-Number(data.advance_amount||0));updateInvoiceBalance();document.getElementById("invoiceDate").value=data.invoice_date;updateInvoiceAmount();
  document.getElementById("generateInvoice").textContent="Update Invoice";document.getElementById("invoices").scrollIntoView({behavior:"smooth"});await renderInvoice(data.invoice_number);
}
async function renderInvoice(invoiceNoOverride){
  const name=document.getElementById("invoiceCustomer").value.trim(),phone=document.getElementById("invoicePhone").value.trim(),address=document.getElementById("invoiceAddress").value.trim(),box=document.getElementById("invoiceBox").value,plan=document.getElementById("invoicePlan").value,startDate=document.getElementById("invoiceStartDate").value,endDate=document.getElementById("invoiceEndDate").value,amount=Number(document.getElementById("invoiceAmount").value||0),advance=Number(document.getElementById("invoicePaid")?.checked?amount:document.getElementById("invoiceAdvance").value||0),balance=Math.max(0,amount-advance),date=document.getElementById("invoiceDate").value||new Date().toISOString().slice(0,10);
  if(!name)return;
  const planKey=invoicePlanKey(),invoiceNo=invoiceNoOverride||await invoiceNumber();document.getElementById("invoiceBalance").value=balance;
  document.getElementById("invoicePreview").innerHTML=`<div class="invoice-paper"><div class="invoice-brand"><div><img class="invoice-logo-img" src="https://loopifydm.github.io/E2FIT/assets/e2fit-logo.jpg" alt="E2FIT"><small>Fresh. Healthy. Better Every Day.</small></div><div class="invoice-meta"><strong>INVOICE</strong><span>${escapeHtml(invoiceNo)}</span><span>${escapeHtml(date)}</span></div></div><div class="invoice-customer"><div><small>BILL TO</small><strong>${escapeHtml(name)}</strong><span>${escapeHtml(phone)}</span><span>${escapeHtml(address)}</span></div></div><table class="invoice-table"><thead><tr><th>Description</th><th>Plan</th><th class="amount">Amount</th></tr></thead><tbody><tr><td>${escapeHtml(box)}</td><td>${escapeHtml(planKey)}</td><td class="amount">₹${amount.toLocaleString("en-IN")}</td></tr></tbody></table><div class="invoice-period"><strong>Plan Period:</strong> ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</div><div class="invoice-total invoice-payment"><div><span>Total Amount</span><strong>₹${amount.toLocaleString("en-IN")}</strong></div><div><span>Advance Amount</span><strong>₹${advance.toLocaleString("en-IN")}</strong></div><div><span>Balance Amount</span><strong>₹${balance.toLocaleString("en-IN")}</strong></div><div><span>Payment Status</span><strong>${balance===0?"FULLY PAID":"PARTIALLY PAID"}</strong></div></div><div class="invoice-footer">Thank you for choosing E2FIT.<br>Gandhi Park, Coimbatore · Free delivery up to 5 km</div></div>`;
}
async function deleteInvoice(id){if(!confirm("Delete this invoice? This cannot be undone."))return;const {error}=await supabaseClient.from("e2fit_invoices").delete().eq("id",id);if(error){alert("Could not delete invoice: "+error.message);return;}if(editingInvoiceId===id){editingInvoiceId=null;editingInvoiceNumber=null;}await loadInvoices();}
async function printSavedInvoice(id){await editInvoice(id);setTimeout(()=>printInvoice(),200);}

function invoicePlanKey(){const v=document.getElementById("invoicePlan").value;return v.startsWith("Weekly")?"Weekly":v.startsWith("Monthly")?"Monthly":"Daily";}
function planEndDate(startDate,plan){if(!startDate)return "";if(plan==="Daily")return startDate;let d=new Date(startDate+"T00:00:00"),count=0,target=plan==="Weekly"?6:26;while(count<target){if(d.getDay()!==0)count++;if(count<target)d.setDate(d.getDate()+1);}return d.toISOString().slice(0,10);}
function updateInvoicePlanDates(){const start=document.getElementById("invoiceStartDate"),end=document.getElementById("invoiceEndDate");if(!start||!end)return;if(!start.value)start.value=new Date().toISOString().slice(0,10);end.value=planEndDate(start.value,invoicePlanKey());}
function updateInvoiceAmount(){const box=document.getElementById("invoiceBox").value;document.getElementById("invoiceAmount").value=invoicePrices[box][invoicePlanKey()];updateInvoiceBalance();}document.getElementById("invoicePaid")?.addEventListener("change",()=>updateInvoiceBalance());function updateInvoiceBalance(){const total=Number(document.getElementById("invoiceAmount").value||0),paid=document.getElementById("invoicePaid")?.checked||false,advance=paid?total:Number(document.getElementById("invoiceAdvance").value||0);document.getElementById("invoiceAdvance").value=advance;document.getElementById("invoiceBalance").value=Math.max(0,total-advance);}
async function invoiceNumber(){const {data,error}=await supabaseClient.rpc("e2fit_next_invoice_number");if(error)throw error;return data;}
async function generateInvoice(){
  const name=document.getElementById("invoiceCustomer").value.trim(),phone=document.getElementById("invoicePhone").value.trim(),address=document.getElementById("invoiceAddress").value.trim(),box=document.getElementById("invoiceBox").value,plan=document.getElementById("invoicePlan").value,amount=Number(document.getElementById("invoiceAmount").value||0),advance=Number(document.getElementById("invoiceAdvance").value||0),balance=Math.max(0,amount-advance),date=document.getElementById("invoiceDate").value||new Date().toISOString().slice(0,10);
  if(!name){alert("Enter the customer name.");return;}
  const planKey=invoicePlanKey();
  let result,invoiceNo;
  if(editingInvoiceId){
    invoiceNo=editingInvoiceNumber;
    const payload={customer_name:name,phone,address,box,plan:planKey,amount,advance_amount:advance,balance_amount:balance,invoice_date:date,start_date:startDate,end_date:endDate,updated_at:new Date().toISOString()};
    result=await supabaseClient.from("e2fit_invoices").update(payload).eq("id",editingInvoiceId);
    if(!result.error){await renderInvoice(invoiceNo);await loadInvoices();}
    if(result.error){alert("Could not update invoice: "+result.error.message);return;}
    editingInvoiceId=null;editingInvoiceNumber=null;
    document.getElementById("generateInvoice").textContent="Generate Invoice";
    return;
  }
  try{invoiceNo=await invoiceNumber();}catch(error){alert("Could not generate invoice number: "+error.message);return;}
  const payload={invoice_number:invoiceNo,customer_name:name,phone,address,box,plan:planKey,amount,advance_amount:advance,balance_amount:balance,invoice_date:date,start_date:startDate,end_date:endDate,updated_at:new Date().toISOString()};
  result=await supabaseClient.from("e2fit_invoices").insert(payload).select("id").single();
  if(result.error){alert("Could not save invoice: "+result.error.message);return;}
  await renderInvoice(invoiceNo);
  await loadInvoices();
  editingInvoiceId=null;editingInvoiceNumber=null;
  document.getElementById("generateInvoice").textContent="Generate Invoice";
}
function resetInvoiceGenerator(){
  ["invoiceCustomer","invoicePhone","invoiceAddress","invoiceAmount","invoiceAdvance","invoiceBalance"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=id==="invoiceAmount"||id==="invoiceAdvance"||id==="invoiceBalance"?"0":"";});
  const paid=document.getElementById("invoicePaid");if(paid)paid.checked=false;
  const date=document.getElementById("invoiceDate");if(date)date.value=new Date().toISOString().slice(0,10);const today=new Date().toISOString().slice(0,10);const start=document.getElementById("invoiceStartDate");const end=document.getElementById("invoiceEndDate");if(start)start.value=today;if(end)end.value=planEndDate(today,invoicePlanKey());
  const box=document.getElementById("invoiceBox");if(box)box.selectedIndex=0;
  const plan=document.getElementById("invoicePlan");if(plan)plan.selectedIndex=0;
  editingInvoiceId=null;editingInvoiceNumber=null;
  const btn=document.getElementById("generateInvoice");if(btn)btn.textContent="Generate Invoice";
  const preview=document.getElementById("invoicePreview");if(preview)preview.innerHTML='<div class="invoice-placeholder">Enter customer details and click <strong>Generate Invoice</strong>.</div>';
}
function printInvoice(){
  const paper=document.querySelector(".invoice-paper");if(!paper){alert("Generate an invoice first.");return;}
  const w=window.open("","_blank");w.document.write(`<!doctype html><html><head><title>E2FIT Invoice</title><style>body{font-family:Arial,sans-serif;padding:35px;color:#173f2b}.invoice-paper{max-width:760px;margin:auto;border:1px solid #ddd;padding:40px}.invoice-brand{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:25px}.invoice-logo-img{width:110px;height:70px;object-fit:contain;display:block;margin-bottom:5px}.invoice-meta{text-align:right}.invoice-meta span,.invoice-meta strong{display:block}.invoice-customer{padding:30px 0}.invoice-customer small,.invoice-customer strong,.invoice-customer span{display:block;margin:4px 0}.invoice-table{width:100%;border-collapse:collapse}.invoice-table th,.invoice-table td{text-align:left;padding:14px 8px;border-bottom:1px solid #ddd}.amount{text-align:right!important}.invoice-total{display:flex;justify-content:flex-end;gap:80px;padding:22px 8px;font-size:18px}.invoice-footer{text-align:center;border-top:1px solid #ddd;padding-top:25px;color:#666;font-size:12px}</style></head><body>${paper.outerHTML}</body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),300);
}
document.getElementById("invoiceBox").addEventListener("change",updateInvoiceAmount);
document.getElementById("invoicePlan").addEventListener("change",()=>{updateInvoiceAmount();updateInvoicePlanDates();});document.getElementById("invoiceStartDate").addEventListener("change",updateInvoicePlanDates);
document.getElementById("invoiceAdvance").addEventListener("input",updateInvoiceBalance);document.getElementById("invoiceAmount").addEventListener("input",updateInvoiceBalance);document.getElementById("generateInvoice").addEventListener("click",generateInvoice);
document.getElementById("printInvoice").addEventListener("click",printInvoice);
document.getElementById("invoiceDate").value=new Date().toISOString().slice(0,10);
updateInvoiceAmount();

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
document.querySelectorAll("aside nav a").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();const target=document.querySelector(a.getAttribute("href"));if(target){document.querySelectorAll("aside nav a").forEach(x=>x.classList.remove("active"));a.classList.add("active");target.scrollIntoView({behavior:"smooth",block:"start"});}}));
boot();