let config = {
    machineCount: 4,
    scale: 30, // 30px per hour
    jobs: [
        { id: 1, color: '#3b82f6', tasks: [{ m: 0, dur: 3 }, { m: 1, dur: 4 }, { m: 2, dur: 2 }] },
        { id: 2, color: '#10b981', tasks: [{ m: 1, dur: 2 }, { m: 0, dur: 5 }, { m: 3, dur: 3 }] },
        { id: 3, color: '#f59e0b', tasks: [{ m: 2, dur: 4 }, { m: 3, dur: 2 }, { m: 1, dur: 3 }] }
    ]
};

let activeSchedule = [];

// 1. Initialize the board
function init() {
    const laneContainer = document.getElementById('machine-lanes');
    if (!laneContainer) return;
    
    laneContainer.innerHTML = ''; 
    
    for (let i = 0; i < config.machineCount; i++) {
        const row = document.createElement('div');
        row.className = 'machine-row';
        row.innerHTML = `<div class="machine-label">Machine ${i}</div><div class="timeline" id="m-${i}"></div>`;
        laneContainer.appendChild(row);
    }
    
    document.getElementById('ruler-timeline').innerHTML = '';
    document.getElementById('makespan-val').innerText = '0';
    document.getElementById('avg-util').innerText = '0';
}

// 2. The Solver (Greedy Heuristic)
function runSolver() {
    init();
    activeSchedule = [];
    let machineNextFree = new Array(config.machineCount).fill(0);
    let jobNextFree = new Array(config.jobs.length + 1).fill(0);

    config.jobs.forEach(job => {
        job.tasks.forEach((task, index) => {
            const start = Math.max(machineNextFree[task.m], jobNextFree[job.id]);
            const end = start + task.dur;
            
            const taskObj = {
                jobId: job.id,
                machine: task.m,
                start: start,
                dur: task.dur,
                color: job.color,
                order: index
            };
            
            activeSchedule.push(taskObj);
            machineNextFree[task.m] = end;
            jobNextFree[job.id] = end;
        });
    });
    render();
}

// 3. Render Blocks
function render() {
    document.querySelectorAll('.timeline').forEach(t => t.innerHTML = '');
    
    let currentMakespan = 0;
    activeSchedule.forEach(task => {
        const end = task.start + task.dur;
        if (end > currentMakespan) currentMakespan = end;
    });

    activeSchedule.forEach((task, index) => {
        const timeline = document.getElementById(`m-${task.machine}`);
        if (!timeline) return;

        const block = document.createElement('div');
        block.className = 'job-block';
        block.title = `Job ${task.jobId}\nStart: ${task.start}h\nEnd: ${task.start + task.dur}h`;
        
        block.style.left = (task.start * config.scale) + 'px';
        block.style.width = (task.dur * config.scale) + 'px';
        block.style.backgroundColor = task.color;
        block.innerHTML = `<span>J${task.jobId}</span><span>${task.dur}h</span>`;
        
        if (task.start + task.dur === currentMakespan && currentMakespan > 0) {
            block.classList.add('critical');
        }

        block.onmouseenter = () => {
            document.querySelectorAll('.job-block').forEach(b => {
                if (!b.innerText.includes(`J${task.jobId}`)) {
                    b.style.opacity = "0.2";
                    b.style.filter = "grayscale(80%)";
                }
            });
        };
        block.onmouseleave = () => {
            document.querySelectorAll('.job-block').forEach(b => {
                b.style.opacity = "1";
                b.style.filter = "none";
            });
        };

        block.draggable = true;
        block.ondragend = (e) => handleDrag(e, index);
        timeline.appendChild(block);
    });

    const ruler = document.getElementById('ruler-timeline');
    ruler.innerHTML = ''; 
    const rulerLimit = Math.max(currentMakespan + 5, 25); 

    for (let h = 0; h <= rulerLimit; h++) {
        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.left = (h * config.scale) + 'px';
        marker.style.borderLeft = '1px solid #cbd5e1';
        marker.style.height = '10px';
        marker.style.fontSize = '10px';
        marker.style.color = '#64748b';
        marker.style.paddingLeft = '2px';
        marker.innerText = h;
        ruler.appendChild(marker);
    }

    document.getElementById('makespan-val').innerText = currentMakespan;
    let totalUtil = 0;
    for (let i = 0; i < config.machineCount; i++) {
        const machineTasks = activeSchedule.filter(t => t.machine === i);
        const busyTime = machineTasks.reduce((sum, t) => sum + t.dur, 0);
        const utilization = currentMakespan > 0 ? Math.round((busyTime / currentMakespan) * 100) : 0;
        totalUtil += utilization;

        const labels = document.querySelectorAll('.machine-label');
        if(labels[i]) {
            labels[i].innerHTML = `<div>Machine ${i}</div><div style="font-size:10px; color:#64748b; font-weight:normal;">${utilization}% Load</div>`;
        }
    }
    document.getElementById('avg-util').innerText = config.machineCount > 0 ? Math.round(totalUtil / config.machineCount) : 0;
    checkViolations();
}

// 4. Input & Dynamic Config Logic
document.getElementById('add-job-field').addEventListener('click', () => {
    const list = document.getElementById('job-inputs-list');
    const jobCount = list.children.length + 1;
    const newRow = document.createElement('div');
    newRow.className = 'job-input-row';
    newRow.style = "display: flex; gap: 10px; margin-bottom: 8px;";
    newRow.innerHTML = `
        <div style="background: #f1f5f9; padding: 8px 12px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; min-width: 60px;">Job ${jobCount}</div>
        <input type="text" class="job-data" placeholder="e.g. 0,2 1,3" style="flex-grow: 1; padding: 8px; border-radius: 4px; border: 1px solid #cbd5e1;">
        <input type="color" class="job-color" value="${'#'+Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}" style="width: 40px; height: 35px; border: none; cursor: pointer; background: none;">
    `;
    list.appendChild(newRow);
});

// --- NEW: RANDOMIZE LOGIC ---
document.getElementById('randomize-btn').addEventListener('click', () => {
    const list = document.getElementById('job-inputs-list');
    list.innerHTML = ''; 

    const numJobs = Math.floor(Math.random() * 3) + 3; // 3-5 jobs
    const maxMachinesAvailable = 4; 

    for (let i = 1; i <= numJobs; i++) {
        let taskParts = [];
        let availableMachines = Array.from({length: maxMachinesAvailable}, (_, idx) => idx);
        
        // Pick 3 random steps for each job
        for (let j = 0; j < 3; j++) {
            const mIndex = Math.floor(Math.random() * availableMachines.length);
            const machine = availableMachines.splice(mIndex, 1)[0];
            const duration = Math.floor(Math.random() * 5) + 2; 
            taskParts.push(`${machine},${duration}`);
        }

        const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        const row = document.createElement('div');
        row.className = 'job-input-row';
        row.style = "display: flex; gap: 10px; margin-bottom: 8px;";
        row.innerHTML = `
            <div style="background: #f1f5f9; padding: 8px 12px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; min-width: 60px;">Job ${i}</div>
            <input type="text" class="job-data" value="${taskParts.join(' ')}" style="flex-grow: 1; padding: 8px; border-radius: 4px; border: 1px solid #cbd5e1;">
            <input type="color" class="job-color" value="${randomColor}" style="width: 40px; height: 35px; border: none; cursor: pointer; background: none;">
        `;
        list.appendChild(row);
    }
    document.getElementById('update-config-btn').click();
});

document.getElementById('update-config-btn').addEventListener('click', () => {
    const jobRows = document.querySelectorAll('.job-input-row');
    const newJobs = [];
    let maxMachineId = 0;

    jobRows.forEach((row, index) => {
        const dataText = row.querySelector('.job-data').value.trim();
        const color = row.querySelector('.job-color').value;
        if (!dataText) return;

        const tasks = dataText.split(' ').map(pair => {
            const [m, dur] = pair.split(',').map(Number);
            if (m > maxMachineId) maxMachineId = m;
            return { m, dur };
        });

        newJobs.push({ id: index + 1, color: color, tasks: tasks });
    });

    if (newJobs.length > 0) {
        config.jobs = newJobs;
        config.machineCount = maxMachineId + 1;
        runSolver(); 
    } else {
        alert("Please enter at least one job!");
    }
});

function handleDrag(e, index) {
    const newStart = Math.max(0, Math.round(e.offsetX / config.scale));
    activeSchedule[index].start = newStart;
    render();
}

function checkViolations() {
    const blocks = document.querySelectorAll('.job-block');
    activeSchedule.forEach((task, i) => {
        const predecessor = activeSchedule.find(t => t.jobId === task.jobId && t.order === task.order - 1);
        if (predecessor && task.start < (predecessor.start + predecessor.dur)) {
            blocks[i].classList.add('error');
        }
    });
}

function downloadReport() {
    if (activeSchedule.length === 0) return alert("Run solver first!");
    let report = `JOB SHOP REPORT\nMakespan: ${document.getElementById('makespan-val').innerText}h\n\n`;
    config.jobs.forEach(job => {
        report += `JOB ${job.id}:\n`;
        activeSchedule.filter(t => t.jobId === job.id).sort((a,b)=>a.order-b.order).forEach(t => {
            report += ` - M${t.machine}: ${t.start}h to ${t.start+t.dur}h\n`;
        });
    });
    const blob = new Blob([report], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Schedule_Report.txt`;
    a.click();
}

document.getElementById('solve-btn').addEventListener('click', runSolver);
document.getElementById('reset-btn').addEventListener('click', () => { location.reload(); });
document.getElementById('download-btn').addEventListener('click', downloadReport);

init();