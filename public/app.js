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