// Constants - Single Source of Truth
const DEFAULTS = {
    documents: 100000,
    pagesPerDoc: 5,
    fieldsPerDoc: 10,
    humanTimePerDoc: 750,
    minWageRate: 7.25,
    consultantRate: 200.00,
    enhancedPercentage: 0,
    imagePercentage: 0
};

// State Variables
let state = { ...DEFAULTS };

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
    enhancedPercentage: document.getElementById('enhancedPercentage'),
    enhancedPercentageDisplay: document.getElementById('enhancedPercentageDisplay'),
    imagePercentage: document.getElementById('imagePercentage'),
    imagePercentageDisplay: document.getElementById('imagePercentageDisplay')
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
function syncDomFromState() {
    inputs.documents.value = state.documents;
    inputs.avgPages.value = state.pagesPerDoc;
    inputs.numFields.value = state.fieldsPerDoc;
    inputs.humanTime.value = state.humanTimePerDoc / 60;
    inputs.minWageRate.value = state.minWageRate;
    inputs.consultantRate.value = state.consultantRate;
    inputs.enhancedPercentage.value = state.enhancedPercentage;
    inputs.imagePercentage.value = state.imagePercentage;

    // Update displays for ranges
    inputs.avgPagesDisplay.textContent = state.pagesPerDoc;
    inputs.numFieldsDisplay.textContent = state.fieldsPerDoc;
    inputs.enhancedPercentageDisplay.textContent = `${state.enhancedPercentage}%`;
    inputs.imagePercentageDisplay.textContent = `${state.imagePercentage}%`;
}

function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('docs')) state.documents = Number(params.get('docs'));
    if (params.has('pages')) state.pagesPerDoc = Number(params.get('pages'));
    if (params.has('fields')) state.fieldsPerDoc = Number(params.get('fields'));
    if (params.has('mix')) state.enhancedPercentage = Number(params.get('mix'));
    if (params.has('img')) state.imagePercentage = Number(params.get('img'));
    if (params.has('time')) {
        const timeSeconds = Number(params.get('time'));
        if (!isNaN(timeSeconds)) {
            state.humanTimePerDoc = timeSeconds;
        }
    }
    if (params.has('rate_std')) state.minWageRate = Number(params.get('rate_std'));
    if (params.has('rate_exp')) state.consultantRate = Number(params.get('rate_exp'));
}

function updateURL() {
    const params = new URLSearchParams();
    params.set('docs', inputs.documents.value);
    params.set('pages', inputs.avgPages.value);
    params.set('fields', inputs.numFields.value);
    params.set('mix', inputs.enhancedPercentage.value);
    params.set('img', inputs.imagePercentage.value);
    params.set('time', state.humanTimePerDoc);
    params.set('rate_std', inputs.minWageRate.value);
    params.set('rate_exp', inputs.consultantRate.value);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

// Initialization
function init() {
    // Load from URL if present
    loadFromURL();

    // Sync DOM with current state
    syncDomFromState();

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
    inputs.enhancedPercentage.addEventListener('input', (e) => {
        inputs.enhancedPercentageDisplay.textContent = `${e.target.value}%`;
        handleInput(e);
    });
    inputs.imagePercentage.addEventListener('input', (e) => {
        inputs.imagePercentageDisplay.textContent = `${e.target.value}%`;
        handleInput(e);
        calculateHeuristicTime(); // Update time estimate when file split changes
    });
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
    // Reset State to Defaults
    state = { ...DEFAULTS };

    // Sync DOM
    syncDomFromState();

    // Update Charts
    calculateAndRender();
    
    // Clear URL parameters instead of setting them to defaults
    window.history.replaceState({}, '', window.location.pathname);
}

function updateStateFromDOM() {
    state.documents = Number(inputs.documents.value) || 0;
    state.pagesPerDoc = Number(inputs.avgPages.value) || 1;
    state.fieldsPerDoc = Number(inputs.numFields.value) || 5;
    state.humanTimePerDoc = (Number(inputs.humanTime.value) || 0) * 60;
    state.minWageRate = Number(inputs.minWageRate.value) || 0;
    state.consultantRate = Number(inputs.consultantRate.value) || 0;
    state.enhancedPercentage = Number(inputs.enhancedPercentage.value) || 0;
    state.imagePercentage = Number(inputs.imagePercentage.value) || 0;
}

function getEffectiveAvgPages(pdfPages) {
    const imageRatio = state.imagePercentage / 100;
    const docRatio = 1 - imageRatio;
    return (imageRatio * 1) + (docRatio * pdfPages);
}

function calculateHeuristicTime() {
    // Heuristic: 60s per field + 30s per page (using effective pages)
    // Only update if the user hasn't manually focused the time input recently (simple check)
    // For this MVP, we'll just update the input value to show the suggestion
    const effectivePages = getEffectiveAvgPages(state.pagesPerDoc);
    const suggestedTimeSeconds = (state.fieldsPerDoc * 60) + (effectivePages * 30);
    state.humanTimePerDoc = suggestedTimeSeconds;
    inputs.humanTime.value = suggestedTimeSeconds / 60;
}

function formatCurrency(value) {
    if (value >= 1000000000) {
        return `$${(value / 1000000000).toFixed(2)}B`;
    } else if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(2)}`;
}

function formatNumber(value) {
    if (value >= 1000000000) {
        return new Intl.NumberFormat('en-GB', {
            notation: "compact",
            compactDisplay: "long",
            maximumFractionDigits: 2
        }).format(value);
    }
    return value.toLocaleString('en-GB');
}

function getEffectiveAiuPerPage() {
    const standardRatio = (100 - state.enhancedPercentage) / 100;
    const enhancedRatio = state.enhancedPercentage / 100;
    return (1 * standardRatio) + (3 * enhancedRatio);
}

function calculateAndRender() {
    const effectiveAvgPages = getEffectiveAvgPages(state.pagesPerDoc);
    const totalPages = state.documents * effectiveAvgPages;
    const totalAIU = totalPages * getEffectiveAiuPerPage();
    
    // AI Cost Calculation
    // Packs needed = ceil(Total AIU / AIU per Pack)
    const packsNeeded = Math.ceil(totalAIU / AIU_PER_PACK);
    const aiTotalCost = packsNeeded * COST_PER_PACK;
    const aiCostPerDoc = aiTotalCost / state.documents;

    // Human Cost Calculation
    const totalHumanHours = (state.documents * state.humanTimePerDoc) / 3600;
    
    // Min Wage
    const minWageTotalCost = totalHumanHours * state.minWageRate;
    const minWageCostPerDoc = minWageTotalCost / state.documents;
    
    // Consultant
    const consultantTotalCost = totalHumanHours * state.consultantRate;
    const consultantCostPerDoc = consultantTotalCost / state.documents;

    // --- Update Summary ---
    outputs.summaryDocs.textContent = formatNumber(state.documents);
    outputs.summaryPages.textContent = formatNumber(totalPages);
    outputs.summaryTime.textContent = `${(state.humanTimePerDoc / 60).toFixed(1)} min/file`;
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
            <span>AI processing costs <strong>${formatCurrency(aiTotalCost)}</strong> for ${formatNumber(state.documents)} files.</span>
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
                            // Show powers of 10 starting from 1000 (1k, 10k, ... 1B, etc.)
                            const log10 = Math.log10(value);
                            if (value >= 1000 && Math.abs(log10 - Math.round(log10)) < 1e-9) {
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
                x: { title: { display: true, text: 'Minutes per File' } },
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
                x: { title: { display: true, text: 'Pages per File (PDF/DOCX)' } },
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
    
    // AI Cost varies with pages (PDF/DOCX pages vary, Images stay at 1)
    const effectiveAiu = getEffectiveAiuPerPage();
    const pageDataAI = pageLabels.map(pdfPages => {
        const effectiveAvgPages = getEffectiveAvgPages(pdfPages);
        const totalP = state.documents * effectiveAvgPages;
        const totalAIU = totalP * effectiveAiu;
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
            // Show powers of 10 starting from 1000 (1k, 10k, ... 1B, etc.)
            const log10 = Math.log10(value);
            if (value >= 1000 && Math.abs(log10 - Math.round(log10)) < 1e-9) {
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
