// Global Application State
let currentSelectedSymbol = "TSLA"; // Default selected stock
let stockDataMap = {}; // Tracks live stock objects by symbol {AAPL: {...}}
let previousStockPrices = {}; // For up/down tick animations {AAPL: 175.50}
let currentActiveTab = "stock-chart"; // "stock-chart" or "portfolio-chart"
let mainChart = null; // Chart.js instance
let liveInterval = null;
let currentCashOperation = "DEPOSIT"; // "DEPOSIT" or "WITHDRAW"

// Game Achievement States
const ACHIEVEMENTS = [
    { id: "first_trade", title: "Stonks Pioneer", desc: "Execute your very first buy or sell trade", icon: "fa-solid fa-rocket", unlocked: false },
    { id: "paper_millionaire", title: "Paper Millionaire", desc: "Increase your net worth to over $15,000", icon: "fa-solid fa-crown", unlocked: false },
    { id: "risk_taker", title: "Fully Invested", desc: "Reduce your cash balance below $500", icon: "fa-solid fa-fire", unlocked: false },
    { id: "whale", title: "Whale Investor", desc: "Own more than 100 shares of a single stock", icon: "fa-solid fa-fish-fins", unlocked: false }
];

// App Init
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    setupEventListeners();
    setupCharts();
    
    // Initial fetch
    refreshAllData().then(() => {
        // Select default stock in UI
        selectStock(currentSelectedSymbol);
    });

    // Start live updates polling (every 1.5 seconds for extremely active responsive simulation)
    liveInterval = setInterval(refreshAllData, 1500);
}

// 1. Event Listeners setups
function setupEventListeners() {
    // Reset simulation button
    document.getElementById("btn-reset").addEventListener("click", () => {
        if (confirm("Are you sure you want to reset the simulation? All history, custom stocks, and cash will go back to initial default state ($10,000).")) {
            fetch("/api/reset", { method: "POST" })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        alert("Account reset complete!");
                        refreshAllData().then(() => {
                            selectStock("TSLA");
                        });
                    }
                });
        }
    });

    // Quantity Input handler
    const qtyInput = document.getElementById("trade-quantity");
    qtyInput.addEventListener("input", updateTradeEstimate);
    qtyInput.addEventListener("change", updateTradeEstimate);

    // Trade Execution Buttons
    document.getElementById("btn-buy").addEventListener("click", () => executeTrade("BUY"));
    document.getElementById("btn-sell").addEventListener("click", () => executeTrade("SELL"));

    // Chart toggle tabs
    document.getElementById("tab-stock-chart").addEventListener("click", (e) => {
        switchChartTab("stock-chart");
    });
    document.getElementById("tab-portfolio-chart").addEventListener("click", (e) => {
        switchChartTab("portfolio-chart");
    });

    // Deposit & Withdraw cash clicks
    document.getElementById("btn-open-deposit").addEventListener("click", () => openCashModal("DEPOSIT"));
    document.getElementById("btn-open-withdraw").addEventListener("click", () => openCashModal("WITHDRAW"));
    
    // Close cash modal
    document.getElementById("btn-close-modal").addEventListener("click", closeCashModal);
    
    // Confirm cash operation
    document.getElementById("btn-modal-confirm").addEventListener("click", executeCashOperation);

    // List new custom stock
    document.getElementById("btn-list-stock").addEventListener("click", submitCustomStock);
}

// 2. Chart Rendering Service
function setupCharts() {
    const ctx = document.getElementById("mainChart").getContext("2d");
    
    // Create modern Chart.js line graph with custom gradient fills
    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Price',
                data: [],
                borderColor: '#6366f1',
                borderWidth: 2.5,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 3,
                pointHoverRadius: 6,
                tension: 0.25,
                fill: true,
                backgroundColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return null;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
                    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
                    return gradient;
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    titleFont: { family: 'Plus Jakarta Sans', weight: 'bold' },
                    bodyFont: { family: 'Plus Jakarta Sans' },
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Value: $${context.parsed.y.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Plus Jakarta Sans', size: 10 },
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// 3. Tab Toggling
function switchChartTab(tabId) {
    if (currentActiveTab === tabId) return;
    currentActiveTab = tabId;

    document.getElementById("tab-stock-chart").classList.toggle("active", tabId === "stock-chart");
    document.getElementById("tab-portfolio-chart").classList.toggle("active", tabId === "portfolio-chart");

    if (tabId === "stock-chart") {
        document.getElementById("chart-main-title").innerText = "Market Analysis";
        if (currentSelectedSymbol) {
            document.getElementById("chart-subtitle").innerText = `${currentSelectedSymbol} Price History`;
        }
    } else {
        document.getElementById("chart-main-title").innerText = "Portfolio Performance";
        document.getElementById("chart-subtitle").innerText = "Total Net Worth History";
    }

    updateChartData();
}

// 4. Global Data Fetch Loop
async function refreshAllData() {
    try {
        // Fetch Parallel Data streams to reduce latency
        const [stocksRes, portfolioRes, newsRes, txRes] = await Promise.all([
            fetch("/api/stocks").then(r => r.json()),
            fetch("/api/portfolio").then(r => r.json()),
            fetch("/api/news").then(r => r.json()),
            fetch("/api/transactions").then(r => r.json())
        ]);

        updateStocksMap(stocksRes);
        renderWatchlist();
        renderPortfolioSummary(portfolioRes);
        renderHoldings(portfolioRes.holdings);
        renderNews(newsRes);
        renderTransactions(txRes);
        checkAchievements(portfolioRes, txRes);
        
        // Auto-select fallback if Trade Ticket is uninitialized but stocks data is ready
        const tradeTickerEl = document.getElementById("trade-ticker");
        if (tradeTickerEl && (tradeTickerEl.innerText === "SELECT ASSET" || tradeTickerEl.innerText.trim() === "") && stocksRes.length > 0) {
            const defaultSymbol = stocksRes.some(s => s.symbol === currentSelectedSymbol) ? currentSelectedSymbol : stocksRes[0].symbol;
            selectStock(defaultSymbol);
        }

        // Update Chart ticks in real time
        updateChartData();
        updateTradeEstimate();

    } catch (err) {
        console.error("Error refreshing simulation APIs:", err);
    }
}

// Update local stocks map
function updateStocksMap(stocksList) {
    stocksList.forEach(stock => {
        // Save previous price before updating to calculate tick directions
        if (stockDataMap[stock.symbol]) {
            previousStockPrices[stock.symbol] = stockDataMap[stock.symbol].currentPrice;
        } else {
            previousStockPrices[stock.symbol] = stock.currentPrice;
        }
        stockDataMap[stock.symbol] = stock;
    });
}

// 5. Render Watchlist Stock Cards
function renderWatchlist() {
    const container = document.getElementById("watchlist-container");
    const activeSymbol = currentSelectedSymbol;

    // Create cards dynamically
    let html = "";
    Object.values(stockDataMap).forEach(stock => {
        const symbol = stock.symbol;
        const prevPrice = previousStockPrices[symbol] || stock.currentPrice;
        const priceDiff = stock.currentPrice - prevPrice;

        // Ticking class flash indicator
        let tickClass = "";
        if (priceDiff > 0.01) {
            tickClass = "tick-up";
        } else if (priceDiff < -0.01) {
            tickClass = "tick-down";
        }

        const isSelected = symbol === activeSymbol ? "selected" : "";
        const changeSign = stock.changePercent >= 0 ? "+" : "";
        const changeClass = stock.changePercent >= 0 ? "positive" : "negative";

        html += `
            <div class="watchlist-row ${isSelected} ${tickClass}" onclick="selectStock('${symbol}')" id="watch-${symbol}">
                <div class="watchlist-asset">
                    <span class="watchlist-symbol">${symbol}</span>
                    <span class="watchlist-name">${stock.name}</span>
                </div>
                <div class="watchlist-pricing">
                    <span class="watchlist-price">$${stock.currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    <span class="watchlist-change ${changeClass}">${changeSign}${stock.changePercent.toFixed(2)}%</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 6. Select Stock to view/trade
function selectStock(symbol) {
    currentSelectedSymbol = symbol;
    const stock = stockDataMap[symbol];
    if (!stock) return;

    // Mark row selected
    document.querySelectorAll(".watchlist-row").forEach(row => {
        row.classList.remove("selected");
    });
    const selectedRow = document.getElementById(`watch-${symbol}`);
    if (selectedRow) selectedRow.classList.add("selected");

    // Update ticket display
    document.getElementById("trade-ticker").innerText = stock.symbol;
    document.getElementById("trade-company").innerText = stock.name;
    document.getElementById("trade-price").innerText = `$${stock.currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    if (currentActiveTab === "stock-chart") {
        document.getElementById("chart-subtitle").innerText = `${stock.symbol} Price History`;
    }

    updateChartData();
    updateTradeEstimate();
}

// 7. Dynamic Trade Cost estimation & button state triggers
function updateTradeEstimate() {
    const stock = stockDataMap[currentSelectedSymbol];
    if (!stock) {
        document.getElementById("btn-buy").disabled = true;
        document.getElementById("btn-sell").disabled = true;
        return;
    }

    const qtyInput = document.getElementById("trade-quantity");
    let qty = parseInt(qtyInput.value);

    if (isNaN(qty) || qty <= 0) {
        qty = 0;
    }

    const estimate = qty * stock.currentPrice;
    document.getElementById("trade-estimate").innerText = `$${estimate.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    // Get current portfolio cash and user shares
    const cashStr = document.getElementById("cash-balance").innerText.replace(/[^0-9.]/g, "");
    const cash = parseFloat(cashStr) || 0;
    
    // Find shares owned for the active stock
    let ownedShares = 0;
    const holdingRow = document.getElementById(`holding-${currentSelectedSymbol}`);
    if (holdingRow) {
        ownedShares = parseInt(holdingRow.getAttribute("data-shares")) || 0;
    }

    // Toggle button locks
    const btnBuy = document.getElementById("btn-buy");
    const btnSell = document.getElementById("btn-sell");

    if (qty > 0) {
        btnBuy.disabled = cash < estimate;
        btnSell.disabled = ownedShares < qty;
        
        // Visual indicator for lack of cash
        if (cash < estimate) {
            document.getElementById("trade-estimate").style.color = "#ef4444";
        } else {
            document.getElementById("trade-estimate").style.color = "#f8fafc";
        }
    } else {
        btnBuy.disabled = true;
        btnSell.disabled = true;
        document.getElementById("trade-estimate").style.color = "#f8fafc";
    }
}

// 8. Render Portfolio Net Worth indicators
function renderPortfolioSummary(portfolio) {
    document.getElementById("net-worth").innerText = `$${portfolio.netWorth.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById("cash-balance").innerText = `$${portfolio.cash.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById("asset-value").innerText = `$${portfolio.assetsValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    const plBadge = document.getElementById("total-pl-badge");
    const sign = portfolio.totalProfitLossPercent >= 0 ? "+" : "";
    
    plBadge.className = `pl-badge ${portfolio.totalProfitLossPercent >= 0 ? 'positive' : 'negative'}`;
    plBadge.innerHTML = `<i class="fa-solid fa-caret-${portfolio.totalProfitLossPercent >= 0 ? 'up' : 'down'}"></i> ${sign}${portfolio.totalProfitLossPercent.toFixed(2)}%`;
}

// 9. Render Portfolio Holdings Table
function renderHoldings(holdings) {
    const tbody = document.getElementById("holdings-tbody");
    if (!holdings || holdings.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-state">
                <td colspan="7">
                    <div class="empty-message">
                        <i class="fa-solid fa-folder-open empty-icon"></i>
                        <p>No active holdings. Select a stock from the watchlist to buy shares.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = "";
    holdings.forEach(holding => {
        const sign = holding.profitLossPercent >= 0 ? "+" : "";
        const cellClass = holding.profitLossPercent >= 0 ? "cell-positive" : "cell-negative";

        html += `
            <tr class="holding-row" id="holding-${holding.symbol}" data-shares="${holding.shares}">
                <td>
                    <button class="ticker-badge" onclick="selectStock('${holding.symbol}')">${holding.symbol}</button>
                    <span class="holding-name">${holding.name}</span>
                </td>
                <td><strong>${holding.shares}</strong></td>
                <td>$${holding.averageBuyPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>$${holding.currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>$${holding.currentValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="${cellClass}"><strong>${sign}$${holding.profitLoss.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong> (${sign}${holding.profitLossPercent.toFixed(2)}%)</td>
                <td style="text-align: right;">
                    <button class="btn-quick" onclick="quickSell('${holding.symbol}', ${holding.shares})">
                        <i class="fa-solid fa-circle-minus"></i> Sell All
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// 10. Render News Feed Cards
function renderNews(newsList) {
    const container = document.getElementById("news-container");
    if (!newsList || newsList.length === 0) {
        container.innerHTML = `<p style="padding: 20px; text-align: center; color: var(--text-muted);">No market news reports.</p>`;
        return;
    }

    let html = "";
    newsList.forEach(news => {
        const formattedTime = new Date(news.timestamp).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        
        let sentimentBadge = "";
        if (news.impact > 0) {
            sentimentBadge = `<span class="news-badge positive"><i class="fa-solid fa-arrow-trend-up"></i> +${news.impact}%</span>`;
        } else if (news.impact < 0) {
            sentimentBadge = `<span class="news-badge negative"><i class="fa-solid fa-arrow-trend-down"></i> ${news.impact}%</span>`;
        } else {
            sentimentBadge = `<span class="news-badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted);"><i class="fa-solid fa-minus"></i> Neutral</span>`;
        }

        html += `
            <div class="news-item">
                <div class="news-header">
                    ${sentimentBadge}
                    <span class="news-time">${formattedTime}</span>
                </div>
                <span class="news-title">${news.title}</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 11. Render Transaction Logs Ledger
function renderTransactions(txList) {
    const container = document.getElementById("transactions-container");
    if (!txList || txList.length === 0) {
        container.innerHTML = `<p style="padding:20px; text-align:center; color: var(--text-muted); font-size:12px;">No transactions logged yet.</p>`;
        return;
    }

    let html = "";
    txList.forEach(tx => {
        const date = new Date(tx.timestamp).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        const type = tx.type.toUpperCase();
        
        let typeClass = "buy";
        if (type === "SELL" || type === "WITHDRAW") {
            typeClass = "sell";
        }

        const isCashOperation = type === "DEPOSIT" || type === "WITHDRAW";
        const symbolDisplay = isCashOperation ? `<i class="fa-solid fa-money-bill-transfer"></i> CASH` : tx.symbol;
        const descriptionDisplay = isCashOperation ? 
            `${type === "DEPOSIT" ? "Deposited" : "Withdrew"} Funds` : 
            `${tx.quantity} Shares @ $${tx.price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        html += `
            <div class="ledger-item">
                <div class="ledger-left">
                    <span class="ledger-type-badge ${typeClass}">${tx.type}</span>
                    <div class="ledger-details">
                        <span class="ledger-symbol">${symbolDisplay}</span>
                        <span class="ledger-time">${date}</span>
                    </div>
                </div>
                <div class="ledger-right">
                    <span>${descriptionDisplay}</span>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                        Value: $${tx.price.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 12. Trade Dispatch services
function executeTrade(type) {
    const stock = stockDataMap[currentSelectedSymbol];
    if (!stock) return;

    const qtyInput = document.getElementById("trade-quantity");
    const qty = parseInt(qtyInput.value);

    if (isNaN(qty) || qty <= 0) {
        alert("Please enter a valid shares quantity.");
        return;
    }

    const estimate = qty * stock.currentPrice;

    // Call API Trade execution POST
    const url = `/api/trade?symbol=${stock.symbol}&quantity=${qty}&type=${type}`;
    
    // Set loading indicator
    const btn = type === "BUY" ? document.getElementById("btn-buy") : document.getElementById("btn-sell");
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;

    fetch(url, { method: "POST" })
        .then(res => res.json())
        .then(data => {
            btn.innerHTML = origText;
            if (data.success) {
                // Success pulse or reset inputs
                qtyInput.value = 10;
                refreshAllData();
            } else {
                alert("Trade failed: " + data.error);
                updateTradeEstimate();
            }
        })
        .catch(err => {
            btn.innerHTML = origText;
            console.error("Trade request network issue:", err);
            updateTradeEstimate();
        });
}

function quickSell(symbol, shares) {
    selectStock(symbol);
    document.getElementById("trade-quantity").value = shares;
    updateTradeEstimate();
    
    // Trigger Sell directly
    setTimeout(() => {
        executeTrade("SELL");
    }, 100);
}

// 13. Dynamic Chart Updates
function updateChartData() {
    if (!mainChart) return;

    if (currentActiveTab === "stock-chart") {
        const stock = stockDataMap[currentSelectedSymbol];
        if (!stock || !stock.priceHistory) return;

        // Set line gradient to indigo
        mainChart.data.datasets[0].borderColor = '#6366f1';
        mainChart.data.datasets[0].pointBackgroundColor = '#8b5cf6';
        mainChart.data.datasets[0].backgroundColor = function(context) {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
            return gradient;
        };

        // Render stock price queue
        mainChart.data.labels = stock.priceHistory.map((_, i) => `Tick ${i+1}`);
        mainChart.data.datasets[0].data = stock.priceHistory;
        mainChart.update('none'); // Update quietly without blocking CPU
    } else {
        // Render portfolio net worth history timeline
        // Fetch value history from page elements or global variables
        const mockHistory = JSON.parse(localStorage.getItem("apex_history_mock")) || [10000];
        
        // Use true net worth history from active portfolio stats
        // We'll scrape it dynamically or fetch directly
        fetch("/api/portfolio")
            .then(res => res.json())
            .then(portfolio => {
                if (!portfolio || !portfolio.valueHistory) return;

                // Color gradient Emerald green for portfolios!
                mainChart.data.datasets[0].borderColor = '#10b981';
                mainChart.data.datasets[0].pointBackgroundColor = '#059669';
                mainChart.data.datasets[0].backgroundColor = function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return null;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
                    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
                    return gradient;
                };

                mainChart.data.labels = portfolio.valueHistory.map((_, i) => `Tick ${i+1}`);
                mainChart.data.datasets[0].data = portfolio.valueHistory;
                mainChart.update('none');
            });
    }
}

// 14. Gamified Achievements Checker
function checkAchievements(portfolio, txList) {
    const container = document.getElementById("achievements-container");

    ACHIEVEMENTS.forEach(ach => {
        if (ach.unlocked) return; // Already unlocked in this session

        let unlockCondition = false;
        
        if (ach.id === "first_trade" && txList && txList.some(tx => tx.type === "BUY" || tx.type === "SELL")) {
            unlockCondition = true;
        } else if (ach.id === "paper_millionaire" && portfolio.netWorth > 15000) {
            unlockCondition = true;
        } else if (ach.id === "risk_taker" && portfolio.cash < 500 && portfolio.assetsValue > 8000) {
            unlockCondition = true;
        } else if (ach.id === "whale" && portfolio.holdings) {
            const hasWhaleShares = portfolio.holdings.some(h => h.shares >= 100);
            if (hasWhaleShares) unlockCondition = true;
        }

        if (unlockCondition) {
            ach.unlocked = true;
            triggerAchievementNotify(ach.title);
        }
    });

    // Render achievements
    let html = "";
    ACHIEVEMENTS.forEach(ach => {
        const activeClass = ach.unlocked ? "unlocked" : "";
        html += `
            <div class="achievement-badge ${activeClass}">
                <div class="achievement-icon-wrap">
                    <i class="${ach.icon}"></i>
                </div>
                <span class="achievement-title">${ach.title}</span>
                <span class="achievement-desc">${ach.desc}</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Notification flash overlay when achievement unlocks
function triggerAchievementNotify(title) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.right = "24px";
    toast.style.background = "linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(139, 92, 246, 0.95))";
    toast.style.color = "#ffffff";
    toast.style.padding = "16px 24px";
    toast.style.borderRadius = "12px";
    toast.style.boxShadow = "0 8px 32px rgba(99, 102, 241, 0.4)";
    toast.style.zIndex = "9999";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "12px";
    toast.style.border = "1px solid rgba(255,255,255,0.2)";
    toast.style.transition = "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s";
    toast.style.transform = "translateY(50px)";
    toast.style.opacity = "0";

    toast.innerHTML = `
        <i class="fa-solid fa-trophy" style="font-size: 24px; color: #f59e0b; filter: drop-shadow(0 0 4px rgba(245,158,11,0.5));"></i>
        <div>
            <div style="font-size: 10px; font-weight: 800; opacity: 0.8; letter-spacing: 1px;">ACHIEVEMENT UNLOCKED!</div>
            <div style="font-size: 14px; font-weight: 700; margin-top: 2px;">${title}</div>
        </div>
    `;

    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = "translateY(0)";
        toast.style.opacity = "1";
    }, 100);

    // Fade out after 4 seconds
    setTimeout(() => {
        toast.style.transform = "translateY(50px)";
        toast.style.opacity = "0";
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 4000);
}

// 15. Cash Modal Actions
function openCashModal(type) {
    currentCashOperation = type;
    const modal = document.getElementById("cash-modal");
    const title = document.getElementById("cash-modal-title");
    const confirmBtn = document.getElementById("btn-modal-confirm");
    const amountInput = document.getElementById("cash-modal-amount");

    amountInput.value = "";
    
    if (type === "DEPOSIT") {
        title.innerText = "Deposit Virtual Funds";
        confirmBtn.innerText = "CONFIRM DEPOSIT";
        confirmBtn.className = "btn-action btn-buy";
    } else {
        title.innerText = "Withdraw Virtual Funds";
        confirmBtn.innerText = "CONFIRM WITHDRAWAL";
        confirmBtn.className = "btn-action btn-sell";
    }

    modal.classList.remove("hidden");
}

function closeCashModal() {
    document.getElementById("cash-modal").classList.add("hidden");
}

function executeCashOperation() {
    const amountInput = document.getElementById("cash-modal-amount");
    const amount = parseFloat(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount greater than $0.");
        return;
    }

    const endpoint = currentCashOperation === "DEPOSIT" ? "/api/deposit" : "/api/withdraw";
    const confirmBtn = document.getElementById("btn-modal-confirm");
    const origText = confirmBtn.innerText;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;

    fetch(`${endpoint}?amount=${amount}`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
            confirmBtn.disabled = false;
            confirmBtn.innerText = origText;
            if (data.success) {
                closeCashModal();
                refreshAllData();
            } else {
                alert("Operation failed: " + data.error);
            }
        })
        .catch(err => {
            confirmBtn.disabled = false;
            confirmBtn.innerText = origText;
            console.error("Cash operation network error:", err);
        });
}

// 16. Custom Stock submission
function submitCustomStock() {
    const symbolInput = document.getElementById("new-stock-symbol");
    const nameInput = document.getElementById("new-stock-name");
    const priceInput = document.getElementById("new-stock-price");

    let symbol = symbolInput.value.toUpperCase().trim();
    let name = nameInput.value.trim();
    let price = parseFloat(priceInput.value);

    if (!symbol || !name || isNaN(price) || price <= 0.01) {
        alert("Please fill in all fields with valid data. Initial price must be > $0.01");
        return;
    }

    // Alphanumeric symbol checking 3-5 chars
    if (!/^[A-Z0-9]{3,5}$/.test(symbol)) {
        alert("Stock Ticker Symbol must be 3-5 alphanumeric characters (e.g. AAPL, BTC1).");
        return;
    }

    const listBtn = document.getElementById("btn-list-stock");
    const origText = listBtn.innerHTML;
    listBtn.disabled = true;
    listBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Listing Asset...`;

    fetch(`/api/stocks/add?symbol=${symbol}&name=${encodeURIComponent(name)}&price=${price}`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
            listBtn.disabled = false;
            listBtn.innerHTML = origText;
            if (data.success) {
                // Clear fields
                symbolInput.value = "";
                nameInput.value = "";
                priceInput.value = "";
                
                alert(`Stock ${symbol} listed successfully! It has been added to the Watchlist.`);
                refreshAllData().then(() => {
                    selectStock(symbol); // Focus on new stock
                });
            } else {
                alert("Failed to list stock: " + data.error);
            }
        })
        .catch(err => {
            listBtn.disabled = false;
            listBtn.innerHTML = origText;
            console.error("Listing stock network error:", err);
        });
}
