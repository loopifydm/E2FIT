const modal=document.getElementById("orderModal");
let selectedBox="",selectedPrice="";
const supabaseClient=window.supabase.createClient(window.E2FIT_SUPABASE_URL,window.E2FIT_SUPABASE_KEY);

document.querySelectorAll(".select-btn").forEach(btn=>btn.addEventListener("click",()=>{
  selectedBox=btn.dataset.box;selectedPrice=btn.dataset.price;
  document.getElementById("modalTitle").textContent=selectedBox;
  modal.classList.add("open");document.getElementById("customerName").focus();
}));
function closeModal(){modal.classList.remove("open")}
document.querySelector(".modal-close").addEventListener("click",closeModal);
document.querySelector(".modal-backdrop").addEventListener("click",closeModal);

function getPricing(box,plan){
  const prices={"Mixed Box":{daily:60,monthly:1499},"Medium Box":{daily:80,monthly:1999},"Premium Box":{daily:100,monthly:2499},"Premium Pro Box":{daily:120,monthly:2999}};
  return plan.startsWith("Monthly")?prices[box].monthly:prices[box].daily;
}
document.getElementById("whatsappOrder").addEventListener("click",async()=>{
  const button=document.getElementById("whatsappOrder");
  const name=document.getElementById("customerName").value.trim();
  const phone=document.getElementById("customerPhone").value.trim();
  const address=document.getElementById("customerAddress").value.trim();
  const plan=document.getElementById("plan").value;
  const time=document.getElementById("time").value;
  if(!name||!phone||!address){alert("Please enter your name, WhatsApp number and delivery address.");return;}
  button.disabled=true;button.textContent="Saving order…";
  try{
    const normalizedPlan=plan.startsWith("Monthly")?"Monthly":"Daily";
    const dailyPrice=getPricing(selectedBox,"Daily"),monthlyPrice=getPricing(selectedBox,"Monthly");
    const today=new Date().toISOString().slice(0,10);
    const {data:customer,error:customerError}=await supabaseClient.from("e2fit_customers").insert({name,phone,address}).select("id").single();
    if(customerError)throw customerError;
    const {data:subscription,error:subscriptionError}=await supabaseClient.from("e2fit_subscriptions").insert({
      customer_id:customer.id,box:selectedBox,plan:normalizedPlan,daily_price:dailyPrice,monthly_price:monthlyPrice,
      start_date:today,end_date:normalizedPlan==="Monthly"?new Date(Date.now()+25*86400000).toISOString().slice(0,10):today,delivery_time:time
    }).select("id").single();
    if(subscriptionError)throw subscriptionError;
    const {error:deliveryError}=await supabaseClient.from("e2fit_deliveries").insert({
      customer_id:customer.id,subscription_id:subscription.id,delivery_date:today,delivery_time:time,box:selectedBox,address
    });
    if(deliveryError)throw deliveryError;
    const message="Hi E2FIT!\n\nI'd like to order:\n• Box: "+selectedBox+"\n• Price: "+selectedPrice+"\n• Plan: "+plan+"\n• Delivery: "+time+"\n• Name: "+name+"\n• Phone: "+phone+"\n• Address: "+address+"\n\nMy order has been submitted through the E2FIT website. Please confirm the next steps.";
    window.open("https://wa.me/?text="+encodeURIComponent(message),"_blank");
    modal.classList.remove("open");alert("Order submitted successfully. We’ll continue on WhatsApp.");
    document.getElementById("customerName").value="";document.getElementById("customerPhone").value="";document.getElementById("customerAddress").value="";
  }catch(error){console.error(error);alert("We couldn't save the order. Please try again or contact E2FIT on WhatsApp.");}
  finally{button.disabled=false;button.textContent="Continue on WhatsApp →";}
});
document.querySelector(".menu-toggle").addEventListener("click",()=>{
  const nav=document.querySelector(".nav");nav.style.display=nav.style.display==="flex"?"none":"flex";
  nav.style.position="absolute";nav.style.top="78px";nav.style.left="0";nav.style.right="0";nav.style.padding="18px 22px";
  nav.style.background="#fbfaf4";nav.style.flexDirection="column";nav.style.borderBottom="1px solid #e9e8df";
});
document.querySelectorAll(".nav a").forEach(a=>a.addEventListener("click",()=>{if(innerWidth<1000)document.querySelector(".nav").style.display="none";}));