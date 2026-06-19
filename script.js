const menuButton = document.querySelector("#menuButton");
const mobileMenu = document.querySelector("#mobileMenu");
const menuLines = document.querySelectorAll(".menu-line");
const mobileLinks = document.querySelectorAll(".mobile-link");

function toggleMenu() {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";

  menuButton.setAttribute("aria-expanded", String(!isOpen));

  mobileMenu.classList.toggle("pointer-events-none");
  mobileMenu.classList.toggle("opacity-0");
  mobileMenu.classList.toggle("translate-y-[-12px]");

  document.body.classList.toggle("overflow-hidden");

  menuLines[0].classList.toggle("translate-y-[7px]");
  menuLines[0].classList.toggle("rotate-45");

  menuLines[1].classList.toggle("opacity-0");

  menuLines[2].classList.toggle("-translate-y-[7px]");
  menuLines[2].classList.toggle("-rotate-45");
}

menuButton.addEventListener("click", toggleMenu);

mobileLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";

    if (isOpen) {
      toggleMenu();
    }
  });
});

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1-1-uMWNpamh54A3_Z9FfA7HxUhkUASylsHkjWJxoNSE/gviz/tq?tqx=out:csv&gid=1115045835";

const calendarTitle = document.querySelector("#calendarTitle");
const calendarGrid = document.querySelector("#calendarGrid");
const agendaList = document.querySelector("#agendaList");
const prevMonthButton = document.querySelector("#prevMonth");
const nextMonthButton = document.querySelector("#nextMonth");
const todayButton = document.querySelector("#todayButton");

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

let currentDate = new Date();
let agendaItems = [];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getField(row, aliases) {
  const normalizedRow = Object.entries(row).reduce((acc, [key, value]) => {
    acc[normalizeText(key)] = value;
    return acc;
  }, {});

  for (const alias of aliases) {
    const value = normalizedRow[normalizeText(alias)];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function parseDate(value) {
  if (!value) return null;

  const text = String(value).trim();

  if (text.includes("-")) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  if (text.includes("/")) {
    const [day, month, year] = text.split("/").map(Number);
    return new Date(year, month - 1, day);
  }

  return null;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getAgendaByDate() {
  return agendaItems.reduce((acc, item) => {
    acc[item.dateKey] = item;
    return acc;
  }, {});
}

function getStatusClasses(status) {
  const normalizedStatus = normalizeText(status);

  if (normalizedStatus === "ocupado") {
    return {
      cell: "bg-kaffee-caramel/20",
      text: "text-kaffee-brown",
      badge: "bg-kaffee-caramel text-kaffee-cream",
    };
  }

  if (normalizedStatus === "indisponivel" || normalizedStatus === "fechado") {
    return {
      cell: "opacity-40",
      text: "text-kaffee-earth",
      badge: "bg-kaffee-earth text-kaffee-cream",
    };
  }

  return {
    cell: "",
    text: "text-kaffee-earth",
    badge: "bg-kaffee-earth text-kaffee-cream",
  };
}

function renderCalendar() {
  if (!calendarTitle || !calendarGrid || !agendaList) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  calendarTitle.textContent = `${monthNames[month]} ${year}`;

  const agendaByDate = getAgendaByDate();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstWeekDay = firstDayOfMonth.getDay();
  const mondayBasedStart = firstWeekDay === 0 ? 6 : firstWeekDay - 1;
  const totalDays = lastDayOfMonth.getDate();

  calendarGrid.innerHTML = "";
  agendaList.innerHTML = "";

  for (let i = 0; i < mondayBasedStart; i++) {
    calendarGrid.insertAdjacentHTML(
      "beforeend",
      `<div class="min-h-[92px] border-r border-b border-kaffee-caramel/20 p-3 opacity-20"></div>`,
    );
  }

  const currentMonthItems = [];

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day);
    const dateKey = formatDateKey(date);
    const item = agendaByDate[dateKey];
    const status = item?.status || "";
    const horario = item?.horario || "";
    const observacao = item?.observacao || "";
    const classes = getStatusClasses(status);

    if (item) currentMonthItems.push(item);

    calendarGrid.insertAdjacentHTML(
      "beforeend",
      `
              <div class="min-h-[92px] border-r border-b border-kaffee-caramel/20 p-3 ${classes.cell}">
                <p class="font-semibold">${day}</p>

                ${
                  item
                    ? `
                      <p class="mt-2 text-[11px] leading-[1.4] ${classes.text}">
                        ${escapeHTML(status)}<br />
                        ${escapeHTML(horario)}
                      </p>
                    `
                    : ""
                }
              </div>
            `,
    );
  }

  currentMonthItems
    .sort((a, b) => a.date - b.date)
    .forEach((item) => {
      const classes = getStatusClasses(item.status);
      const day = String(item.date.getDate()).padStart(2, "0");
      const monthNumber = String(item.date.getMonth() + 1).padStart(2, "0");

      agendaList.insertAdjacentHTML(
        "beforeend",
        `
                <article class="px-5 py-5">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <p class="font-sans text-[13px] font-bold uppercase tracking-[0.16em] text-kaffee-brown">
                        ${day}/${monthNumber}${item.dia ? ` • ${escapeHTML(item.dia)}` : ""}
                      </p>

                      <p class="mt-2 font-sans text-[14px] leading-[1.6] text-kaffee-earth">
                        ${escapeHTML(item.horario)}
                      </p>

                      ${
                        item.observacao
                          ? `<p class="mt-2 font-sans text-[12px] leading-[1.6] text-kaffee-earth">${escapeHTML(item.observacao)}</p>`
                          : ""
                      }
                    </div>

                    <span class="shrink-0 rounded-full px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] ${classes.badge}">
                      ${escapeHTML(item.status)}
                    </span>
                  </div>
                </article>
              `,
      );
    });

  if (!agendaList.innerHTML.trim()) {
    agendaList.innerHTML = `
            <div class="px-5 py-6 text-center font-sans text-[13px] leading-[1.7] text-kaffee-earth">
              Nenhum horário cadastrado para este mês.
            </div>
          `;
  }
}

function showAgendaError() {
  if (calendarTitle) calendarTitle.textContent = "Agenda indisponível";

  if (calendarGrid) {
    calendarGrid.innerHTML = `
            <div class="col-span-7 p-6 text-center font-sans text-[13px] leading-[1.7] text-kaffee-earth">
              Não foi possível carregar a agenda. Verifique se a planilha está publicada ou compartilhada para visualização.
            </div>
          `;
  }

  if (agendaList) {
    agendaList.innerHTML = `
            <div class="px-5 py-6 text-center font-sans text-[13px] leading-[1.7] text-kaffee-earth">
              Não foi possível carregar a agenda.
            </div>
          `;
  }
}

function loadAgendaFromSheet() {
  if (typeof Papa === "undefined") {
    showAgendaError();
    return;
  }

  Papa.parse(SHEET_CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (result) {
      agendaItems = result.data
        .map((row) => {
          const date = parseDate(getField(row, ["Data", "data"]));
          const shouldShow = normalizeText(
            getField(row, ["Exibir no site?", "Exibir no site"]),
          );

          if (
            !date ||
            shouldShow === "nao" ||
            shouldShow === "não" ||
            shouldShow === "n"
          ) {
            return null;
          }

          return {
            date,
            dateKey: formatDateKey(date),
            dia: getField(row, ["Dia", "dia"]),
            status: getField(row, ["Status", "status"]) || "Livre",
            horario: getField(row, [
              "Horário exibido",
              "Horario exibido",
              "Horário",
              "Horario",
            ]),
            observacao: getField(row, [
              "Observação pública",
              "Observacao publica",
              "Observação",
              "Observacao",
            ]),
          };
        })
        .filter(Boolean);

      if (!agendaItems.length) {
        showAgendaError();
        return;
      }

      renderCalendar();
    },
    error: showAgendaError,
  });
}

prevMonthButton?.addEventListener("click", () => {
  currentDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - 1,
    1,
  );
  renderCalendar();
});

nextMonthButton?.addEventListener("click", () => {
  currentDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    1,
  );
  renderCalendar();
});

todayButton?.addEventListener("click", () => {
  currentDate = new Date();
  renderCalendar();
});

loadAgendaFromSheet();
