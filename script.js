(function() {
    'use strict';

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
    let currentMetrics = null;

    const AIU_PER_PACK = 100000;
    const COST_PER_PACK = 2000;
    const EFFECTIVE_ANNUAL_HOURS = 1380;

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
        standardPercentageDisplay: document.getElementById('standardPercentageDisplay'),
        imagePercentage: document.getElementById('imagePercentage'),
        imagePercentageDisplay: document.getElementById('imagePercentageDisplay'),
        docPercentageDisplay: document.getElementById('docPercentageDisplay')
    };

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
        
        formatLargeValue(value, isCurrency = false) {
            const absValue = Math.abs(value);
            let suffix = '';
            let divisor = 1;
            
            if (absValue >= 1e24) {
                suffix = 'Sp';
                divisor = 1e24;
            } else if (absValue >= 1e21) {
                suffix = 'Sx';
                divisor = 1e21;
            } else if (absValue >= 1e18) {
                suffix = 'Qt';
                divisor = 1e18;
            } else if (absValue >= 1e15) {
                suffix = 'Qa';
                divisor = 1e15;
            } else {
                // Delegate to Intl for Trillions (T) and below
                return isCurrency 
                    ? (value >= 1000 && value < 1000000 ? this.currencyLarge.format(value) : this.currencySmall.format(value))
                    : (value >= 1000000000 ? this.numberLarge.format(value) : this.numberSmall.format(value));
            }

            const formattedNum = (value / divisor).toLocaleString('en-US', { maximumFractionDigits: 2 });
            return isCurrency ? `$${formattedNum}${suffix}` : `${formattedNum}${suffix}`;
        },

        currency(value) {
            return this.formatLargeValue(value, true);
        },
        number(value) {
            return this.formatLargeValue(value, false);
        }
    };

    const formatCurrency = (v) => Formatters.currency(v);
    const formatNumber = (v) => Formatters.number(v);

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
        updateText('avgPagesDisplay', state.pagesPerDoc);
        updateText('numFieldsDisplay', state.fieldsPerDoc);
        updateText('enhancedPercentageDisplay', `${state.enhancedPercentage}%`);
        updateText('standardPercentageDisplay', `${100 - state.enhancedPercentage}%`);
        updateText('imagePercentageDisplay', `${state.imagePercentage}%`);
        updateText('docPercentageDisplay', `${100 - state.imagePercentage}%`);
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
        if (params.has('time')) state.humanTimePerDoc = Number(params.get('time')) * 60;
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
        params.set('time', inputs.humanTime.value);

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
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

    function getEffectiveAvgPages(pdfPages) {
        const imageRatio = state.imagePercentage / 100;
        const docRatio = 1 - imageRatio;
        return (imageRatio * 1) + (docRatio * pdfPages);
    }

    function calculateHeuristicTime() {
        const effectivePages = getEffectiveAvgPages(state.pagesPerDoc);
        const suggestedTimeSeconds = (state.fieldsPerDoc * HEURISTICS.SECONDS_PER_FIELD) + (effectivePages * HEURISTICS.SECONDS_PER_PAGE);
        state.humanTimePerDoc = suggestedTimeSeconds;
        inputs.humanTime.value = suggestedTimeSeconds / 60;
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

    function getEffectiveAiuPerPage() {
        const standardRatio = (100 - state.enhancedPercentage) / 100;
        const enhancedRatio = state.enhancedPercentage / 100;
        return (1 * standardRatio) + (3 * enhancedRatio);
    }

    function updateText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function calculateMetrics(currentState) {
        const effectiveAvgPages = getEffectiveAvgPages(currentState.pagesPerDoc);
        const totalPages = currentState.documents * effectiveAvgPages;
        const totalAIU = totalPages * getEffectiveAiuPerPage();
        
        // AI Cost Calculation
        const packsNeeded = Math.ceil(totalAIU / AIU_PER_PACK);
        const aiTotalCost = packsNeeded * COST_PER_PACK;
        const aiCostPerDoc = aiTotalCost / currentState.documents;

        // Human Cost Calculation
        const totalHumanHours = (currentState.documents * currentState.humanTimePerDoc) / 3600;
        
        // Min Wage
        const minWageTotalCost = totalHumanHours * currentState.minWageRate;
        const minWageCostPerDoc = minWageTotalCost / currentState.documents;
        
        // Consultant
        const consultantTotalCost = totalHumanHours * currentState.consultantRate;
        const consultantCostPerDoc = consultantTotalCost / currentState.documents;

        // Metrics
        const netSavingsStandard = minWageTotalCost - aiTotalCost;
        const netSavingsExpert = consultantTotalCost - aiTotalCost;
        
        const roiStandard = aiTotalCost > 0 ? ((netSavingsStandard / aiTotalCost) * 100) : 0;
        const roiExpert = aiTotalCost > 0 ? ((netSavingsExpert / aiTotalCost) * 100) : 0;
        
        const efficiencyRatio = aiTotalCost > 0 ? (minWageTotalCost / aiTotalCost) : 0;
        const efficiencyRatioExpert = aiTotalCost > 0 ? (consultantTotalCost / aiTotalCost) : 0;

        const breakEvenDocs = minWageCostPerDoc > 0 ? Math.ceil(COST_PER_PACK / minWageCostPerDoc) : 0;
        const breakEvenDocsExpert = consultantCostPerDoc > 0 ? Math.ceil(COST_PER_PACK / consultantCostPerDoc) : 0;

        const fteCount = totalHumanHours / EFFECTIVE_ANNUAL_HOURS;
        const workingYears = totalHumanHours / EFFECTIVE_ANNUAL_HOURS;

        return {
            effectiveAvgPages, totalPages, totalAIU, packsNeeded, aiTotalCost, aiCostPerDoc,
            totalHumanHours, minWageTotalCost, minWageCostPerDoc, consultantTotalCost, consultantCostPerDoc,
            netSavingsStandard, netSavingsExpert, roiStandard, roiExpert,
            efficiencyRatio, efficiencyRatioExpert, breakEvenDocs, breakEvenDocsExpert,
            fteCount, workingYears
        };
    }

    // --- Helper for Duplicate UI Logic ---
    function updateScenarioUI(metricId, value, type, options = {}) {
        // type: 'percent' | 'currency' | 'text'
        // options: { colorize: boolean, badgeId: string, ratio: number }
        
        const el = document.getElementById(metricId);
        if (!el) return;

        let formattedValue;
        if (type === 'percent') formattedValue = `${formatNumber(Math.round(value))}%`;
        else if (type === 'currency') formattedValue = formatCurrency(value);
        else formattedValue = value;
        
        el.textContent = formattedValue;
        
        // Add tooltip for truncated values if it's a number/currency
        if (typeof value === 'number' && (Math.abs(value) >= 1000)) {
            el.title = value.toLocaleString('en-US');
        } else {
            el.removeAttribute('title');
        }

        if (options.colorize) {
            el.classList.remove('stat-positive', 'stat-critical', 'text-success', 'text-danger', 'text-warning');
            const isPositive = value > 0;
            
            // For ROI and Savings cards
            if (options.isCard) {
                el.classList.add(isPositive ? 'stat-positive' : 'stat-critical');
            } 
            // For Table
            else {
                el.classList.add('fw-bold', 'text-right'); // Ensure base classes
                el.classList.add(isPositive ? 'text-success' : 'text-danger');
            }
        }

        if (options.badgeId) {
            const badge = document.getElementById(options.badgeId);
            if (badge) {
                if (value > 0) {
                    badge.textContent = `${options.ratio.toFixed(1)}x`;
                    badge.style.backgroundColor = '#d1fae5';
                    badge.style.color = '#059669';
                } else {
                    badge.textContent = 'Loss';
                    badge.style.backgroundColor = '#fee2e2';
                    badge.style.color = '#b91c1c';
                }
            }
        }
    }

    function renderUI(metrics) {
        // 1. ROI
        updateScenarioUI('summaryROIStd', metrics.roiStandard, 'percent', { colorize: true, isCard: true });
        updateScenarioUI('summaryROIExp', metrics.roiExpert, 'percent', { colorize: true, isCard: true });

        // 2. Net Savings
        updateScenarioUI('summarySavingsStd', metrics.netSavingsStandard, 'currency', { 
            colorize: true, isCard: true, badgeId: 'savingsBadgeStd', ratio: metrics.efficiencyRatio 
        });
        updateScenarioUI('summarySavingsExp', metrics.netSavingsExpert, 'currency', { 
            colorize: true, isCard: true, badgeId: 'savingsBadgeExp', ratio: metrics.efficiencyRatioExpert 
        });

        // 3. FTEs
        updateText('summaryFTE', formatNumber(Math.ceil(metrics.fteCount))); 
        const fteSubtext = document.getElementById('fteSubtext');
        if (fteSubtext) {
             if (metrics.totalHumanHours > EFFECTIVE_ANNUAL_HOURS) {
                 fteSubtext.textContent = `approx ${metrics.workingYears.toFixed(1)} Years`;
            } else {
                 fteSubtext.textContent = `${formatNumber(Math.round(metrics.totalHumanHours))} Hours`;
            }
        }
        const fteEl = document.getElementById('summaryFTE');
        if (fteEl) {
            if (metrics.fteCount > 5) fteEl.classList.add('stat-critical');
            else fteEl.classList.remove('stat-critical');
        }

        // 4. Break-Even
        updateText('summaryBreakEvenStd', `${formatNumber(metrics.breakEvenDocs)} Files`);
        updateText('summaryBreakEvenExp', `${formatNumber(metrics.breakEvenDocsExpert)} Files`);

        // 5. AI Cost
        updateText('summaryAiCost', formatCurrency(metrics.aiTotalCost));

        // --- Table Updates ---
        updateText('table-ai-pack-cost', formatNumber(COST_PER_PACK));
        updateText('table-ai-total-cost', formatCurrency(metrics.aiTotalCost));
        updateText('table-ai-cost-per-doc', '$' + metrics.aiCostPerDoc.toFixed(4));

        // Standard Row
        updateText('table-human-std-rate', state.minWageRate.toFixed(2));
        updateText('table-human-std-hours', formatNumber(Math.round(metrics.totalHumanHours)));
        updateText('table-human-std-total', formatCurrency(metrics.minWageTotalCost));
        updateText('table-human-std-cost-per-doc', '$' + metrics.minWageCostPerDoc.toFixed(4));
        updateScenarioUI('table-human-std-savings', metrics.netSavingsStandard, 'currency', { colorize: true });
        updateText('table-human-std-ratio', (metrics.minWageTotalCost / metrics.aiTotalCost).toFixed(2) + 'x');

        // Expert Row
        updateText('table-human-exp-rate', state.consultantRate.toFixed(2));
        updateText('table-human-exp-hours', formatNumber(Math.round(metrics.totalHumanHours)));
        updateText('table-human-exp-total', formatCurrency(metrics.consultantTotalCost));
        updateText('table-human-exp-cost-per-doc', '$' + metrics.consultantCostPerDoc.toFixed(4));
        updateScenarioUI('table-human-exp-savings', metrics.netSavingsExpert, 'currency', { colorize: true });
        updateText('table-human-exp-ratio', (metrics.consultantTotalCost / metrics.aiTotalCost).toFixed(2) + 'x');

        // --- Insights ---
        updateText('insight-roi', formatNumber(Math.round(metrics.roiStandard)) + '%');
        updateText('insight-savings', formatCurrency(metrics.netSavingsStandard));
        updateText('insight-fte', formatNumber(Math.ceil(metrics.fteCount)));
        updateText('insight-time-per-doc', (state.humanTimePerDoc / 60).toFixed(1));
        updateText('insight-cheaper-ratio', metrics.aiCostPerDoc > 0 ? (metrics.minWageCostPerDoc / metrics.aiCostPerDoc).toFixed(1) : '0');
    }

    // Charts
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

    function updateCharts(metrics) {
        costChart.data.datasets[0].data = [metrics.aiTotalCost, metrics.minWageTotalCost, metrics.consultantTotalCost];
        costChart.update();

        const timeLabels = [1, 5, 10, 15, 20, 30];
        timeSensitivityChart.data.labels = timeLabels;
        timeSensitivityChart.data.datasets[0].data = timeLabels.map(() => metrics.aiTotalCost);
        timeSensitivityChart.data.datasets[1].data = timeLabels.map(min => (state.documents * min / 60) * state.minWageRate);
        timeSensitivityChart.data.datasets[2].data = timeLabels.map(min => (state.documents * min / 60) * state.consultantRate);
        timeSensitivityChart.update();

        const pageLabels = [1, 5, 10, 20, 50, 100];
        const effectiveAiu = getEffectiveAiuPerPage();
        pageSensitivityChart.data.labels = pageLabels;
        pageSensitivityChart.data.datasets[0].data = pageLabels.map(pdfPages => {
            const effectiveAvgPages = getEffectiveAvgPages(pdfPages);
            const totalAIU = state.documents * effectiveAvgPages * effectiveAiu;
            return Math.ceil(totalAIU / AIU_PER_PACK) * COST_PER_PACK;
        });
        pageSensitivityChart.data.datasets[1].data = pageLabels.map(() => metrics.minWageTotalCost);
        pageSensitivityChart.data.datasets[2].data = pageLabels.map(() => metrics.consultantTotalCost);
        pageSensitivityChart.update();
    }

    function toggleCostChartScale(isLog) {
        if (!costChart) return;
        costChart.options.scales.y.type = isLog ? 'logarithmic' : 'linear';
        costChart.options.scales.y.title.text = isLog ? 'Cost (Log Scale)' : 'Cost (Linear Scale)';
        
        if (isLog) {
            costChart.options.scales.y.ticks.callback = function(value) {
                const log10 = Math.log10(value);
                if (value >= 1000 && Math.abs(log10 - Math.round(log10)) < 1e-9) return formatCurrency(value);
                return null;
            };
        } else {
            costChart.options.scales.y.ticks.callback = (value) => formatCurrency(value);
        }
        costChart.update();
    }

    // --- Modal Logic ---
    const MODAL_CONFIGS = {
        roi: {
            title: 'Projected ROI Breakdown',
            id: 'modal-content-roi',
            update: (d) => {
                updateText('modal-roi-human-cost', formatCurrency(d.minWageTotalCost));
                updateText('modal-roi-ai-cost', formatCurrency(d.aiTotalCost));
                updateText('modal-roi-net-savings', formatCurrency(d.netSavingsStandard));
                updateText('modal-roi-ai-cost-base', formatCurrency(d.aiTotalCost));
                updateText('modal-roi-value', `${formatNumber(Math.round(d.roiStandard))}%`);
                
                updateText('modal-roi-human-cost-exp', formatCurrency(d.consultantTotalCost));
                updateText('modal-roi-ai-cost-exp', formatCurrency(d.aiTotalCost));
                updateText('modal-roi-net-savings-exp', formatCurrency(d.netSavingsExpert));
                updateText('modal-roi-ai-cost-base-exp', formatCurrency(d.aiTotalCost));
                updateText('modal-roi-value-exp', `${formatNumber(Math.round(d.roiExpert))}%`);
            }
        },
        savings: {
            title: 'Net Estimated Savings Breakdown',
            id: 'modal-content-savings',
            update: (d) => {
                updateText('modal-savings-aiu', formatNumber(Math.ceil(d.totalAIU)));
                updateText('modal-savings-packs', d.packsNeeded);
                
                updateText('modal-savings-hours', formatNumber(Math.round(d.totalHumanHours)));
                updateText('modal-savings-rate', state.minWageRate.toFixed(2));
                updateText('modal-savings-human-total', formatCurrency(d.minWageTotalCost));
                updateText('modal-savings-ai-total', formatCurrency(d.aiTotalCost));
                updateText('modal-savings-net', formatCurrency(d.netSavingsStandard));
                updateText('modal-savings-ratio-display', d.efficiencyRatio.toFixed(1));
                
                updateText('modal-savings-hours-exp', formatNumber(Math.round(d.totalHumanHours)));
                updateText('modal-savings-rate-exp', state.consultantRate.toFixed(2));
                updateText('modal-savings-human-total-exp', formatCurrency(d.consultantTotalCost));
                updateText('modal-savings-ai-total-exp', formatCurrency(d.aiTotalCost));
                updateText('modal-savings-net-exp', formatCurrency(d.netSavingsExpert));
                updateText('modal-savings-ratio-display-exp', d.efficiencyRatioExpert.toFixed(1));
            }
        },
        breakeven: {
            title: 'Break-Even Volume Analysis',
            id: 'modal-content-breakeven',
            update: (d) => {
                updateText('modal-breakeven-manual-cost', d.minWageCostPerDoc.toFixed(4));
                updateText('modal-breakeven-docs', formatNumber(d.breakEvenDocs));
                updateText('modal-breakeven-manual-cost-exp', d.consultantCostPerDoc.toFixed(4));
                updateText('modal-breakeven-docs-exp', formatNumber(d.breakEvenDocsExpert));
            }
        },
        fte: {
            title: 'Est. FTEs Required Breakdown',
            id: 'modal-content-fte',
            update: (d) => {
                updateText('modal-fte-docs', formatNumber(state.documents));
                updateText('modal-fte-time-per-doc', (state.humanTimePerDoc / 60).toFixed(1));
                updateText('modal-fte-total-hours', formatNumber(Math.round(d.totalHumanHours)));
                updateText('modal-fte-count', formatNumber(Math.ceil(d.fteCount)));
                updateText('modal-fte-years', d.workingYears.toFixed(1));
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

    function showExplanation(metric) {
        if (!currentMetrics) return;

        const modal = document.getElementById('explanationModal');
        const modalTitle = document.getElementById('modalTitle');
        const closeBtn = document.querySelector('.close-modal');

        const closeModal = () => modal.close();
        closeBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        document.querySelectorAll('.modal-scenario').forEach(el => el.hidden = true);

        const config = MODAL_CONFIGS[metric];
        if (config) {
            modalTitle.textContent = config.title;
            document.getElementById(config.id).hidden = false;
            config.update(currentMetrics);
            modal.showModal();
        }
    }

    function handleInput() {
        updateStateFromDOM();
        currentMetrics = calculateMetrics(state);
        renderUI(currentMetrics);
        updateCharts(currentMetrics);
        debouncedUpdateURL();
    }

    function resetInputs() {
        state = { ...DEFAULTS };
        syncDomFromState();
        handleInput();
        window.history.replaceState({}, '', window.location.pathname);
    }

    function init() {
        loadFromURL();
        syncDomFromState();
        // Don't overwrite URL params if time is already set
        if (!new URLSearchParams(window.location.search).has('time')) {
             calculateHeuristicTime();
        }
        
        // Event Listeners
        inputs.documents.addEventListener('input', handleInput);
        inputs.avgPages.addEventListener('input', (e) => {
            updateText('avgPagesDisplay', e.target.value);
            updateStateFromDOM();
            calculateHeuristicTime();
            handleInput();
        });
        inputs.numFields.addEventListener('input', (e) => {
            updateText('numFieldsDisplay', e.target.value);
            updateStateFromDOM();
            calculateHeuristicTime();
            handleInput();
        });
        inputs.humanTime.addEventListener('input', handleInput);
        inputs.minWageRate.addEventListener('input', handleInput);
        inputs.consultantRate.addEventListener('input', handleInput);
        inputs.enhancedPercentage.addEventListener('input', (e) => {
            updateText('enhancedPercentageDisplay', `${e.target.value}%`);
            updateText('standardPercentageDisplay', `${100 - e.target.value}%`);
            handleInput();
        });
        inputs.imagePercentage.addEventListener('input', (e) => {
            updateText('imagePercentageDisplay', `${e.target.value}%`);
            updateText('docPercentageDisplay', `${100 - e.target.value}%`);
            updateStateFromDOM();
            calculateHeuristicTime();
            handleInput();
        });

        document.getElementById('resetBtn').addEventListener('click', resetInputs);
        
        const logToggle = document.getElementById('logScaleToggle');
        if (logToggle) {
            logToggle.addEventListener('change', (e) => toggleCostChartScale(e.target.checked));
        }

        // Modal Event Delegation
        document.querySelectorAll('[data-modal]').forEach(el => {
            const openModal = () => showExplanation(el.dataset.modal);
            el.addEventListener('click', openModal);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModal();
                }
            });
        });

        initCharts();
        handleInput();
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
