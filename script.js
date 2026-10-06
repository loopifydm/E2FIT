document.addEventListener("DOMContentLoaded",()=>{
const modal=document.getElementById("orderModal");
let selectedBox="",selectedPrice="";
const E2FIT_WHATSAPP="917904894446";

document.querySelectorAll(".select-btn").forEach(btn=>btn.addEventListener("click",e=>{
 e.preventDefault();
 selectedBox=btn.dataset.box||"";
 selectedPrice=btn.dataset.price||"";
 document.getElementById("modalTitle").textContent=selectedBox+" — Enquiry";
 modal.classList.add("open");
 modal.setAttribute("aria-hidden","false");
 document.getElementById("customerName").focus();
}));

function closeModal(){modal.classList.remove("open");modal.setAttribute("aria-hidden","true");}
document.querySelector(".modal-close").addEventListener("click",closeModal);
document.querySelector(".modal-backdrop").addEventListener("click",closeModal);

document.getElementById("whatsappOrder").addEventListener("click",async()=>{
 const button=document.getElementById("whatsappOrder");
 const name=document.getElementById("customerName").value.trim(),phone=document.getElementById("customerPhone").value.trim(),address=document.getElementById("customerAddress").value.trim(),plan=document.getElementById("plan").value,time=document.getElementById("time").value;
 if(!selectedBox){alert("Please choose a box first.");return;}
 if(!name||!phone||!address){alert("Please enter your name, WhatsApp number and delivery address.");return;}
 const weekly={"Mixed Box":360,"Medium Box":480,"Premium Box":600,"Premium Pro Box":720};
 const price=plan.startsWith("Weekly")?"₹"+weekly[selectedBox]+"/week":selectedPrice;
 const message="Hi E2FIT!\n\nI'd like to enquire about:\n• Box: "+selectedBox+"\n• Price: "+price+"\n• Plan: "+plan+"\n• Delivery: "+time+"\n• Name: "+name+"\n• Phone: "+phone+"\n• Address: "+address+"\n\nI am enquiring through the E2FIT website. Please share the next steps.";
 const whatsappUrl="https://wa.me/"+E2FIT_WHATSAPP+"?text="+encodeURIComponent(message);
 button.disabled=true;button.textContent="Opening WhatsApp…";
 closeModal();
 document.getElementById("customerName").value="";document.getElementById("customerPhone").value="";document.getElementById("customerAddress").value="";
 const w=window.open(whatsappUrl,"_blank");if(!w)window.location.href=whatsappUrl;
 setTimeout(()=>{button.disabled=false;button.textContent="Continue on WhatsApp →";},500);
});
document.querySelector(".menu-toggle").addEventListener("click",()=>{
 const nav=document.querySelector(".nav");nav.style.display=nav.style.display==="flex"?"none":"flex";nav.style.position="absolute";nav.style.top="78px";nav.style.left="0";nav.style.right="0";nav.style.padding="18px 22px";nav.style.background="#fbfaf4";nav.style.flexDirection="column";nav.style.borderBottom="1px solid #e9e8df";
});
document.querySelectorAll(".nav a").forEach(a=>a.addEventListener("click",()=>{if(innerWidth<1000)document.querySelector(".nav").style.display="none";}));
});