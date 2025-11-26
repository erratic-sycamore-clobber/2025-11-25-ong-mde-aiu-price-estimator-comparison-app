// Constants - Single Source of Truth
const DEFAULTS = {
    documents: 10000,
    pagesPerDoc: 5,
    fieldsPerDoc: 10,
    humanTimePerDoc: 690,
    minWageRate: 15.00,
    consultantRate: 200.00,
    enhancedPercentage: 50,
    imagePercentage: 50
};

const HEURISTICS = {
    SECONDS_PER_FIELD: 60,
    SECONDS_PER_PAGE: 30
};

// State Variables
let state = { ...DEFAULTS };

const AIU_PER_PACK = 100000;
const COST_PER_PACK = 2000;

    // Chart Instances
    let costChart = null;
    let timeSensitivityChart = null;
    let pageSensitivityChart = null;

    // New FTE Constant: 230 working days * 6 productive hours (8hrs * 0.75)
    const EFFECTIVE_ANNUAL_HOURS = 1380;
    
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
    standardPercentageDisplay: document.getElementById('standardPercentageDisplay'),
    imagePercentage: document.getElementById('imagePercentage'),
    imagePercentageDisplay: document.getElementById('imagePercentageDisplay'),
    docPercentageDisplay: document.getElementById('docPercentageDisplay')
};

const outputs = {
    summaryROI: document.getElementById('summaryROI'),
    summarySavings: document.getElementById('summarySavings'),
    savingsBadge: document.getElementById('savingsBadge'),
    summaryFTE: document.getElementById('summaryFTE'),
    fteSubtext: document.getElementById('fteSubtext'),
    summaryBreakEven: document.getElementById('summaryBreakEven'),
    summaryAiCost: document.getElementById('summaryAiCost')
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
    inputs.standardPercentageDisplay.textContent = `${100 - state.enhancedPercentage}%`;
    inputs.imagePercentageDisplay.textContent = `${state.imagePercentage}%`;
    inputs.docPercentageDisplay.textContent = `${100 - state.imagePercentage}%`;
}

function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('docs')) state.documents = Number(params.get('docs'));
    if (params.has('pages')) state.pagesPerDoc = Number(params.get('pages'));
    if (params.has('fields')) state.fieldsPerDoc = Number(params.get('fields'));
    if (params.has('mix')) state.enhancedPercentage = Number(params.get('mix'));
    if (params.has('img')) state.imagePercentage = Number(params.get('img'));
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
        inputs.standardPercentageDisplay.textContent = `${100 - e.target.value}%`;
        handleInput(e);
    });
    inputs.imagePercentage.addEventListener('input', (e) => {
        inputs.imagePercentageDisplay.textContent = `${e.target.value}%`;
        inputs.docPercentageDisplay.textContent = `${100 - e.target.value}%`;
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

// Utility
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

const debouncedUpdateURL = debounce(updateURL, 500);

function handleInput() {
    updateStateFromDOM();
    calculateAndRender();
    debouncedUpdateURL();
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
    const suggestedTimeSeconds = (state.fieldsPerDoc * HEURISTICS.SECONDS_PER_FIELD) + (effectivePages * HEURISTICS.SECONDS_PER_PAGE);
    state.humanTimePerDoc = suggestedTimeSeconds;
    inputs.humanTime.value = suggestedTimeSeconds / 60;
}

// Shared Formatters
const Formatters = {
    currencyLarge: new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', notation: 'compact', compactDisplay: 'short', minimumFractionDigits: 0, maximumFractionDigits: 0
    }),
    currencySmall: new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', notation: 'compact', compactDisplay: 'short', minimumFractionDigits: 2, maximumFractionDigits: 2
    }),
    numberLarge: new Intl.NumberFormat('en-GB', {
        notation: "compact", compactDisplay: "long", maximumFractionDigits: 2
    }),
    numberSmall: new Intl.NumberFormat('en-GB'),
    
    currency(value) {
        return (value >= 1000 && value < 1000000) ? this.currencyLarge.format(value) : this.currencySmall.format(value);
    },
    number(value) {
        return (value >= 1000000000) ? this.numberLarge.format(value) : this.numberSmall.format(value);
    }
};

const formatCurrency = (v) => Formatters.currency(v);
const formatNumber = (v) => Formatters.number(v);

function getEffectiveAiuPerPage() {
    const standardRatio = (100 - state.enhancedPercentage) / 100;
    const enhancedRatio = state.enhancedPercentage / 100;
    return (1 * standardRatio) + (3 * enhancedRatio);
}

function updateText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
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

    // --- New Narrative Metrics ---
    const netSavingsStandard = minWageTotalCost - aiTotalCost;
    const netSavingsExpert = consultantTotalCost - aiTotalCost;
    
    // ROI = (Net Savings / Investment) * 100
    // Prevent division by zero if AI cost is 0 (unlikely but safe)
    const roiStandard = aiTotalCost > 0 ? ((netSavingsStandard / aiTotalCost) * 100) : 0;
    
    // Efficiency Multiplier
    const efficiencyRatio = aiTotalCost > 0 ? (minWageTotalCost / aiTotalCost) : 0;

    // Break-Even Volume
    // How many docs until manual cost > first pack cost ($2000)?
    // Formula: BreakEvenDocs = FirstPackCost / HumanCostPerDoc
    // Note: This is a simplification. Strictly it's a step function vs linear line intersection.
    // But for "Risk Reversal", showing when the *first* pack pays off is the most honest metric.
    const breakEvenDocs = minWageCostPerDoc > 0 ? Math.ceil(COST_PER_PACK / minWageCostPerDoc) : 0;

    // FTE Calculation
    const fteCount = totalHumanHours / EFFECTIVE_ANNUAL_HOURS;

    // Time Velocity (Years)
    const workingYears = totalHumanHours / EFFECTIVE_ANNUAL_HOURS;

    // --- Update Summary ---
    
    // 1. ROI
    outputs.summaryROI.textContent = `${formatNumber(Math.round(roiStandard))}%`;
    // Color code ROI
    if (roiStandard > 0) {
        outputs.summaryROI.className = '';
        outputs.summaryROI.classList.add('stat-positive');
    } else {
        outputs.summaryROI.className = '';
        outputs.summaryROI.classList.add('stat-critical');
    }

    // 2. Net Estimated Savings (Standard)
    outputs.summarySavings.textContent = formatCurrency(netSavingsStandard);
    // Color code savings
    if (netSavingsStandard > 0) {
        outputs.summarySavings.className = ''; 
        outputs.summarySavings.classList.add('stat-positive');
        outputs.savingsBadge.textContent = `${efficiencyRatio.toFixed(1)}x Cheaper`;
        outputs.savingsBadge.style.backgroundColor = '#d1fae5'; // Light green
        outputs.savingsBadge.style.color = '#059669';
    } else {
        outputs.summarySavings.className = '';
        outputs.summarySavings.classList.add('stat-critical');
        outputs.savingsBadge.textContent = 'More Expensive';
        outputs.savingsBadge.style.backgroundColor = '#fee2e2'; // Light red
        outputs.savingsBadge.style.color = '#b91c1c';
    }

    // 3. FTEs Required
    outputs.summaryFTE.textContent = formatNumber(Math.ceil(fteCount)); 
    // Update subtext with hours/years
    if (totalHumanHours > EFFECTIVE_ANNUAL_HOURS) {
         outputs.fteSubtext.textContent = `approx ${workingYears.toFixed(1)} Years`;
    } else {
         outputs.fteSubtext.textContent = `${formatNumber(Math.round(totalHumanHours))} Hours`;
    }
    
    // Color code FTE if high
    if (fteCount > 5) {
        outputs.summaryFTE.className = '';
        outputs.summaryFTE.classList.add('stat-critical');
    } else {
        outputs.summaryFTE.className = '';
    }

    // 4. Break-Even
    outputs.summaryBreakEven.textContent = `${formatNumber(breakEvenDocs)} Files`;

    // 5. AI Cost
    outputs.summaryAiCost.textContent = formatCurrency(aiTotalCost);

    // --- Update Table ---
    // AI Row
    updateText('table-ai-pack-cost', formatNumber(COST_PER_PACK));
    updateText('table-ai-total-cost', formatCurrency(aiTotalCost));
    updateText('table-ai-cost-per-doc', '$' + aiCostPerDoc.toFixed(4));

    // Human Standard Row
    updateText('table-human-std-rate', state.minWageRate.toFixed(2));
    updateText('table-human-std-hours', formatNumber(Math.round(totalHumanHours)));
    updateText('table-human-std-total', formatCurrency(minWageTotalCost));
    updateText('table-human-std-cost-per-doc', '$' + minWageCostPerDoc.toFixed(4));
    
    const stdSavingsEl = document.getElementById('table-human-std-savings');
    if (stdSavingsEl) {
        stdSavingsEl.textContent = formatCurrency(netSavingsStandard);
        // Reset classes and add base classes
        stdSavingsEl.className = 'text-right fw-bold';
        stdSavingsEl.classList.add(netSavingsStandard >= 0 ? 'text-success' : 'text-danger');
    }

    updateText('table-human-std-ratio', (minWageTotalCost / aiTotalCost).toFixed(2) + 'x');

    // Human Expert Row
    updateText('table-human-exp-rate', state.consultantRate.toFixed(2));
    updateText('table-human-exp-hours', formatNumber(Math.round(totalHumanHours)));
    updateText('table-human-exp-total', formatCurrency(consultantTotalCost));
    updateText('table-human-exp-cost-per-doc', '$' + consultantCostPerDoc.toFixed(4));

    const expSavingsEl = document.getElementById('table-human-exp-savings');
    if (expSavingsEl) {
        expSavingsEl.textContent = formatCurrency(netSavingsExpert);
        // Reset classes and add base classes
        expSavingsEl.className = 'text-right fw-bold';
        expSavingsEl.classList.add(netSavingsExpert >= 0 ? 'text-success' : 'text-danger');
    }

    updateText('table-human-exp-ratio', (consultantTotalCost / aiTotalCost).toFixed(2) + 'x');

    // --- Update Insights ---
    updateText('insight-roi', formatNumber(Math.round(roiStandard)) + '%');
    updateText('insight-savings', formatCurrency(netSavingsStandard));
    updateText('insight-fte', formatNumber(Math.ceil(fteCount)));
    updateText('insight-time-per-doc', (state.humanTimePerDoc / 60).toFixed(1));
    updateText('insight-cheaper-ratio', aiCostPerDoc > 0 ? (minWageCostPerDoc / aiCostPerDoc).toFixed(1) : '0');

    // --- Update Charts ---
    updateCharts(aiTotalCost, minWageTotalCost, consultantTotalCost);
}

function createChartConfig(type, labels, datasets, extraOptions = {}) {
    return {
        type,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += formatCurrency(context.parsed.y);
                            return label;
                        }
                    }
                }
            },
            ...extraOptions
        }
    };
}

function initCharts() {
    // 1. Total Cost Bar Chart (Log Scale)
    const ctxCost = document.getElementById('costChart').getContext('2d');
    costChart = new Chart(ctxCost, createChartConfig(
        'bar',
        ['AI Processing', 'Human (Standard)', 'Human (Expert)'],
        [{
            label: 'Total Cost (USD)',
            data: [0, 0, 0],
            backgroundColor: ['rgba(16, 185, 129, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(239, 68, 68, 0.7)'],
            borderColor: ['rgb(16, 185, 129)', 'rgb(245, 158, 11)', 'rgb(239, 68, 68)'],
            borderWidth: 1
        }],
        {
            scales: {
                y: {
                    type: 'logarithmic',
                    title: { display: true, text: 'Cost (Log Scale)' },
                    ticks: {
                        callback: function(value) {
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
    ));

    // 2. Time Sensitivity Line Chart
    const ctxTime = document.getElementById('timeSensitivityChart').getContext('2d');
    timeSensitivityChart = new Chart(ctxTime, createChartConfig(
        'line', 
        [], 
        [
            { label: 'AI Cost', data: [], borderColor: 'rgb(16, 185, 129)', borderDash: [5, 5], tension: 0.1, fill: false },
            { label: 'Human (Standard)', data: [], borderColor: 'rgb(245, 158, 11)', tension: 0.1, fill: false },
            { label: 'Human (Expert)', data: [], borderColor: 'rgb(239, 68, 68)', tension: 0.1, fill: false }
        ],
        {
            scales: {
                x: { title: { display: true, text: 'Minutes per File' } },
                y: { title: { display: true, text: 'Total Cost' }, ticks: { callback: (value) => formatCurrency(value) } }
            }
        }
    ));

    // 3. Page Sensitivity Line Chart
    const ctxPage = document.getElementById('pageSensitivityChart').getContext('2d');
    pageSensitivityChart = new Chart(ctxPage, createChartConfig(
        'line', 
        [],
        [
            { label: 'AI Cost', data: [], borderColor: 'rgb(16, 185, 129)', tension: 0.1, fill: false },
            { label: 'Human (Standard)', data: [], borderColor: 'rgb(245, 158, 11)', borderDash: [5, 5], tension: 0.1, fill: false },
            { label: 'Human (Expert)', data: [], borderColor: 'rgb(239, 68, 68)', borderDash: [5, 5], tension: 0.1, fill: false }
        ],
        {
            scales: {
                x: { title: { display: true, text: 'Pages per File (PDF/DOCX)' } },
                y: { title: { display: true, text: 'Total Cost' }, ticks: { callback: (value) => formatCurrency(value) } }
            }
        }
    ));
}

// --- Modal Logic ---

function showExplanation(metric) {
    const modal = document.getElementById('explanationModal');
    const modalTitle = document.getElementById('modalTitle');
    const closeBtn = document.querySelector('.close-modal');

    const closeModal = () => modal.close();
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    document.querySelectorAll('.modal-scenario').forEach(el => el.hidden = true);

    // Calculations
    const effectiveAvgPages = getEffectiveAvgPages(state.pagesPerDoc);
    const totalPages = state.documents * effectiveAvgPages;
    const totalAIU = totalPages * getEffectiveAiuPerPage();
    const packsNeeded = Math.ceil(totalAIU / AIU_PER_PACK);
    const aiTotalCost = packsNeeded * COST_PER_PACK;
    
    const totalHumanHours = (state.documents * state.humanTimePerDoc) / 3600;
    const minWageTotalCost = totalHumanHours * state.minWageRate;
    const netSavings = minWageTotalCost - aiTotalCost;
    const fteCount = totalHumanHours / EFFECTIVE_ANNUAL_HOURS;
    const efficiencyRatio = aiTotalCost > 0 ? (minWageTotalCost / aiTotalCost) : 0;

    const data = {
        aiTotalCost, minWageTotalCost, netSavings, totalHumanHours, 
        totalAIU, packsNeeded, fteCount, efficiencyRatio, totalPages
    };

    const configs = {
        roi: {
            title: 'Projected ROI Breakdown',
            id: 'modal-content-roi',
            update: (d) => {
                const roi = d.aiTotalCost > 0 ? ((d.netSavings / d.aiTotalCost) * 100) : 0;
                updateText('modal-roi-human-cost', formatCurrency(d.minWageTotalCost));
                updateText('modal-roi-ai-cost', formatCurrency(d.aiTotalCost));
                updateText('modal-roi-net-savings', formatCurrency(d.netSavings));
                updateText('modal-roi-ai-cost-base', formatCurrency(d.aiTotalCost));
                updateText('modal-roi-value', formatNumber(Math.round(roi)) + '%');
            }
        },
        savings: {
            title: 'Net Estimated Savings Breakdown',
            id: 'modal-content-savings',
            update: (d) => {
                updateText('modal-savings-ratio', d.efficiencyRatio.toFixed(1));
                updateText('modal-savings-hours', formatNumber(Math.round(d.totalHumanHours)));
                updateText('modal-savings-rate', state.minWageRate.toFixed(2));
                updateText('modal-savings-human-total', formatCurrency(d.minWageTotalCost));
                updateText('modal-savings-aiu', formatNumber(Math.ceil(d.totalAIU)));
                updateText('modal-savings-packs', d.packsNeeded);
                updateText('modal-savings-ai-total', formatCurrency(d.aiTotalCost));
                updateText('modal-savings-net', formatCurrency(d.netSavings));
            }
        },
        breakeven: {
            title: 'Break-Even Volume Analysis',
            id: 'modal-content-breakeven',
            update: (d) => {
                const minWageCostPerDoc = d.minWageTotalCost / state.documents;
                const breakEvenDocs = minWageCostPerDoc > 0 ? Math.ceil(COST_PER_PACK / minWageCostPerDoc) : 0;
                updateText('modal-breakeven-manual-cost', minWageCostPerDoc.toFixed(4));
                updateText('modal-breakeven-docs', formatNumber(breakEvenDocs));
            }
        },
        fte: {
            title: 'Est. FTEs Required Breakdown',
            id: 'modal-content-fte',
            update: (d) => {
                const years = d.totalHumanHours / EFFECTIVE_ANNUAL_HOURS;
                updateText('modal-fte-docs', formatNumber(state.documents));
                updateText('modal-fte-time-per-doc', (state.humanTimePerDoc / 60).toFixed(1));
                updateText('modal-fte-total-hours', formatNumber(Math.round(d.totalHumanHours)));
                updateText('modal-fte-count', formatNumber(Math.ceil(d.fteCount)));
                updateText('modal-fte-years', years.toFixed(1));
            }
        },
        ai: {
            title: 'Est. AI Cost Breakdown',
            id: 'modal-content-ai',
            update: (d) => {
                updateText('modal-ai-pages', formatNumber(Math.ceil(d.totalPages)));
                updateText('modal-ai-aiu-per-page', getEffectiveAiuPerPage().toFixed(2));
                updateText('modal-ai-total-aiu', formatNumber(Math.ceil(d.totalAIU)));
                updateText('modal-ai-packs', d.packsNeeded);
                updateText('modal-ai-total-cost', formatCurrency(d.aiTotalCost));
            }
        }
    };

    const config = configs[metric];
    if (config) {
        modalTitle.textContent = config.title;
        document.getElementById(config.id).hidden = false;
        config.update(data);
        modal.showModal();
    }
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
