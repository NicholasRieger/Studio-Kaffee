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

if (menuButton) {
  menuButton.addEventListener("click", toggleMenu);
}

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

const STUDIO_WHATSAPP_NUMBER = "5511987573010";

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
    start: 9 * 60,
    end: 18 * 60,
  },
];

let currentDate = new Date();
let agendaItems = [];
let selectedBookingDate = null;
let selectedBookingAvailability = null;

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

function isStatus(status, statuses) {
  const normalizedStatus = normalizeText(status);

  return statuses.some((item) => normalizeText(item) === normalizedStatus);
}

function getTodayAtMidnight() {
  const today = new Date();

  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
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

  if (first.length !== second.length) return false;

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
      intervals.push({ start, end });
    }
  }

  return intervals;
}

function mergeIntervals(intervals) {
  const sortedIntervals = [...intervals]
    .filter((interval) => interval.start < interval.end)
    .sort((a, b) => a.start - b.start);

  if (sortedIntervals.length === 0) return [];

  const merged = [sortedIntervals[0]];

  for (let i = 1; i < sortedIntervals.length; i++) {
    const current = sortedIntervals[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
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
        intersections.push({ start, end });
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
  if (!intervals.length) return "";

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
    if (startTime < interval.start || startTime >= interval.end) return;

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

function getDayAvailability(date, entries = []) {
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

  const freeIntervalsFromSheet = entries
    .filter((entry) => isStatus(entry.status, ["Livre"]))
    .flatMap((entry) => parseIntervals(entry.horario));

  const busyIntervalsFromSheet = entries
    .filter((entry) => isStatus(entry.status, ["Ocupado"]))
    .flatMap((entry) => parseIntervals(entry.horario));

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
// Visual/status
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
  const availableIntervals = selectedBookingAvailability.availableIntervals || [];
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
    startTime && endTime ? `${startTime} - ${endTime}` : "Ainda não selecionado";

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
// Renderização
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

function renderCalendar() {
  if (!calendarTitle || !calendarGrid || !agendaList) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  calendarTitle.textContent = `${monthNames[month]} ${year}`;

  const firstDayOfMonth = new Date(year, month, 1);
  const firstWeekDay = firstDayOfMonth.getDay();

  const mondayBasedStart = firstWeekDay === 0 ? 6 : firstWeekDay - 1;

  const monthDays = getMonthDays(year, month);

  calendarGrid.innerHTML = "";
  agendaList.innerHTML = "";

  for (let i = 0; i < mondayBasedStart; i++) {
    calendarGrid.insertAdjacentHTML(
      "beforeend",
      `
        <div class="min-h-[106px] border-r border-b border-kaffee-caramel/20 p-3 opacity-20"></div>
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
          <p class="font-semibold text-[18px]">${item.day}</p>

          <p class="mt-3 text-[12px] leading-[1.45] ${classes.text}">
            ${escapeHTML(item.status)}<br />
            ${escapeHTML(item.horario)}
          </p>

          ${
            item.observacao
              ? `
                <p class="mt-2 line-clamp-2 text-[10px] leading-[1.4] text-kaffee-earth">
                  ${escapeHTML(item.observacao)}
                </p>
              `
              : ""
          }
        </button>
      `,
    );
  });

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

function renderMobileAgendaList(monthDays) {
  const exceptionDays = monthDays.filter((item) => item.isException);

  const availableDays = monthDays.filter((item) => {
    return normalizeText(item.status) === "livre" && !isPastDate(item.date);
  });

  agendaList.insertAdjacentHTML(
    "beforeend",
    `
      <div class="bg-kaffee-caramel/10 px-5 py-5">
        <p class="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-kaffee-brown">
          Resumo da agenda
        </p>

        <p class="mt-2 font-sans text-[13px] leading-[1.7] text-kaffee-earth">
          Dias não listados abaixo seguem como <strong>Livre</strong>, das 9h às 18h.
        </p>

        <div class="mt-5">
          <label
            for="mobileBookingDaySelect"
            class="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-kaffee-brown"
          >
            Escolha um dia para solicitar reserva
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
            class="mt-3 flex w-full items-center justify-center gap-2 bg-kaffee-brown px-5 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-kaffee-cream shadow-md transition hover:bg-[#61300d]"
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

  if (exceptionDays.length === 0) {
    agendaList.insertAdjacentHTML(
      "beforeend",
      `
        <div class="px-5 py-6 text-center font-sans text-[13px] leading-[1.7] text-kaffee-earth">
          Nenhuma alteração cadastrada para este mês.
        </div>
      `,
    );

    return;
  }

  exceptionDays.forEach((item) => {
    const day = String(item.date.getDate()).padStart(2, "0");
    const monthNumber = String(item.date.getMonth() + 1).padStart(2, "0");
    const classes = getStatusClasses(item.status);
    const isClickable =
      normalizeText(item.status) === "livre" && !isPastDate(item.date);

    agendaList.insertAdjacentHTML(
      "beforeend",
      `
        <article class="px-5 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-sans text-[13px] font-bold uppercase tracking-[0.16em] text-kaffee-brown">
                ${day}/${monthNumber}
              </p>

              <p class="mt-2 font-sans text-[14px] leading-[1.6] text-kaffee-earth">
                ${escapeHTML(item.horario)}
              </p>

              ${
                item.observacao
                  ? `
                    <p class="mt-2 font-sans text-[12px] leading-[1.6] text-kaffee-earth">
                      ${escapeHTML(item.observacao)}
                    </p>
                  `
                  : ""
              }

              ${
                isClickable
                  ? `
                    <button
                      type="button"
                      data-mobile-booking-date="${item.dateKey}"
                      class="mt-4 inline-flex items-center justify-center border border-kaffee-brown px-4 py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-kaffee-brown transition hover:bg-kaffee-brown hover:text-kaffee-cream"
                    >
                      Escolher horário
                    </button>
                  `
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

  agendaList.querySelectorAll("[data-mobile-booking-date]").forEach((button) => {
    button.addEventListener("click", () => {
      const dateKey = button.getAttribute("data-mobile-booking-date");
      const dayItem = monthDays.find((item) => item.dateKey === dateKey);

      if (dayItem) {
        openBookingModal(dayItem);
      }
    });
  });
}

function showAgendaError(message = "Agenda indisponível") {
  if (calendarTitle) {
    calendarTitle.textContent = message;
  }

  if (calendarGrid) {
    calendarGrid.innerHTML = `
      <div class="col-span-7 p-6 text-center font-sans text-[13px] text-kaffee-earth">
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

// ===============================
// Carregamento da planilha
// ===============================

function loadAgendaFromSheet() {
  if (!calendarTitle || !calendarGrid || !agendaList) return;

  if (typeof Papa === "undefined") {
    showAgendaError("PapaParse não carregou");
    console.error(
      "PapaParse não foi carregado. Adicione o CDN do PapaParse antes do script.js.",
    );
    return;
  }

  calendarTitle.textContent = "Carregando...";

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

      if (agendaItems.length > 0) {
        const hasCurrentMonthItem = agendaItems.some((item) => {
          return (
            item.date.getFullYear() === currentDate.getFullYear() &&
            item.date.getMonth() === currentDate.getMonth()
          );
        });

        if (!hasCurrentMonthItem) {
          currentDate = new Date(
            agendaItems[0].date.getFullYear(),
            agendaItems[0].date.getMonth(),
            1,
          );
        }
      }

      renderCalendar();
    },

    error: function (error) {
      console.error("Erro ao carregar CSV:", error);
      showAgendaError();
    },
  });
}

// ===============================
// Eventos
// ===============================

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

loadAgendaFromSheet();