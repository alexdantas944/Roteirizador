// Conexão com Supabase
const { createClient } = supabase
const supabaseUrl = "https://skuwkibkicoiufxnoltl.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrdXdraWJraWNvaXVmeG5vbHRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NzUxNTksImV4cCI6MjA3MTE1MTE1OX0.F-trfc7Sz3BbsFJ5vFgPlBvGiWJcJoYQy-lhlaTv9wA"
const supabaseClient = createClient(supabaseUrl, supabaseKey)

// Referências
const form = document.getElementById("delivery-form")
const deliveriesTable = document.getElementById("deliveries-table")
const totalSemanaEl = document.getElementById("total-semana")
const totalQuinzenaEl = document.getElementById("total-quinzena")
const bonusEl = document.getElementById("bonus")

// Função para buscar entregas
async function loadDeliveries() {
  const { data, error } = await supabaseClient
    .from("entregas")
    .select("*")
    .order("data", { ascending: false })

  if (error) {
    console.error("Erro ao buscar entregas:", error)
    return
  }

  deliveriesTable.innerHTML = ""
  let totalSemana = 0
  let totalQuinzena = 0

  const hoje = new Date()
  const inicioSemana = new Date()
  inicioSemana.setDate(hoje.getDate() - hoje.getDay()) // Domingo
  const inicioQuinzena = new Date()
  inicioQuinzena.setDate(hoje.getDate() - 14)

  data.forEach(entrega => {
    const tr = document.createElement("tr")
    tr.innerHTML = `
      <td>${new Date(entrega.data).toLocaleDateString("pt-BR")}</td>
      <td>${entrega.quantidade}</td>
    `
    deliveriesTable.appendChild(tr)

    const dataEntrega = new Date(entrega.data)
    if (dataEntrega >= inicioSemana) {
      totalSemana += entrega.quantidade
    }
    if (dataEntrega >= inicioQuinzena) {
      totalQuinzena += entrega.quantidade
    }
  })

  totalSemanaEl.textContent = totalSemana
  totalQuinzenaEl.textContent = totalQuinzena

  let bonus = 0
  if (totalQuinzena > 200) {
    bonus = (totalQuinzena - 200) * 5.5
  }
  bonusEl.textContent = bonus.toFixed(2).replace(".", ",")
}

// Registrar nova entrega
form.addEventListener("submit", async (e) => {
  e.preventDefault()
  const data = form.data.value
  const quantidade = parseInt(form.quantidade.value)

  const { error } = await supabaseClient
    .from("entregas")
    .insert([{ data, quantidade }])

  if (error) {
    alert("Erro ao registrar entrega")
    console.error(error)
  } else {
    form.reset()
    loadDeliveries()
  }
})
console.log()

// Carregar dados ao abrir
loadDeliveries()
