// State Variables
const state = {
    documents: 1000000,
    pagesPerDoc: 5,
    fieldsPerDoc: 10,
    humanTimePerDoc: 7.5, // Initial calculation: 10 * 1 + 5 * 0.5 = 12.5 -> user defaulted override in HTML is 7.5, will sync on load
    minWageRate: 7.25,
    consultantRate: 100.00,
    aiuPerPage: 1
};

// Constants
const DEFAULTS = {
    documents: 100000,
    avgPages: 5,
    numFields: 10,
    humanTime: 7.5,
    minWageRate: 7.25,
    consultantRate: 200.00,
    aiuPerPage: 1
};

const AIU_PER_PACK = 100000;
const COST_PER_PACK = 2000;

// Chart Instances
let costChart = null;
let timeSensitivityChart = null;
let pageSensitivityChart = null;

// DOM Elements
const inputs = {
    documents: document.getElementById('numDocuments'),
    avgPages: document.getElementById('avgPages'),
    avgPagesDisplay: document.getElementById('avgPagesDisplay'),
    numFields: document.getElementById('numFields'),
    numFieldsDisplay: document.getElementById('numFieldsDisplay'),
    humanTime: document.getElementById('humanTime'),
    minWageRate: document.getElementById('minWageRate'),
    consultantRate: document.getElementById('consultantRate'),
    agentType: document.getElementById('agentType')
};

const outputs = {
    summaryDocs: document.getElementById('summaryDocs'),
    summaryPages: document.getElementById('summaryPages'),
    summaryTime: document.getElementById('summaryTime'),
    summaryAiCost: document.getElementById('summaryAiCost'),
    tableBody: document.querySelector('#comparisonTable tbody'),
    insightsList: document.getElementById('insightsList')
};

// URL State Management
function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('docs')) inputs.documents.value = params.get('docs');
    if (params.has('pages')) inputs.avgPages.value = params.get('pages');
    if (params.has('fields')) inputs.numFields.value = params.get('fields');
    if (params.has('agent')) inputs.agentType.value = params.get('agent');
    if (params.has('time')) inputs.humanTime.value = params.get('time');
    if (params.has('rate_std')) inputs.minWageRate.value = params.get('rate_std');
    if (params.has('rate_exp')) inputs.consultantRate.value = params.get('rate_exp');

    // Update displays for ranges
    inputs.avgPagesDisplay.textContent = inputs.avgPages.value;
    inputs.numFieldsDisplay.textContent = inputs.numFields.value;
}

function updateURL() {
    const params = new URLSearchParams();
    params.set('docs', inputs.documents.value);
    params.set('pages', inputs.avgPages.value);
    params.set('fields', inputs.numFields.value);
    params.set('agent', inputs.agentType.value);
    params.set('time', inputs.humanTime.value);
    params.set('rate_std', inputs.minWageRate.value);
    params.set('rate_exp', inputs.consultantRate.value);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

// Initialization
function init() {
    // Load from URL if present
    loadFromURL();

    // Sync state with initial HTML values
    updateStateFromDOM();
    
    // Sync display spans with input values (handles browser persistence)
    inputs.avgPagesDisplay.textContent = inputs.avgPages.value;
    inputs.numFieldsDisplay.textContent = inputs.numFields.value;

    // Calculate initial heuristic time
    calculateHeuristicTime();

    // Setup Event Listeners
    inputs.documents.addEventListener('input', handleInput);
    inputs.avgPages.addEventListener('input', (e) => {
        inputs.avgPagesDisplay.textContent = e.target.value;
        handleInput(e);
        calculateHeuristicTime(); // Update time estimate when pages change
    });
    inputs.numFields.addEventListener('input', (e) => {
        inputs.numFieldsDisplay.textContent = e.target.value;
        handleInput(e);
        calculateHeuristicTime(); // Update time estimate when fields change
    });
    inputs.humanTime.addEventListener('input', handleInput);
    inputs.minWageRate.addEventListener('input', handleInput);
    inputs.consultantRate.addEventListener('input', handleInput);
    inputs.agentType.addEventListener('change', handleInput);
    document.getElementById('resetBtn').addEventListener('click', resetInputs);
    
    // Add log scale toggle listener
    const logToggle = document.getElementById('logScaleToggle');
    if (logToggle) {
        logToggle.addEventListener('change', (e) => {
            toggleCostChartScale(e.target.checked);
        });
    }

    // Initialize Charts
    initCharts();
    
    // Initial Calculation & Render
    calculateAndRender();
}

function handleInput(e) {
    updateStateFromDOM();
    calculateAndRender();
    updateURL();
}

function resetInputs() {
    // Reset DOM elements
    inputs.documents.value = DEFAULTS.documents;
    inputs.avgPages.value = DEFAULTS.avgPages;
    inputs.numFields.value = DEFAULTS.numFields;
    inputs.humanTime.value = DEFAULTS.humanTime;
    inputs.minWageRate.value = DEFAULTS.minWageRate;
    inputs.consultantRate.value = DEFAULTS.consultantRate;
    inputs.agentType.value = DEFAULTS.aiuPerPage;

    // Update Range Displays
    inputs.avgPagesDisplay.textContent = DEFAULTS.avgPages;
    inputs.numFieldsDisplay.textContent = DEFAULTS.numFields;

    // Update State & Charts
    updateStateFromDOM();
    calculateAndRender();
    
    // Clear URL parameters instead of setting them to defaults
    window.history.replaceState({}, '', window.location.pathname);
}

function updateStateFromDOM() {
    state.documents = Number(inputs.documents.value) || 0;
    state.pagesPerDoc = Number(inputs.avgPages.value) || 1;
    state.fieldsPerDoc = Number(inputs.numFields.value) || 5;
    state.humanTimePerDoc = Number(inputs.humanTime.value) || 0;
    state.minWageRate = Number(inputs.minWageRate.value) || 0;
    state.consultantRate = Number(inputs.consultantRate.value) || 0;
    state.aiuPerPage = Number(inputs.agentType.value) || 1;
}

function calculateHeuristicTime() {
    // Heuristic: 1 min per field + 0.5 min per page
    // Only update if the user hasn't manually focused the time input recently (simple check)
    // For this MVP, we'll just update the input value to show the suggestion
    const suggestedTime = (state.fieldsPerDoc * 1) + (state.pagesPerDoc * 0.5);
    inputs.humanTime.value = suggestedTime;
    state.humanTimePerDoc = suggestedTime;
}

function formatCurrency(value) {
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(2)}`;
}

function formatNumber(value) {
    return value.toLocaleString('en-US');
}

function calculateAndRender() {
    const totalPages = state.documents * state.pagesPerDoc;
    const totalAIU = totalPages * state.aiuPerPage;
    
    // AI Cost Calculation
    // Packs needed = ceil(Total AIU / AIU per Pack)
    const packsNeeded = Math.ceil(totalAIU / AIU_PER_PACK);
    const aiTotalCost = packsNeeded * COST_PER_PACK;
    const aiCostPerDoc = aiTotalCost / state.documents;

    // Human Cost Calculation
    const totalHumanHours = (state.documents * state.humanTimePerDoc) / 60;
    
    // Min Wage
    const minWageTotalCost = totalHumanHours * state.minWageRate;
    const minWageCostPerDoc = minWageTotalCost / state.documents;
    
    // Consultant
    const consultantTotalCost = totalHumanHours * state.consultantRate;
    const consultantCostPerDoc = consultantTotalCost / state.documents;

    // --- Update Summary ---
    outputs.summaryDocs.textContent = formatNumber(state.documents);
    outputs.summaryPages.textContent = formatNumber(totalPages);
    outputs.summaryTime.textContent = `${state.humanTimePerDoc.toFixed(1)} min/doc`;
    outputs.summaryAiCost.textContent = formatCurrency(aiTotalCost);

    // --- Update Table ---
    outputs.tableBody.innerHTML = `
        <tr>
            <td class="fw-bold">AI Processing</td>
            <td class="text-right">$${formatNumber(COST_PER_PACK)} / 100k AIU</td>
            <td class="text-right">Instant</td>
            <td class="text-right fw-bold text-success">${formatCurrency(aiTotalCost)}</td>
            <td class="text-right">$${aiCostPerDoc.toFixed(4)}</td>
            <td class="text-right fw-bold text-success">1.00x</td>
        </tr>
        <tr>
            <td class="fw-bold">Human (Standard)</td>
            <td class="text-right">$${state.minWageRate.toFixed(2)} / hr</td>
            <td class="text-right">${formatNumber(Math.round(totalHumanHours))} hrs</td>
            <td class="text-right fw-bold text-warning">${formatCurrency(minWageTotalCost)}</td>
            <td class="text-right">$${minWageCostPerDoc.toFixed(4)}</td>
            <td class="text-right fw-bold text-warning">${(minWageTotalCost / aiTotalCost).toFixed(2)}x</td>
        </tr>
        <tr>
            <td class="fw-bold">Human (Expert)</td>
            <td class="text-right">$${state.consultantRate.toFixed(2)} / hr</td>
            <td class="text-right">${formatNumber(Math.round(totalHumanHours))} hrs</td>
            <td class="text-right fw-bold text-danger">${formatCurrency(consultantTotalCost)}</td>
            <td class="text-right">$${consultantCostPerDoc.toFixed(4)}</td>
            <td class="text-right fw-bold text-danger">${(consultantTotalCost / aiTotalCost).toFixed(2)}x</td>
        </tr>
    `;

    // --- Update Insights ---
    const yearsWork = (totalHumanHours / 2080).toFixed(1); // 2080 work hours/year
    outputs.insightsList.innerHTML = `
        <li>
            <span class="insight-icon text-success">✓</span>
            <span>AI processing costs <strong>${formatCurrency(aiTotalCost)}</strong> for ${formatNumber(state.documents)} documents.</span>
        </li>
        <li>
            <span class="insight-icon text-warning">✓</span>
            <span>Standard human labor costs <strong>${formatCurrency(minWageTotalCost)}</strong> (${(minWageTotalCost / aiTotalCost).toFixed(1)}x more expensive).</span>
        </li>
        <li>
            <span class="insight-icon text-danger">✓</span>
            <span>Expert review costs <strong>${formatCurrency(consultantTotalCost)}</strong> (${(consultantTotalCost / aiTotalCost).toFixed(1)}x more expensive).</span>
        </li>
        <li>
            <span class="insight-icon text-primary">ℹ</span>
            <span>Manual processing would take approx <strong>${formatNumber(Math.round(totalHumanHours))} hours</strong> (approx. ${yearsWork} person-years).</span>
        </li>
    `;

    // --- Update Charts ---
    updateCharts(aiTotalCost, minWageTotalCost, consultantTotalCost);
}

function initCharts() {
    // Common Chart Options
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += formatCurrency(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        }
    };

    // 1. Total Cost Bar Chart (Log Scale)
    const ctxCost = document.getElementById('costChart').getContext('2d');
    costChart = new Chart(ctxCost, {
        type: 'bar',
        data: {
            labels: ['AI Processing', 'Human (Standard)', 'Human (Expert)'],
            datasets: [{
                label: 'Total Cost (USD)',
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.7)', // Green
                    'rgba(245, 158, 11, 0.7)', // Orange
                    'rgba(239, 68, 68, 0.7)'   // Red
                ],
                borderColor: [
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)',
                    'rgb(239, 68, 68)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                y: {
                    type: 'logarithmic',
                    title: { display: true, text: 'Cost (Log Scale)' },
                    ticks: {
                        callback: function(value, index, values) {
                            // Custom tick formatting for log scale to look cleaner
                            if (value === 1000 || value === 10000 || value === 100000 || value === 1000000 || value === 10000000) {
                                return formatCurrency(value);
                            }
                            return null;
                        }
                    }
                }
            }
        }
    });

    // 2. Time Sensitivity Line Chart
    const ctxTime = document.getElementById('timeSensitivityChart').getContext('2d');
    timeSensitivityChart = new Chart(ctxTime, {
        type: 'line',
        data: {
            labels: [], // Will be mins
            datasets: [
                {
                    label: 'AI Cost',
                    data: [],
                    borderColor: 'rgb(16, 185, 129)',
                    borderDash: [5, 5], // AI cost is constant w.r.t time
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'Human (Standard)',
                    data: [],
                    borderColor: 'rgb(245, 158, 11)',
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'Human (Expert)',
                    data: [],
                    borderColor: 'rgb(239, 68, 68)',
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { title: { display: true, text: 'Minutes per Document' } },
                y: { 
                    title: { display: true, text: 'Total Cost' },
                    ticks: { callback: (value) => formatCurrency(value) }
                }
            }
        }
    });

    // 3. Page Sensitivity Line Chart
    const ctxPage = document.getElementById('pageSensitivityChart').getContext('2d');
    pageSensitivityChart = new Chart(ctxPage, {
        type: 'line',
        data: {
            labels: [], // Will be pages
            datasets: [
                {
                    label: 'AI Cost',
                    data: [],
                    borderColor: 'rgb(16, 185, 129)',
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'Human (Standard)',
                    data: [], // Constant w.r.t pages in this specific model (unless time changes, but this chart isolates page count cost impact assuming fixed time)
                    borderColor: 'rgb(245, 158, 11)',
                    borderDash: [5, 5],
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'Human (Expert)',
                    data: [],
                    borderColor: 'rgb(239, 68, 68)',
                    borderDash: [5, 5],
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { title: { display: true, text: 'Pages per Document' } },
                y: { 
                    title: { display: true, text: 'Total Cost' },
                    ticks: { callback: (value) => formatCurrency(value) }
                }
            }
        }
    });
}

function updateCharts(aiCost, minWageCost, consultantCost) {
    // 1. Update Bar Chart
    costChart.data.datasets[0].data = [aiCost, minWageCost, consultantCost];
    costChart.update();

    // 2. Update Time Sensitivity Data
    // Generate data points: 1min to 30min
    const timeLabels = [1, 5, 10, 15, 20, 30];
    const timeDataAI = timeLabels.map(() => aiCost); // Constant
    const timeDataMinWage = timeLabels.map(min => {
        const hours = (state.documents * min) / 60;
        return hours * state.minWageRate;
    });
    const timeDataConsultant = timeLabels.map(min => {
        const hours = (state.documents * min) / 60;
        return hours * state.consultantRate;
    });

    timeSensitivityChart.data.labels = timeLabels;
    timeSensitivityChart.data.datasets[0].data = timeDataAI;
    timeSensitivityChart.data.datasets[1].data = timeDataMinWage;
    timeSensitivityChart.data.datasets[2].data = timeDataConsultant;
    timeSensitivityChart.update();

    // 3. Update Page Sensitivity Data
    // Generate data points: 1 to 50 pages
    const pageLabels = [1, 5, 10, 20, 50, 100];
    
    // AI Cost varies with pages
    const pageDataAI = pageLabels.map(pages => {
        const totalP = state.documents * pages;
        const totalAIU = totalP * state.aiuPerPage;
        const packs = Math.ceil(totalAIU / AIU_PER_PACK);
        return packs * COST_PER_PACK;
    });

    // Human Cost is nominally constant relative to page count in this specific isolation view
    // (Unless we dynamically update the time-per-doc assumption inside the loop, which makes it complex.
    //  Usually sensitivity charts vary one variable while holding others constant.
    //  So we hold 'current estimated time' constant to show just the impact of page count on AI cost.)
    const pageDataMinWage = pageLabels.map(() => minWageCost);
    const pageDataConsultant = pageLabels.map(() => consultantCost);

    pageSensitivityChart.data.labels = pageLabels;
    pageSensitivityChart.data.datasets[0].data = pageDataAI;
    pageSensitivityChart.data.datasets[1].data = pageDataMinWage;
    pageSensitivityChart.data.datasets[2].data = pageDataConsultant;
    pageSensitivityChart.update();
}

function toggleCostChartScale(isLog) {
    if (!costChart) return;
    
    costChart.options.scales.y.type = isLog ? 'logarithmic' : 'linear';
    costChart.options.scales.y.title.text = isLog ? 'Cost (Log Scale)' : 'Cost (Linear Scale)';
    
    if (isLog) {
        costChart.options.scales.y.ticks.callback = function(value, index, values) {
            if (value === 1000 || value === 10000 || value === 100000 || value === 1000000 || value === 10000000) {
                return formatCurrency(value);
            }
            return null;
        };
    } else {
        costChart.options.scales.y.ticks.callback = function(value) {
            return formatCurrency(value);
        };
    }
    costChart.update();
}

// Run initialization
init();
