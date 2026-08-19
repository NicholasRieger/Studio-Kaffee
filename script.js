// ===============================
// Menu mobile
// ===============================

const menuButton = document.querySelector("#menuButton");
const mobileMenu = document.querySelector("#mobileMenu");
const menuLines = document.querySelectorAll(".menu-line");
const mobileLinks = document.querySelectorAll(".mobile-link");

function toggleMenu() {
  if (!menuButton || !mobileMenu || menuLines.length < 3) return;

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

menuButton?.addEventListener("click", toggleMenu);

mobileLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const isOpen = menuButton?.getAttribute("aria-expanded") === "true";

    if (isOpen) {
      toggleMenu();
    }
  });
});

// ===============================
// Agenda via Google Sheets CSV
// ===============================

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1-1-uMWNpamh54A3_Z9FfA7HxUhkUASylsHkjWJxoNSE/gviz/tq?tqx=out:csv&gid=1115045835";

const STUDIO_WHATSAPP_NUMBER = "5511978981727";

const calendarTitle = document.querySelector("#calendarTitle");
const calendarGrid = document.querySelector("#calendarGrid");
const agendaList = document.querySelector("#agendaList");

const prevMonthButton = document.querySelector("#prevMonth");
const nextMonthButton = document.querySelector("#nextMonth");
const todayButton = document.querySelector("#todayButton");

const bookingModal = document.querySelector("#bookingModal");
const bookingModalContent = document.querySelector("#bookingModalContent");
const closeBookingModalButton = document.querySelector("#closeBookingModal");

const bookingDateText = document.querySelector("#bookingDateText");
const bookingStartTimeSelect = document.querySelector("#bookingStartTime");
const bookingEndTimeSelect = document.querySelector("#bookingEndTime");
const bookingTimeHint = document.querySelector("#bookingTimeHint");
const bookingUseInput = document.querySelector("#bookingUse");
const bookingWhatsAppButton = document.querySelector("#bookingWhatsApp");

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

const DEFAULT_AVAILABLE_INTERVALS = [
  {
    start: 10 * 60,
    end: 18 * 60,
  },
];

// ===============================
// Estado
// ===============================

// Sempre inicia no mês atual do dispositivo/navegador.
const today = new Date();

let currentDate = new Date(today.getFullYear(), today.getMonth(), 1);

let agendaItems = [];

let selectedBookingDate = null;
let selectedBookingAvailability = null;

// A agenda permite visualizar somente:
// mês atual + os 3 meses seguintes.
const CALENDAR_FUTURE_MONTHS = 3;

// ===============================
// Helpers
// ===============================

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getField(row, possibleNames) {
  const keys = Object.keys(row || {});

  for (const name of possibleNames) {
    const exactValue = row[name];

    if (exactValue !== undefined && exactValue !== null && exactValue !== "") {
      return exactValue;
    }
  }

  const normalizedPossibleNames = possibleNames.map(normalizeText);

  const matchingKey = keys.find((key) => {
    const normalizedKey = normalizeText(key);

    return normalizedPossibleNames.some((possibleName) => {
      return (
        normalizedKey === possibleName ||
        normalizedKey.endsWith(possibleName) ||
        normalizedKey.includes(possibleName)
      );
    });
  });

  if (!matchingKey) return "";

  return row[matchingKey] || "";
}

function parseDate(value) {
  if (!value) return null;

  const text = String(value).trim();

  const googleDateMatch = text.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2})\)/);

  if (googleDateMatch) {
    const year = Number(googleDateMatch[1]);
    const month = Number(googleDateMatch[2]);
    const day = Number(googleDateMatch[3]);

    return new Date(year, month, day);
  }

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);

    return new Date(year, month - 1, day);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/").map(Number);

    return new Date(year, month - 1, day);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(text)) {
    const [day, month, shortYear] = text.split("/").map(Number);

    const year = shortYear < 50 ? 2000 + shortYear : 1900 + shortYear;

    return new Date(year, month - 1, day);
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);

    const excelEpoch = new Date(1899, 11, 30);

    return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
  }

  return null;
}

function formatDateKey(date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatFullDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getCurrentMonthStart() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getLastAllowedMonth() {
  const currentMonth = getCurrentMonthStart();

  return new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + CALENDAR_FUTURE_MONTHS,
    1,
  );
}

function getMonthTimestamp(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function clampCurrentDateToAllowedRange() {
  const firstAllowedMonth = getCurrentMonthStart();
  const lastAllowedMonth = getLastAllowedMonth();

  const currentTimestamp = getMonthTimestamp(currentDate);
  const firstTimestamp = getMonthTimestamp(firstAllowedMonth);
  const lastTimestamp = getMonthTimestamp(lastAllowedMonth);

  if (currentTimestamp < firstTimestamp) {
    currentDate = firstAllowedMonth;

    return;
  }

  if (currentTimestamp > lastTimestamp) {
    currentDate = lastAllowedMonth;
  }
}

function updateMonthNavigationButtons() {
  const firstAllowedMonth = getCurrentMonthStart();
  const lastAllowedMonth = getLastAllowedMonth();

  const currentTimestamp = getMonthTimestamp(currentDate);

  const isAtFirstMonth =
    currentTimestamp <= getMonthTimestamp(firstAllowedMonth);

  const isAtLastMonth = currentTimestamp >= getMonthTimestamp(lastAllowedMonth);

  if (prevMonthButton) {
    prevMonthButton.disabled = isAtFirstMonth;

    prevMonthButton.classList.toggle("opacity-40", isAtFirstMonth);
    prevMonthButton.classList.toggle("cursor-not-allowed", isAtFirstMonth);
    prevMonthButton.classList.toggle("cursor-pointer", !isAtFirstMonth);
  }

  if (nextMonthButton) {
    nextMonthButton.disabled = isAtLastMonth;

    nextMonthButton.classList.toggle("opacity-40", isAtLastMonth);
    nextMonthButton.classList.toggle("cursor-not-allowed", isAtLastMonth);
    nextMonthButton.classList.toggle("cursor-pointer", !isAtLastMonth);
  }
}

function isStatus(status, statuses) {
  const normalizedStatus = normalizeText(status);

  return statuses.some((item) => normalizeText(item) === normalizedStatus);
}

function getTodayAtMidnight() {
  const current = new Date();

  return new Date(current.getFullYear(), current.getMonth(), current.getDate());
}

function isPastDate(date) {
  const selectedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  return selectedDate < getTodayAtMidnight();
}

function isMonday(date) {
  return date.getDay() === 1;
}

function intervalsAreEqual(firstIntervals, secondIntervals) {
  const first = mergeIntervals(firstIntervals);
  const second = mergeIntervals(secondIntervals);

  if (first.length !== second.length) {
    return false;
  }

  return first.every((interval, index) => {
    return (
      interval.start === second[index].start &&
      interval.end === second[index].end
    );
  });
}

// ===============================
// Lógica de horários
// ===============================

function parseTimeToMinutes(hour, minute = "00") {
  return Number(hour) * 60 + Number(minute || 0);
}

function parseIntervals(value) {
  const text = String(value || "")
    .toLowerCase()
    .replaceAll("às", "-")
    .replaceAll("as", "-")
    .replaceAll("até", "-");

  const regex =
    /(\d{1,2})(?:h|:)?(\d{2})?\s*(?:-|–|—|a)\s*(\d{1,2})(?:h|:)?(\d{2})?/g;

  const intervals = [];

  let match;

  while ((match = regex.exec(text)) !== null) {
    const start = parseTimeToMinutes(match[1], match[2]);

    const end = parseTimeToMinutes(match[3], match[4]);

    if (start < end) {
      intervals.push({
        start,
        end,
      });
    }
  }

  return intervals;
}

function mergeIntervals(intervals) {
  const sortedIntervals = [...intervals]
    .filter((interval) => interval.start < interval.end)
    .sort((a, b) => a.start - b.start);

  if (sortedIntervals.length === 0) {
    return [];
  }

  const merged = [{ ...sortedIntervals[0] }];

  for (let i = 1; i < sortedIntervals.length; i++) {
    const current = sortedIntervals[i];

    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({
        ...current,
      });
    }
  }

  return merged;
}

function intersectIntervals(firstIntervals, secondIntervals) {
  const intersections = [];

  mergeIntervals(firstIntervals).forEach((firstInterval) => {
    mergeIntervals(secondIntervals).forEach((secondInterval) => {
      const start = Math.max(firstInterval.start, secondInterval.start);

      const end = Math.min(firstInterval.end, secondInterval.end);

      if (start < end) {
        intersections.push({
          start,
          end,
        });
      }
    });
  });

  return mergeIntervals(intersections);
}

function subtractIntervals(baseIntervals, busyIntervals) {
  let availableIntervals = mergeIntervals(baseIntervals);

  mergeIntervals(busyIntervals).forEach((busyInterval) => {
    const updatedIntervals = [];

    availableIntervals.forEach((availableInterval) => {
      const doesNotOverlap =
        busyInterval.end <= availableInterval.start ||
        busyInterval.start >= availableInterval.end;

      if (doesNotOverlap) {
        updatedIntervals.push(availableInterval);

        return;
      }

      if (busyInterval.start > availableInterval.start) {
        updatedIntervals.push({
          start: availableInterval.start,

          end: Math.min(busyInterval.start, availableInterval.end),
        });
      }

      if (busyInterval.end < availableInterval.end) {
        updatedIntervals.push({
          start: Math.max(busyInterval.end, availableInterval.start),

          end: availableInterval.end,
        });
      }
    });

    availableIntervals = updatedIntervals;
  });

  return mergeIntervals(availableIntervals);
}

function formatMinutes(minutes) {
  const hour = Math.floor(minutes / 60);

  const minute = minutes % 60;

  if (minute === 0) {
    return `${hour}h`;
  }

  return `${hour}h${String(minute).padStart(2, "0")}`;
}

function formatIntervals(intervals) {
  if (!intervals.length) {
    return "";
  }

  return intervals
    .map(
      (interval) =>
        `${formatMinutes(interval.start)} - ${formatMinutes(interval.end)}`,
    )
    .join(" / ");
}

function getAvailableTimePoints(intervals, stepInMinutes = 30) {
  const points = [];

  intervals.forEach((interval) => {
    for (
      let time = interval.start;
      time <= interval.end;
      time += stepInMinutes
    ) {
      points.push(time);
    }
  });

  return [...new Set(points)].sort((a, b) => a - b);
}

function getValidEndTimes(startTime, intervals, minimumDuration = 120) {
  const validEndTimes = [];

  intervals.forEach((interval) => {
    if (startTime < interval.start || startTime >= interval.end) {
      return;
    }

    for (
      let endTime = startTime + minimumDuration;
      endTime <= interval.end;
      endTime += 30
    ) {
      validEndTimes.push(endTime);
    }
  });

  return [...new Set(validEndTimes)].sort((a, b) => a - b);
}

function fillSelectWithTimes(select, times) {
  if (!select) return;

  select.innerHTML = "";

  times.forEach((time) => {
    select.insertAdjacentHTML(
      "beforeend",
      `
        <option value="${time}">
          ${formatMinutes(time)}
        </option>
      `,
    );
  });
}

function getAgendaByDate() {
  return agendaItems.reduce((acc, item) => {
    if (!acc[item.dateKey]) {
      acc[item.dateKey] = [];
    }

    acc[item.dateKey].push(item);

    return acc;
  }, {});
}

// ===============================
// Disponibilidade por dia
// ===============================

function getDayAvailability(date, entries = []) {
  // Segunda-feira sempre indisponível.
  if (isMonday(date)) {
    return {
      status: "Indisponível",
      horario: "Indisponível",
      observacao: "Estúdio indisponível às segundas-feiras",
      busyText: "",
      isException: true,
      availableIntervals: [],
    };
  }

  // Dia completamente fechado.
  const closedEntry = entries.find((entry) =>
    isStatus(entry.status, ["Fechado", "Indisponível", "Indisponivel"]),
  );

  if (closedEntry) {
    return {
      status: closedEntry.status || "Fechado",

      horario: closedEntry.horario || closedEntry.status || "Fechado",

      observacao: closedEntry.observacao || "",

      busyText: "",

      isException: true,

      availableIntervals: [],
    };
  }

  // Horários declarados como livres na planilha.
  const freeIntervalsFromSheet = entries
    .filter((entry) => isStatus(entry.status, ["Livre"]))
    .flatMap((entry) => parseIntervals(entry.horario));

  // Horários ocupados na planilha.
  const busyIntervalsFromSheet = entries
    .filter((entry) => isStatus(entry.status, ["Ocupado"]))
    .flatMap((entry) => parseIntervals(entry.horario));

  // Caso não exista intervalo livre específico,
  // usa o funcionamento padrão 9h às 18h.
  const baseAvailableIntervals =
    freeIntervalsFromSheet.length > 0
      ? mergeIntervals(freeIntervalsFromSheet)
      : DEFAULT_AVAILABLE_INTERVALS;

  const busyIntervals = intersectIntervals(
    busyIntervalsFromSheet,
    baseAvailableIntervals,
  );

  const finalAvailableIntervals = subtractIntervals(
    baseAvailableIntervals,
    busyIntervals,
  );

  const isDefaultAvailability = intervalsAreEqual(
    finalAvailableIntervals,
    DEFAULT_AVAILABLE_INTERVALS,
  );

  if (finalAvailableIntervals.length === 0) {
    return {
      status: "Ocupado",
      horario: "Sem horários disponíveis",
      observacao: "",
      busyText: "",
      isException: true,
      availableIntervals: [],
    };
  }

  return {
    status: "Livre",

    horario: formatIntervals(finalAvailableIntervals),

    observacao: "",

    busyText: "",

    isException: !isDefaultAvailability,

    availableIntervals: finalAvailableIntervals,
  };
}

// ===============================
// Visual / status
// ===============================

function getStatusClasses(status) {
  const normalizedStatus = normalizeText(status);

  if (
    normalizedStatus === "ocupado" ||
    normalizedStatus === "indisponivel" ||
    normalizedStatus === "fechado" ||
    normalizedStatus === "manutencao"
  ) {
    return {
      cell: "bg-[#d8c0a6]",
      text: "text-kaffee-brown",
      badge: "bg-kaffee-brown text-kaffee-cream",
      dot: "bg-[#d8c0a6]",
    };
  }

  return {
    cell: "bg-[#efe1d2]",
    text: "text-kaffee-earth",
    badge: "bg-kaffee-earth text-kaffee-cream",
    dot: "bg-[#efe1d2]",
  };
}

// ===============================
// Modal de agendamento
// ===============================

function updateEndTimeOptions() {
  if (
    !bookingStartTimeSelect ||
    !bookingEndTimeSelect ||
    !selectedBookingAvailability
  ) {
    return;
  }

  const startTime = Number(bookingStartTimeSelect.value);

  const availableIntervals =
    selectedBookingAvailability.availableIntervals || [];

  const endTimes = getValidEndTimes(startTime, availableIntervals);

  fillSelectWithTimes(bookingEndTimeSelect, endTimes);

  if (bookingTimeHint) {
    if (endTimes.length === 0) {
      bookingTimeHint.textContent =
        "Não há horário final disponível respeitando a locação mínima de 2 horas.";
    } else {
      bookingTimeHint.textContent = "A locação mínima é de 2 horas.";
    }
  }

  updateBookingWhatsAppLink();
}

function openBookingModal(dayItem) {
  if (
    !bookingModal ||
    !bookingDateText ||
    !bookingStartTimeSelect ||
    !bookingEndTimeSelect ||
    !bookingUseInput ||
    !bookingWhatsAppButton
  ) {
    return;
  }

  if (normalizeText(dayItem.status) !== "livre") {
    return;
  }

  if (isPastDate(dayItem.date)) {
    return;
  }

  const availableIntervals = dayItem.availableIntervals || [];

  const startTimes = getAvailableTimePoints(availableIntervals).filter(
    (time) => {
      return getValidEndTimes(time, availableIntervals).length > 0;
    },
  );

  selectedBookingDate = dayItem.date;

  selectedBookingAvailability = dayItem;

  bookingDateText.textContent = formatFullDate(dayItem.date);

  bookingStartTimeSelect.innerHTML = "";

  bookingEndTimeSelect.innerHTML = "";

  bookingUseInput.value = "";

  if (startTimes.length === 0) {
    bookingStartTimeSelect.insertAdjacentHTML(
      "beforeend",
      `
        <option value="">
          Sem horários disponíveis
        </option>
      `,
    );

    bookingEndTimeSelect.insertAdjacentHTML(
      "beforeend",
      `
        <option value="">
          —
        </option>
      `,
    );

    bookingStartTimeSelect.disabled = true;

    bookingEndTimeSelect.disabled = true;

    bookingWhatsAppButton.classList.add("pointer-events-none", "opacity-50");

    if (bookingTimeHint) {
      bookingTimeHint.textContent =
        "Não há janelas disponíveis com o mínimo de 2 horas.";
    }
  } else {
    fillSelectWithTimes(bookingStartTimeSelect, startTimes);

    bookingStartTimeSelect.disabled = false;

    bookingEndTimeSelect.disabled = false;

    bookingWhatsAppButton.classList.remove("pointer-events-none", "opacity-50");

    updateEndTimeOptions();
  }

  updateBookingWhatsAppLink();

  bookingModal.classList.remove("pointer-events-none", "opacity-0");

  bookingModalContent?.classList.remove("translate-y-4");

  document.body.classList.add("overflow-hidden");
}

function closeBookingModal() {
  if (!bookingModal) return;

  bookingModal.classList.add("pointer-events-none", "opacity-0");

  bookingModalContent?.classList.add("translate-y-4");

  document.body.classList.remove("overflow-hidden");
}

function updateBookingWhatsAppLink() {
  if (
    !bookingWhatsAppButton ||
    !selectedBookingDate ||
    !bookingStartTimeSelect ||
    !bookingEndTimeSelect ||
    !bookingUseInput
  ) {
    return;
  }

  const startTime = bookingStartTimeSelect.value
    ? formatMinutes(Number(bookingStartTimeSelect.value))
    : "";

  const endTime = bookingEndTimeSelect.value
    ? formatMinutes(Number(bookingEndTimeSelect.value))
    : "";

  const selectedTime =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : "Ainda não selecionado";

  const studioUse = bookingUseInput.value.trim();

  const message = `
Olá! Gostaria de solicitar uma reserva no Studio Kaffee.

Dia: ${formatFullDate(selectedBookingDate)}
Horário: ${selectedTime}
Uso do estúdio: ${studioUse || "Ainda não informado"}
`.trim();

  const whatsappUrl = `https://wa.me/${STUDIO_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    message,
  )}`;

  bookingWhatsAppButton.href = whatsappUrl;
}

function validateBookingBeforeSend(event) {
  if (!bookingStartTimeSelect || !bookingEndTimeSelect || !bookingUseInput) {
    return;
  }

  if (!bookingStartTimeSelect.value || !bookingEndTimeSelect.value) {
    event.preventDefault();

    alert("Selecione o horário inicial e final antes de enviar.");

    return;
  }

  if (!bookingUseInput.value.trim()) {
    event.preventDefault();

    alert("Informe qual será o uso do estúdio antes de enviar.");
  }
}

// ===============================
// Dias do mês
// ===============================

function getMonthDays(year, month) {
  const agendaByDate = getAgendaByDate();

  const totalDays = getDaysInMonth(year, month);

  const days = [];

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day);

    const dateKey = formatDateKey(date);

    const entries = agendaByDate[dateKey] || [];

    const availability = getDayAvailability(date, entries);

    days.push({
      date,
      day,
      dateKey,
      entries,
      ...availability,
    });
  }

  return days;
}

// ===============================
// Calendário
// ===============================

function renderCalendar() {
  if (!calendarTitle || !calendarGrid || !agendaList) {
    return;
  }

  // Se o mês real mudou enquanto a página estava aberta,
  // impede que o calendário permaneça em um mês já passado
  // ou avance além dos dois meses futuros permitidos.
  clampCurrentDateToAllowedRange();

  updateMonthNavigationButtons();

  const year = currentDate.getFullYear();

  const month = currentDate.getMonth();

  calendarTitle.textContent = `${monthNames[month]} ${year}`;

  const firstDayOfMonth = new Date(year, month, 1);

  const firstWeekDay = firstDayOfMonth.getDay();

  // Calendário começa na segunda.
  const mondayBasedStart = firstWeekDay === 0 ? 6 : firstWeekDay - 1;

  const monthDays = getMonthDays(year, month);

  calendarGrid.innerHTML = "";
  agendaList.innerHTML = "";

  // Espaços antes do primeiro dia do mês.
  for (let i = 0; i < mondayBasedStart; i++) {
    calendarGrid.insertAdjacentHTML(
      "beforeend",
      `
        <div
          class="min-h-[106px] border-r border-b border-kaffee-caramel/20 p-3 opacity-20"
        ></div>
      `,
    );
  }

  monthDays.forEach((item) => {
    const classes = getStatusClasses(item.status);

    const isClickable =
      normalizeText(item.status) === "livre" && !isPastDate(item.date);

    calendarGrid.insertAdjacentHTML(
      "beforeend",
      `
        <button
          type="button"
          data-booking-date="${item.dateKey}"
          class="min-h-[106px] border-r border-b border-kaffee-caramel/20 p-3 text-left transition ${
            isClickable
              ? `${classes.cell} cursor-pointer hover:bg-kaffee-caramel/20`
              : `${classes.cell} cursor-not-allowed opacity-70`
          }"
        >
          <p class="font-semibold text-[18px]">
            ${item.day}
          </p>

          <p
            class="mt-3 text-[12px] leading-[1.45] ${classes.text}"
          >
            ${escapeHTML(item.status)}
            <br />
            ${escapeHTML(item.horario)}
          </p>

          ${
            item.observacao
              ? `
                <p
                  class="mt-2 line-clamp-2 text-[10px] leading-[1.4] text-kaffee-earth"
                >
                  ${escapeHTML(item.observacao)}
                </p>
              `
              : ""
          }
        </button>
      `,
    );
  });

  // Clique nos dias.
  calendarGrid.querySelectorAll("[data-booking-date]").forEach((button) => {
    button.addEventListener("click", () => {
      const dateKey = button.getAttribute("data-booking-date");

      const dayItem = monthDays.find((item) => item.dateKey === dateKey);

      if (dayItem) {
        openBookingModal(dayItem);
      }
    });
  });

  renderMobileAgendaList(monthDays);
}

// ===============================
// Agendamento mobile
// ===============================

function renderMobileAgendaList(monthDays) {
  const availableDays = monthDays.filter((item) => {
    return normalizeText(item.status) === "livre" && !isPastDate(item.date);
  });

  agendaList.insertAdjacentHTML(
    "beforeend",
    `
      <div class="bg-kaffee-caramel/10 px-4 py-5">
        <p
          class="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-kaffee-brown"
        >
          Solicitar reserva
        </p>

        <p
          class="mt-2 font-sans text-[12px] leading-[1.7] text-kaffee-earth"
        >
          Consulte a disponibilidade no calendário acima e selecione um dia para escolher o horário.
        </p>

        <div class="mt-5">
          <label
            for="mobileBookingDaySelect"
            class="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-kaffee-brown"
          >
            Escolha um dia disponível
          </label>

          <select
            id="mobileBookingDaySelect"
            class="mt-2 w-full border border-kaffee-caramel/30 bg-kaffee-cream px-4 py-3 font-sans text-[13px] text-kaffee-earth outline-none"
          >
            ${
              availableDays.length > 0
                ? availableDays
                    .map((item) => {
                      const day = String(item.date.getDate()).padStart(2, "0");

                      const monthNumber = String(
                        item.date.getMonth() + 1,
                      ).padStart(2, "0");

                      return `
                          <option value="${item.dateKey}">
                            ${day}/${monthNumber} — ${escapeHTML(item.horario)}
                          </option>
                        `;
                    })
                    .join("")
                : `
                  <option value="">
                    Nenhum dia disponível para agendamento
                  </option>
                `
            }
          </select>

          <button
            id="mobileBookingDayButton"
            type="button"
            class="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 bg-kaffee-brown px-5 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-kaffee-cream shadow-md transition hover:bg-[#61300d]"
          >
            Selecionar horário
          </button>
        </div>
      </div>
    `,
  );

  const mobileBookingDaySelect = document.querySelector(
    "#mobileBookingDaySelect",
  );

  const mobileBookingDayButton = document.querySelector(
    "#mobileBookingDayButton",
  );

  if (availableDays.length === 0) {
    mobileBookingDayButton?.classList.add("pointer-events-none", "opacity-50");
  }

  mobileBookingDayButton?.addEventListener("click", () => {
    const dateKey = mobileBookingDaySelect?.value;

    const dayItem = monthDays.find((item) => item.dateKey === dateKey);

    if (dayItem) {
      openBookingModal(dayItem);
    }
  });
}

// ===============================
// Erro da agenda
// ===============================

function showAgendaError(message = "Agenda indisponível") {
  if (calendarTitle) {
    calendarTitle.textContent = message;
  }

  if (calendarGrid) {
    calendarGrid.innerHTML = `
      <div
        class="col-span-7 p-6 text-center font-sans text-[13px] text-kaffee-earth"
      >
        Não foi possível carregar a agenda.
        Verifique se a planilha está publicada
        ou compartilhada para visualização.
      </div>
    `;
  }

  if (agendaList) {
    agendaList.innerHTML = `
      <div
        class="px-5 py-6 text-center font-sans text-[13px] leading-[1.7] text-kaffee-earth"
      >
        Não foi possível carregar a agenda.
      </div>
    `;
  }
}

// ===============================
// Carregamento da planilha
// ===============================

function loadAgendaFromSheet() {
  if (!calendarTitle || !calendarGrid || !agendaList) {
    return;
  }

  if (typeof Papa === "undefined") {
    showAgendaError("PapaParse não carregou");

    console.error(
      "PapaParse não foi carregado. Adicione o CDN do PapaParse antes do script.js.",
    );

    return;
  }

  // Renderiza imediatamente para não ficar travado em "Carregando...".
  renderCalendar();

  Papa.parse(SHEET_CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,

    beforeFirstChunk: function (chunk) {
      const lines = chunk.split(/\r?\n/);

      const headerIndex = lines.findIndex((line) => {
        const normalizedLine = normalizeText(line);

        return (
          normalizedLine.includes("data") &&
          normalizedLine.includes("status") &&
          normalizedLine.includes("horario") &&
          normalizedLine.includes("exibir")
        );
      });

      if (headerIndex > 0) {
        return lines.slice(headerIndex).join("\n");
      }

      return chunk;
    },

    complete: function (result) {
      agendaItems = result.data
        .map((row) => {
          const dateValue = getField(row, ["Data", "data"]);

          const date = parseDate(dateValue);

          const shouldShow = normalizeText(
            getField(row, [
              "Exibir no site?",
              "Exibir no site",
              "Exibir",
              "Mostrar no site?",
              "Mostrar no site",
            ]),
          );

          const isHidden =
            shouldShow === "nao" ||
            shouldShow === "não" ||
            shouldShow === "n" ||
            shouldShow === "false" ||
            shouldShow === "falso" ||
            shouldShow === "0";

          if (!date || isHidden) {
            return null;
          }

          return {
            date,

            dateKey: formatDateKey(date),

            dia: getField(row, ["Dia", "Dia da semana", "dia"]),

            status: getField(row, ["Status", "status"]) || "Livre",

            horario: getField(row, [
              "Horário exibido",
              "Horario exibido",
              "Horário",
              "Horario",
              "Hora",
            ]),

            observacao: getField(row, [
              "Observação pública",
              "Observacao publica",
              "Observação",
              "Observacao",
              "Observações",
              "Observacoes",
            ]),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.date - b.date);

      // Atualiza novamente quando os dados reais chegam.
      renderCalendar();
    },

    error: function (error) {
      console.error("Erro ao carregar CSV:", error);

      showAgendaError();
    },
  });
}

// ===============================
// Navegação entre meses
// ===============================

prevMonthButton?.addEventListener("click", () => {
  const firstAllowedMonth = getCurrentMonthStart();

  if (getMonthTimestamp(currentDate) <= getMonthTimestamp(firstAllowedMonth)) {
    return;
  }

  currentDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - 1,
    1,
  );

  renderCalendar();
});

nextMonthButton?.addEventListener("click", () => {
  const lastAllowedMonth = getLastAllowedMonth();

  if (getMonthTimestamp(currentDate) >= getMonthTimestamp(lastAllowedMonth)) {
    return;
  }

  currentDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    1,
  );

  renderCalendar();
});

todayButton?.addEventListener("click", () => {
  currentDate = getCurrentMonthStart();

  renderCalendar();
});

// ===============================
// Eventos do modal de agendamento
// ===============================

closeBookingModalButton?.addEventListener("click", closeBookingModal);

bookingModal?.addEventListener("click", (event) => {
  if (event.target === bookingModal) {
    closeBookingModal();
  }
});

bookingStartTimeSelect?.addEventListener("change", updateEndTimeOptions);

bookingEndTimeSelect?.addEventListener("change", updateBookingWhatsAppLink);

bookingUseInput?.addEventListener("input", updateBookingWhatsAppLink);

bookingWhatsAppButton?.addEventListener("click", validateBookingBeforeSend);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeBookingModal();
  }
});

// ===============================
// Inicialização da agenda
// ===============================

loadAgendaFromSheet();

// ===============================
// Carrossel do Studio
// ===============================

const galleryViewport = document.querySelector("#galleryViewport");
const galleryTrack = document.querySelector("#galleryTrack");
const galleryPrev = document.querySelector("#galleryPrev");
const galleryNext = document.querySelector("#galleryNext");
const galleryDots = document.querySelector("#galleryDots");

function getGallerySlides() {
  if (!galleryTrack) return [];

  return Array.from(galleryTrack.querySelectorAll(".gallery-slide"));
}

function getGalleryGap() {
  if (!galleryTrack) return 0;

  const styles = window.getComputedStyle(galleryTrack);

  return parseFloat(styles.gap || styles.columnGap || "0");
}

function getGalleryStep() {
  const firstSlide = getGallerySlides()[0];

  if (!firstSlide) return 0;

  return firstSlide.getBoundingClientRect().width + getGalleryGap();
}

function getGalleryMaxScroll() {
  if (!galleryViewport) return 0;

  return Math.max(galleryViewport.scrollWidth - galleryViewport.clientWidth, 0);
}

function getGalleryMaxIndex() {
  const step = getGalleryStep();

  if (step <= 0) return 0;

  return Math.ceil(getGalleryMaxScroll() / step);
}

function getCurrentGalleryIndex() {
  if (!galleryViewport) return 0;

  const step = getGalleryStep();

  if (step <= 0) return 0;

  return Math.max(
    0,
    Math.min(
      Math.round(galleryViewport.scrollLeft / step),
      getGalleryMaxIndex(),
    ),
  );
}

function updateGalleryButtons() {
  if (!galleryViewport) return;

  const maxScroll = getGalleryMaxScroll();
  const currentScroll = galleryViewport.scrollLeft;

  if (galleryPrev) {
    galleryPrev.disabled = currentScroll <= 2;
  }

  if (galleryNext) {
    galleryNext.disabled = currentScroll >= maxScroll - 2;
  }
}

function renderGalleryDots() {
  if (!galleryDots || !galleryViewport) return;

  const maxIndex = getGalleryMaxIndex();
  const currentIndex = getCurrentGalleryIndex();

  galleryDots.innerHTML = "";

  for (let index = 0; index <= maxIndex; index++) {
    const dot = document.createElement("button");

    dot.type = "button";
    dot.setAttribute("aria-label", `Ir para posição ${index + 1}`);

    dot.className = `
      h-2.5 w-2.5 cursor-pointer rounded-full transition
      ${index === currentIndex ? "bg-kaffee-brown" : "bg-kaffee-caramel/30"}
    `;

    dot.addEventListener("click", () => {
      galleryViewport.scrollTo({
        left: Math.min(index * getGalleryStep(), getGalleryMaxScroll()),
        behavior: "smooth",
      });
    });

    galleryDots.appendChild(dot);
  }
}

// ===============================
// Setas do carrossel
// ===============================

galleryNext?.addEventListener("click", () => {
  galleryViewport?.scrollBy({
    left: getGalleryStep(),
    behavior: "smooth",
  });
});

galleryPrev?.addEventListener("click", () => {
  galleryViewport?.scrollBy({
    left: -getGalleryStep(),
    behavior: "smooth",
  });
});

// ===============================
// Atualização durante o scroll
// ===============================

let galleryScrollFrame = null;

galleryViewport?.addEventListener(
  "scroll",
  () => {
    if (galleryScrollFrame) return;

    galleryScrollFrame = requestAnimationFrame(() => {
      updateGalleryButtons();
      renderGalleryDots();

      galleryScrollFrame = null;
    });
  },
  { passive: true },
);

// ===============================
// Drag livre com mouse
// ===============================

let galleryMouseDragging = false;
let galleryMouseStartX = 0;
let galleryMouseStartScroll = 0;
let galleryMouseMoved = false;

let galleryPressedImageIndex = null;

if (galleryViewport) {
  galleryViewport.style.cursor = "grab";
  galleryViewport.style.userSelect = "none";
}

getGallerySlides().forEach((image) => {
  image.draggable = false;

  image.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });
});

galleryViewport?.addEventListener("pointerdown", (event) => {
  // Touch continua usando o scroll nativo.
  if (event.pointerType !== "mouse" || event.button !== 0) {
    return;
  }

  galleryMouseDragging = true;
  galleryMouseMoved = false;

  galleryMouseStartX = event.clientX;
  galleryMouseStartScroll = galleryViewport.scrollLeft;

  /*
   * Guarda qual imagem recebeu o clique.
   * Assim conseguimos abrir o lightbox no pointerup,
   * mesmo usando pointer capture.
   */
  const clickedImage = event.target.closest(".gallery-slide");

  if (clickedImage) {
    galleryPressedImageIndex = getGallerySlides().indexOf(clickedImage);
  } else {
    galleryPressedImageIndex = null;
  }

  galleryViewport.style.cursor = "grabbing";

  galleryViewport.setPointerCapture(event.pointerId);
});

galleryViewport?.addEventListener("pointermove", (event) => {
  if (!galleryMouseDragging) return;

  const difference = event.clientX - galleryMouseStartX;

  if (Math.abs(difference) > 5) {
    galleryMouseMoved = true;
  }

  /*
   * Arraste totalmente livre.
   * Não existe snap nem centralização.
   */
  galleryViewport.scrollLeft = galleryMouseStartScroll - difference;
});

galleryViewport?.addEventListener("pointerup", () => {
  if (!galleryMouseDragging) return;

  galleryMouseDragging = false;

  galleryViewport.style.cursor = "grab";

  /*
   * Se NÃO houve arraste e o clique
   * começou em uma imagem, abre o lightbox.
   */
  if (
    !galleryMouseMoved &&
    galleryPressedImageIndex !== null &&
    galleryPressedImageIndex >= 0
  ) {
    openGalleryLightbox(galleryPressedImageIndex);
  }

  galleryPressedImageIndex = null;
});

galleryViewport?.addEventListener("pointercancel", () => {
  galleryMouseDragging = false;
  galleryMouseMoved = false;
  galleryPressedImageIndex = null;

  if (galleryViewport) {
    galleryViewport.style.cursor = "grab";
  }
});

// ===============================
// Lightbox da galeria
// ===============================

const galleryLightbox = document.querySelector("#galleryLightbox");
const galleryLightboxPanel = document.querySelector("#galleryLightboxPanel");
const galleryLightboxImage = document.querySelector("#galleryLightboxImage");
const galleryLightboxPrev = document.querySelector("#galleryLightboxPrev");
const galleryLightboxNext = document.querySelector("#galleryLightboxNext");

const closeGalleryLightboxButton = document.querySelector(
  "#closeGalleryLightbox",
);

let galleryLightboxIndex = 0;

let lightboxDragging = false;
let lightboxStartX = 0;
let lightboxCurrentX = 0;
let lightboxAnimating = false;

function isGalleryLightboxOpen() {
  return Boolean(
    galleryLightbox && !galleryLightbox.classList.contains("opacity-0"),
  );
}

function updateGalleryLightbox() {
  const images = getGallerySlides();

  const currentImage = images[galleryLightboxIndex];

  if (!currentImage || !galleryLightboxImage) return;

  galleryLightboxImage.src = currentImage.src;

  galleryLightboxImage.alt =
    currentImage.alt || "Imagem ampliada do Studio Kaffee";

  if (galleryLightboxPrev) {
    galleryLightboxPrev.disabled = galleryLightboxIndex <= 0;
  }

  if (galleryLightboxNext) {
    galleryLightboxNext.disabled = galleryLightboxIndex >= images.length - 1;
  }
}

// ===============================
// Abrir / fechar lightbox
// ===============================

function openGalleryLightbox(index) {
  if (!galleryLightbox || !galleryLightboxImage) return;

  galleryLightboxIndex = index;

  lightboxDragging = false;
  lightboxAnimating = false;

  galleryLightboxImage.style.transition = "";
  galleryLightboxImage.style.transform = "";
  galleryLightboxImage.style.opacity = "";

  updateGalleryLightbox();

  galleryLightbox.classList.remove("pointer-events-none", "opacity-0");

  galleryLightboxImage.classList.remove("scale-95");

  document.body.classList.add("overflow-hidden");
}

function closeGalleryLightbox() {
  if (!galleryLightbox || !galleryLightboxImage) return;

  lightboxDragging = false;
  lightboxAnimating = false;

  galleryLightbox.classList.add("pointer-events-none", "opacity-0");

  galleryLightboxImage.classList.add("scale-95");

  galleryLightboxImage.style.transition = "";
  galleryLightboxImage.style.transform = "";
  galleryLightboxImage.style.opacity = "";

  document.body.classList.remove("overflow-hidden");
}

// ===============================
// Toque nas imagens - tablet/mobile
// ===============================

let galleryTouchStartX = 0;
let galleryTouchStartY = 0;

getGallerySlides().forEach((image, index) => {
  image.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.touches[0];

      if (!touch) return;

      galleryTouchStartX = touch.clientX;
      galleryTouchStartY = touch.clientY;
    },
    {
      passive: true,
    },
  );

  image.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];

      if (!touch) return;

      const differenceX = Math.abs(touch.clientX - galleryTouchStartX);

      const differenceY = Math.abs(touch.clientY - galleryTouchStartY);

      /*
       * Se o dedo praticamente não se moveu,
       * consideramos um toque.
       *
       * Se moveu bastante na horizontal,
       * foi swipe do carrossel e NÃO abre.
       */
      if (differenceX < 12 && differenceY < 12) {
        openGalleryLightbox(index);
      }
    },
    {
      passive: true,
    },
  );
});

// ===============================
// Retornar imagem ampliada ao centro
// ===============================

function resetLightboxPosition() {
  if (!galleryLightboxImage) return;

  galleryLightboxImage.style.transition =
    "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease";

  galleryLightboxImage.style.transform = "translate3d(0, 0, 0) scale(1)";

  galleryLightboxImage.style.opacity = "1";

  window.setTimeout(() => {
    if (!galleryLightboxImage || lightboxAnimating) return;

    galleryLightboxImage.style.transition = "";
    galleryLightboxImage.style.transform = "";
    galleryLightboxImage.style.opacity = "";
  }, 280);
}

// ===============================
// Troca animada de imagem
// ===============================

function animateLightboxChange(direction) {
  if (!galleryLightboxImage || lightboxAnimating) return;

  const images = getGallerySlides();

  const nextIndex = galleryLightboxIndex + direction;

  if (nextIndex < 0 || nextIndex >= images.length) {
    resetLightboxPosition();

    return;
  }

  lightboxAnimating = true;
  lightboxDragging = false;

  const exitPosition = direction > 0 ? "-28%" : "28%";
  const enterPosition = direction > 0 ? "24%" : "-24%";

  galleryLightboxImage.style.transition =
    "transform 180ms ease, opacity 160ms ease";

  galleryLightboxImage.style.transform = `translate3d(${exitPosition}, 0, 0) scale(0.99)`;

  galleryLightboxImage.style.opacity = "0";

  window.setTimeout(() => {
    galleryLightboxIndex = nextIndex;

    updateGalleryLightbox();

    galleryLightboxImage.style.transition = "none";

    galleryLightboxImage.style.transform = `translate3d(${enterPosition}, 0, 0) scale(0.99)`;

    galleryLightboxImage.style.opacity = "0";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        galleryLightboxImage.style.transition =
          "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease";

        galleryLightboxImage.style.transform = "translate3d(0, 0, 0) scale(1)";

        galleryLightboxImage.style.opacity = "1";
      });
    });

    window.setTimeout(() => {
      galleryLightboxImage.style.transition = "";
      galleryLightboxImage.style.transform = "";
      galleryLightboxImage.style.opacity = "";

      lightboxAnimating = false;
    }, 280);
  }, 170);
}

// ===============================
// Swipe / drag no lightbox
// ===============================

if (galleryLightboxImage) {
  galleryLightboxImage.draggable = false;

  galleryLightboxImage.style.touchAction = "pan-y";

  galleryLightboxImage.style.userSelect = "none";
}

galleryLightboxImage?.addEventListener("pointerdown", (event) => {
  if (lightboxAnimating) return;

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  lightboxDragging = true;

  lightboxStartX = event.clientX;
  lightboxCurrentX = event.clientX;

  galleryLightboxImage.setPointerCapture(event.pointerId);

  galleryLightboxImage.style.transition = "none";
});

galleryLightboxImage?.addEventListener("pointermove", (event) => {
  if (!lightboxDragging || lightboxAnimating) return;

  lightboxCurrentX = event.clientX;

  const difference = lightboxCurrentX - lightboxStartX;

  // Resistência progressiva.
  const maxVisualDrag = 170;

  const resistedMovement =
    maxVisualDrag * Math.tanh(difference / maxVisualDrag);

  const progress = Math.min(Math.abs(resistedMovement) / maxVisualDrag, 1);

  const scale = 1 - progress * 0.012;

  const opacity = 1 - progress * 0.08;

  galleryLightboxImage.style.transform = `translate3d(${resistedMovement}px, 0, 0) scale(${scale})`;

  galleryLightboxImage.style.opacity = String(opacity);
});

function finishLightboxDrag() {
  if (!lightboxDragging || lightboxAnimating) return;

  lightboxDragging = false;

  const difference = lightboxCurrentX - lightboxStartX;

  const imageWidth = galleryLightboxImage?.getBoundingClientRect().width || 600;

  // Não troca com uma puxadinha pequena.
  const threshold = Math.min(150, Math.max(90, imageWidth * 0.18));

  if (difference <= -threshold) {
    animateLightboxChange(1);

    return;
  }

  if (difference >= threshold) {
    animateLightboxChange(-1);

    return;
  }

  resetLightboxPosition();
}

galleryLightboxImage?.addEventListener("pointerup", finishLightboxDrag);

galleryLightboxImage?.addEventListener("pointercancel", finishLightboxDrag);

// ===============================
// Setas do lightbox
// ===============================

galleryLightboxPrev?.addEventListener("click", (event) => {
  event.stopPropagation();

  animateLightboxChange(-1);
});

galleryLightboxNext?.addEventListener("click", (event) => {
  event.stopPropagation();

  animateLightboxChange(1);
});

// ===============================
// Fechar lightbox
// ===============================

closeGalleryLightboxButton?.addEventListener("click", (event) => {
  event.stopPropagation();

  closeGalleryLightbox();
});

galleryLightboxPanel?.addEventListener("click", (event) => {
  event.stopPropagation();
});

galleryLightbox?.addEventListener("click", closeGalleryLightbox);

// ===============================
// Teclado do lightbox
// ===============================

document.addEventListener("keydown", (event) => {
  if (!isGalleryLightboxOpen()) return;

  if (event.key === "Escape") {
    closeGalleryLightbox();

    return;
  }

  if (event.key === "ArrowLeft") {
    animateLightboxChange(-1);
  }

  if (event.key === "ArrowRight") {
    animateLightboxChange(1);
  }
});

// ===============================
// Resize
// ===============================

let galleryResizeTimer;

window.addEventListener("resize", () => {
  if (!galleryViewport) return;

  window.clearTimeout(galleryResizeTimer);

  galleryResizeTimer = window.setTimeout(() => {
    updateGalleryButtons();
    renderGalleryDots();
  }, 100);
});

// ===============================
// Inicialização da galeria
// ===============================

if (galleryViewport && galleryTrack) {
  updateGalleryButtons();
  renderGalleryDots();
}
