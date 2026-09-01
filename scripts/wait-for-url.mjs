const url = process.argv[2];
const label = process.argv[3] || 'servicio';
const timeoutMs = Number(process.argv[4] || 60_000);

if (!url) {
  console.error('Debes indicar una URL para esperar.');
  process.exit(1);
}

const deadline = Date.now() + timeoutMs;
console.log(`Esperando ${label} en ${url}...`);

while (Date.now() < deadline) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    if (response.ok) {
      console.log(`${label} listo.`);
      process.exit(0);
    }
  } catch {
    // El proceso todavía está arrancando; se vuelve a intentar.
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
}

console.error(`${label} no estuvo disponible después de ${Math.round(timeoutMs / 1000)} segundos.`);
process.exit(1);
