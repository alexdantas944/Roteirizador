const form = document.getElementById("delivery-form");
const deliveriesTable = document.getElementById("deliveries-table");
const totalSemanaEl = document.getElementById("total-semana");
const totalQuinzenaEl = document.getElementById("total-quinzena");
const bonusEl = document.getElementById("bonus");

// 🔹 Variável que guarda todos os dados em memória
let entregas = JSON.parse(localStorage.getItem("entregas")) || [];

// 🔹 Função para salvar na variável e no localStorage
function salvarDados() {
  localStorage.setItem("entregas", JSON.stringify(entregas));
  console.log("📦 Dados atuais na variável:", entregas); // debug
}

// 🔹 Atualiza a tabela e os totais
function atualizarTabela() {
  deliveriesTable.innerHTML = "";
  let totalSemana = 0;
  let totalQuinzena = 0;

  const hoje = new Date();
  const inicioSemana = new Date();
  inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // domingo
  const inicioQuinzena = new Date();
  inicioQuinzena.setDate(hoje.getDate() - 14);

  entregas.forEach((entrega, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(entrega.data).toLocaleDateString("pt-BR")}</td>
      <td>${entrega.quantidade}</td>
      <td>
        <button onclick="excluirEntrega(${index})">❌ Excluir</button>
      </td>
    `;
    deliveriesTable.appendChild(tr);

    const dataEntrega = new Date(entrega.data);
    if (dataEntrega >= inicioSemana) {
      totalSemana += entrega.quantidade;
    }
    if (dataEntrega >= inicioQuinzena) {
      totalQuinzena += entrega.quantidade;
    }
  });

  totalSemanaEl.textContent = totalSemana;
  totalQuinzenaEl.textContent = totalQuinzena;

  let bonus = 0;
  if (totalQuinzena > 200) {
    bonus = (totalQuinzena - 200) * 5.5;
  }
  bonusEl.textContent = bonus.toFixed(2).replace(".", ",");
}
const faltamEl = document.getElementById("faltam");

// ...

function atualizarTabela() {
  deliveriesTable.innerHTML = "";
  let totalSemana = 0;
  let totalQuinzena = 0;

  const hoje = new Date();
  const inicioSemana = new Date();
  inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  const inicioQuinzena = new Date();
  inicioQuinzena.setDate(hoje.getDate() - 14);

  entregas.forEach((entrega, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(entrega.data).toLocaleDateString("pt-BR")}</td>
      <td>${entrega.quantidade}</td>
      <td><button onclick="excluirEntrega(${index})">❌ Excluir</button></td>
    `;
    deliveriesTable.appendChild(tr);

    const dataEntrega = new Date(entrega.data);
    if (dataEntrega >= inicioSemana) {
      totalSemana += entrega.quantidade;
    }
    if (dataEntrega >= inicioQuinzena) {
      totalQuinzena += entrega.quantidade;
    }
  });

  totalSemanaEl.textContent = totalSemana;
  totalQuinzenaEl.textContent = totalQuinzena;

  // 🔹 Calcular faltantes
  const meta = 200;
  const faltam = totalQuinzena >= meta ? 0 : meta - totalQuinzena;
  faltamEl.textContent = faltam;

  // 🔹 Calcular bonificação
  let bonus = 0;
  if (totalQuinzena > meta) {
    bonus = (totalQuinzena - meta) * 5.5;
  }
  bonusEl.textContent = bonus.toFixed(2).replace(".", ",");
}
// 🔹 Registrar nova entrega
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = form.data.value;
  const quantidade = parseInt(form.quantidade.value);

  entregas.push({ data, quantidade }); // adiciona na variável
  salvarDados(); // salva no localStorage
  form.reset();
  atualizarTabela();
});

// 🔹 Excluir entrega
function excluirEntrega(index) {
  entregas.splice(index, 1); // remove da variável
  salvarDados(); // atualiza localStorage
  atualizarTabela();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('Service Worker registrado com sucesso:', registration.scope);
      })
      .catch(err => {
        console.log('Falha ao registrar Service Worker:', err);
      });
  });
}
// 🔹 Inicializa
atualizarTabela();