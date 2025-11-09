document.getElementById('checkBtn').addEventListener('click', ()=>{
  const n = document.getElementById('numInput').value.trim();
  if(!n) return alert('Ingresa un número');
  fetch('/api/numero/'+n).then(r=>r.json()).then(d=>{
    const el = document.getElementById('checkResult');
    if(d.disponible) el.innerHTML = `<p style="color:#8fd08a">Número ${d.numero} disponible ✅</p>`;
    else el.innerHTML = `<p style="color:#f08a8a">Número ${d.numero} vendido por ${d.venta.nombre} (${d.venta.telefono})</p>`;
  });
});

document.getElementById('buyForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const form = document.getElementById('buyForm');
  const fd = new FormData(form);
  const enviarWhatsapp = document.getElementById('enviarWhatsapp').checked;
  fd.append('metodo_whatsapp', enviarWhatsapp ? '1' : '0');
  const numeroRaw = document.getElementById('numero').value.trim();
  if(!numeroRaw) return alert('Ingresa un número');
  const numero = numeroRaw.padStart(5,'0');
  fd.set('numero', numero);
  const res = await fetch('/api/comprar', { method:'POST', body: fd });
  const j = await res.json();
  const out = document.getElementById('buyResult');
  if(j.ok){
    out.innerHTML = `<div style="color:#8fd08a">Número ${j.numero} reservado correctamente ✅</div>`;
    // if user wanted WhatsApp, open WhatsApp with prefilled message
    if(enviarWhatsapp){
      const telefono = document.getElementById('telefono').value.trim().replace(/\D/g,'');
      const texto = encodeURIComponent(`Hola, he pagado la rifa. Nombre: ${document.getElementById('nombre').value} - Número: ${j.numero} - Envío comprobante.`);
      window.open('https://wa.me/56'+telefono+'?text='+texto,'_blank');
    }
  } else {
    out.innerHTML = `<div style="color:#f08a8a">Error: ${j.error || 'no se pudo reservar'}</div>`;
  }
});

document.getElementById('exportBtn').addEventListener('click', ()=>{
  const pass = document.getElementById('adminPass').value;
  if(!pass) return alert('Ingresa contraseña admin');
  window.location = '/admin/export?pass='+encodeURIComponent(pass);
});

document.getElementById('listBtn').addEventListener('click', async ()=>{
  const pass = document.getElementById('adminPass').value;
  if(!pass) return alert('Ingresa contraseña admin');
  const res = await fetch('/admin/list?pass='+encodeURIComponent(pass));
  const json = await res.json();
  document.getElementById('adminResult').innerText = JSON.stringify(json, null, 2);
});
