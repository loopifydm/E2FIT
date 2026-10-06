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
async function refresh(){await generateToday();await loadEnquiries();await loadOrders();await loadCustomers();await loadSubscriptions();await loadSubscriberCalendarOptions();await loadInvoices();}
async function loadEnquiries(){
  const {data,error}=await supabaseClient.from("e2fit_enquiries").select("*").order("created_at",{ascending:false});
  if(error){console.error(error);return;}
  const filter=document.getElementById("enquiryFilter")?.value||"All";
  const rows=(data||[]).filter(e=>filter==="All"||e.status===filter);
  document.getElementById("enquiryRows").innerHTML=rows.map(e=>`<tr><td><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.phone||"")}<br>${escapeHtml(e.address||"")}</small></td><td>${escapeHtml(e.box)}</td><td>${escapeHtml(e.plan)}</td><td>${escapeHtml(e.delivery_time)}</td><td>₹${Number(e.price||0).toLocaleString("en-IN")}</td><td>${escapeHtml(new Date(e.created_at).toLocaleString("en-IN"))}</td><td><span class="pill ${escapeHtml(e.status)}">${escapeHtml(e.status)}</span></td><td><select class="status-select" data-enquiry-id="${e.id}"><option${e.status==="New"?" selected":""}>New</option><option${e.status==="Contacted"?" selected":""}>Contacted</option><option${e.status==="Converted"?" selected":""}>Converted</option><option${e.status==="Closed"?" selected":""}>Closed</option></select></td></tr>`).join("")||"<tr><td colspan='8'>No enquiries yet.</td></tr>";
  document.querySelectorAll(".status-select").forEach(select=>select.addEventListener("change",async()=>{const {error}=await supabaseClient.from("e2fit_enquiries").update({status:select.value,updated_at:new Date().toISOString()}).eq("id",select.dataset.enquiryId);if(error){alert("Could not update enquiry: "+error.message);return;}await loadEnquiries();}));
}
async function generateToday(){const {error}=await supabaseClient.rpc("e2fit_generate_today_deliveries");if(error)console.warn(error.message);}
async function loadOrders(){
  const today=new Date().toISOString().slice(0,10);
  const {data,error}=await supabaseClient.from("e2fit_deliveries").select("*, e2fit_customers(name,phone,address)").eq("delivery_date",today).order("delivery_time").order("created_at",{ascending:false});
  if(error){console.error(error);alert("Could not load deliveries: "+error.message);return;}
  orders=data||[];render();
}
async function loadCustomers(){
  const {data,error}=await supabaseClient.from("e2fit_subscriptions").select("id,customer_id,invoice_id,box,plan,delivery_time,status,start_date,end_date,e2fit_customers(name,phone)").eq("status","active").not("invoice_id","is",null).order("created_at",{ascending:false});
  if(error){console.error(error);return;}
  document.getElementById("customerRows").innerHTML=(data||[]).map(s=>{const c=s.e2fit_customers||{};return `<tr><td><strong>${escapeHtml(c.name||"—")}</strong><small>${escapeHtml(c.phone||"")}</small></td><td>${escapeHtml(s.box)}</td><td>${escapeHtml(s.plan)}</td><td>${escapeHtml(s.delivery_time)}</td><td><span class="pill Active">Active</span></td><td><button class="status-btn" onclick="deleteCustomer('${s.customer_id}')">Delete</button></td></tr>`;}).join("")||"<tr><td colspan='6'>No active subscriptions yet.</td></tr>";
}
async function loadSubscriptions(){
  const {data,error}=await supabaseClient.from("e2fit_subscriptions").select("id,invoice_id,box,plan,delivery_time,status,start_date,end_date,e2fit_customers(name,phone)").not("invoice_id","is",null).order("created_at",{ascending:false});
  if(error){console.error(error);return;}
  document.getElementById("subscriptionRows").innerHTML=(data||[]).map(s=>{const c=s.e2fit_customers||{};return "<tr><td><strong>"+escapeHtml(c.name||"—")+"</strong><small>"+escapeHtml(c.phone||"")+"</small></td><td>"+escapeHtml(s.box)+"</td><td>"+escapeHtml(s.plan)+"</td><td>"+escapeHtml(s.delivery_time)+"</td><td>"+escapeHtml(s.start_date)+"</td><td>"+escapeHtml(s.end_date)+"</td><td><span class='pill "+escapeHtml(s.status)+"'>"+escapeHtml(s.status)+"</span></td></tr>";}).join("")||"<tr><td colspan='7'>No subscriptions yet.</td></tr>";
}
async function loadSubscriberCalendarOptions(){
  const {data,error}=await supabaseClient.from("e2fit_subscriptions").select("id,customer_id,box,plan,start_date,end_date,delivery_time,status,e2fit_customers(name,phone)").not("invoice_id","is",null).order("created_at",{ascending:false});
  if(error){console.error(error);return;}
  const select=document.getElementById("calendarSubscriber"),current=select.value;
  select.innerHTML='<option value="">Select subscriber</option>'+(data||[]).map(s=>{const c=s.e2fit_customers||{};return '<option value="'+s.id+'">'+escapeHtml(c.name||"Customer")+' — '+escapeHtml(s.box)+' ('+escapeHtml(s.plan)+')</option>';}).join("");
  if(current && (data||[]).some(s=>s.id===current)) select.value=current;
  window.e2fitCalendarSubscriptions=data||[];
  if(!select.value && data?.length){select.value=data[0].id;}
  if(select.value) await renderSubscriberCalendar();
}
let subscriptions=[];
function monthValue(d){return String(d||"").slice(0,7)}
function calendarMonthValue(date){return String(date||"").slice(0,7);}

function subscriberTargetDays(plan,startDate,endDate){
  if(plan==="Monthly")return 26;
  if(plan==="Weekly")return 6;
  if(plan==="Trial")return nonSundayDaysBetween(startDate,endDate||startDate);
  return 1;
}
function nonSundayDaysBetween(startDate,endDate){
  if(!startDate||!endDate||endDate<startDate)return 0;
  let d=new Date(startDate+"T12:00:00Z"),last=new Date(endDate+"T12:00:00Z"),count=0;
  while(d<=last){if(d.getUTCDay()!==0)count++;d.setUTCDate(d.getUTCDate()+1);}
  return count;
}
function subscriberEffectiveEnd(startDate,plan,records,customEndDate){
  if(plan==="Trial")return customEndDate||startDate;
  const target=subscriberTargetDays(plan,startDate,customEndDate);
  const missed=(records||[]).filter(r=>r.delivery_date>=startDate && r.status!=="Delivered" && new Date(r.delivery_date+"T12:00:00Z").getUTCDay()!==0).length;
  let d=new Date(startDate+"T12:00:00Z"),needed=target+missed,count=0;
  while(count<needed){
    if(d.getUTCDay()!==0)count++;
    if(count<needed)d.setUTCDate(d.getUTCDate()+1);
  }
  return d.toISOString().slice(0,10);
}

async function renderSubscriberCalendar(){
  const select=document.getElementById("calendarSubscriber"),sub=(window.e2fitCalendarSubscriptions||[]).find(s=>s.id===select.value),month=document.getElementById("calendarMonth").value;
  const box=document.getElementById("subscriberCalendar");
  if(!sub){box.innerHTML='<div class="calendar-empty">Select a subscriber to view their delivery calendar.</div>';return;}

  const targetDays=subscriberTargetDays(sub.plan,sub.start_date,sub.end_date);
  let monthValue=month||calendarMonthValue(sub.start_date);
  if(!monthValue)monthValue=new Date().toISOString().slice(0,7);
  document.getElementById("calendarMonth").value=monthValue;

  const {data:allRecords,error}=await supabaseClient.from("e2fit_deliveries").select("id,delivery_date,status").eq("subscription_id",sub.id).gte("delivery_date",sub.start_date).order("delivery_date",{ascending:true});
  if(error){console.error(error);box.innerHTML='<div class="calendar-empty">Could not load delivery calendar.</div>';return;}

  const records=allRecords||[],effectiveEnd=subscriberEffectiveEnd(sub.start_date,sub.plan,records,sub.end_date),byDate={};
  records.forEach(r=>{if(new Date(r.delivery_date+"T12:00:00Z").getUTCDay()!==0)byDate[r.delivery_date]=r;});

  const monthStart=monthValue+"-01",monthEnd=new Date(Number(monthValue.slice(0,4)),Number(monthValue.slice(5,7)),0).toISOString().slice(0,10);
  const start=monthStart>sub.start_date?monthStart:sub.start_date,end=monthEnd<effectiveEnd?monthEnd:effectiveEnd;
  if(start>end){box.innerHTML='<div class="calendar-empty">No delivery days for this month.</div>';return;}

  const deliveredCount=records.filter(r=>r.status==="Delivered" && r.delivery_date>=sub.start_date && r.delivery_date<=effectiveEnd).length;
  const remaining=Math.max(0,targetDays-deliveredCount);

  const dates=[];let d=new Date(start+"T12:00:00Z"),last=new Date(end+"T12:00:00Z");
  while(d<=last){const iso=d.toISOString().slice(0,10);if(d.getUTCDay()!==0)dates.push(iso);d.setUTCDate(d.getUTCDate()+1);}

  const firstDay=new Date(dates[0]+"T12:00:00Z").getUTCDay(),leadingBlanks=firstDay===0?0:firstDay-1;
  const weekdayHeader=["Mon","Tue","Wed","Thu","Fri","Sat"].map(day=>'<div class="calendar-weekday">'+day+'</div>').join("");
  const spacers=Array.from({length:leadingBlanks},()=>'<div class="calendar-spacer"></div>').join("");
  const days=dates.map(date=>{
    const rec=byDate[date],done=rec?.status==="Delivered",dt=new Date(date+"T12:00:00Z"),label=dt.toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short"});
    return '<label class="calendar-day '+(done?"done":"")+'"><input type="checkbox" '+(done?"checked":"")+' data-delivery-id="'+(rec?.id||"")+'" data-subscription-id="'+sub.id+'" data-date="'+date+'"><span class="day-check">'+(done?"✓":"")+'</span><span class="day-info"><strong>'+label+'</strong><small>'+(done?"Box brought":"Not brought")+'</small></span></label>';
  }).join("");

  const statusText=remaining>0?("Brought: "+deliveredCount+" / "+targetDays+" · Remaining: "+remaining):("Completed: "+targetDays+" / "+targetDays);
  box.innerHTML='<div class="calendar-summary"><strong>'+escapeHtml((sub.e2fit_customers||{}).name||"Subscriber")+'</strong><span>'+escapeHtml(sub.box)+' · '+escapeHtml(sub.plan)+' · '+escapeHtml(sub.delivery_time)+'</span><span>'+statusText+'</span><span>Plan: '+escapeHtml(sub.start_date)+' to '+escapeHtml(effectiveEnd)+'</span></div><div class="calendar-scroll"><div class="calendar-grid">'+weekdayHeader+spacers+days+'</div></div>';
  box.querySelectorAll('input[type="checkbox"]').forEach(input=>input.addEventListener("change",()=>toggleCalendarDelivery(input)));
}

async function toggleCalendarDelivery(input){
  const status=input.checked?"Delivered":"Pending";
  const sub=(window.e2fitCalendarSubscriptions||[]).find(s=>s.id===input.dataset.subscriptionId);
  if(!sub)return;
  const payload={subscription_id:sub.id,customer_id:sub.customer_id||null,delivery_date:input.dataset.date,delivery_time:sub.delivery_time,box:sub.box,address:"",status,updated_at:new Date().toISOString()};
  let result;
  if(input.dataset.deliveryId) result=await supabaseClient.from("e2fit_deliveries").update({status,updated_at:new Date().toISOString()}).eq("id",input.dataset.deliveryId);
  else result=await supabaseClient.from("e2fit_deliveries").insert(payload).select("id").single();
  if(result.error){alert("Could not save delivery status: "+result.error.message);input.checked=!input.checked;return;}

  // Monthly/Weekly plans carry forward missed days. Trial plans keep the
  // custom end date entered on the invoice and do not auto-extend.
  if(sub.plan!=="Trial"){
    const {data:records,error:recordError}=await supabaseClient.from("e2fit_deliveries").select("delivery_date,status").eq("subscription_id",sub.id).gte("delivery_date",sub.start_date);
    if(!recordError){
      const effectiveEnd=subscriberEffectiveEnd(sub.start_date,sub.plan,records||[],sub.end_date);
      await supabaseClient.from("e2fit_subscriptions").update({end_date:effectiveEnd,updated_at:new Date().toISOString()}).eq("id",sub.id);
    }
  }
  await renderSubscriberCalendar();
  await loadSubscriptions();
  await loadCustomers();
}

function render(){
  const filter=document.getElementById("filter").value,visible=filter==="All"?orders:orders.filter(o=>o.status===filter);
  document.getElementById("total").textContent=orders.length;
  document.getElementById("preparing").textContent=orders.filter(o=>o.status==="Preparing").length;
  document.getElementById("out").textContent=orders.filter(o=>o.status==="Out for Delivery").length;
  document.getElementById("delivered").textContent=orders.filter(o=>o.status==="Delivered").length;
  document.getElementById("orders").innerHTML=visible.map(o=>{const c=o.e2fit_customers||{},next=o.status==="Pending"?"Preparing":o.status==="Preparing"?"Out for Delivery":o.status==="Out for Delivery"?"Delivered":null;return `<div class="order"><div class="customer"><strong>${escapeHtml(c.name||"Customer")}</strong><small>${escapeHtml(c.phone||"")} · ${escapeHtml(o.address||c.address||"")}</small></div><div><strong>${escapeHtml(o.box)}</strong><div class="muted">${escapeHtml(o.delivery_time)}</div></div><div><strong>${escapeHtml(o.status)}</strong><div class="muted">${escapeHtml(o.delivery_date)}</div></div><div class="status-action"><span class="pill ${statusClass(o.status)}">${escapeHtml(o.status)}</span> ${next?`<button class="status-btn" onclick="advance('${o.id}','${next}')">Next →</button>`:""} <button class="status-btn delete-delivery-btn" onclick="deleteTodayDelivery('${o.id}')">Delete</button></div></div>`;}).join("")||"<div style='padding:30px;color:#879189'>No deliveries found.</div>";
}
function statusClass(status){return status==="Out for Delivery"?"Out":status.replaceAll(" ","");}
async function advance(id,next){const {error}=await supabaseClient.from("e2fit_deliveries").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);if(error){alert("Could not update delivery: "+error.message);return;}await loadOrders();}
async function deleteTodayDelivery(id){
  if(!id||!confirm("Delete this delivery from Today's Deliveries?\n\nThis will remove only today's delivery record. The subscriber and invoice will not be deleted."))return;
  const {error}=await supabaseClient.from("e2fit_deliveries").delete().eq("id",id);
  if(error){alert("Could not delete delivery: "+error.message);return;}
  await loadOrders();
  await loadSubscriberCalendarOptions();
}
async function deleteCustomer(id){if(!id||!confirm("Delete this customer and all their subscriptions and deliveries?"))return;const {error}=await supabaseClient.from("e2fit_customers").delete().eq("id",id);if(error){alert("Could not delete customer: "+error.message);return;}await refresh();}

document.getElementById("filter").addEventListener("change",render);
document.getElementById("enquiryFilter")?.addEventListener("change",loadEnquiries);
document.getElementById("calendarSubscriber")?.addEventListener("change",()=>{const sub=(window.e2fitCalendarSubscriptions||[]).find(s=>s.id===document.getElementById("calendarSubscriber").value);if(sub)document.getElementById("calendarMonth").value=calendarMonthValue(sub.start_date);renderSubscriberCalendar();});
document.getElementById("calendarMonth")?.addEventListener("change",renderSubscriberCalendar);
const invoicePrices={"Mixed Box":{Daily:60,Weekly:360,Monthly:1499,Trial:0},"Medium Box":{Daily:80,Weekly:480,Monthly:1999,Trial:0},"Premium Box":{Daily:100,Weekly:600,Monthly:2499,Trial:0},"Premium Pro Box":{Daily:120,Weekly:720,Monthly:2999,Trial:0}};
async function loadInvoices(){
  const {data,error}=await supabaseClient.from("e2fit_invoices").select("*").order("created_at",{ascending:false});
  if(error){console.error(error);return;}
  document.getElementById("invoiceRows").innerHTML=(data||[]).map(i=>`<tr><td><strong>${escapeHtml(i.invoice_number)}</strong></td><td>${escapeHtml(i.customer_name)}<small>${escapeHtml(i.phone||"")}</small></td><td>${escapeHtml(i.box)} · ${escapeHtml(i.plan)}</td><td>₹${Number(i.amount||0).toLocaleString("en-IN")}</td><td>${escapeHtml(i.invoice_date)}</td><td><button class="status-btn" onclick="editInvoice('${i.id}')">Edit</button> <button class="status-btn" onclick="printSavedInvoice('${i.id}')">Print</button> <button class="status-btn" onclick="deleteInvoice('${i.id}')">Delete</button></td></tr>`).join("")||"<tr><td colspan='6'>No invoices generated yet.</td></tr>";
}
let editingInvoiceId=null,editingInvoiceNumber=null;
async function editInvoice(id){
  const {data,error}=await supabaseClient.from("e2fit_invoices").select("*").eq("id",id).single();if(error){alert(error.message);return;}
  editingInvoiceId=id;editingInvoiceNumber=data.invoice_number;
  document.getElementById("invoiceCustomer").value=data.customer_name||"";document.getElementById("invoicePhone").value=data.phone||"";document.getElementById("invoiceAddress").value=data.address||"";document.getElementById("invoiceBox").value=data.box||"Mixed Box";document.getElementById("invoicePlan").value=data.plan==="Weekly"?"Weekly (6 days)":data.plan==="Monthly"?"Monthly (26 days)":data.plan==="Trial"?"Trial (Custom Dates)":"Daily";document.getElementById("invoiceDeliveryTime").value=data.delivery_time||"Breakfast";document.getElementById("invoiceAmount").value=data.amount;document.getElementById("invoiceStartDate").value=data.start_date||data.invoice_date;document.getElementById("invoiceEndDate").value=data.end_date||data.invoice_date;document.getElementById("invoiceAdvance").value=data.advance_amount||0;document.getElementById("invoiceBalance").value=data.balance_amount??Math.max(0,Number(data.amount||0)-Number(data.advance_amount||0));updateInvoiceBalance();document.getElementById("invoiceDate").value=data.invoice_date;updateInvoiceAmount();updateInvoicePlanDates();
  document.getElementById("generateInvoice").textContent="Update Invoice";document.getElementById("invoices").scrollIntoView({behavior:"smooth"});await renderInvoice(data.invoice_number);
}
async function renderInvoice(invoiceNoOverride){
  const name=document.getElementById("invoiceCustomer").value.trim(),phone=document.getElementById("invoicePhone").value.trim(),address=document.getElementById("invoiceAddress").value.trim(),box=document.getElementById("invoiceBox").value,plan=document.getElementById("invoicePlan").value,startDate=document.getElementById("invoiceStartDate").value,endDate=document.getElementById("invoiceEndDate").value,deliveryTime=document.getElementById("invoiceDeliveryTime").value||"Breakfast",amount=Number(document.getElementById("invoiceAmount").value||0),advance=Number(document.getElementById("invoicePaid")?.checked?amount:document.getElementById("invoiceAdvance").value||0),balance=Math.max(0,amount-advance),date=document.getElementById("invoiceDate").value||new Date().toISOString().slice(0,10);
  if(!name)return;
  const planKey=invoicePlanKey(),invoiceNo=invoiceNoOverride||await invoiceNumber();document.getElementById("invoiceBalance").value=balance;
  document.getElementById("invoicePreview").innerHTML=`<div class="invoice-paper"><div class="invoice-brand"><div><img class="invoice-logo-img" src="https://loopifydm.github.io/E2FIT/assets/e2fit-logo.jpg" alt="E2FIT"><small>Fresh. Healthy. Better Every Day.</small></div><div class="invoice-meta"><strong>INVOICE</strong><span>${escapeHtml(invoiceNo)}</span><span>${escapeHtml(date)}</span></div></div><div class="invoice-customer"><div><small>BILL TO</small><strong>${escapeHtml(name)}</strong><span>${escapeHtml(phone)}</span><span>${escapeHtml(address)}</span></div></div><table class="invoice-table"><thead><tr><th>Description</th><th>Plan</th><th class="amount">Amount</th></tr></thead><tbody><tr><td>${escapeHtml(box)}</td><td>${escapeHtml(planKey)}</td><td class="amount">₹${amount.toLocaleString("en-IN")}</td></tr></tbody></table><div class="invoice-period"><strong>Plan Period:</strong> ${escapeHtml(startDate)} to ${escapeHtml(endDate)} · <strong>Delivery:</strong> ${escapeHtml(document.getElementById("invoiceDeliveryTime").value||"Breakfast")}</div><div class="invoice-total invoice-payment"><div><span>Total Amount</span><strong>₹${amount.toLocaleString("en-IN")}</strong></div><div><span>Advance Amount</span><strong>₹${advance.toLocaleString("en-IN")}</strong></div><div><span>Balance Amount</span><strong>₹${balance.toLocaleString("en-IN")}</strong></div><div><span>Payment Status</span><strong>${balance===0?"FULLY PAID":"PARTIALLY PAID"}</strong></div></div><div class="invoice-footer">Thank you for choosing E2FIT.<br>Gandhi Park, Coimbatore · Free delivery up to 5 km</div></div>`;
}
async function deleteInvoice(id){if(!confirm("Delete this invoice and its linked subscriber? This cannot be undone."))return;const {data:inv,error:invError}=await supabaseClient.from("e2fit_invoices").select("id").eq("id",id).single();if(invError){alert(invError.message);return;}const {data:sub,error:subError}=await supabaseClient.from("e2fit_subscriptions").select("id,customer_id").eq("invoice_id",id).maybeSingle();if(subError){alert(subError.message);return;}if(sub){await supabaseClient.from("e2fit_deliveries").delete().eq("subscription_id",sub.id);await supabaseClient.from("e2fit_subscriptions").delete().eq("id",sub.id);const {data:other}=await supabaseClient.from("e2fit_subscriptions").select("id").eq("customer_id",sub.customer_id).limit(1);if(!other?.length)await supabaseClient.from("e2fit_customers").delete().eq("id",sub.customer_id);}const {error}=await supabaseClient.from("e2fit_invoices").delete().eq("id",id);if(error){alert("Could not delete invoice: "+error.message);return;}if(editingInvoiceId===id){editingInvoiceId=null;editingInvoiceNumber=null;}await loadInvoices();}
async function printSavedInvoice(id){await editInvoice(id);setTimeout(()=>printInvoice(),200);}

function invoicePlanKey(){const v=document.getElementById("invoicePlan").value;return v.startsWith("Weekly")?"Weekly":v.startsWith("Monthly")?"Monthly":v.startsWith("Trial")?"Trial":"Daily";}
function planEndDate(startDate,plan){if(!startDate)return "";if(plan==="Daily"||plan==="Trial")return startDate;let d=new Date(startDate+"T00:00:00"),count=0,target=plan==="Weekly"?6:26;while(count<target){if(d.getDay()!==0)count++;if(count<target)d.setDate(d.getDate()+1);}return d.toISOString().slice(0,10);}
function updateInvoicePlanDates(){const start=document.getElementById("invoiceStartDate"),end=document.getElementById("invoiceEndDate"),endField=document.getElementById("invoiceEndDateField");if(!start||!end)return;if(!start.value)start.value=new Date().toISOString().slice(0,10);const plan=invoicePlanKey();if(plan==="Trial"){endField?.classList.remove("hidden");if(!end.value||end.value<start.value)end.value=start.value;return;}endField?.classList.add("hidden");end.value=planEndDate(start.value,plan);}
function updateInvoiceAmount(){const box=document.getElementById("invoiceBox").value,plan=invoicePlanKey(),amount=document.getElementById("invoiceAmount");if(plan!=="Trial"){amount.value=invoicePrices[box][plan];}else if(amount.value===""){amount.value="0";}updateInvoiceBalance();}document.getElementById("invoicePaid")?.addEventListener("change",()=>updateInvoiceBalance());function updateInvoiceBalance(){const total=Number(document.getElementById("invoiceAmount").value||0),paid=document.getElementById("invoicePaid")?.checked||false,advance=paid?total:Number(document.getElementById("invoiceAdvance").value||0);document.getElementById("invoiceAdvance").value=advance;document.getElementById("invoiceBalance").value=Math.max(0,total-advance);}
async function invoiceNumber(){const {data,error}=await supabaseClient.rpc("e2fit_next_invoice_number");if(error)throw error;return data;}
async function syncSubscriberFromInvoice(invoiceId,invoiceData){
  // When an invoice is edited, keep the existing invoice-linked customer and
  // subscription as the source record. This prevents duplicate subscribers
  // when the phone number is changed during an edit.
  const {data:existing,error:findError}=await supabaseClient.from("e2fit_subscriptions").select("id,customer_id,plan,start_date,end_date").eq("invoice_id",invoiceId).maybeSingle();
  if(findError)throw findError;

  let customerId=existing?.customer_id||null;
  if(customerId){
    const {error}=await supabaseClient.from("e2fit_customers").update({
      name:invoiceData.customer_name,
      phone:(invoiceData.phone||"").trim(),
      address:invoiceData.address||""
    }).eq("id",customerId);
    if(error)throw error;
  }else{
    const phone=(invoiceData.phone||"").trim();
    if(phone){
      const {data:byPhone,error}=await supabaseClient.from("e2fit_customers").select("id").eq("phone",phone).maybeSingle();
      if(error)throw error;
      customerId=byPhone?.id||null;
    }
    if(!customerId){
      const {data:customer,error}=await supabaseClient.from("e2fit_customers").insert({
        name:invoiceData.customer_name,
        phone:invoiceData.phone||"",
        address:invoiceData.address||""
      }).select("id").single();
      if(error)throw error;
      customerId=customer.id;
    }else{
      const {error}=await supabaseClient.from("e2fit_customers").update({
        name:invoiceData.customer_name,
        address:invoiceData.address||""
      }).eq("id",customerId);
      if(error)throw error;
    }
  }

  const prices=invoicePrices[invoiceData.box];
  if(!prices && invoiceData.plan!=="Trial")throw new Error("Invalid box selected.");

  // Preserve a previously extended Weekly/Monthly subscription when the
  // invoice is edited without changing its plan start date.
  let syncedEndDate=invoiceData.end_date;
  if(existing && existing.plan===invoiceData.plan && existing.start_date===invoiceData.start_date && invoiceData.plan!=="Trial"){
    syncedEndDate=existing.end_date>invoiceData.end_date?existing.end_date:invoiceData.end_date;
  }

  const subscriptionPayload={
    customer_id:customerId,
    invoice_id:invoiceId,
    box:invoiceData.box,
    plan:invoiceData.plan,
    daily_price:invoiceData.plan==="Trial"?invoiceData.amount:prices.Daily,
    monthly_price:invoiceData.amount,
    start_date:invoiceData.start_date,
    end_date:syncedEndDate,
    delivery_time:invoiceData.delivery_time,
    status:"active",
    updated_at:new Date().toISOString()
  };

  let subscriptionId=existing?.id;
  if(subscriptionId){
    const {error}=await supabaseClient.from("e2fit_subscriptions").update(subscriptionPayload).eq("id",subscriptionId);
    if(error)throw error;

    // Update every linked delivery, including already-delivered rows, so an
    // invoice edit is reflected consistently in the delivery list and calendar.
    const {error:deliveryError}=await supabaseClient.from("e2fit_deliveries").update({
      customer_id:customerId,
      delivery_time:invoiceData.delivery_time,
      box:invoiceData.box,
      address:invoiceData.address||"",
      updated_at:new Date().toISOString()
    }).eq("subscription_id",subscriptionId);
    if(deliveryError)throw deliveryError;
  }else{
    const {data:subscription,error}=await supabaseClient.from("e2fit_subscriptions").insert(subscriptionPayload).select("id").single();
    if(error)throw error;
    subscriptionId=subscription.id;
  }

  const {error:generateError}=await supabaseClient.rpc("e2fit_generate_today_deliveries");
  if(generateError)console.warn("Could not regenerate today's delivery:",generateError.message);
  return {customerId,subscriptionId};
}

async function generateInvoice(){
  const name=document.getElementById("invoiceCustomer").value.trim(),phone=document.getElementById("invoicePhone").value.trim(),address=document.getElementById("invoiceAddress").value.trim(),box=document.getElementById("invoiceBox").value,plan=document.getElementById("invoicePlan").value,startDate=document.getElementById("invoiceStartDate").value,endDate=document.getElementById("invoiceEndDate").value,deliveryTime=document.getElementById("invoiceDeliveryTime").value||"Breakfast",amount=Number(document.getElementById("invoiceAmount").value||0),advance=Number(document.getElementById("invoicePaid")?.checked?amount:document.getElementById("invoiceAdvance").value||0),balance=Math.max(0,amount-advance),date=document.getElementById("invoiceDate").value||new Date().toISOString().slice(0,10);
  if(!name){alert("Enter the customer name.");return;}
  if(!startDate||!endDate){alert("Select the plan start and end dates.");return;}
  const planKey=invoicePlanKey();
  const invoiceData={customer_name:name,phone,address,box,plan:planKey,delivery_time:deliveryTime,amount,start_date:startDate,end_date:endDate};
  let result,invoiceNo;
  if(editingInvoiceId){
    invoiceNo=editingInvoiceNumber;
    const payload={customer_name:name,phone,address,box,plan:planKey,delivery_time:deliveryTime,amount,advance_amount:advance,balance_amount:balance,invoice_date:date,start_date:startDate,end_date:endDate,updated_at:new Date().toISOString()};
    result=await supabaseClient.from("e2fit_invoices").update(payload).eq("id",editingInvoiceId);
    if(result.error){alert("Could not update invoice: "+result.error.message);return;}
    try{await syncSubscriberFromInvoice(editingInvoiceId,invoiceData);}catch(error){alert("Invoice updated, but subscriber sync failed: "+(error.message||"Unknown error"));return;}
    await renderInvoice(invoiceNo);await loadInvoices();await loadOrders();await loadCustomers();await loadSubscriptions();await loadSubscriberCalendarOptions();
    editingInvoiceId=null;editingInvoiceNumber=null;
    document.getElementById("generateInvoice").textContent="Generate Invoice";
    return;
  }
  try{invoiceNo=await invoiceNumber();}catch(error){alert("Could not generate invoice number: "+error.message);return;}
  const payload={invoice_number:invoiceNo,customer_name:name,phone,address,box,plan:planKey,delivery_time:deliveryTime,amount,advance_amount:advance,balance_amount:balance,invoice_date:date,start_date:startDate,end_date:endDate,updated_at:new Date().toISOString()};
  result=await supabaseClient.from("e2fit_invoices").insert(payload).select("id").single();
  if(result.error){alert("Could not save invoice: "+result.error.message);return;}
  try{
    await syncSubscriberFromInvoice(result.data.id,invoiceData);
  }catch(error){
    await supabaseClient.from("e2fit_invoices").delete().eq("id",result.data.id);
    alert("Invoice was not created because the subscriber could not be saved: "+(error.message||"Unknown error"));
    return;
  }
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
  const plan=document.getElementById("invoicePlan");if(plan)plan.selectedIndex=0;const deliveryTime=document.getElementById("invoiceDeliveryTime");if(deliveryTime)deliveryTime.selectedIndex=0;
  editingInvoiceId=null;editingInvoiceNumber=null;
  const btn=document.getElementById("generateInvoice");if(btn)btn.textContent="Generate Invoice";
  const preview=document.getElementById("invoicePreview");if(preview)preview.innerHTML='<div class="invoice-placeholder">Enter customer details and click <strong>Generate Invoice</strong>.</div>';
}
function printInvoice(){
  const paper=document.querySelector(".invoice-paper");if(!paper){alert("Generate an invoice first.");return;}
  const w=window.open("","_blank");w.document.write(`<!doctype html><html><head><title>E2FIT Invoice</title><style>body{font-family:Arial,sans-serif;padding:35px;color:#173f2b}.invoice-paper{max-width:760px;margin:auto;border:1px solid #ddd;padding:40px}.invoice-brand{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:25px}.invoice-logo-img{width:110px;height:70px;object-fit:contain;display:block;margin-bottom:5px}.invoice-meta{text-align:right}.invoice-meta span,.invoice-meta strong{display:block}.invoice-customer{padding:30px 0}.invoice-customer small,.invoice-customer strong,.invoice-customer span{display:block;margin:4px 0}.invoice-table{width:100%;border-collapse:collapse}.invoice-table th,.invoice-table td{text-align:left;padding:14px 8px;border-bottom:1px solid #ddd}.amount{text-align:right!important}.invoice-total{display:flex;justify-content:flex-end;gap:80px;padding:22px 8px;font-size:18px}.invoice-footer{text-align:center;border-top:1px solid #ddd;padding-top:25px;color:#666;font-size:12px}</style></head><body>${paper.outerHTML}</body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),300);
}
document.getElementById("invoiceBox").addEventListener("change",updateInvoiceAmount);
document.getElementById("invoicePlan").addEventListener("change",()=>{if(invoicePlanKey()==="Trial")document.getElementById("invoiceAmount").value="0";updateInvoiceAmount();updateInvoicePlanDates();});document.getElementById("invoiceStartDate").addEventListener("change",updateInvoicePlanDates);
document.getElementById("invoiceDeliveryTime").addEventListener("change",()=>{if(document.getElementById("invoiceCustomer").value.trim())renderInvoice(editingInvoiceNumber||null);});document.getElementById("invoiceAdvance").addEventListener("input",updateInvoiceBalance);document.getElementById("invoiceAmount").addEventListener("input",updateInvoiceBalance);document.getElementById("generateInvoice").addEventListener("click",generateInvoice);
document.getElementById("printInvoice").addEventListener("click",printInvoice);
document.getElementById("invoiceDate").value=new Date().toISOString().slice(0,10);
updateInvoiceAmount();updateInvoicePlanDates();

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
document.querySelectorAll("aside nav a").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();const target=document.querySelector(a.getAttribute("href"));if(target){document.querySelectorAll("aside nav a").forEach(x=>x.classList.remove("active"));a.classList.add("active");target.scrollIntoView({behavior:"smooth",block:"start"});}}));
boot();