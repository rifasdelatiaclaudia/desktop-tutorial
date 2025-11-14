document.getElementById("formRifa").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value;
  const telefono = document.getElementById("telefono").value;

  // Generar número aleatorio automáticamente
  const numeroSeleccionado = Math.floor(Math.random() * 100000) + 1;

  const data = { nombre, telefono, numero: numeroSeleccionado };

  const respuesta = await fetch("/comprar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (respuesta.ok) {
    alert(`✅ Número ${numeroSeleccionado} comprado correctamente.`);
    document.getElementById("formRifa").reset();
  } else {
    alert("❌ Hubo un error al comprar tu número. Intenta nuevamente.");
  }
});
<script>
document.getElementById("formRifa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = document.getElementById("nombre").value.trim();
  const correo = document.getElementById("correo") ? document.getElementById("correo").value.trim() : "";
  const telefono = document.getElementById("telefono").value.trim();
  const instagram = document.getElementById("instagram") ? document.getElementById("instagram").value.trim() : "";

  if (!nombre || !telefono) { alert("Completa nombre y teléfono"); return; }

  const resp = await fetch("/iniciar-pago", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, correo, telefono, instagram })
  });
  const data = await resp.json();
  if (resp.ok && data.url) {
    window.location.href = data.url;
  } else {
    alert(data.error || "Error al iniciar el pago");
  }
});
</script>