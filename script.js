// Constants - Single Source of Truth
const DEFAULTS = {
    documents: 10000,
    pagesPerDoc: 5,
    fieldsPerDoc: 10,
    humanTimePerDoc: 750,
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

function formatCurrency(value) {
    // Match existing behavior: 
    // >= 1B: 2 decimals, B suffix
    // >= 1M: 2 decimals, M suffix
    // >= 1K: 0 decimals, K suffix
    // < 1K: 2 decimals, no suffix
    
    const fractionDigits = (value >= 1000 && value < 1000000) ? 0 : 2;
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        compactDisplay: 'short',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    }).format(value);
}

function formatNumber(value) {
    if (value >= 1000000000) {
        return new Intl.NumberFormat('en-GB', {
            notation: "compact",
            compactDisplay: "long",
            maximumFractionDigits: 2
        }).format(value);
    }
    return new Intl.NumberFormat('en-GB').format(value);
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
    outputs.tableBody.innerHTML = `
        <tr>
            <td class="fw-bold">AI Processing</td>
            <td class="text-right">$${formatNumber(COST_PER_PACK)} / 100k AIU</td>
            <td class="text-right">Instant</td>
            <td class="text-right fw-bold text-success">${formatCurrency(aiTotalCost)}</td>
            <td class="text-right">$${aiCostPerDoc.toFixed(4)}</td>
            <td class="text-right">-</td>
            <td class="text-right fw-bold text-success">1.00x</td>
        </tr>
        <tr>
            <td class="fw-bold">Human (Standard)</td>
            <td class="text-right">$${state.minWageRate.toFixed(2)} / hr</td>
            <td class="text-right">${formatNumber(Math.round(totalHumanHours))} hrs</td>
            <td class="text-right fw-bold text-warning">${formatCurrency(minWageTotalCost)}</td>
            <td class="text-right">$${minWageCostPerDoc.toFixed(4)}</td>
            <td class="text-right fw-bold ${netSavingsStandard >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(netSavingsStandard)}</td>
            <td class="text-right fw-bold text-warning">${(minWageTotalCost / aiTotalCost).toFixed(2)}x</td>
        </tr>
        <tr>
            <td class="fw-bold">Human (Expert)</td>
            <td class="text-right">$${state.consultantRate.toFixed(2)} / hr</td>
            <td class="text-right">${formatNumber(Math.round(totalHumanHours))} hrs</td>
            <td class="text-right fw-bold text-danger">${formatCurrency(consultantTotalCost)}</td>
            <td class="text-right">$${consultantCostPerDoc.toFixed(4)}</td>
            <td class="text-right fw-bold ${netSavingsExpert >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(netSavingsExpert)}</td>
            <td class="text-right fw-bold text-danger">${(consultantTotalCost / aiTotalCost).toFixed(2)}x</td>
        </tr>
    `;

    // --- Update Insights ---
    // Friendly, professional narrative
    outputs.insightsList.innerHTML = `
        <li>
            <span class="insight-icon text-success">✓</span>
            <span>
                <strong>Headline:</strong> Projected <strong>${formatNumber(Math.round(roiStandard))}% ROI</strong> and <strong>${formatCurrency(netSavingsStandard)}</strong> in savings compared to standard manual processing.
            </span>
        </li>
        <li>
            <span class="insight-icon text-warning">⚠</span>
            <span>
                <strong>Feasibility:</strong> To match this output manually in one year, you'd need approximately <strong>${formatNumber(Math.ceil(fteCount))} full-time employees</strong> working solely on this task.
            </span>
        </li>
        <li>
            <span class="insight-icon text-primary">ℹ</span>
            <span>
                <strong>Pricing Context:</strong> AI costs are estimated using standard $2k data packs (100k units each). Buying in bulk or subscriptions could save even more.
            </span>
        </li>
        <li>
            <span class="insight-icon text-primary">ℹ</span>
            <span>
                Based on your input of <strong>${(state.humanTimePerDoc / 60).toFixed(1)} min/file</strong>, AI processing is <strong>${(minWageCostPerDoc / aiCostPerDoc).toFixed(1)}x cheaper</strong> per document.
            </span>
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

// --- Modal Logic ---

function showExplanation(metric) {
    const modal = document.getElementById('explanationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const closeBtn = document.querySelector('.close-modal');

    // Close handler
    const closeModal = () => {
        modal.close();
        // Reset body scroll if needed, though dialog element handles it well
    };
    
    closeBtn.onclick = closeModal;
    
    // Close on backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    // Calculate current values for display
    const effectiveAvgPages = getEffectiveAvgPages(state.pagesPerDoc);
    const totalPages = state.documents * effectiveAvgPages;
    const totalAIU = totalPages * getEffectiveAiuPerPage();
    const packsNeeded = Math.ceil(totalAIU / AIU_PER_PACK);
    const aiTotalCost = packsNeeded * COST_PER_PACK;
    
    const totalHumanHours = (state.documents * state.humanTimePerDoc) / 3600;
    const minWageTotalCost = totalHumanHours * state.minWageRate;
    const netSavings = minWageTotalCost - aiTotalCost;
    const fteCount = totalHumanHours / EFFECTIVE_ANNUAL_HOURS;

    let content = '';

    if (metric === 'roi') {
        modalTitle.textContent = 'Projected ROI Breakdown';
        const roiStandard = aiTotalCost > 0 ? ((netSavings / aiTotalCost) * 100) : 0;
        content = `
            <p class="explanation-text">
                <strong>Return on Investment (ROI)</strong> is calculated based on <strong>Labor Cost Avoidance</strong>. 
                <br><br>
                It strictly measures the hard dollar savings of using AI versus paying for manual labor at your specified rates. It does not include "soft" benefits like faster turnaround or reduced error rates, making this a conservative estimate.
            </p>
            <div class="math-row">
                <span class="math-label">Total Human Cost (Liability):</span>
                <span class="math-value">${formatCurrency(minWageTotalCost)}</span>
            </div>
            <div class="math-row">
                <span class="math-label">Total AI Cost (Investment):</span>
                <span class="math-value">- ${formatCurrency(aiTotalCost)}</span>
            </div>
            <div class="math-row">
                <span class="math-label"><strong>Net Savings:</strong></span>
                <span class="math-value"><strong>${formatCurrency(netSavings)}</strong></span>
            </div>
            <br>
            <div class="math-row">
                <span class="math-label">Investment Base:</span>
                <span class="math-value">÷ ${formatCurrency(aiTotalCost)}</span>
            </div>
            <div class="math-row">
                <span class="math-label" style="color: var(--secondary-color);"><strong>Projected ROI:</strong></span>
                <span class="math-value" style="color: var(--secondary-color);"><strong>${formatNumber(Math.round(roiStandard))}%</strong></span>
            </div>
        `;
    } else if (metric === 'savings') {
        modalTitle.textContent = 'Net Estimated Savings Breakdown';
        const efficiencyRatio = aiTotalCost > 0 ? (minWageTotalCost / aiTotalCost) : 0;
        content = `
            <p class="explanation-text">
                <strong>Net Estimated Savings</strong> represents the direct financial advantage of using AI over standard manual entry. 
                <br><br>
                The <strong>Efficiency Multiplier</strong> (e.g., "${efficiencyRatio.toFixed(1)}x") shows how many times more expensive it is to stick with the manual process.
            </p>
            <div class="math-row">
                <span class="math-label">Total Human Hours:</span>
                <span class="math-value">${formatNumber(Math.round(totalHumanHours))} hrs</span>
            </div>
            <div class="math-row">
                <span class="math-label">Standard Hourly Rate:</span>
                <span class="math-value">$${state.minWageRate.toFixed(2)} / hr</span>
            </div>
            <div class="math-row">
                <span class="math-label"><strong>Total Human Cost:</strong></span>
                <span class="math-value"><strong>${formatCurrency(minWageTotalCost)}</strong></span>
            </div>
            <br>
            <div class="math-row">
                <span class="math-label">Total AI Units:</span>
                <span class="math-value">${formatNumber(Math.ceil(totalAIU))} AIU</span>
            </div>
             <div class="math-row">
                <span class="math-label">Packs Needed (100k/pack):</span>
                <span class="math-value">${packsNeeded} packs</span>
            </div>
            <div class="math-row">
                <span class="math-label">Cost per Pack:</span>
                <span class="math-value">$${formatNumber(COST_PER_PACK)}</span>
            </div>
            <div class="math-row">
                <span class="math-label"><strong>Total AI Cost:</strong></span>
                <span class="math-value"><strong>${formatCurrency(aiTotalCost)}</strong></span>
            </div>
            <div class="math-row">
                <span class="math-label" style="color: var(--secondary-color);"><strong>Net Savings:</strong></span>
                <span class="math-value" style="color: var(--secondary-color);"><strong>${formatCurrency(netSavings)}</strong></span>
            </div>
        `;
    } else if (metric === 'breakeven') {
        const minWageCostPerDoc = minWageTotalCost / state.documents;
        const breakEvenDocs = minWageCostPerDoc > 0 ? Math.ceil(COST_PER_PACK / minWageCostPerDoc) : 0;
        modalTitle.textContent = 'Break-Even Volume Analysis';
        content = `
            <p class="explanation-text">
                <strong>Break-Even Volume</strong> answers the question: "When does this investment pay for itself?"
                <br><br>
                It calculates how many documents you need to process manually before that cost exceeds the price of a single AI Pack ($${formatNumber(COST_PER_PACK)}). Any volume above this number is pure savings.
            </p>
             <div class="math-row">
                <span class="math-label">Cost of 1 AI Pack:</span>
                <span class="math-value">$${formatNumber(COST_PER_PACK)}</span>
            </div>
            <div class="math-row">
                <span class="math-label">Manual Cost per File:</span>
                <span class="math-value">÷ $${minWageCostPerDoc.toFixed(4)}</span>
            </div>
            <div class="math-row">
                <span class="math-label" style="color: var(--secondary-color);"><strong>Break-Even Point:</strong></span>
                <span class="math-value" style="color: var(--secondary-color);"><strong>${formatNumber(breakEvenDocs)} Files</strong></span>
            </div>
            <p class="note" style="margin-top: 15px;">
                Note: This assumes you purchase 1 pack to start.
            </p>
        `;
    } else if (metric === 'fte') {
        modalTitle.textContent = 'Est. FTEs Required Breakdown';
        const workingYears = totalHumanHours / EFFECTIVE_ANNUAL_HOURS;
        content = `
            <p class="explanation-text">
                <strong>Full-Time Equivalent (FTE)</strong> estimates the headcount needed.
                <br>
                <strong>Time Velocity</strong> (Working Years) highlights the opportunity cost of time.
                <br><br>
                We use a realistic annual capacity of <strong>${formatNumber(EFFECTIVE_ANNUAL_HOURS)} hours</strong> per employee (taking into account PTO and 75% productivity).
            </p>
            <div class="math-row">
                <span class="math-label">Total Documents:</span>
                <span class="math-value">${formatNumber(state.documents)}</span>
            </div>
             <div class="math-row">
                <span class="math-label">Time per Document:</span>
                <span class="math-value">${(state.humanTimePerDoc / 60).toFixed(1)} min</span>
            </div>
            <div class="math-row">
                <span class="math-label"><strong>Total Workload Hours:</strong></span>
                <span class="math-value"><strong>${formatNumber(Math.round(totalHumanHours))} hrs</strong></span>
            </div>
            <br>
            <div class="math-row">
                <span class="math-label">Effective Annual Hours/FTE:</span>
                <span class="math-value">÷ ${formatNumber(EFFECTIVE_ANNUAL_HOURS)} hrs</span>
            </div>
            <div class="math-row">
                <span class="math-label" style="color: var(--danger-color);"><strong>FTEs Required:</strong></span>
                <span class="math-value" style="color: var(--danger-color);"><strong>${formatNumber(Math.ceil(fteCount))}</strong></span>
            </div>
            <div class="math-row">
                <span class="math-label"><strong>Equivalent Time:</strong></span>
                <span class="math-value"><strong>${workingYears.toFixed(1)} Years</strong></span>
            </div>
        `;
    } else if (metric === 'ai') {
        modalTitle.textContent = 'Est. AI Cost Breakdown';
        content = `
            <p class="explanation-text">
                AI costs are calculated based on a <strong>"Lump Sum" purchase model</strong>. 
                Credits are purchased in minimum blocks (packs) of 100,000 AI Units (AIU).
                <br><br>
                • Standard Page = 1 AIU
                <br>• Enhanced Page = 3 AIU (for complex layouts/handwriting)
            </p>
            <div class="math-row">
                <span class="math-label">Total Pages:</span>
                <span class="math-value">${formatNumber(Math.ceil(totalPages))}</span>
            </div>
            <div class="math-row">
                <span class="math-label">Effective AIU per Page:</span>
                <span class="math-value">× ${getEffectiveAiuPerPage().toFixed(2)}</span>
            </div>
            <div class="math-row">
                <span class="math-label"><strong>Total AI Units Needed:</strong></span>
                <span class="math-value"><strong>${formatNumber(Math.ceil(totalAIU))}</strong></span>
            </div>
            <br>
            <div class="math-row">
                <span class="math-label">AI Units per Pack:</span>
                <span class="math-value">÷ ${formatNumber(AIU_PER_PACK)}</span>
            </div>
             <div class="math-row">
                <span class="math-label">Packs Required (Rounded Up):</span>
                <span class="math-value">${packsNeeded}</span>
            </div>
             <div class="math-row">
                <span class="math-label">Cost per Pack:</span>
                <span class="math-value">× $${formatNumber(COST_PER_PACK)}</span>
            </div>
            <div class="math-row">
                <span class="math-label" style="color: var(--secondary-color);"><strong>Total AI Cost:</strong></span>
                <span class="math-value" style="color: var(--secondary-color);"><strong>${formatCurrency(aiTotalCost)}</strong></span>
            </div>
        `;
    }

    modalBody.innerHTML = content;
    modal.showModal();
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
