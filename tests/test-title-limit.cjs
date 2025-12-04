function enforceMaxLength(value, max) {
  const v = String(value || "");
  if (v.length <= max) {
    return { value: v, blocked: false };
  }
  return { value: v.slice(0, max), blocked: true };
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

console.log("🧪 Testando limitação de caracteres do Título (150 máx)...");

// Caso 1: vazio
let r = enforceMaxLength("", 150);
assert(r.value === "" && r.blocked === false, "Caso vazio falhou");

// Caso 2: exatamente 150
let s150 = "a".repeat(150);
r = enforceMaxLength(s150, 150);
assert(r.value.length === 150 && r.blocked === false, "Caso 150 falhou");

// Caso 3: ultrapassa 150
let s151 = "a".repeat(151);
r = enforceMaxLength(s151, 150);
assert(r.value.length === 150 && r.blocked === true, "Caso 151 falhou");

// Caso 4: threshold 80% (120)
let s120 = "a".repeat(120);
r = enforceMaxLength(s120, 150);
assert(r.value.length === 120 && r.blocked === false, "Caso 120 falhou");

console.log("✅ Todos os testes de limitação de caracteres passaram.");
