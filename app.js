/* ==========================================================================
   APEX STOCK TRADING PLATFORM - CORE APPLICATION JS
   Single Page Application Architecture, API Polling, Real-Time Charting
   ========================================================================== */

const API_BASE = window.location.protocol === "file:" ? "http://localhost:8085" : "";

// Global App State
const state = {
    isAuthenticated: false,
    user: null,
    stocks: [],
    watchlist: [],
    currentView: "dashboard",
    selectedStock: null,
    tradeMode: "BUY", // BUY or SELL
    portfolioData: null,
    sectors: new Set(),
    activeFilterSector: "ALL",
    marketSearchQuery: ""
};

// Global Chart References
let allocationChart = null;
let stockChart = null;

// Polling interval IDs
let marketPollingInterval = null;
let portfolioPollingInterval = null;
let notificationPollingInterval = null;

// ==========================================================================
//  STARTUP & INITIALIZATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    checkAuthStatus();
});

// Check if user is logged in
async function checkAuthStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/auth/status`);
        const data = await res.json();
        
        if (data.authenticated) {
            state.isAuthenticated = true;
            state.user = data.user;
            setupAppSession();
        } else {
            showAuthScreen();
        }
    } catch (err) {
        console.error("Auth status check failed", err);
        showAuthScreen();
    }
}

// Show login screen
function showAuthScreen() {
    state.isAuthenticated = false;
    document.getElementById("welcome-screen").classList.remove("hidden");
    document.getElementById("app-dashboard").classList.add("hidden");
    clearPolling();
}

// Setup user app dashboard session
function setupAppSession() {
    document.getElementById("welcome-screen").classList.add("hidden");
    document.getElementById("app-dashboard").classList.remove("hidden");
    
    // Set static UI values
    document.getElementById("username-display").textContent = state.user.username;
    document.getElementById("user-tier-display").textContent = `${state.user.tier} Tier`;
    
    // Fetch initial data
    fetchMarketData();
    fetchPortfolioData();
    fetchWatchlist();
    
    // Start real-time background polling
    startPolling();
    
    // Switch to default dashboard overview
    switchView("dashboard");
}

// Start polling
function startPolling() {
    clearPolling(); // prevent duplicates
    
    // Poll market every 3 seconds
    marketPollingInterval = setInterval(fetchMarketData, 3000);
    // Poll portfolio every 3 seconds
    portfolioPollingInterval = setInterval(fetchPortfolioData, 3000);
    // Poll real-time transaction notifications every 3 seconds
    notificationPollingInterval = setInterval(fetchNotifications, 3000);
}

// Clear polling
function clearPolling() {
    if (marketPollingInterval) clearInterval(marketPollingInterval);
    if (portfolioPollingInterval) clearInterval(portfolioPollingInterval);
    if (notificationPollingInterval) clearInterval(notificationPollingInterval);
}

// ==========================================================================
//  DATA FETCHING / API WRAPPERS
// ==========================================================================

// Fetch all stocks
async function fetchMarketData() {
    try {
        const res = await fetch(`${API_BASE}/api/market/stocks`);
        const data = await res.json();
        state.stocks = data.stocks;
        
        // Populate unique sectors list
        state.sectors.clear();
        state.stocks.forEach(s => state.sectors.add(s.sector));
        
        // Update live index headers
        updateIndexHeader(data.marketIndex, data.sentiment);
        
        // Dynamically refresh active list rendering
        if (state.currentView === "dashboard") {
            renderDashboardGainersLosers();
        } else if (state.currentView === "market") {
            renderMarketStocks();
        }
        
        // If stock quote modal is currently open, refresh its price details
        if (state.selectedStock) {
            const freshStock = state.stocks.find(s => s.symbol === state.selectedStock.symbol);
            if (freshStock) {
                state.selectedStock = freshStock;
                updateStockModalUI();
            }
        }
    } catch (err) {
        console.error("Error fetching market data", err);
    }
}

// Fetch user portfolio balances & positions
async function fetchPortfolioData() {
    if (!state.isAuthenticated) return;
    try {
        const res = await fetch(`${API_BASE}/api/portfolio`);
        const data = await res.json();
        state.portfolioData = data;
        
        // Refresh values on UI components
        updatePortfolioBalances();
        
        if (state.currentView === "portfolio") {
            renderPortfolioView();
        }
        
        // Update modal balance if open
        if (state.selectedStock) {
            document.getElementById("trade-user-capital").textContent = `Cash Available: $${formatMoney(data.cashBalance)}`;
            const holding = data.holdings.find(h => h.symbol === state.selectedStock.symbol);
            document.getElementById("trade-user-shares").textContent = `Shares Owned: ${holding ? holding.quantity : 0}`;
        }
    } catch (err) {
        console.error("Error fetching portfolio data", err);
    }
}

// Fetch user watchlist
async function fetchWatchlist() {
    if (!state.isAuthenticated) return;
    try {
        const res = await fetch(`${API_BASE}/api/watchlist`);
        const data = await res.json();
        state.watchlist = data.symbols;
        
        if (state.currentView === "dashboard") {
            renderWatchlist();
        }
    } catch (err) {
        console.error("Error fetching watchlist", err);
    }
}

// Fetch background notification triggers
async function fetchNotifications() {
    if (!state.isAuthenticated) return;
    try {
        const res = await fetch(`${API_BASE}/api/notifications`);
        const data = await res.json();
        if (data.notifications && data.notifications.length > 0) {
            data.notifications.forEach(msg => {
                showToast(msg, "info");
                // Refresh data to show changes
                fetchPortfolioData();
                fetchWatchlist();
            });
        }
    } catch (err) {
        console.error("Error fetching notifications", err);
    }
}

// ==========================================================================
//  ROUTING / VIEW HANDLING
// ==========================================================================
function switchView(viewName) {
    state.currentView = viewName;
    
    // Toggle nav active classes
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.remove("active");
    });
    
    // Find active nav item based on click or match
    const activeBtn = Array.from(document.querySelectorAll(".nav-item")).find(btn => 
        btn.getAttribute("onclick").includes(`'${viewName}'`)
    );
    if (activeBtn) activeBtn.classList.add("active");
    
    // Hide all view sections
    document.querySelectorAll(".content-view").forEach(view => {
        view.classList.add("hidden");
    });
    
    // Unhide current view
    const viewSection = document.getElementById(`view-${viewName}`);
    if (viewSection) viewSection.classList.remove("hidden");
    
    // Set title
    const titles = {
        dashboard: "Dashboard Overview",
        market: "Market Terminal",
        portfolio: "My Portfolio",
        transactions: "Transaction History Log",
        leaderboard: "Apex Trader Leaderboard",
        alerts: "Alerts & Limit Orders Suite",
        settings: "Account Suite & Settings"
    };
    document.getElementById("view-title").textContent = titles[viewName] || "Platform Suite";
    
    // Render specific views on entering
    if (viewName === "dashboard") {
        renderWatchlist();
        renderDashboardGainersLosers();
        renderSectorDonutChart();
    } else if (viewName === "market") {
        renderSectorFilters();
        renderMarketStocks();
    } else if (viewName === "portfolio") {
        renderPortfolioView();
    } else if (viewName === "transactions") {
        renderTransactionsHistory();
    } else if (viewName === "leaderboard") {
        renderLeaderboard();
    } else if (viewName === "alerts") {
        renderAlertsAndOrders();
    } else if (viewName === "settings") {
        updateSettingsViewUI();
    }
}

// Toggle Auth Screen Tabs
function switchAuthTab(tabType, element) {
    document.querySelectorAll(".auth-tab").forEach(tab => {
        tab.classList.remove("active");
    });
    document.querySelectorAll(".auth-form").forEach(form => {
        form.classList.remove("active");
    });
    
    if (element) {
        element.classList.add("active");
    } else {
        const index = tabType === "login" ? 0 : 1;
        const tabs = document.querySelectorAll(".auth-tab");
        if (tabs[index]) tabs[index].classList.add("active");
    }
    
    if (tabType === "login") {
        document.getElementById("login-form").classList.add("active");
    } else {
        document.getElementById("register-form").classList.add("active");
    }
}

// ==========================================================================
//  VIEW RENDERING UTILITIES
// ==========================================================================

// Live header index tape
function updateIndexHeader(indexVal, sentiment) {
    document.getElementById("header-market-index").textContent = `$${formatMoney(indexVal)}`;
    
    const changeBadge = document.getElementById("header-market-change");
    const sentimentPct = sentiment * 100;
    
    changeBadge.textContent = `${sentimentPct >= 0 ? "+" : ""}${sentimentPct.toFixed(2)}%`;
    if (sentimentPct >= 0) {
        changeBadge.className = "index-change positive";
    } else {
        changeBadge.className = "index-change negative";
    }
}

// Dashboard metrics cards
function updatePortfolioBalances() {
    if (!state.portfolioData) return;
    const data = state.portfolioData;
    
    // Dashboard views
    document.getElementById("dash-total-value").textContent = `$${formatMoney(data.totalValue)}`;
    document.getElementById("dash-cash-balance").textContent = `$${formatMoney(data.cashBalance)}`;
    
    const dashPnL = document.getElementById("dash-unrealized-pnl");
    dashPnL.textContent = `${data.unrealizedPnL >= 0 ? "+" : ""}$${formatMoney(data.unrealizedPnL)}`;
    const dashCard = document.getElementById("dash-pnl-card");
    if (data.unrealizedPnL >= 0) {
        dashCard.className = "metric-card green-gradient";
        dashPnL.className = "text-green";
    } else {
        dashCard.className = "metric-card red-gradient";
        dashPnL.className = "text-red";
    }
    
    const dashReturn = document.getElementById("dash-total-return");
    dashReturn.textContent = `${data.totalReturnPct >= 0 ? "+" : ""}${data.totalReturnPct.toFixed(2)}%`;
}

// Watchlist renderer
function renderWatchlist() {
    const tbody = document.getElementById("watchlist-body");
    tbody.innerHTML = "";
    
    const watchedStocks = state.stocks.filter(s => state.watchlist.includes(s.symbol));
    
    if (watchedStocks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">Your watchlist is empty. Visit the Market Terminal to add stocks!</td></tr>`;
        return;
    }
    
    watchedStocks.forEach(s => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><span class="stock-symbol-badge">${s.symbol}</span></td>
            <td><strong>$${formatMoney(s.currentPrice)}</strong></td>
            <td class="${s.dayChangePercent >= 0 ? 'text-green' : 'text-red'}">
                <strong>${s.dayChangePercent >= 0 ? '▲' : '▼'} ${s.dayChangePercent.toFixed(2)}%</strong>
            </td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="openStockModal('${s.symbol}')">Trade</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Dashboard Top Gainers & Losers list rendering
function renderDashboardGainersLosers() {
    const gainersList = document.getElementById("dash-top-gainers");
    const losersList = document.getElementById("dash-top-losers");
    
    gainersList.innerHTML = "";
    losersList.innerHTML = "";
    
    // Sort stocks
    const sortedStocks = [...state.stocks];
    const gainers = [...sortedStocks].sort((a, b) => b.dayChangePercent - a.dayChangePercent).slice(0, 5);
    const losers = [...sortedStocks].sort((a, b) => a.dayChangePercent - b.dayChangePercent).slice(0, 5);
    
    gainers.forEach(s => {
        const li = document.createElement("li");
        li.className = "market-list-item";
        li.onclick = () => openStockModal(s.symbol);
        li.innerHTML = `
            <div class="mli-left">
                <span class="mli-symbol">${s.symbol}</span>
                <span class="mli-name">${s.companyName}</span>
            </div>
            <div class="mli-right">
                <span class="mli-price">$${formatMoney(s.currentPrice)}</span>
                <span class="mli-change text-green">▲ ${s.dayChangePercent.toFixed(2)}%</span>
            </div>
        `;
        gainersList.appendChild(li);
    });

    losers.forEach(s => {
        const li = document.createElement("li");
        li.className = "market-list-item";
        li.onclick = () => openStockModal(s.symbol);
        li.innerHTML = `
            <div class="mli-left">
                <span class="mli-symbol">${s.symbol}</span>
                <span class="mli-name">${s.companyName}</span>
            </div>
            <div class="mli-right">
                <span class="mli-price">$${formatMoney(s.currentPrice)}</span>
                <span class="mli-change text-red">▼ ${s.dayChangePercent.toFixed(2)}%</span>
            </div>
        `;
        losersList.appendChild(li);
    });
}

// Sector donut chart
function renderSectorDonutChart() {
    const canvas = document.getElementById("allocationDonutChart");
    const emptyMsg = document.getElementById("allocation-empty-msg");
    
    if (!state.portfolioData || Object.keys(state.portfolioData.allocation).length === 0) {
        canvas.style.display = "none";
        emptyMsg.classList.remove("hidden");
        return;
    }
    
    canvas.style.display = "block";
    emptyMsg.classList.add("hidden");
    
    const labels = Object.keys(state.portfolioData.allocation);
    const dataVals = Object.values(state.portfolioData.allocation);
    
    if (allocationChart) {
        allocationChart.destroy();
    }
    
    allocationChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: dataVals,
                backgroundColor: [
                    "hsl(210, 100%, 55%)",
                    "hsl(265, 80%, 65%)",
                    "hsl(150, 80%, 45%)",
                    "hsl(42, 90%, 55%)",
                    "hsl(270, 75%, 60%)",
                    "hsl(190, 90%, 50%)",
                    "hsl(345, 80%, 55%)"
                ],
                borderWidth: 1,
                borderColor: "rgba(30, 41, 59, 0.8)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "right",
                    labels: {
                        color: "hsl(220, 10%, 75%)",
                        font: { family: "Outfit", size: 12 }
                    }
                }
            }
        }
    });
}

// ==========================================================================
//  MARKET TERMINAL VIEWS & FILTERS
// ==========================================================================

// Sector tabs
function renderSectorFilters() {
    const tabBox = document.getElementById("sector-filter-tabs");
    tabBox.innerHTML = `<button class="sector-tab ${state.activeFilterSector === 'ALL' ? 'active' : ''}" onclick="filterMarketSector('ALL')">All Sectors</button>`;
    
    Array.from(state.sectors).sort().forEach(sec => {
        const btn = document.createElement("button");
        btn.className = `sector-tab ${state.activeFilterSector === sec ? 'active' : ''}`;
        btn.onclick = () => filterMarketSector(sec);
        btn.textContent = sec;
        tabBox.appendChild(btn);
    });
}

function filterMarketSector(sector) {
    state.activeFilterSector = sector;
    renderSectorFilters();
    renderMarketStocks();
}

function handleMarketSearch() {
    state.marketSearchQuery = document.getElementById("market-search").value.toLowerCase();
    renderMarketStocks();
}

// Active securities list
function renderMarketStocks() {
    const tbody = document.getElementById("market-stocks-body");
    tbody.innerHTML = "";
    
    let filtered = state.stocks;
    
    // Sector filter
    if (state.activeFilterSector !== "ALL") {
        filtered = filtered.filter(s => s.sector === state.activeFilterSector);
    }
    
    // Search query filter
    if (state.marketSearchQuery) {
        filtered = filtered.filter(s => 
            s.symbol.toLowerCase().includes(state.marketSearchQuery) ||
            s.companyName.toLowerCase().includes(state.marketSearchQuery) ||
            s.sector.toLowerCase().includes(state.marketSearchQuery)
        );
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">No active stocks match the filters.</td></tr>`;
        return;
    }
    
    filtered.forEach(s => {
        const isWatched = state.watchlist.includes(s.symbol);
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><span class="stock-symbol-badge">${s.symbol}</span></td>
            <td><strong>${s.companyName}</strong></td>
            <td>${s.sector}</td>
            <td class="text-right"><strong>$${formatMoney(s.currentPrice)}</strong></td>
            <td class="text-right ${s.dayChangeAmount >= 0 ? 'text-green' : 'text-red'}">
                <strong>${s.dayChangeAmount >= 0 ? '+' : ''}${s.dayChangeAmount.toFixed(2)}</strong>
            </td>
            <td class="text-right ${s.dayChangePercent >= 0 ? 'text-green' : 'text-red'}">
                <strong>${s.dayChangePercent >= 0 ? '▲' : '▼'} ${s.dayChangePercent.toFixed(2)}%</strong>
            </td>
            <td class="text-right text-muted">${formatVolume(s.volume)}</td>
            <td class="text-center">
                <div style="display: flex; justify-content: center; gap: 8px;">
                    <button class="btn btn-sm btn-outline" onclick="openStockModal('${s.symbol}')">Quote & Trade</button>
                    <button class="btn btn-sm btn-outline ${isWatched ? 'text-green' : ''}" onclick="toggleWatchlistAPI('${s.symbol}', this)" style="padding: 6px 8px;">
                        <i class="bx ${isWatched ? 'bxs-star text-gold' : 'bx-star'}"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Watchlist API addition/removal
async function toggleWatchlistAPI(symbol, element) {
    const isWatched = state.watchlist.includes(symbol);
    const apiRoute = isWatched ? "remove" : "add";
    
    try {
        const res = await fetch(`${API_BASE}/api/watchlist/${apiRoute}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol: symbol })
        });
        const data = await res.json();
        
        if (data.success) {
            showToast(`${symbol} ${isWatched ? 'removed from' : 'added to'} watchlist.`, "success");
            fetchWatchlist();
        } else {
            showToast(data.message, "error");
        }
    } catch (err) {
        console.error("Watchlist API error", err);
    }
}

// ==========================================================================
//  PORTFOLIO VIEW
// ==========================================================================
function renderPortfolioView() {
    if (!state.portfolioData) return;
    const data = state.portfolioData;
    
    // Update headers
    document.getElementById("port-total-value").textContent = `$${formatMoney(data.totalValue)}`;
    document.getElementById("port-stock-value").textContent = `$${formatMoney(data.stockValue)}`;
    document.getElementById("port-realized-pnl").textContent = `$${formatMoney(data.realizedPnL)}`;
    
    const portPnL = document.getElementById("port-unrealized-pnl");
    portPnL.textContent = `${data.unrealizedPnL >= 0 ? "+" : ""}$${formatMoney(data.unrealizedPnL)} (${data.unrealizedPnLPct.toFixed(2)}%)`;
    const portCard = document.getElementById("port-pnl-card");
    if (data.unrealizedPnL >= 0) {
        portCard.className = "metric-card green-gradient";
        portPnL.className = "text-green";
    } else {
        portCard.className = "metric-card red-gradient";
        portPnL.className = "text-red";
    }
    
    document.getElementById("portfolio-rating").textContent = `Rating: ${data.rating}`;
    
    // Holdings table
    const tbody = document.getElementById("portfolio-holdings-body");
    tbody.innerHTML = "";
    
    if (data.holdings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">You don't own any shares. Visit the Market Terminal to build your portfolio!</td></tr>`;
        return;
    }
    
    data.holdings.forEach(h => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><span class="stock-symbol-badge">${h.symbol}</span></td>
            <td><strong>${h.companyName}</strong></td>
            <td class="text-right">${h.quantity}</td>
            <td class="text-right">$${formatMoney(h.avgCost)}</td>
            <td class="text-right">$${formatMoney(h.currentPrice)}</td>
            <td class="text-right"><strong>$${formatMoney(h.currentValue)}</strong></td>
            <td class="text-right ${h.unrealizedPnL >= 0 ? 'text-green' : 'text-red'}">
                <strong>${h.unrealizedPnL >= 0 ? '+' : ''}${h.unrealizedPnLPct.toFixed(2)}%</strong>
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline" onclick="openStockModal('${h.symbol}')">Trade</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ==========================================================================
//  TRANSACTIONS & EXPORT
// ==========================================================================
async function renderTransactionsHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/transactions`);
        const data = await res.json();
        
        document.getElementById("tx-commission-total").textContent = `Commission Paid: $${formatMoney(data.totalCommission)}`;
        
        const tbody = document.getElementById("transactions-log-body");
        tbody.innerHTML = "";
        
        if (data.transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center">No trades logged yet.</td></tr>`;
            return;
        }
        
        data.transactions.forEach(t => {
            const isBuy = t.type === "BUY";
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><small>${t.transactionId}</small></td>
                <td><small>${t.timestamp}</small></td>
                <td><span class="stock-symbol-badge">${t.symbol}</span></td>
                <td class="${isBuy ? 'text-green' : 'text-red'}"><strong>${t.type} (${t.orderType})</strong></td>
                <td class="text-right">${t.quantity}</td>
                <td class="text-right">$${formatMoney(t.pricePerShare)}</td>
                <td class="text-right text-muted">$${formatMoney(t.commission)}</td>
                <td class="text-right"><strong>$${formatMoney(t.totalAmount)}</strong></td>
                <td class="text-right ${t.profitLoss >= 0 ? 'text-green' : 'text-red'}">
                    <strong>${!isBuy ? (t.profitLoss >= 0 ? '+' : '') + formatMoney(t.profitLoss) : '—'}</strong>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Error fetching transactions", err);
    }
}

// Export account metrics
async function triggerAccountAction(actionType) {
    try {
        const res = await fetch(`${API_BASE}/api/account/${actionType}`, { method: "POST" });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, "success");
        } else {
            showToast(data.message, "error");
        }
    } catch (err) {
        console.error(`Export ${actionType} error`, err);
    }
}

// ==========================================================================
//  LEADERBOARD
// ==========================================================================
async function renderLeaderboard() {
    try {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        const data = await res.json();
        const board = data.leaderboard;
        
        // Populate Podium
        const podiumData = [...board].slice(0, 3);
        
        // 1st place
        if (podiumData[0]) {
            document.getElementById("podium-1-user").textContent = podiumData[0].username;
            document.getElementById("podium-1-val").textContent = `$${formatMoney(podiumData[0].totalValue)}`;
        } else {
            document.getElementById("podium-1-user").textContent = "No User";
            document.getElementById("podium-1-val").textContent = "$0.00";
        }
        
        // 2nd place
        if (podiumData[1]) {
            document.getElementById("podium-2-user").textContent = podiumData[1].username;
            document.getElementById("podium-2-val").textContent = `$${formatMoney(podiumData[1].totalValue)}`;
        } else {
            document.getElementById("podium-2-user").textContent = "No User";
            document.getElementById("podium-2-val").textContent = "$0.00";
        }

        // 3rd place
        if (podiumData[2]) {
            document.getElementById("podium-3-user").textContent = podiumData[2].username;
            document.getElementById("podium-3-val").textContent = `$${formatMoney(podiumData[2].totalValue)}`;
        } else {
            document.getElementById("podium-3-user").textContent = "No User";
            document.getElementById("podium-3-val").textContent = "$0.00";
        }
        
        // List table
        const tbody = document.getElementById("leaderboard-body");
        tbody.innerHTML = "";
        
        board.forEach((u, i) => {
            const row = document.createElement("tr");
            const highlight = state.user && u.username === state.user.username ? 'style="background: rgba(234,179,8,0.06); border-left: 3px solid var(--gold)"' : '';
            
            row.innerHTML = `
                <td ${highlight}><strong>#${i + 1}</strong></td>
                <td ${highlight}><strong>${u.username}</strong></td>
                <td ${highlight} class="text-accent">${u.tier}</td>
                <td ${highlight} class="text-right"><strong>$${formatMoney(u.totalValue)}</strong></td>
                <td ${highlight} class="text-right ${u.netPnL >= 0 ? 'text-green' : 'text-red'}">
                    <strong>${u.netPnL >= 0 ? '+' : ''}${formatMoney(u.netPnL)}</strong>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Leaderboard error", err);
    }
}

// ==========================================================================
//  ALERTS & LIMIT ORDERS VIEWS
// ==========================================================================
async function renderAlertsAndOrders() {
    // Fill option lists with active securities
    const alertSel = document.getElementById("alert-symbol");
    const orderSel = document.getElementById("order-symbol");
    
    alertSel.innerHTML = '<option value="" disabled selected>Symbol</option>';
    orderSel.innerHTML = '<option value="" disabled selected>Symbol</option>';
    
    state.stocks.forEach(s => {
        const opt1 = `<option value="${s.symbol}">${s.symbol} ($${s.currentPrice})</option>`;
        const opt2 = `<option value="${s.symbol}">${s.symbol} ($${s.currentPrice})</option>`;
        alertSel.insertAdjacentHTML("beforeend", opt1);
        orderSel.insertAdjacentHTML("beforeend", opt2);
    });
    
    fetchActiveAlerts();
    fetchPendingOrders();
}

async function fetchActiveAlerts() {
    try {
        const res = await fetch(`${API_BASE}/api/alerts`);
        const data = await res.json();
        
        const tbody = document.getElementById("alerts-list-body");
        tbody.innerHTML = "";
        
        if (data.alerts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center">No active price alerts set.</td></tr>`;
            return;
        }
        
        data.alerts.forEach(a => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><span class="stock-symbol-badge">${a.symbol}</span></td>
                <td><strong>${a.alertType === "ABOVE" ? 'Above (▲)' : 'Below (▼)'}</strong></td>
                <td class="text-right"><strong>$${formatMoney(a.targetPrice)}</strong></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-logout" onclick="handleCancelAlert('${a.alertId}')">Cancel</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Alerts fetching error", err);
    }
}

async function handleCreateAlert(e) {
    e.preventDefault();
    const symbol = document.getElementById("alert-symbol").value;
    const type = document.getElementById("alert-type").value;
    const targetPrice = parseFloat(document.getElementById("alert-price").value);
    
    try {
        const res = await fetch(`${API_BASE}/api/alerts/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol, type, targetPrice })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, "success");
            fetchActiveAlerts();
            document.getElementById("create-alert-form").reset();
        } else {
            showToast(data.message, "error");
        }
    } catch (err) {
        console.error("Create alert error", err);
    }
}

async function handleCancelAlert(alertId) {
    try {
        const res = await fetch(`${API_BASE}/api/alerts/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ alertId })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, "success");
            fetchActiveAlerts();
        }
    } catch (err) {
        console.error("Cancel alert error", err);
    }
}

async function fetchPendingOrders() {
    try {
        const res = await fetch(`${API_BASE}/api/orders`);
        const data = await res.json();
        
        const tbody = document.getElementById("orders-list-body");
        tbody.innerHTML = "";
        
        if (data.orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center">No pending limit orders.</td></tr>`;
            return;
        }
        
        data.orders.forEach(o => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><span class="stock-symbol-badge">${o.symbol}</span></td>
                <td class="${o.type === 'BUY' ? 'text-green' : 'text-red'}"><strong>LIMIT ${o.type}</strong></td>
                <td class="text-right">${o.quantity}</td>
                <td class="text-right"><strong>$${formatMoney(o.limitPrice)}</strong></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-logout" onclick="handleCancelOrder('${o.orderId}')">Cancel</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Pending orders fetching error", err);
    }
}

async function handlePlaceLimitOrder(e) {
    e.preventDefault();
    const symbol = document.getElementById("order-symbol").value;
    const type = document.getElementById("order-type").value;
    const qty = parseInt(document.getElementById("order-qty").value);
    const limitPrice = parseFloat(document.getElementById("order-price").value);
    
    try {
        const res = await fetch(`${API_BASE}/api/orders/place`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol, type, qty, limitPrice })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, "success");
            fetchPendingOrders();
            document.getElementById("place-order-form").reset();
        } else {
            showToast(data.message, "error");
        }
    } catch (err) {
        console.error("Place limit order error", err);
    }
}

async function handleCancelOrder(orderId) {
    try {
        const res = await fetch(`${API_BASE}/api/orders/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, "success");
            fetchPendingOrders();
        }
    } catch (err) {
        console.error("Cancel order error", err);
    }
}

// ==========================================================================
//  ACCOUNT SETTINGS OPERATIONS
// ==========================================================================
function updateSettingsViewUI() {
    if (!state.portfolioData) return;
    document.getElementById("settings-cash-balance").textContent = `$${formatMoney(state.portfolioData.cashBalance)}`;
}

async function handleDeposit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById("deposit-amount").value);
    
    try {
        const res = await fetch(`${API_BASE}/api/account/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, "success");
            document.getElementById("deposit-amount").value = "";
            fetchPortfolioData();
            setTimeout(updateSettingsViewUI, 200);
        } else {
            showToast(data.message, "error");
        }
    } catch (err) {
        console.error("Deposit funds error", err);
    }
}

async function handleWithdraw(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById("withdraw-amount").value);
    
    try {
        const res = await fetch(`${API_BASE}/api/account/withdraw`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, "success");
            document.getElementById("withdraw-amount").value = "";
            fetchPortfolioData();
            setTimeout(updateSettingsViewUI, 200);
        } else {
            showToast(data.message, "error");
        }
    } catch (err) {
        console.error("Withdraw funds error", err);
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    const oldPassword = document.getElementById("old-password").value;
    const newPassword = document.getElementById("new-password").value;
    
    try {
        const res = await fetch(`${API_BASE}/api/account/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, "success");
            document.getElementById("old-password").value = "";
            document.getElementById("new-password").value = "";
        } else {
            showToast(data.message, "error");
        }
    } catch (err) {
        console.error("Password change error", err);
    }
}

// ==========================================================================
//  STOCK TERMINAL QUOTES & TRADING MODAL
// ==========================================================================
async function openStockModal(symbol) {
    const stock = state.stocks.find(s => s.symbol === symbol);
    if (!stock) return;
    
    state.selectedStock = stock;
    state.tradeMode = "BUY";
    
    // Clear trade quantity inputs
    document.getElementById("trade-quantity").value = "";
    document.getElementById("trade-est-cost").textContent = "$0.00";
    document.getElementById("trade-total-est").textContent = "$0.00";
    
    // Select default active BUY tab
    document.querySelectorAll(".trade-tab").forEach(t => t.classList.remove("active"));
    document.querySelector(".trade-panel-tabs button:first-child").classList.add("active");
    
    // Open panel
    document.getElementById("stock-modal").classList.remove("hidden");
    
    // Populate layout
    updateStockModalUI();
    
    // Load historical tick graph
    renderStockTrendChart(stock);
}

function closeStockModal() {
    document.getElementById("stock-modal").classList.add("hidden");
    state.selectedStock = null;
    if (stockChart) {
        stockChart.destroy();
        stockChart = null;
    }
}

function updateStockModalUI() {
    const s = state.selectedStock;
    if (!s) return;
    
    document.getElementById("modal-stock-symbol").textContent = s.symbol;
    document.getElementById("modal-stock-name").textContent = s.companyName;
    document.getElementById("modal-stock-price").textContent = `$${formatMoney(s.currentPrice)}`;
    
    const changeSpan = document.getElementById("modal-stock-change");
    changeSpan.textContent = `${s.dayChangeAmount >= 0 ? '+' : ''}${s.dayChangeAmount.toFixed(2)} (${s.dayChangePercent >= 0 ? '+' : ''}${s.dayChangePercent.toFixed(2)}%)`;
    if (s.dayChangePercent >= 0) {
        changeSpan.className = "positive text-green";
    } else {
        changeSpan.className = "negative text-red";
    }
    
    // Stats grid
    document.getElementById("mstat-open").textContent = `$${formatMoney(s.openPrice)}`;
    document.getElementById("mstat-close").textContent = `$${formatMoney(s.previousClose)}`;
    document.getElementById("mstat-low").textContent = `$${formatMoney(s.dayLow)}`;
    document.getElementById("mstat-high").textContent = `$${formatMoney(s.dayHigh)}`;
    document.getElementById("mstat-ylow").textContent = `$${formatMoney(s.yearLow)}`;
    document.getElementById("mstat-yhigh").textContent = `$${formatMoney(s.yearHigh)}`;
    document.getElementById("mstat-vol").textContent = formatVolume(s.volume);
    document.getElementById("mstat-cap").textContent = formatMarketCap(s.marketCap);
    document.getElementById("mstat-pe").textContent = s.peRatio.toFixed(1);
    document.getElementById("mstat-div").textContent = `${s.dividendYield.toFixed(2)}%`;
    
    // Watched visual toggle
    const wlBtn = document.getElementById("btn-modal-watchlist");
    const isWatched = state.watchlist.includes(s.symbol);
    if (isWatched) {
        wlBtn.className = "btn btn-block btn-outline btn-watchlist-toggle added";
        wlBtn.innerHTML = `<i class="bx bxs-star text-gold"></i> Remove from Watchlist`;
    } else {
        wlBtn.className = "btn btn-block btn-outline btn-watchlist-toggle";
        wlBtn.innerHTML = `<i class="bx bx-star"></i> Add to Watchlist`;
    }
    
    // User portfolio position stats
    if (state.portfolioData) {
        document.getElementById("trade-user-capital").textContent = `Cash Available: $${formatMoney(state.portfolioData.cashBalance)}`;
        const holding = state.portfolioData.holdings.find(h => h.symbol === s.symbol);
        document.getElementById("trade-user-shares").textContent = `Shares Owned: ${holding ? holding.quantity : 0}`;
    }
}

// Switch between BUY and SELL modes in modal
function switchTradeMode(mode) {
    state.tradeMode = mode;
    document.querySelectorAll(".trade-tab").forEach(t => t.classList.remove("active"));
    
    if (mode === "BUY") {
        document.querySelector(".trade-panel-tabs button:first-child").classList.add("active");
        document.getElementById("btn-execute-trade").className = "btn btn-primary btn-block";
        document.getElementById("btn-execute-trade").textContent = "Confirm Purchase";
    } else {
        document.querySelector(".trade-panel-tabs button:last-child").classList.add("active");
        document.getElementById("btn-execute-trade").className = "btn btn-secondary btn-block";
        document.getElementById("btn-execute-trade").textContent = "Confirm Liquidation";
    }
    calculateTradeTotal();
}

// Real-time cost calculations
function calculateTradeTotal() {
    const qty = parseInt(document.getElementById("trade-quantity").value) || 0;
    const price = state.selectedStock ? state.selectedStock.currentPrice : 0;
    
    const cost = qty * price;
    const commission = qty > 0 ? 1.00 : 0.00; // Flat $1.00 mock brokerage
    const total = cost + (state.tradeMode === "BUY" ? commission : -commission);
    
    document.getElementById("trade-est-cost").textContent = `$${formatMoney(cost)}`;
    document.getElementById("trade-est-commission").textContent = `$${formatMoney(commission)}`;
    document.getElementById("trade-total-est").textContent = `$${formatMoney(Math.max(0, total))}`;
}

async function handleExecuteTrade(e) {
    e.preventDefault();
    const qty = parseInt(document.getElementById("trade-quantity").value) || 0;
    if (qty <= 0) {
        showToast("Please enter a valid quantity of shares.", "error");
        return;
    }
    
    const symbol = state.selectedStock.symbol;
    const type = state.tradeMode;
    
    try {
        const res = await fetch(`${API_BASE}/api/trade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol, type, qty })
        });
        const data = await res.json();
        
        if (data.success) {
            showToast(data.message, "success");
            fetchPortfolioData();
            setTimeout(closeStockModal, 300);
        } else {
            showToast(data.message, "error");
        }
    } catch (err) {
        console.error("Execute trade error", err);
    }
}

function toggleWatchlistModal() {
    if (state.selectedStock) {
        toggleWatchlistAPI(state.selectedStock.symbol, null);
    }
}

// Render historical Chart.js tick chart
function renderStockTrendChart(stock) {
    const canvas = document.getElementById("stockTrendChart");
    
    // Extract history labels and data points
    const history = stock.history || [];
    const labels = history.map(h => h.time);
    const dataVals = history.map(h => h.price);
    
    if (stockChart) {
        stockChart.destroy();
    }
    
    const borderGradient = canvas.getContext("2d").createLinearGradient(0, 0, 0, 250);
    borderGradient.addColorStop(0, stock.dayChangePercent >= 0 ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)");
    borderGradient.addColorStop(1, "rgba(30, 41, 59, 0)");

    stockChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Share Price ($)",
                data: dataVals,
                borderColor: stock.dayChangePercent >= 0 ? "hsl(150, 80%, 45%)" : "hsl(345, 80%, 55%)",
                backgroundColor: borderGradient,
                fill: true,
                borderWidth: 2,
                tension: 0.25,
                pointRadius: history.length > 20 ? 0 : 2,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: "rgba(255,255,255,0.03)" },
                    ticks: {
                        color: "rgba(255,255,255,0.4)",
                        font: { family: "Outfit", size: 10 },
                        maxTicksLimit: 6
                    }
                },
                y: {
                    grid: { color: "rgba(255,255,255,0.03)" },
                    ticks: {
                        color: "rgba(255,255,255,0.4)",
                        font: { family: "Outfit", size: 10 }
                    }
                }
            }
        }
    });
}

// ==========================================================================
//  AUTH ACTIONS
// ==========================================================================
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.success) {
            showToast(data.message, "success");
            state.isAuthenticated = true;
            state.user = data.user;
            setupAppSession();
        } else {
            showToast(data.message, "error");
        }
    } catch (err) {
        showToast("Incorrect username or security password.", "error");
        console.error("Login err", err);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById("reg-username").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const deposit = parseFloat(document.getElementById("reg-deposit").value) || 0;
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password, deposit })
        });
        const data = await res.json();
        
        if (data.success) {
            showToast(data.message, "success");
            state.isAuthenticated = true;
            state.user = data.user;
            setupAppSession();
        } else {
            showToast(data.message, "error");
        }
    } catch (err) {
        showToast("Unable to process account registration details.", "error");
        console.error("Register err", err);
    }
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, { method: "POST" });
        showToast("Session disconnected. Goodbye!", "info");
        state.user = null;
        showAuthScreen();
    } catch (err) {
        console.error("Logout error", err);
    }
}

// ==========================================================================
//  TOAST TOASTER MECHANICS
// ==========================================================================
function showToast(message, type = "info") {
    const box = document.getElementById("toast-container");
    const id = Date.now();
    
    const icons = {
        success: "bx-check-circle",
        error: "bx-error-circle",
        info: "bx-info-circle"
    };
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.id = `toast-${id}`;
    toast.innerHTML = `
        <i class="bx ${icons[type] || 'bx-bell'} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${type.toUpperCase()}</div>
            <div class="toast-msg">${message}</div>
        </div>
    `;
    box.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.classList.add("removing");
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ==========================================================================
//  HELPERS & UTILITY FUNCTIONS
// ==========================================================================
function formatMoney(num) {
    if (num === null || isNaN(num)) return "0.00";
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(vol) {
    if (vol >= 1000000) return (vol / 1000000).toFixed(1) + "M";
    if (vol >= 1000) return (vol / 1000).toFixed(1) + "K";
    return vol.toString();
}

function formatMarketCap(cap) {
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
    return `$${formatMoney(cap)}`;
}
