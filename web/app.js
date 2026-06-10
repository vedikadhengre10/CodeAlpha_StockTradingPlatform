/* ==========================================================================
   APEX STOCK TRADING PLATFORM - CORE APPLICATION JS
   Single Page Application Architecture, Hybrid Server/Sandbox Client Mode
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
    marketSearchQuery: "",
    isOfflineSandbox: false, // Flag to run fully client-side if Java server is unreachable
    currency: "USD",
    marketSentiment: 0.0
};

const EXCHANGE_RATE = 83.0;

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
        
        state.isOfflineSandbox = false;
        if (data.authenticated) {
            state.isAuthenticated = true;
            state.user = data.user;
            setupAppSession();
        } else {
            showAuthScreen();
        }
    } catch (err) {
        console.warn("Backend server unreachable or HTTPS mixed content blocked. Entering Client-Side Sandbox Mode.", err);
        state.isOfflineSandbox = true;
        initializeSandboxMode();
    }
}

// Show login screen
function showAuthScreen() {
    state.isAuthenticated = false;
    document.getElementById("welcome-screen").classList.remove("hidden");
    document.getElementById("app-dashboard").classList.add("hidden");
    clearPolling();
}

// Setup user app dashboard session (Connected to Java Server)
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
//  SANDBOX / CLIENT-SIDE OFFLINE MODE ENGINE
// ==========================================================================
function initializeSandboxMode() {
    seedSandboxMarket();
    
    // Check if user session already exists in localStorage
    const sessionUser = localStorage.getItem("apex_sandbox_session");
    if (sessionUser) {
        state.isAuthenticated = true;
        state.user = JSON.parse(sessionUser);
        setupSandboxSession();
    } else {
        showAuthScreen();
    }
    
    showToast("Switched to Client-Side Offline Sandbox Mode", "info");
}

function setupSandboxSession() {
    document.getElementById("welcome-screen").classList.add("hidden");
    document.getElementById("app-dashboard").classList.remove("hidden");
    
    document.getElementById("username-display").textContent = state.user.username;
    document.getElementById("user-tier-display").textContent = `${state.user.tier} Tier`;
    
    // Populate sectors list
    state.sectors.clear();
    state.stocks.forEach(s => state.sectors.add(s.sector));
    
    state.watchlist = state.user.watchlist || [];
    
    fetchMarketData();
    fetchPortfolioData();
    
    // Start simulation polling
    startPolling();
    
    switchView("dashboard");
}

function saveSandboxUserState() {
    if (!state.user) return;
    const users = JSON.parse(localStorage.getItem("apex_sandbox_users") || "{}");
    users[state.user.username.toLowerCase()] = state.user;
    localStorage.setItem("apex_sandbox_users", JSON.stringify(users));
    localStorage.setItem("apex_sandbox_session", JSON.stringify(state.user));
}

function seedSandboxMarket() {
    state.stocks = [
        { symbol: "AAPL", companyName: "Apple Inc.", sector: "Technology", currentPrice: 185.50, previousClose: 184.20, dayChangeAmount: 1.30, dayChangePercent: 0.71, volume: 52000000, openPrice: 184.50, dayLow: 183.80, dayHigh: 186.10, yearLow: 165.00, yearHigh: 199.60, marketCap: 2890000000000, peRatio: 28.5, dividendYield: 0.54, status: "ACTIVE", history: [] },
        { symbol: "MSFT", companyName: "Microsoft Corporation", sector: "Technology", currentPrice: 420.30, previousClose: 418.50, dayChangeAmount: 1.80, dayChangePercent: 0.43, volume: 22000000, openPrice: 419.00, dayLow: 417.50, dayHigh: 422.00, yearLow: 315.00, yearHigh: 430.00, marketCap: 3120000000000, peRatio: 35.2, dividendYield: 0.72, status: "ACTIVE", history: [] },
        { symbol: "GOOGL", companyName: "Alphabet Inc.", sector: "Technology", currentPrice: 175.80, previousClose: 177.10, dayChangeAmount: -1.30, dayChangePercent: -0.73, volume: 28000000, openPrice: 176.50, dayLow: 174.20, dayHigh: 178.00, yearLow: 115.00, yearHigh: 180.00, marketCap: 2180000000000, peRatio: 25.1, dividendYield: 0.00, status: "ACTIVE", history: [] },
        { symbol: "META", companyName: "Meta Platforms Inc.", sector: "Technology", currentPrice: 520.00, previousClose: 512.40, dayChangeAmount: 7.60, dayChangePercent: 1.48, volume: 18000000, openPrice: 514.00, dayLow: 511.00, dayHigh: 523.00, yearLow: 220.00, yearHigh: 531.00, marketCap: 1320000000000, peRatio: 22.8, dividendYield: 0.44, status: "ACTIVE", history: [] },
        { symbol: "NVDA", companyName: "NVIDIA Corporation", sector: "Technology", currentPrice: 875.25, previousClose: 860.10, dayChangeAmount: 15.15, dayChangePercent: 1.76, volume: 42000000, openPrice: 862.00, dayLow: 855.00, dayHigh: 884.00, yearLow: 260.00, yearHigh: 974.00, marketCap: 2190000000000, peRatio: 65.3, dividendYield: 0.04, status: "ACTIVE", history: [] },
        { symbol: "AMZN", companyName: "Amazon.com Inc.", sector: "Technology", currentPrice: 210.40, previousClose: 212.30, dayChangeAmount: -1.90, dayChangePercent: -0.90, volume: 35000000, openPrice: 211.50, dayLow: 209.10, dayHigh: 213.00, yearLow: 102.00, yearHigh: 215.00, marketCap: 2180000000000, peRatio: 45.7, dividendYield: 0.00, status: "ACTIVE", history: [] },
        { symbol: "TSLA", companyName: "Tesla Inc.", sector: "Consumer", currentPrice: 245.60, previousClose: 249.20, dayChangeAmount: -3.60, dayChangePercent: -1.44, volume: 88000000, openPrice: 248.00, dayLow: 242.00, dayHigh: 251.00, yearLow: 138.00, yearHigh: 299.00, marketCap: 780000000000, peRatio: 55.3, dividendYield: 0.00, status: "ACTIVE", history: [] },
        { symbol: "WMT", companyName: "Walmart Inc.", sector: "Consumer", currentPrice: 68.40, previousClose: 68.10, dayChangeAmount: 0.30, dayChangePercent: 0.44, volume: 15000000, openPrice: 68.20, dayLow: 67.80, dayHigh: 68.90, yearLow: 48.00, yearHigh: 70.00, marketCap: 550000000000, peRatio: 27.8, dividendYield: 1.24, status: "ACTIVE", history: [] },
        { symbol: "KO", companyName: "Coca-Cola Company", sector: "Consumer", currentPrice: 62.15, previousClose: 62.20, dayChangeAmount: -0.05, dayChangePercent: -0.08, volume: 12000000, openPrice: 62.25, dayLow: 61.90, dayHigh: 62.40, yearLow: 51.50, yearHigh: 64.00, marketCap: 268000000000, peRatio: 23.5, dividendYield: 3.18, status: "ACTIVE", history: [] },
        { symbol: "JPM", companyName: "JPMorgan Chase & Co.", sector: "Finance", currentPrice: 205.60, previousClose: 204.10, dayChangeAmount: 1.50, dayChangePercent: 0.74, volume: 9000000, openPrice: 204.50, dayLow: 203.20, dayHigh: 206.50, yearLow: 123.00, yearHigh: 209.00, marketCap: 590000000000, peRatio: 12.3, dividendYield: 2.40, status: "ACTIVE", history: [] },
        { symbol: "BAC", companyName: "Bank of America Corp.", sector: "Finance", currentPrice: 38.90, previousClose: 39.20, dayChangeAmount: -0.30, dayChangePercent: -0.77, volume: 38000000, openPrice: 39.10, dayLow: 38.50, dayHigh: 39.40, yearLow: 25.00, yearHigh: 40.50, marketCap: 302000000000, peRatio: 11.5, dividendYield: 2.85, status: "ACTIVE", history: [] },
        { symbol: "GS", companyName: "Goldman Sachs Group", sector: "Finance", currentPrice: 495.20, previousClose: 492.10, dayChangeAmount: 3.10, dayChangePercent: 0.63, volume: 3000000, openPrice: 493.00, dayLow: 489.00, dayHigh: 498.00, yearLow: 290.00, yearHigh: 505.00, marketCap: 162000000000, peRatio: 14.8, dividendYield: 1.98, status: "ACTIVE", history: [] },
        { symbol: "JNJ", companyName: "Johnson & Johnson", sector: "Healthcare", currentPrice: 155.30, previousClose: 156.40, dayChangeAmount: -1.10, dayChangePercent: -0.70, volume: 8000000, openPrice: 156.00, dayLow: 154.50, dayHigh: 156.80, yearLow: 144.00, yearHigh: 175.00, marketCap: 374000000000, peRatio: 15.2, dividendYield: 3.25, status: "ACTIVE", history: [] },
        { symbol: "PFE", companyName: "Pfizer Inc.", sector: "Healthcare", currentPrice: 28.75, previousClose: 29.10, dayChangeAmount: -0.35, dayChangePercent: -1.20, volume: 24000000, openPrice: 29.00, dayLow: 28.50, dayHigh: 29.35, yearLow: 25.00, yearHigh: 42.00, marketCap: 162000000000, peRatio: 9.8, dividendYield: 6.15, status: "ACTIVE", history: [] },
        { symbol: "UNH", companyName: "UnitedHealth Group", sector: "Healthcare", currentPrice: 520.80, previousClose: 518.20, dayChangeAmount: 2.60, dayChangePercent: 0.50, volume: 4000000, openPrice: 519.00, dayLow: 515.00, dayHigh: 524.00, yearLow: 435.00, yearHigh: 558.00, marketCap: 482000000000, peRatio: 21.4, dividendYield: 1.55, status: "ACTIVE", history: [] },
        { symbol: "XOM", companyName: "ExxonMobil Corporation", sector: "Energy", currentPrice: 112.45, previousClose: 111.90, dayChangeAmount: 0.55, dayChangePercent: 0.49, volume: 16000000, openPrice: 112.10, dayLow: 111.20, dayHigh: 113.15, yearLow: 95.00, yearHigh: 124.00, marketCap: 450000000000, peRatio: 13.6, dividendYield: 3.45, status: "ACTIVE", history: [] },
        { symbol: "CVX", companyName: "Chevron Corporation", sector: "Energy", currentPrice: 156.20, previousClose: 156.90, dayChangeAmount: -0.70, dayChangePercent: -0.45, volume: 9000000, openPrice: 156.50, dayLow: 155.00, dayHigh: 157.80, yearLow: 135.00, yearHigh: 172.00, marketCap: 290000000000, peRatio: 14.2, dividendYield: 4.12, status: "ACTIVE", history: [] },
        { symbol: "T", companyName: "AT&T Inc.", sector: "Telecom", currentPrice: 17.85, previousClose: 17.75, dayChangeAmount: 0.10, dayChangePercent: 0.56, volume: 32000000, openPrice: 17.80, dayLow: 17.65, dayHigh: 17.95, yearLow: 13.40, yearHigh: 19.20, marketCap: 128000000000, peRatio: 7.2, dividendYield: 6.72, status: "ACTIVE", history: [] },
        { symbol: "VZ", companyName: "Verizon Communications", sector: "Telecom", currentPrice: 41.20, previousClose: 41.50, dayChangeAmount: -0.30, dayChangePercent: -0.72, volume: 18000000, openPrice: 41.40, dayLow: 40.80, dayHigh: 41.65, yearLow: 30.00, yearHigh: 43.50, marketCap: 173000000000, peRatio: 8.5, dividendYield: 6.55, status: "ACTIVE", history: [] },
        { symbol: "SPY", companyName: "SPDR S&P 500 ETF", sector: "ETF", currentPrice: 520.00, previousClose: 518.50, dayChangeAmount: 1.50, dayChangePercent: 0.29, volume: 75000000, openPrice: 519.00, dayLow: 517.50, dayHigh: 522.00, yearLow: 393.00, yearHigh: 525.00, marketCap: 500000000000, peRatio: 22.0, dividendYield: 1.35, status: "ACTIVE", history: [] }
    ];
    
    // Seed initial price histories
    state.stocks.forEach(s => {
        for (let i = 0; i < 20; i++) {
            s.history.push({
                price: Math.round(s.currentPrice * (1 + (Math.random() * 0.04 - 0.02)) * 100) / 100,
                time: new Date(Date.now() - (20 - i) * 10000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
        }
    });
}

function checkSandboxAlertsAndOrders() {
    if (!state.isAuthenticated || !state.user) return;
    
    let stateChanged = false;
    
    // Check price alerts
    if (state.user.alerts) {
        const remainingAlerts = [];
        state.user.alerts.forEach(a => {
            if (a.status !== "ACTIVE") {
                remainingAlerts.push(a);
                return;
            }
            const stock = state.stocks.find(s => s.symbol === a.symbol);
            if (stock) {
                const hit = a.alertType === "ABOVE" ? stock.currentPrice >= a.targetPrice : stock.currentPrice <= a.targetPrice;
                if (hit) {
                    a.status = "TRIGGERED";
                    a.message = `ALERT: ${a.symbol} hit ${formatCurrency(stock.currentPrice)} (target: ${formatCurrency(a.targetPrice)} ${a.alertType === "ABOVE" ? "▲" : "▼"})`;
                    showToast("🔔 " + a.message, "info");
                    stateChanged = true;
                } else {
                    remainingAlerts.push(a);
                }
            } else {
                remainingAlerts.push(a);
            }
        });
        state.user.alerts = remainingAlerts;
    }
    
    // Check limit orders
    if (state.user.orders) {
        const remainingOrders = [];
        state.user.orders.forEach(o => {
            const stock = state.stocks.find(s => s.symbol === o.symbol);
            if (stock) {
                const fill = o.type === "BUY" ? stock.currentPrice <= o.limitPrice : stock.currentPrice >= o.limitPrice;
                if (fill) {
                    const total = o.quantity * stock.currentPrice;
                    const commission = 1.00;
                    
                    if (o.type === "BUY") {
                        const finalCost = total + commission;
                        if (state.user.cashBalance >= finalCost) {
                            state.user.cashBalance -= finalCost;
                            
                            if (!state.user.holdings) state.user.holdings = [];
                            const holding = state.user.holdings.find(h => h.symbol === o.symbol);
                            if (holding) {
                                holding.avgCost = ((holding.avgCost * holding.quantity) + total) / (holding.quantity + o.quantity);
                                holding.quantity += o.quantity;
                            } else {
                                state.user.holdings.push({ symbol: o.symbol, quantity: o.quantity, avgCost: stock.currentPrice });
                            }
                            
                            if (!state.user.transactions) state.user.transactions = [];
                            state.user.transactions.push({
                                transactionId: "TX" + Math.floor(100000 + Math.random() * 900000),
                                timestamp: new Date().toLocaleString(),
                                symbol: o.symbol,
                                type: "BUY",
                                orderType: "LIMIT",
                                quantity: o.quantity,
                                pricePerShare: stock.currentPrice,
                                commission: commission,
                                totalAmount: finalCost,
                                profitLoss: 0
                            });
                            showToast(`📈 Filled LIMIT BUY: ${o.quantity} ${o.symbol} @ ${formatCurrency(stock.currentPrice)}`, "success");
                            stateChanged = true;
                        } else {
                            showToast(`Failed limit order: Insufficient cash for ${o.symbol}.`, "error");
                        }
                    } else {
                        // SELL LIMIT
                        if (!state.user.holdings) state.user.holdings = [];
                        const holding = state.user.holdings.find(h => h.symbol === o.symbol);
                        if (holding && holding.quantity >= o.quantity) {
                            const finalGain = total - commission;
                            state.user.cashBalance += finalGain;
                            
                            const costBasis = o.quantity * holding.avgCost;
                            const pnl = total - costBasis;
                            
                            holding.quantity -= o.quantity;
                            if (holding.quantity === 0) {
                                state.user.holdings = state.user.holdings.filter(h => h.symbol !== o.symbol);
                            }
                            
                            if (!state.user.transactions) state.user.transactions = [];
                            state.user.transactions.push({
                                transactionId: "TX" + Math.floor(100000 + Math.random() * 900000),
                                timestamp: new Date().toLocaleString(),
                                symbol: o.symbol,
                                type: "SELL",
                                orderType: "LIMIT",
                                quantity: o.quantity,
                                pricePerShare: stock.currentPrice,
                                commission: commission,
                                totalAmount: finalGain,
                                profitLoss: pnl
                            });
                            showToast(`📈 Filled LIMIT SELL: ${o.quantity} ${o.symbol} @ ${formatCurrency(stock.currentPrice)}`, "success");
                            stateChanged = true;
                        }
                    }
                } else {
                    remainingOrders.push(o);
                }
            } else {
                remainingOrders.push(o);
            }
        });
        state.user.orders = remainingOrders;
    }
    
    if (stateChanged) {
        saveSandboxUserState();
        fetchPortfolioData();
    }
}

// ==========================================================================
//  DATA FETCHING / API WRAPPERS
// ==========================================================================

// Fetch all stocks
async function fetchMarketData() {
    if (state.isOfflineSandbox) {
        // Update global market sentiment
        state.marketSentiment += (Math.random() * 0.04 - 0.02);
        state.marketSentiment = Math.max(-0.5, Math.min(0.5, state.marketSentiment));

        state.stocks.forEach(s => {
            if (s.status === "ACTIVE") {
                // Base volatility based on sector/symbol
                let baseVolatility = 0.01; // 1% default
                if (s.sector.toLowerCase() === "technology" || s.symbol === "TSLA") {
                    baseVolatility = 0.025; // 2.5% tech/TSLA volatility
                } else if (s.sector.toLowerCase() === "consumer" || s.sector.toLowerCase() === "healthcare") {
                    baseVolatility = 0.008; // 0.8% defensive volatility
                } else if (s.symbol === "SPY") {
                    baseVolatility = 0.004; // 0.4% ETF index volatility
                }

                // Stock specific drift (random walk with momentum)
                const stockDrift = (Math.random() * 2 - 1) * baseVolatility;

                // Market sentiment effect (biases drift direction)
                const sentimentEffect = state.marketSentiment * baseVolatility * 0.5;

                let changePercent = stockDrift + sentimentEffect;

                // Cap single tick change to +/- 5%
                changePercent = Math.max(-0.05, Math.min(0.05, changePercent));

                const change = changePercent * s.currentPrice;
                s.currentPrice = Math.max(0.01, Math.round((s.currentPrice + change) * 100) / 100);
                s.dayChangeAmount = Math.round((s.currentPrice - s.previousClose) * 100) / 100;
                s.dayChangePercent = (s.dayChangeAmount / s.previousClose) * 100;
                s.dayHigh = Math.max(s.dayHigh, s.currentPrice);
                s.dayLow = Math.min(s.dayLow, s.currentPrice);
                s.volume += Math.floor(Math.random() * 4000);
                
                s.history.push({
                    price: s.currentPrice,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                });
                if (s.history.length > 30) s.history.shift();
            }
        });
        
        checkSandboxAlertsAndOrders();
        
        // Update live index headers
        const indexVal = state.stocks.reduce((sum, s) => sum + (s.currentPrice * (s.marketCap / 1e12)), 0);
        const avgSentiment = state.stocks.reduce((sum, s) => sum + s.dayChangePercent, 0) / state.stocks.length / 100;
        updateIndexHeader(indexVal, avgSentiment);
        
        // Dynamically refresh active list rendering
        if (state.currentView === "dashboard") {
            renderDashboardGainersLosers();
        } else if (state.currentView === "market") {
            renderMarketStocks();
        }
        
        // Modal refresh
        if (state.selectedStock) {
            const freshStock = state.stocks.find(s => s.symbol === state.selectedStock.symbol);
            if (freshStock) {
                state.selectedStock = freshStock;
                updateStockModalUI();
            }
        }
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/market/stocks`);
        const data = await res.json();
        state.stocks = data.stocks;
        
        state.sectors.clear();
        state.stocks.forEach(s => state.sectors.add(s.sector));
        
        updateIndexHeader(data.marketIndex, data.sentiment);
        
        if (state.currentView === "dashboard") {
            renderDashboardGainersLosers();
        } else if (state.currentView === "market") {
            renderMarketStocks();
        }
        
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
    if (state.isOfflineSandbox) {
        if (!state.isAuthenticated || !state.user) return;
        
        let stockValue = 0;
        if (!state.user.holdings) state.user.holdings = [];
        
        const holdingsSnapshots = state.user.holdings.map(h => {
            const stock = state.stocks.find(s => s.symbol === h.symbol);
            const curPrice = stock ? stock.currentPrice : h.avgCost;
            const curValue = h.quantity * curPrice;
            stockValue += curValue;
            const unrealizedPnL = curValue - (h.quantity * h.avgCost);
            const unrealizedPnLPct = ((curPrice - h.avgCost) / h.avgCost) * 100;
            
            return {
                symbol: h.symbol,
                companyName: stock ? stock.companyName : h.symbol,
                quantity: h.quantity,
                avgCost: h.avgCost,
                currentPrice: curPrice,
                currentValue: curValue,
                unrealizedPnL: unrealizedPnL,
                unrealizedPnLPct: unrealizedPnLPct
            };
        });
        
        let totalCost = state.user.holdings.reduce((sum, h) => sum + (h.quantity * h.avgCost), 0);
        let unrealizedPnL = stockValue - totalCost;
        let unrealizedPnLPct = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0;
        
        let totalValue = state.user.cashBalance + stockValue;
        let initialDeposit = 100000.0;
        let totalReturnPct = ((totalValue - initialDeposit) / initialDeposit) * 100;
        
        if (!state.user.transactions) state.user.transactions = [];
        let realizedPnL = state.user.transactions
            .filter(t => t.type === "SELL")
            .reduce((sum, t) => sum + (t.profitLoss || 0), 0);
            
        // Calculate sector allocation
        const allocation = {};
        state.user.holdings.forEach(h => {
            const stock = state.stocks.find(s => s.symbol === h.symbol);
            if (stock) {
                const val = h.quantity * stock.currentPrice;
                allocation[stock.sector] = (allocation[stock.sector] || 0) + val;
            }
        });
        
        const totalAllocationVal = Object.values(allocation).reduce((a, b) => a + b, 0);
        if (totalAllocationVal > 0) {
            for (let sec in allocation) {
                allocation[sec] = (allocation[sec] / totalAllocationVal) * 100;
            }
        }
        
        state.portfolioData = {
            cashBalance: state.user.cashBalance,
            stockValue: stockValue,
            totalValue: totalValue,
            unrealizedPnL: unrealizedPnL,
            unrealizedPnLPct: unrealizedPnLPct,
            totalReturnPct: totalReturnPct,
            realizedPnL: realizedPnL,
            rating: totalReturnPct >= 10 ? "Dynamic Alpha" : (totalReturnPct >= 0 ? "Standard Growth" : "Capital Halted"),
            holdings: holdingsSnapshots,
            allocation: allocation
        };
        
        updatePortfolioBalances();
        
        if (state.currentView === "portfolio") {
            renderPortfolioView();
        }
        
        if (state.selectedStock) {
            document.getElementById("trade-user-capital").textContent = `Cash Available: $${formatMoney(state.user.cashBalance)}`;
            const holding = state.user.holdings.find(h => h.symbol === state.selectedStock.symbol);
            document.getElementById("trade-user-shares").textContent = `Shares Owned: ${holding ? holding.quantity : 0}`;
        }
        return;
    }

    if (!state.isAuthenticated) return;
    try {
        const res = await fetch(`${API_BASE}/api/portfolio`);
        const data = await res.json();
        state.portfolioData = data;
        
        updatePortfolioBalances();
        
        if (state.currentView === "portfolio") {
            renderPortfolioView();
        }
        
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
    if (state.isOfflineSandbox) {
        state.watchlist = state.user ? (state.user.watchlist || []) : [];
        if (state.currentView === "dashboard") {
            renderWatchlist();
        }
        return;
    }

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
    if (state.isOfflineSandbox || !state.isAuthenticated) return;
    try {
        const res = await fetch(`${API_BASE}/api/notifications`);
        const data = await res.json();
        if (data.notifications && data.notifications.length > 0) {
            data.notifications.forEach(msg => {
                showToast(msg, "info");
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
    
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.remove("active");
    });
    
    const activeBtn = Array.from(document.querySelectorAll(".nav-item")).find(btn => 
        btn.getAttribute("onclick").includes(`'${viewName}'`)
    );
    if (activeBtn) activeBtn.classList.add("active");
    
    document.querySelectorAll(".content-view").forEach(view => {
        view.classList.add("hidden");
    });
    
    const viewSection = document.getElementById(`view-${viewName}`);
    if (viewSection) viewSection.classList.remove("hidden");
    
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

function updateIndexHeader(indexVal, sentiment) {
    document.getElementById("header-market-index").textContent = formatCurrency(indexVal);
    
    const changeBadge = document.getElementById("header-market-change");
    const sentimentPct = sentiment * 100;
    
    changeBadge.textContent = `${sentimentPct >= 0 ? "+" : ""}${sentimentPct.toFixed(2)}%`;
    if (sentimentPct >= 0) {
        changeBadge.className = "index-change positive";
    } else {
        changeBadge.className = "index-change negative";
    }
}

function updatePortfolioBalances() {
    if (!state.portfolioData) return;
    const data = state.portfolioData;
    
    document.getElementById("dash-total-value").textContent = formatCurrency(data.totalValue);
    document.getElementById("dash-cash-balance").textContent = formatCurrency(data.cashBalance);
    
    const dashPnL = document.getElementById("dash-unrealized-pnl");
    dashPnL.textContent = `${data.unrealizedPnL >= 0 ? "+" : ""}${formatCurrency(data.unrealizedPnL)}`;
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
            <td><strong>${formatCurrency(s.currentPrice)}</strong></td>
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

function renderDashboardGainersLosers() {
    const gainersList = document.getElementById("dash-top-gainers");
    const losersList = document.getElementById("dash-top-losers");
    
    gainersList.innerHTML = "";
    losersList.innerHTML = "";
    
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
                <span class="mli-price">${formatCurrency(s.currentPrice)}</span>
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
                <span class="mli-price">${formatCurrency(s.currentPrice)}</span>
                <span class="mli-change text-red">▼ ${s.dayChangePercent.toFixed(2)}%</span>
            </div>
        `;
        losersList.appendChild(li);
    });
}

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

function renderMarketStocks() {
    const tbody = document.getElementById("market-stocks-body");
    tbody.innerHTML = "";
    
    let filtered = state.stocks;
    
    if (state.activeFilterSector !== "ALL") {
        filtered = filtered.filter(s => s.sector === state.activeFilterSector);
    }
    
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
            <td class="text-right"><strong>${formatCurrency(s.currentPrice)}</strong></td>
            <td class="text-right ${s.dayChangeAmount >= 0 ? 'text-green' : 'text-red'}">
                <strong>${s.dayChangeAmount >= 0 ? '+' : ''}${(s.dayChangeAmount * (state.currency === "INR" ? EXCHANGE_RATE : 1.0)).toFixed(2)}</strong>
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

async function toggleWatchlistAPI(symbol, element) {
    if (state.isOfflineSandbox) {
        const isWatched = state.watchlist.includes(symbol);
        if (isWatched) {
            state.user.watchlist = state.user.watchlist.filter(s => s !== symbol);
            showToast(`${symbol} removed from watchlist.`, "success");
        } else {
            if (!state.user.watchlist) state.user.watchlist = [];
            state.user.watchlist.push(symbol);
            showToast(`${symbol} added to watchlist.`, "success");
        }
        saveSandboxUserState();
        fetchWatchlist();
        return;
    }

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
    
    document.getElementById("port-total-value").textContent = formatCurrency(data.totalValue);
    document.getElementById("port-stock-value").textContent = formatCurrency(data.stockValue);
    document.getElementById("port-realized-pnl").textContent = formatCurrency(data.realizedPnL);
    
    const portPnL = document.getElementById("port-unrealized-pnl");
    portPnL.textContent = `${data.unrealizedPnL >= 0 ? "+" : ""}${formatCurrency(data.unrealizedPnL)} (${data.unrealizedPnLPct.toFixed(2)}%)`;
    const portCard = document.getElementById("port-pnl-card");
    if (data.unrealizedPnL >= 0) {
        portCard.className = "metric-card green-gradient";
        portPnL.className = "text-green";
    } else {
        portCard.className = "metric-card red-gradient";
        portPnL.className = "text-red";
    }
    
    document.getElementById("portfolio-rating").textContent = `Rating: ${data.rating}`;
    
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
            <td class="text-right">${formatCurrency(h.avgCost)}</td>
            <td class="text-right">${formatCurrency(h.currentPrice)}</td>
            <td class="text-right"><strong>${formatCurrency(h.currentValue)}</strong></td>
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
    if (state.isOfflineSandbox) {
        document.getElementById("tx-commission-total").textContent = `Commission Paid: ${formatCurrency(state.user.transactions.filter(t => t.commission).reduce((sum, t) => sum + t.commission, 0))}`;
        
        const tbody = document.getElementById("transactions-log-body");
        tbody.innerHTML = "";
        
        if (!state.user.transactions || state.user.transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center">No trades logged yet.</td></tr>`;
            return;
        }
        
        // Render in reverse order (most recent first)
        [...state.user.transactions].reverse().forEach(t => {
            const isBuy = t.type === "BUY";
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><small>${t.transactionId}</small></td>
                <td><small>${t.timestamp}</small></td>
                <td><span class="stock-symbol-badge">${t.symbol}</span></td>
                <td class="${isBuy ? 'text-green' : 'text-red'}"><strong>${t.type} (${t.orderType})</strong></td>
                <td class="text-right">${t.quantity}</td>
                <td class="text-right">${formatCurrency(t.pricePerShare)}</td>
                <td class="text-right text-muted">${formatCurrency(t.commission)}</td>
                <td class="text-right"><strong>${formatCurrency(t.totalAmount)}</strong></td>
                <td class="text-right ${t.profitLoss >= 0 ? 'text-green' : 'text-red'}">
                    <strong>${!isBuy ? (t.profitLoss >= 0 ? '+' : '') + formatCurrency(t.profitLoss) : '—'}</strong>
                </td>
            `;
            tbody.appendChild(row);
        });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/transactions`);
        const data = await res.json();
        
        document.getElementById("tx-commission-total").textContent = `Commission Paid: ${formatCurrency(data.totalCommission)}`;
        
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
                <td class="text-right">${formatCurrency(t.pricePerShare)}</td>
                <td class="text-right text-muted">${formatCurrency(t.commission)}</td>
                <td class="text-right"><strong>${formatCurrency(t.totalAmount)}</strong></td>
                <td class="text-right ${t.profitLoss >= 0 ? 'text-green' : 'text-red'}">
                    <strong>${!isBuy ? (t.profitLoss >= 0 ? '+' : '') + formatCurrency(t.profitLoss) : '—'}</strong>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Error fetching transactions", err);
    }
}

async function triggerAccountAction(actionType) {
    if (state.isOfflineSandbox) {
        if (!state.user) return;
        
        if (actionType === "save") {
            let content = `=== APEX TRADING — PORTFOLIO SNAPSHOT ===\n`;
            content += `User: ${state.user.username} (${state.user.userId})\n`;
            content += `Tier: ${state.user.tier}\n`;
            content += `Timestamp: ${new Date().toLocaleString()}\n\n`;
            content += `Available Cash: ${formatCurrency(state.portfolioData.cashBalance)}\n`;
            content += `Portfolio Value: ${formatCurrency(state.portfolioData.totalValue)}\n\n`;
            content += `=== ACTIVE HOLDINGS ===\n`;
            state.portfolioData.holdings.forEach(h => {
                content += `${h.symbol} (${h.companyName}): ${h.quantity} shares @ avg ${formatCurrency(h.avgCost)} (Current: ${formatCurrency(h.currentPrice)}) | Value: ${formatCurrency(h.currentValue)}\n`;
            });
            triggerDownload(`${state.user.username}_portfolio.txt`, content);
            showToast("Portfolio snapshot saved locally!", "success");
        } else if (actionType === "export") {
            let csv = "TxID,Timestamp,Type,OrderType,Symbol,Quantity,Price,Commission,Total,P&L\n";
            state.user.transactions.forEach(t => {
                csv += `${t.transactionId},${t.timestamp},${t.type},${t.orderType},${t.symbol},${t.quantity},${t.pricePerShare},${t.commission},${t.totalAmount},${t.profitLoss}\n`;
            });
            triggerDownload(`${state.user.username}_transactions.csv`, csv);
            showToast("Transaction history exported to CSV!", "success");
        } else if (actionType === "report") {
            let content = `╔══════════════════════════════════════════════════╗\n`;
            content += `║       APEX TRADING — FULL PERFORMANCE REPORT      ║\n`;
            content += `╚══════════════════════════════════════════════════╝\n\n`;
            content += `Generated: ${new Date().toLocaleString()}\n`;
            content += `User: ${state.user.username} | Tier: ${state.user.tier}\n\n`;
            content += `=== METRICS SUMMARY ===\n`;
            content += `Cash Available:      ${formatCurrency(state.portfolioData.cashBalance)}\n`;
            content += `Stock Holdings:      ${formatCurrency(state.portfolioData.stockValue)}\n`;
            content += `Net Portfolio worth: ${formatCurrency(state.portfolioData.totalValue)}\n`;
            content += `Total Return Rate:   ${state.portfolioData.totalReturnPct.toFixed(2)}%\n`;
            content += `Portfolio Rating:    ${state.portfolioData.rating}\n`;
            content += `Total Trades Filled: ${state.user.transactions.length}\n`;
            content += `Commission Paid:     ${formatCurrency(state.user.transactions.reduce((sum, t) => sum + (t.commission || 0), 0))}\n`;
            
            triggerDownload(`${state.user.username}_performance_report.txt`, content);
            showToast("Performance report generated successfully!", "success");
        }
        return;
    }

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

function triggerDownload(filename, text) {
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// ==========================================================================
//  LEADERBOARD
// ==========================================================================
async function renderLeaderboard() {
    if (state.isOfflineSandbox) {
        const userTotalVal = state.portfolioData ? state.portfolioData.totalValue : state.user.cashBalance;
        const userInitial = state.user.initialDeposit !== undefined ? state.user.initialDeposit : 100000.0;
        const userNetPnL = userTotalVal - userInitial;

        const board = [
            { username: "WarrenBuffett", tier: "Platinum", totalValue: 9850000.00, netPnL: 9750000.00 },
            { username: "NancyPelosi", tier: "Platinum", totalValue: 2450000.00, netPnL: 2350000.00 },
            { username: "NancyPelosi_Husband", tier: "Gold", totalValue: 1250000.00, netPnL: 1150000.00 },
            { username: "MichaelBurry", tier: "Gold", totalValue: 850000.00, netPnL: 750000.00 },
            { username: state.user.username, tier: state.user.tier, totalValue: userTotalVal, netPnL: userNetPnL }
        ];
        
        board.sort((a, b) => b.totalValue - a.totalValue);
        
        const podiumData = board.slice(0, 3);
        if (podiumData[0]) {
            document.getElementById("podium-1-user").textContent = podiumData[0].username;
            document.getElementById("podium-1-val").textContent = formatCurrency(podiumData[0].totalValue);
        }
        if (podiumData[1]) {
            document.getElementById("podium-2-user").textContent = podiumData[1].username;
            document.getElementById("podium-2-val").textContent = formatCurrency(podiumData[1].totalValue);
        }
        if (podiumData[2]) {
            document.getElementById("podium-3-user").textContent = podiumData[2].username;
            document.getElementById("podium-3-val").textContent = formatCurrency(podiumData[2].totalValue);
        }
        
        const tbody = document.getElementById("leaderboard-body");
        tbody.innerHTML = "";
        
        board.forEach((u, i) => {
            const row = document.createElement("tr");
            const highlight = u.username === state.user.username ? 'style="background: rgba(234,179,8,0.06); border-left: 3px solid var(--gold)"' : '';
            row.innerHTML = `
                <td ${highlight}><strong>#${i + 1}</strong></td>
                <td ${highlight}><strong>${u.username}</strong></td>
                <td ${highlight} class="text-accent">${u.tier}</td>
                <td ${highlight} class="text-right"><strong>${formatCurrency(u.totalValue)}</strong></td>
                <td ${highlight} class="text-right ${u.netPnL >= 0 ? 'text-green' : 'text-red'}">
                    <strong>${u.netPnL >= 0 ? '+' : ''}${formatCurrency(u.netPnL)}</strong>
                </td>
            `;
            tbody.appendChild(row);
        });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        const data = await res.json();
        const board = data.leaderboard;
        
        const podiumData = [...board].slice(0, 3);
        if (podiumData[0]) {
            document.getElementById("podium-1-user").textContent = podiumData[0].username;
            document.getElementById("podium-1-val").textContent = formatCurrency(podiumData[0].totalValue);
        }
        if (podiumData[1]) {
            document.getElementById("podium-2-user").textContent = podiumData[1].username;
            document.getElementById("podium-2-val").textContent = formatCurrency(podiumData[1].totalValue);
        }
        if (podiumData[2]) {
            document.getElementById("podium-3-user").textContent = podiumData[2].username;
            document.getElementById("podium-3-val").textContent = formatCurrency(podiumData[2].totalValue);
        }
        
        const tbody = document.getElementById("leaderboard-body");
        tbody.innerHTML = "";
        
        board.forEach((u, i) => {
            const row = document.createElement("tr");
            const highlight = state.user && u.username === state.user.username ? 'style="background: rgba(234,179,8,0.06); border-left: 3px solid var(--gold)"' : '';
            row.innerHTML = `
                <td ${highlight}><strong>#${i + 1}</strong></td>
                <td ${highlight}><strong>${u.username}</strong></td>
                <td ${highlight} class="text-accent">${u.tier}</td>
                <td ${highlight} class="text-right"><strong>${formatCurrency(u.totalValue)}</strong></td>
                <td ${highlight} class="text-right ${u.netPnL >= 0 ? 'text-green' : 'text-red'}">
                    <strong>${u.netPnL >= 0 ? '+' : ''}${formatCurrency(u.netPnL)}</strong>
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
    const alertSel = document.getElementById("alert-symbol");
    const orderSel = document.getElementById("order-symbol");
    
    alertSel.innerHTML = '<option value="" disabled selected>Symbol</option>';
    orderSel.innerHTML = '<option value="" disabled selected>Symbol</option>';
    
    state.stocks.forEach(s => {
        const opt1 = `<option value="${s.symbol}">${s.symbol} (${formatCurrency(s.currentPrice)})</option>`;
        const opt2 = `<option value="${s.symbol}">${s.symbol} (${formatCurrency(s.currentPrice)})</option>`;
        alertSel.insertAdjacentHTML("beforeend", opt1);
        orderSel.insertAdjacentHTML("beforeend", opt2);
    });
    
    fetchActiveAlerts();
    fetchPendingOrders();
}

async function fetchActiveAlerts() {
    if (state.isOfflineSandbox) {
        const tbody = document.getElementById("alerts-list-body");
        tbody.innerHTML = "";
        
        if (!state.user.alerts) state.user.alerts = [];
        const activeAlerts = state.user.alerts.filter(a => a.status === "ACTIVE");
        if (activeAlerts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center">No active price alerts set.</td></tr>`;
            return;
        }
        
        activeAlerts.forEach(a => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><span class="stock-symbol-badge">${a.symbol}</span></td>
                <td><strong>${a.alertType === "ABOVE" ? 'Above (▲)' : 'Below (▼)'}</strong></td>
                <td class="text-right"><strong>${formatCurrency(a.targetPrice)}</strong></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-logout" onclick="handleCancelAlert('${a.alertId}')">Cancel</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        return;
    }

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
                <td class="text-right"><strong>${formatCurrency(a.targetPrice)}</strong></td>
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
    const targetPriceVal = parseFloat(document.getElementById("alert-price").value);
    
    const rate = state.currency === "INR" ? EXCHANGE_RATE : 1.0;
    const targetPrice = targetPriceVal / rate;
    
    if (state.isOfflineSandbox) {
        if (!state.user.alerts) state.user.alerts = [];
        const newAlert = {
            alertId: "AL" + Math.floor(1000 + Math.random() * 9000),
            symbol: symbol,
            alertType: type,
            targetPrice: targetPrice,
            status: "ACTIVE",
            message: ""
        };
        state.user.alerts.push(newAlert);
        saveSandboxUserState();
        showToast("Price alert set successfully!", "success");
        fetchActiveAlerts();
        document.getElementById("create-alert-form").reset();
        return;
    }

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
    if (state.isOfflineSandbox) {
        state.user.alerts = state.user.alerts.filter(a => a.alertId !== alertId);
        saveSandboxUserState();
        showToast("Price alert cancelled.", "success");
        fetchActiveAlerts();
        return;
    }

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
    if (state.isOfflineSandbox) {
        const tbody = document.getElementById("orders-list-body");
        tbody.innerHTML = "";
        
        if (!state.user.orders) state.user.orders = [];
        if (state.user.orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center">No pending limit orders.</td></tr>`;
            return;
        }
        
        state.user.orders.forEach(o => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><span class="stock-symbol-badge">${o.symbol}</span></td>
                <td class="${o.type === 'BUY' ? 'text-green' : 'text-red'}"><strong>LIMIT ${o.type}</strong></td>
                <td class="text-right">${o.quantity}</td>
                <td class="text-right"><strong>${formatCurrency(o.limitPrice)}</strong></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-logout" onclick="handleCancelOrder('${o.orderId}')">Cancel</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        return;
    }

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
                <td class="text-right"><strong>${formatCurrency(o.limitPrice)}</strong></td>
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
    const limitPriceVal = parseFloat(document.getElementById("order-price").value);
    
    const rate = state.currency === "INR" ? EXCHANGE_RATE : 1.0;
    const limitPrice = limitPriceVal / rate;
    
    if (state.isOfflineSandbox) {
        if (!state.user.orders) state.user.orders = [];
        const newOrder = {
            orderId: "OR" + Math.floor(1000 + Math.random() * 9000),
            symbol: symbol,
            type: type,
            quantity: qty,
            limitPrice: limitPrice,
            orderType: "LIMIT"
        };
        state.user.orders.push(newOrder);
        saveSandboxUserState();
        showToast("Limit order placed successfully!", "success");
        fetchPendingOrders();
        document.getElementById("place-order-form").reset();
        return;
    }

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
    if (state.isOfflineSandbox) {
        state.user.orders = state.user.orders.filter(o => o.orderId !== orderId);
        saveSandboxUserState();
        showToast("Limit order cancelled.", "success");
        fetchPendingOrders();
        return;
    }

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
    document.getElementById("settings-cash-balance").textContent = formatCurrency(state.portfolioData.cashBalance);
    
    // Dynamically update limits texts
    document.getElementById("deposit-limits-text").textContent = `Min: ${formatCurrency(10)}, Max: ${formatCurrency(10000000)}`;
    document.getElementById("withdraw-limits-text").textContent = `Min: ${formatCurrency(10)}, Max: ${formatCurrency(5000000)}`;
    
    // Dynamically toggle input currency icons
    const depIcon = document.getElementById("deposit-currency-icon");
    const withIcon = document.getElementById("withdraw-currency-icon");
    if (depIcon && withIcon) {
        if (state.currency === "INR") {
            depIcon.className = "bx bx-rupee";
            withIcon.className = "bx bx-rupee";
        } else {
            depIcon.className = "bx bx-dollar";
            withIcon.className = "bx bx-dollar";
        }
    }
}

async function handleDeposit(e) {
    e.preventDefault();
    const amountVal = parseFloat(document.getElementById("deposit-amount").value);
    if (isNaN(amountVal) || amountVal <= 0) {
        showToast("Invalid deposit amount.", "error");
        return;
    }
    
    const rate = state.currency === "INR" ? EXCHANGE_RATE : 1.0;
    const amount = amountVal / rate; // Store and transmit USD
    
    // Validate deposit limits
    if (amount < 10.0 || amount > 10000000.0) {
        showToast(`Deposit must be between ${formatCurrency(10)} and ${formatCurrency(10000000)}.`, "error");
        return;
    }
    
    if (state.isOfflineSandbox) {
        state.user.cashBalance += amount;
        state.user.initialDeposit = (state.user.initialDeposit || 100000.0) + amount;
        saveSandboxUserState();
        showToast(`Deposited ${formatCurrency(amount)} successfully!`, "success");
        document.getElementById("deposit-amount").value = "";
        fetchPortfolioData();
        setTimeout(updateSettingsViewUI, 200);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/account/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Deposited ${formatCurrency(amount)} successfully!`, "success");
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
    const amountVal = parseFloat(document.getElementById("withdraw-amount").value);
    if (isNaN(amountVal) || amountVal <= 0) {
        showToast("Invalid withdrawal amount.", "error");
        return;
    }
    
    const rate = state.currency === "INR" ? EXCHANGE_RATE : 1.0;
    const amount = amountVal / rate; // Store and transmit USD
    
    // Validate withdrawal limits
    if (amount < 10.0 || amount > 5000000.0) {
        showToast(`Withdrawal must be between ${formatCurrency(10)} and ${formatCurrency(5000000)}.`, "error");
        return;
    }
    
    const cash = state.isOfflineSandbox ? state.user.cashBalance : (state.portfolioData ? state.portfolioData.cashBalance : 0);
    if (amount > cash) {
        showToast("Insufficient funds available for withdrawal.", "error");
        return;
    }
    
    if (state.isOfflineSandbox) {
        state.user.cashBalance -= amount;
        state.user.initialDeposit = (state.user.initialDeposit || 100000.0) - amount;
        saveSandboxUserState();
        showToast(`Withdrew ${formatCurrency(amount)} successfully!`, "success");
        document.getElementById("withdraw-amount").value = "";
        fetchPortfolioData();
        setTimeout(updateSettingsViewUI, 200);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/account/withdraw`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Withdrew ${formatCurrency(amount)} successfully!`, "success");
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
    
    if (state.isOfflineSandbox) {
        if (state.user.password === oldPassword && newPassword.length >= 4) {
            state.user.password = newPassword;
            saveSandboxUserState();
            showToast("Password changed successfully!", "success");
            document.getElementById("old-password").value = "";
            document.getElementById("new-password").value = "";
        } else {
            showToast("Invalid current password or new password too short.", "error");
        }
        return;
    }

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
    
    document.getElementById("trade-quantity").value = "";
    document.getElementById("trade-est-cost").textContent = "$0.00";
    document.getElementById("trade-total-est").textContent = "$0.00";
    
    document.querySelectorAll(".trade-tab").forEach(t => t.classList.remove("active"));
    document.querySelector(".trade-panel-tabs button:first-child").classList.add("active");
    
    document.getElementById("stock-modal").classList.remove("hidden");
    
    updateStockModalUI();
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
    document.getElementById("modal-stock-price").textContent = formatCurrency(s.currentPrice);
    
    const changeSpan = document.getElementById("modal-stock-change");
    changeSpan.textContent = `${s.dayChangeAmount >= 0 ? '+' : ''}${(s.dayChangeAmount * (state.currency === "INR" ? EXCHANGE_RATE : 1.0)).toFixed(2)} (${s.dayChangePercent >= 0 ? '+' : ''}${s.dayChangePercent.toFixed(2)}%)`;
    if (s.dayChangePercent >= 0) {
        changeSpan.className = "positive text-green";
    } else {
        changeSpan.className = "negative text-red";
    }
    
    document.getElementById("mstat-open").textContent = formatCurrency(s.openPrice);
    document.getElementById("mstat-close").textContent = formatCurrency(s.previousClose);
    document.getElementById("mstat-low").textContent = formatCurrency(s.dayLow);
    document.getElementById("mstat-high").textContent = formatCurrency(s.dayHigh);
    document.getElementById("mstat-ylow").textContent = formatCurrency(s.yearLow);
    document.getElementById("mstat-yhigh").textContent = formatCurrency(s.yearHigh);
    document.getElementById("mstat-vol").textContent = formatVolume(s.volume);
    document.getElementById("mstat-cap").textContent = formatMarketCap(s.marketCap);
    document.getElementById("mstat-pe").textContent = s.peRatio.toFixed(1);
    document.getElementById("mstat-div").textContent = `${s.dividendYield.toFixed(2)}%`;
    
    const wlBtn = document.getElementById("btn-modal-watchlist");
    const isWatched = state.watchlist.includes(s.symbol);
    if (isWatched) {
        wlBtn.className = "btn btn-block btn-outline btn-watchlist-toggle added";
        wlBtn.innerHTML = `<i class="bx bxs-star text-gold"></i> Remove from Watchlist`;
    } else {
        wlBtn.className = "btn btn-block btn-outline btn-watchlist-toggle";
        wlBtn.innerHTML = `<i class="bx bx-star"></i> Add to Watchlist`;
    }
    
    if (state.portfolioData) {
        document.getElementById("trade-user-capital").textContent = `Cash Available: ${formatCurrency(state.portfolioData.cashBalance)}`;
        const holdingsList = state.isOfflineSandbox ? state.user.holdings : state.portfolioData.holdings;
        const holding = holdingsList.find(h => h.symbol === s.symbol);
        document.getElementById("trade-user-shares").textContent = `Shares Owned: ${holding ? holding.quantity : 0}`;
    }
}

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

function calculateTradeTotal() {
    const qty = parseInt(document.getElementById("trade-quantity").value) || 0;
    const price = state.selectedStock ? state.selectedStock.currentPrice : 0;
    
    const cost = qty * price;
    const commission = qty > 0 ? 1.00 : 0.00;
    const total = cost + (state.tradeMode === "BUY" ? commission : -commission);
    
    document.getElementById("trade-est-cost").textContent = formatCurrency(cost);
    document.getElementById("trade-est-commission").textContent = formatCurrency(commission);
    document.getElementById("trade-total-est").textContent = formatCurrency(Math.max(0, total));
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
    
    if (state.isOfflineSandbox) {
        const s = state.selectedStock;
        const total = qty * s.currentPrice;
        const commission = 1.00;
        
        if (type === "BUY") {
            const finalCost = total + commission;
            if (state.user.cashBalance >= finalCost) {
                state.user.cashBalance -= finalCost;
                
                if (!state.user.holdings) state.user.holdings = [];
                const holding = state.user.holdings.find(h => h.symbol === s.symbol);
                if (holding) {
                    holding.avgCost = ((holding.avgCost * holding.quantity) + total) / (holding.quantity + qty);
                    holding.quantity += qty;
                } else {
                    state.user.holdings.push({ symbol: s.symbol, quantity: qty, avgCost: s.currentPrice });
                }
                
                if (!state.user.transactions) state.user.transactions = [];
                state.user.transactions.push({
                    transactionId: "TX" + Math.floor(100000 + Math.random() * 900000),
                    timestamp: new Date().toLocaleString(),
                    symbol: s.symbol,
                    type: "BUY",
                    orderType: "MARKET",
                    quantity: qty,
                    pricePerShare: s.currentPrice,
                    commission: commission,
                    totalAmount: finalCost,
                    profitLoss: 0
                });
                
                saveSandboxUserState();
                showToast(`Successfully purchased ${qty} shares of ${s.symbol}!`, "success");
                fetchPortfolioData();
                setTimeout(closeStockModal, 300);
            } else {
                showToast("Insufficient cash balance.", "error");
            }
        } else {
            // SELL
            if (!state.user.holdings) state.user.holdings = [];
            const holding = state.user.holdings.find(h => h.symbol === s.symbol);
            if (holding && holding.quantity >= qty) {
                const finalGain = total - commission;
                state.user.cashBalance += finalGain;
                
                const costBasis = qty * holding.avgCost;
                const pnl = total - costBasis;
                
                holding.quantity -= qty;
                if (holding.quantity === 0) {
                    state.user.holdings = state.user.holdings.filter(h => h.symbol !== s.symbol);
                }
                
                if (!state.user.transactions) state.user.transactions = [];
                state.user.transactions.push({
                    transactionId: "TX" + Math.floor(100000 + Math.random() * 900000),
                    timestamp: new Date().toLocaleString(),
                    symbol: s.symbol,
                    type: "SELL",
                    orderType: "MARKET",
                    quantity: qty,
                    pricePerShare: s.currentPrice,
                    commission: commission,
                    totalAmount: finalGain,
                    profitLoss: pnl
                });
                
                saveSandboxUserState();
                showToast(`Successfully sold ${qty} shares of ${s.symbol}!`, "success");
                fetchPortfolioData();
                setTimeout(closeStockModal, 300);
            } else {
                showToast("Insufficient shares owned.", "error");
            }
        }
        return;
    }
    
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

function renderStockTrendChart(stock) {
    const canvas = document.getElementById("stockTrendChart");
    
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
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    
    if (state.isOfflineSandbox) {
        const users = JSON.parse(localStorage.getItem("apex_sandbox_users") || "{}");
        const user = users[username.toLowerCase()];
        
        // Setup initial demo user if localstorage is empty and they type 'demo'
        if (username.toLowerCase() === "demo" && !user) {
            const demoUser = {
                userId: "USR1000",
                username: "demo",
                email: "demo@apex.com",
                password: "demo1234",
                cashBalance: 100000.00,
                tier: "Platinum",
                registeredAt: new Date().toISOString(),
                totalTrades: 0,
                totalProfit: 0,
                totalLoss: 0,
                netPnL: 0,
                winRate: 0,
                holdings: [],
                watchlist: [],
                transactions: [],
                alerts: [],
                orders: []
            };
            users["demo"] = demoUser;
            localStorage.setItem("apex_sandbox_users", JSON.stringify(users));
            
            state.isAuthenticated = true;
            state.user = demoUser;
            localStorage.setItem("apex_sandbox_session", JSON.stringify(demoUser));
            showToast("Welcome back (Demo Account)!", "success");
            setupSandboxSession();
            return;
        }

        if (user && user.password === password) {
            state.isAuthenticated = true;
            state.user = user;
            localStorage.setItem("apex_sandbox_session", JSON.stringify(user));
            showToast("Welcome back!", "success");
            setupSandboxSession();
        } else {
            showToast("Incorrect username or security password.", "error");
        }
        return;
    }

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
    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const deposit = parseFloat(document.getElementById("reg-deposit").value) || 0;
    
    if (state.isOfflineSandbox) {
        const users = JSON.parse(localStorage.getItem("apex_sandbox_users") || "{}");
        if (users[username.toLowerCase()]) {
            showToast("Username already taken.", "error");
            return;
        }
        if (password.length < 4) {
            showToast("Password must be at least 4 characters.", "error");
            return;
        }
        
        const newUser = {
            userId: "USR" + (1001 + Object.keys(users).length),
            username: username,
            email: email,
            password: password,
            cashBalance: deposit,
            tier: deposit >= 100000 ? "Platinum" : (deposit >= 50000 ? "Gold" : "Bronze"),
            registeredAt: new Date().toISOString(),
            totalTrades: 0,
            totalProfit: 0,
            totalLoss: 0,
            netPnL: 0,
            winRate: 0,
            holdings: [],
            watchlist: [],
            transactions: [],
            alerts: [],
            orders: []
        };
        
        users[username.toLowerCase()] = newUser;
        localStorage.setItem("apex_sandbox_users", JSON.stringify(users));
        
        state.isAuthenticated = true;
        state.user = newUser;
        localStorage.setItem("apex_sandbox_session", JSON.stringify(newUser));
        
        showToast("Account registered successfully!", "success");
        setupSandboxSession();
        return;
    }

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
    if (state.isOfflineSandbox) {
        localStorage.removeItem("apex_sandbox_session");
        showToast("Session disconnected. Goodbye!", "info");
        state.user = null;
        showAuthScreen();
        return;
    }

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
    
    setTimeout(() => {
        toast.classList.add("removing");
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ==========================================================================
//  HELPERS & UTILITY FUNCTIONS
// ==========================================================================
function formatCurrency(num) {
    if (num === null || isNaN(num)) {
        return state.currency === "INR" ? "₹0.00" : "$0.00";
    }
    const exchangeRate = state.currency === "INR" ? EXCHANGE_RATE : 1.0;
    const converted = num * exchangeRate;
    const symbol = state.currency === "INR" ? "₹" : "$";
    const locale = state.currency === "INR" ? "en-IN" : "en-US";
    return symbol + converted.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
    const symbol = state.currency === "INR" ? "₹" : "$";
    const exchangeRate = state.currency === "INR" ? EXCHANGE_RATE : 1.0;
    const converted = cap * exchangeRate;
    
    if (converted >= 1e12) return `${symbol}${(converted / 1e12).toFixed(2)}T`;
    if (converted >= 1e9) return `${symbol}${(converted / 1e9).toFixed(2)}B`;
    if (converted >= 1e6) return `${symbol}${(converted / 1e6).toFixed(2)}M`;
    return formatCurrency(cap);
}

function setCurrency(curr) {
    if (curr !== "USD" && curr !== "INR") return;
    state.currency = curr;
    
    // Toggle active class on buttons
    const btnUsd = document.getElementById("btn-currency-usd");
    const btnInr = document.getElementById("btn-currency-inr");
    if (btnUsd && btnInr) {
        if (curr === "USD") {
            btnUsd.classList.add("active");
            btnInr.classList.remove("active");
        } else {
            btnInr.classList.add("active");
            btnUsd.classList.remove("active");
        }
    }
    
    // Refresh all views
    updatePortfolioBalances();
    
    // Rerender active view
    switchView(state.currentView);
    showToast(`Switched currency to ${curr}`, "success");
}
