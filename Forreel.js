// =========================
// Helper functions
// =========================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Format mm:ss
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Save & load from localStorage
function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}
function loadData(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
}

// =========================
// Tabs navigation
// =========================
$$(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
        // Hide all sections
        $$("main > section").forEach((sec) => (sec.hidden = true));
        // Reset aria-current
        $$(".tab").forEach((t) => t.removeAttribute("aria-current"));

        // Show target
        const target = btn.dataset.target;
        $(target).hidden = false;
        btn.setAttribute("aria-current", "page");
    });
});

// =========================
// Plan generator
// =========================
const planForm = $("#planForm");
const scheduleList = $("#schedule");
const scheduleEmpty = $("#scheduleEmpty");
const btnSendToTimer = $("#btnSendToTimer");
let schedule = [];

planForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(planForm);
    const goal = data.get("goal");
    const subject = data.get("subject");
    const total = parseInt(data.get("minutes"));
    const block = parseInt(data.get("block"));
    const shortBreak = parseInt(data.get("shortBreak"));
    const longBreak = parseInt(data.get("longBreak"));

    // Build schedule
    schedule = [];
    let minutesLeft = total;
    let i = 1;
    while (minutesLeft > 0) {
        // Focus block
        const blockLen = Math.min(block, minutesLeft);
        schedule.push({
            type: "Focus",
            title: `${subject}: ${goal} (Block ${i})`,
            minutes: blockLen,
        });
        minutesLeft -= blockLen;

        if (minutesLeft <= 0) break;

        // Break
        const breakLen = i % 4 === 0 ? longBreak : shortBreak;
        schedule.push({
            type: "Break",
            title: i % 4 === 0 ? "Long Break" : "Short Break",
            minutes: breakLen,
        });
        minutesLeft -= breakLen;

        i++;
    }

    renderSchedule();
    saveData("schedule", schedule);
});

function renderSchedule() {
    scheduleList.innerHTML = "";
    if (schedule.length === 0) {
        scheduleEmpty.style.display = "block";
        btnSendToTimer.disabled = true;
        return;
    }
    scheduleEmpty.style.display = "none";
    schedule.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
      <div>
        <strong>${item.type}</strong> — ${item.title}
        <div class="muted">${item.minutes} min</div>
      </div>
      <div class="controls">
        <button class="btn-secondary" onclick="startBlock(${idx})">Start</button>
      </div>
    `;
        scheduleList.appendChild(div);
    });
    btnSendToTimer.disabled = false;
}

function startBlock(index) {
    const block = schedule[index];
    currentTaskHint.textContent = `${block.type}: ${block.title}`;
    startTimer(block.minutes * 60);
    $("#timerStatus").textContent = "Started from schedule";
    // Jump to timer tab
    $(".tab[data-target='#timer']").click();
}

// =========================
// Task list
// =========================
const taskForm = $("#taskForm");
const taskList = $("#taskList");
let tasks = loadData("tasks", []);

taskForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(taskForm);
    const task = {
        title: data.get("title"),
        priority: data.get("priority"),
        minutes: parseInt(data.get("minutes")),
    };
    tasks.push(task);
    saveData("tasks", tasks);
    renderTasks();
    taskForm.reset();
});

function renderTasks() {
    taskList.innerHTML = "";
    tasks.forEach((task, idx) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
      <div>
        <strong>${task.title}</strong>
        <div class="muted">${task.minutes} min • <span class="pill">${task.priority}</span></div>
      </div>
      <div class="controls">
        <button class="btn-secondary" onclick="startTask(${idx})">Start</button>
        <button class="btn-danger" onclick="deleteTask(${idx})">Delete</button>
      </div>
    `;
        taskList.appendChild(div);
    });
}

function startTask(index) {
    const t = tasks[index];
    currentTaskHint.textContent = `Task: ${t.title}`;
    startTimer(t.minutes * 60);
    $("#timerStatus").textContent = "Started from task list";
    $(".tab[data-target='#timer']").click();
}

function deleteTask(index) {
    tasks.splice(index, 1);
    saveData("tasks", tasks);
    renderTasks();
}

renderTasks();

// =========================
// Timer
// =========================
let timerInterval;
let remaining = 0;
let running = false;
const timeFace = $("#timeFace");
const timerStatus = $("#timerStatus");
const currentTaskHint = $("#currentTaskHint");

function startTimer(seconds) {
    clearInterval(timerInterval);
    remaining = seconds;
    running = true;
    updateTimeFace();
    $("#startTimer").disabled = true;
    $("#pauseTimer").disabled = false;
    $("#resetTimer").disabled = false;
    $("#skipPhase").disabled = false;
    timerStatus.textContent = "Running...";
    timerInterval = setInterval(tick, 1000);
}

function tick() {
    if (remaining <= 0) {
        clearInterval(timerInterval);
        running = false;
        timeFace.textContent = "00:00";
        timerStatus.textContent = "Done!";
        alert("⏰ Time’s up! Take a break or switch task.");
        return;
    }
    remaining--;
    updateTimeFace();
}

function updateTimeFace() {
    timeFace.textContent = formatTime(remaining);
}

$("#startTimer")?.addEventListener("click", () => {
    const mins = parseInt($("#focusLen").value) || 25;
    startTimer(mins * 60);
});

$("#pauseTimer")?.addEventListener("click", () => {
    if (running) {
        clearInterval(timerInterval);
        running = false;
        timerStatus.textContent = "Paused";
        $("#pauseTimer").textContent = "Resume";
    } else {
        timerInterval = setInterval(tick, 1000);
        running = true;
        timerStatus.textContent = "Running...";
        $("#pauseTimer").textContent = "Pause";
    }
});

$("#resetTimer")?.addEventListener("click", () => {
    clearInterval(timerInterval);
    running = false;
    remaining = 0;
    timeFace.textContent = "00:00";
    timerStatus.textContent = "Ready";
    $("#startTimer").disabled = false;
    $("#pauseTimer").disabled = true;
    $("#resetTimer").disabled = true;
    $("#skipPhase").disabled = true;
});

$("#skipPhase")?.addEventListener("click", () => {
    clearInterval(timerInterval);
    running = false;
    timerStatus.textContent = "Skipped!";
    timeFace.textContent = "00:00";
});

// =========================
// Load saved data
// =========================
schedule = loadData("schedule", []);
if (schedule.length > 0) renderSchedule();

// Motivational advice (random)
const tips = [
    "💡 Tip: Focus beats hours. 40 min of deep work > 2 hrs distracted.",
    "🔥 Remember: Hardest problems first → biggest win.",
    "🍎 Take water & stretch breaks, your brain will thank you.",
    "📖 Recall > reread. Test yourself instead of just reading.",
];
setInterval(() => {
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    $("#timerStatus").textContent = randomTip;
}, 60000); // every 1 min