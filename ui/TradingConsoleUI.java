

package ui;

import model.*;
import service.*;

import java.util.*;

/**
 * Interactive console UI for the APEX Stock Trading Platform
 * Provides all menus, displays, and user interactions
 */
public class TradingConsoleUI {
    private final MarketService marketService;
    private final UserService userService;
    private final TransactionService transactionService;
    private final PortfolioService portfolioService;
    private final AlertService alertService;
    private final FileIOService fileIOService;
    private final Scanner scanner;

    private User currentUser;
    private boolean running;

    private static final String RESET = "\u001B[0m";
    private static final String GREEN = "\u001B[32m";
    private static final String RED = "\u001B[31m";
    private static final String YELLOW = "\u001B[33m";
    private static final String CYAN = "\u001B[36m";
    private static final String BOLD = "\u001B[1m";
    private static final String DIM = "\u001B[2m";

    public TradingConsoleUI(MarketService marketService, UserService userService,
                             TransactionService transactionService,
                             PortfolioService portfolioService,
                             AlertService alertService,
                             FileIOService fileIOService) {
        this.marketService = marketService;
        this.userService = userService;
        this.transactionService = transactionService;
        this.portfolioService = portfolioService;
        this.alertService = alertService;
        this.fileIOService = fileIOService;
        this.scanner = new Scanner(System.in);
        this.running = true;
    }

    public void start() {
        // Create a demo user for first-time experience
        try {
            userService.register("demo", "demo1234", "demo@apex.com", 100000.00);
            System.out.println(DIM + "Demo account created: username=demo, password=demo1234, balance=$100,000" + RESET);
        } catch (Exception ignored) {}

        while (running) {
            if (currentUser == null) {
                showAuthMenu();
            } else {
                showMainMenu();
            }
        }
        System.out.println("\n" + CYAN + "Thank you for trading with APEX. Goodbye!" + RESET);
    }

    // ════════════════════════════════════════════
    //  AUTH MENU
    // ════════════════════════════════════════════
    private void showAuthMenu() {
        printHeader("APEX STOCK TRADING PLATFORM");
        System.out.println("  [1] Login");
        System.out.println("  [2] Register New Account");
        System.out.println("  [0] Exit");
        System.out.print("\n  Choice: ");

        String choice = scanner.nextLine().trim();
        switch (choice) {
            case "1" -> handleLogin();
            case "2" -> handleRegister();
            case "0" -> { running = false; }
            default -> System.out.println(RED + "Invalid option." + RESET);
        }
    }

    private void handleLogin() {
        System.out.print("  Username: ");
        String username = scanner.nextLine().trim();
        System.out.print("  Password: ");
        String password = scanner.nextLine().trim();

        Optional<User> result = userService.authenticate(username, password);
        if (result.isPresent()) {
            currentUser = result.get();
            System.out.println(GREEN + "  ✓ Welcome back, " + currentUser.getUsername()
                + "! [" + currentUser.getTier().getLabel() + " Tier]" + RESET);
            pause(800);
        } else {
            System.out.println(RED + "  ✗ Invalid credentials. Please try again." + RESET);
        }
    }

    private void handleRegister() {
        System.out.println("\n  ── NEW ACCOUNT REGISTRATION ──");
        System.out.print("  Username: ");
        String username = scanner.nextLine().trim();
        System.out.print("  Password (min 4 chars): ");
        String password = scanner.nextLine().trim();
        System.out.print("  Email: ");
        String email = scanner.nextLine().trim();
        System.out.print("  Initial Deposit ($): ");
        double deposit = parseDouble(scanner.nextLine().trim(), 0);

        try {
            User newUser = userService.register(username, password, email, deposit);
            System.out.println(GREEN + "  ✓ Account created! User ID: " + newUser.getUserId() + RESET);
            currentUser = newUser;
            pause(800);
        } catch (IllegalArgumentException e) {
            System.out.println(RED + "  ✗ " + e.getMessage() + RESET);
        }
    }

    // ════════════════════════════════════════════
    //  MAIN MENU
    // ════════════════════════════════════════════
    private void showMainMenu() {
        // Auto-refresh prices & check alerts/orders
        marketService.refreshMarketPrices();
        checkAlertsAndOrders();

        clearScreen();
        printStatusBar();

        System.out.println();
        System.out.println(BOLD + "  MAIN MENU" + RESET);
        System.out.println("  ─────────────────────────────────────────");
        System.out.println("  [1] Market Overview           [6] Watchlist");
        System.out.println("  [2] Stock Quote & Chart       [7] Price Alerts");
        System.out.println("  [3] Buy / Sell Stocks         [8] Limit Orders");
        System.out.println("  [4] My Portfolio              [9] Leaderboard");
        System.out.println("  [5] Transaction History       [10] Account Settings");
        System.out.println("  [11] Save / Export Data       [0] Logout");
        System.out.println("  ─────────────────────────────────────────");
        System.out.print("  Choice: ");

        String choice = scanner.nextLine().trim();
        switch (choice) {
            case "1" -> showMarketOverview();
            case "2" -> showStockQuote();
            case "3" -> showTradingMenu();
            case "4" -> showPortfolio();
            case "5" -> showTransactionHistory();
            case "6" -> showWatchlist();
            case "7" -> showAlertMenu();
            case "8" -> showOrderMenu();
            case "9" -> showLeaderboard();
            case "10" -> showAccountSettings();
            case "11" -> showSaveMenu();
            case "0" -> {
                System.out.println("  Logging out...");
                currentUser = null;
            }
            default -> System.out.println(RED + "  Invalid option." + RESET);
        }
    }

    // ════════════════════════════════════════════
    //  STATUS BAR
    // ════════════════════════════════════════════
    private void printStatusBar() {
        double portfolioVal = portfolioService.getTotalPortfolioValue(currentUser);
        double returnPct = portfolioService.getTotalReturnPercent(currentUser);
        String returnColor = returnPct >= 0 ? GREEN : RED;
        String returnSign = returnPct >= 0 ? "+" : "";

        System.out.println("┌─────────────────────────────────────────────────────────────┐");
        System.out.printf("│ " + BOLD + "%-12s" + RESET + " │ Cash: " + CYAN + "$%,10.2f" + RESET
            + " │ Portfolio: " + CYAN + "$%,12.2f" + RESET + " │ Return: "
            + returnColor + "%s%.2f%%" + RESET + " │%n",
            currentUser.getUsername(),
            currentUser.getCashBalance(), portfolioVal, returnSign, returnPct);
        System.out.println("└─────────────────────────────────────────────────────────────┘");
    }

    // ════════════════════════════════════════════
    //  MARKET OVERVIEW
    // ════════════════════════════════════════════
    private void showMarketOverview() {
        clearScreen();
        printHeader("MARKET OVERVIEW");

        System.out.println("\n" + BOLD + "  TOP GAINERS:" + RESET);
        printStockTable(marketService.getTopGainers(5));

        System.out.println("\n" + BOLD + "  TOP LOSERS:" + RESET);
        printStockTable(marketService.getTopLosers(5));

        System.out.println("\n" + BOLD + "  MOST ACTIVE:" + RESET);
        printStockTable(marketService.getMostActive(5));

        System.out.println("\n  ── ALL STOCKS BY SECTOR ──");
        for (String sector : marketService.getAllSectors()) {
            System.out.println("\n" + CYAN + "  ▸ " + sector + RESET);
            printStockTable(marketService.getStocksBySector(sector));
        }

        pressEnter();
    }

    private void printStockTable(List<Stock> stocks) {
        System.out.printf("  %-8s %-28s %10s %10s %10s %12s%n",
            "Symbol", "Company", "Price", "Change", "Change%", "Volume");
        System.out.println("  " + "─".repeat(80));
        for (Stock s : stocks) {
            double chg = s.getDayChangeAmount();
            double chgPct = s.getDayChangePercent();
            String color = chgPct >= 0 ? GREEN : RED;
            String indicator = s.getChangeIndicator();
            System.out.printf("  %-8s %-28s %10.2f " + color + "%10.2f %9.2f%% " + RESET + "%12s%n",
                s.getSymbol(), truncate(s.getCompanyName(), 27),
                s.getCurrentPrice(), chg, chgPct,
                formatVolume(s.getVolume()));
        }
    }

    // ════════════════════════════════════════════
    //  STOCK QUOTE
    // ════════════════════════════════════════════
    private void showStockQuote() {
        System.out.print("\n  Enter symbol (or search term): ");
        String query = scanner.nextLine().trim().toUpperCase();

        List<Stock> results = marketService.searchStocks(query);
        if (results.isEmpty()) {
            System.out.println(RED + "  No stocks found for: " + query + RESET);
            pressEnter();
            return;
        }

        Stock stock;
        if (results.size() == 1) {
            stock = results.get(0);
        } else {
            System.out.println("  Multiple results:");
            for (int i = 0; i < results.size(); i++) {
                System.out.printf("  [%d] %s - %s%n", i+1,
                    results.get(i).getSymbol(), results.get(i).getCompanyName());
            }
            System.out.print("  Select: ");
            int sel = parseInt(scanner.nextLine().trim(), 1) - 1;
            if (sel < 0 || sel >= results.size()) return;
            stock = results.get(sel);
        }

        printDetailedQuote(stock);
        pressEnter();
    }

    private void printDetailedQuote(Stock stock) {
        marketService.refreshMarketPrices();
        double chg = stock.getDayChangeAmount();
        double chgPct = stock.getDayChangePercent();
        String color = chgPct >= 0 ? GREEN : RED;

        System.out.println();
        System.out.println("  ╔══════════════════════════════════════════╗");
        System.out.printf("  ║  %-42s║%n", BOLD + stock.getSymbol() + " — " + stock.getCompanyName() + RESET);
        System.out.println("  ╚══════════════════════════════════════════╝");
        System.out.printf("  Sector:          %s%n", stock.getSector());
        System.out.printf("  Status:          %s%n", stock.getStatus());
        System.out.println();
        System.out.printf("  " + BOLD + "Current Price:   " + color + "$%.2f  %s%.2f (%s%.2f%%)" + RESET + "%n",
            stock.getCurrentPrice(), chg >= 0 ? "+" : "", chg,
            chg >= 0 ? "+" : "", chgPct);
        System.out.println();
        System.out.printf("  Open:            $%.2f%n", stock.getOpenPrice());
        System.out.printf("  Prev Close:      $%.2f%n", stock.getPreviousClose());
        System.out.printf("  Day Range:       $%.2f – $%.2f%n", stock.getDayLow(), stock.getDayHigh());
        System.out.printf("  52W Range:       $%.2f – $%.2f%n", stock.getYearLow(), stock.getYearHigh());
        System.out.printf("  Volume:          %s%n", formatVolume(stock.getVolume()));
        System.out.printf("  Market Cap:      %s%n", formatMarketCap(stock.getMarketCap()));
        System.out.printf("  P/E Ratio:       %.1f%n", stock.getPeRatio());
        System.out.printf("  Dividend Yield:  %.2f%%%n", stock.getDividendYield());

        // Mini ASCII price chart
        System.out.println();
        System.out.println("  ── PRICE HISTORY (recent ticks) ──");
        printMiniChart(stock);

        // Your position
        if (currentUser.getPortfolio().hasHolding(stock.getSymbol())) {
            int qty = currentUser.getPortfolio().getQuantity(stock.getSymbol());
            double avgCost = currentUser.getPortfolio().getAverageCost(stock.getSymbol());
            double pnl = (stock.getCurrentPrice() - avgCost) * qty;
            String pnlColor = pnl >= 0 ? GREEN : RED;
            System.out.println();
            System.out.println("  ── YOUR POSITION ──");
            System.out.printf("  Shares Held:     %d @ avg $%.2f%n", qty, avgCost);
            System.out.printf("  Position Value:  $%.2f%n", stock.getCurrentPrice() * qty);
            System.out.printf("  Unrealized P&L:  " + pnlColor + "$%.2f (%.2f%%)" + RESET + "%n",
                pnl, ((stock.getCurrentPrice() - avgCost) / avgCost) * 100);
        }
    }

    private void printMiniChart(Stock stock) {
        List<PriceHistory> history = stock.getPriceHistory();
        if (history.size() < 2) {
            System.out.println("  Insufficient data");
            return;
        }

        int chartWidth = 50;
        int displayCount = Math.min(chartWidth, history.size());
        List<PriceHistory> recent = history.subList(history.size() - displayCount, history.size());

        double minP = recent.stream().mapToDouble(PriceHistory::getPrice).min().orElse(0);
        double maxP = recent.stream().mapToDouble(PriceHistory::getPrice).max().orElse(1);
        double range = maxP - minP;
        if (range == 0) range = 1;

        int chartHeight = 6;
        char[][] chart = new char[chartHeight][displayCount];
        for (char[] row : chart) Arrays.fill(row, ' ');

        for (int i = 0; i < displayCount; i++) {
            double price = recent.get(i).getPrice();
            int row = (int)((maxP - price) / range * (chartHeight - 1));
            row = Math.max(0, Math.min(chartHeight - 1, row));
            chart[row][i] = '·';
        }

        System.out.printf("  $%-7.2f ┤", maxP);
        for (int r = 0; r < chartHeight; r++) {
            if (r > 0) System.out.printf("  %9s ┤", "");
            System.out.print(new String(chart[r]));
            System.out.println();
        }
        System.out.printf("  $%-7.2f ┤%n", minP);
        System.out.println("          └" + "─".repeat(displayCount));
    }

    // ════════════════════════════════════════════
    //  TRADING MENU
    // ════════════════════════════════════════════
    private void showTradingMenu() {
        clearScreen();
        printHeader("BUY / SELL STOCKS");
        System.out.println("  [1] Buy Shares (Market Order)");
        System.out.println("  [2] Sell Shares (Market Order)");
        System.out.println("  [3] Quick Buy (from Market Overview)");
        System.out.println("  [0] Back");
        System.out.print("\n  Choice: ");

        switch (scanner.nextLine().trim()) {
            case "1" -> executeTrade(Transaction.TransactionType.BUY);
            case "2" -> executeTrade(Transaction.TransactionType.SELL);
            case "3" -> quickTrade();
            case "0" -> {}
        }
    }

    private void executeTrade(Transaction.TransactionType type) {
        System.out.print("  Stock symbol: ");
        String symbol = scanner.nextLine().trim().toUpperCase();

        Optional<Stock> stockOpt = marketService.getStock(symbol);
        if (stockOpt.isEmpty()) {
            System.out.println(RED + "  Stock not found: " + symbol + RESET);
            pressEnter();
            return;
        }
        Stock stock = stockOpt.get();
        printDetailedQuote(stock);

        if (type == Transaction.TransactionType.SELL &&
            !currentUser.getPortfolio().hasHolding(symbol)) {
            System.out.println(RED + "  You don't own any shares of " + symbol + RESET);
            pressEnter();
            return;
        }

        System.out.printf("%n  " + BOLD + "%s %s" + RESET + " @ $%.2f | Your cash: $%.2f%n",
            type, symbol, stock.getCurrentPrice(), currentUser.getCashBalance());

        if (type == Transaction.TransactionType.BUY) {
            double maxShares = currentUser.getCashBalance() / stock.getCurrentPrice();
            System.out.printf("  Max affordable: ~%d shares%n", (int)maxShares);
        } else {
            System.out.printf("  You own: %d shares%n",
                currentUser.getPortfolio().getQuantity(symbol));
        }

        System.out.print("  Quantity: ");
        int qty = parseInt(scanner.nextLine().trim(), 0);
        if (qty <= 0) {
            System.out.println(RED + "  Invalid quantity." + RESET);
            pressEnter();
            return;
        }

        double total = qty * stock.getCurrentPrice();
        System.out.printf("%n  ── ORDER CONFIRMATION ──%n");
        System.out.printf("  %s %d x %s @ $%.2f%n", type, qty, symbol, stock.getCurrentPrice());
        System.out.printf("  Estimated Total: $%.2f%n", total);
        System.out.print("  Confirm? [Y/N]: ");

        if (!scanner.nextLine().trim().equalsIgnoreCase("Y")) {
            System.out.println("  Order cancelled.");
            pressEnter();
            return;
        }

        TransactionResult result = switch (type) {
            case BUY -> transactionService.buyStock(currentUser, stock, qty, Transaction.OrderType.MARKET);
            case SELL -> transactionService.sellStock(currentUser, stock, qty, Transaction.OrderType.MARKET);
        };

        if (result.isSuccess()) {
            System.out.println(GREEN + "\n  " + result.getMessage() + RESET);
        } else {
            System.out.println(RED + "\n  ✗ " + result.getMessage() + RESET);
        }
        pressEnter();
    }

    private void quickTrade() {
        System.out.println("\n  ── MARKET OVERVIEW ──");
        printStockTable(marketService.getAllStocks());
        executeTrade(Transaction.TransactionType.BUY);
    }

    // ════════════════════════════════════════════
    //  PORTFOLIO
    // ════════════════════════════════════════════
    private void showPortfolio() {
        clearScreen();
        printHeader("MY PORTFOLIO");

        double totalVal = portfolioService.getTotalPortfolioValue(currentUser);
        double stockVal = portfolioService.getStockValue(currentUser);
        double unrealizedPnL = portfolioService.getUnrealizedPnL(currentUser);
        double totalReturn = portfolioService.getTotalReturnPercent(currentUser);
        String returnColor = totalReturn >= 0 ? GREEN : RED;

        System.out.println();
        System.out.printf("  %-24s $%,14.2f%n", "Cash Balance:", currentUser.getCashBalance());
        System.out.printf("  %-24s $%,14.2f%n", "Stock Holdings Value:", stockVal);
        System.out.printf("  %-24s $%,14.2f%n", "Total Portfolio Value:", totalVal);
        System.out.printf("  %-24s " + returnColor + "$%,+14.2f (%+.2f%%)" + RESET + "%n",
            "Unrealized P&L:", unrealizedPnL,
            portfolioService.getUnrealizedReturnPercent(currentUser));
        System.out.printf("  %-24s " + returnColor + "%+.2f%%" + RESET + "%n",
            "Total Return:", totalReturn);
        System.out.printf("  %-24s $%,14.2f%n", "Realized P&L (closed):",
            transactionService.getRealizedPnL(currentUser.getUserId()));
        System.out.printf("  %-24s %s%n", "Portfolio Rating:",
            portfolioService.getPortfolioRating(currentUser));

        System.out.println();
        System.out.println(BOLD + "  ── HOLDINGS ──" + RESET);
        List<PortfolioService.HoldingSnapshot> snapshots =
            portfolioService.getHoldingSnapshots(currentUser);

        if (snapshots.isEmpty()) {
            System.out.println("  No holdings. Start trading to build your portfolio!");
        } else {
            System.out.printf("  %-8s %-22s %6s %10s %10s %12s %10s%n",
                "Symbol", "Company", "Qty", "Avg Cost", "Price", "Value", "P&L %");
            System.out.println("  " + "─".repeat(82));
            for (PortfolioService.HoldingSnapshot s : snapshots) {
                String pnlColor = s.unrealizedPnL >= 0 ? GREEN : RED;
                System.out.printf("  %-8s %-22s %6d %10.2f %10.2f %12.2f "
                    + pnlColor + "%9.2f%%" + RESET + "%n",
                    s.stock.getSymbol(), truncate(s.stock.getCompanyName(), 21),
                    s.quantity, s.avgCost, s.currentPrice,
                    s.currentValue, s.unrealizedPnLPct);
            }
        }

        System.out.println();
        System.out.println(BOLD + "  ── SECTOR ALLOCATION ──" + RESET);
        Map<String, Double> allocation = portfolioService.getSectorAllocation(currentUser);
        if (allocation.isEmpty()) {
            System.out.println("  No sector data (no holdings)");
        } else {
            allocation.forEach((sector, pct) -> {
                int bars = (int)(pct / 2);
                System.out.printf("  %-18s [%-25s] %5.1f%%%n",
                    sector, "█".repeat(bars) + "░".repeat(25 - bars), pct);
            });
        }

        pressEnter();
    }

    // ════════════════════════════════════════════
    //  TRANSACTION HISTORY
    // ════════════════════════════════════════════
    private void showTransactionHistory() {
        clearScreen();
        printHeader("TRANSACTION HISTORY");

        System.out.print("  Show last how many? (default 20): ");
        String input = scanner.nextLine().trim();
        int limit = input.isEmpty() ? 20 : parseInt(input, 20);

        List<Transaction> txList = transactionService.getRecentTransactions(
            currentUser.getUserId(), limit);

        if (txList.isEmpty()) {
            System.out.println("\n  No transactions yet.");
        } else {
            System.out.printf("%n  %-10s %-20s %-5s %-6s %6s %10s %10s %10s%n",
                "TxID", "Timestamp", "Type", "Symbol", "Qty", "Price", "Commission", "P&L");
            System.out.println("  " + "─".repeat(82));
            for (Transaction tx : txList) {
                boolean isBuy = tx.getType() == Transaction.TransactionType.BUY;
                String typeColor = isBuy ? GREEN : RED;
                String pnlStr = tx.getType() == Transaction.TransactionType.SELL
                    ? String.format("%+.2f", tx.getProfitLoss()) : "   —";
                System.out.printf("  %-10s %-20s " + typeColor + "%-5s" + RESET
                    + " %-6s %6d %10.2f %10.2f %10s%n",
                    tx.getTransactionId(), tx.getFormattedTimestamp(),
                    tx.getType(), tx.getSymbol(), tx.getQuantity(),
                    tx.getPricePerShare(), tx.getCommission(), pnlStr);
            }
            System.out.printf("%n  Total commission paid: $%.2f%n",
                transactionService.getTotalCommissionPaid(currentUser.getUserId()));
            System.out.printf("  Total realized P&L:    $%.2f%n",
                transactionService.getRealizedPnL(currentUser.getUserId()));
        }
        pressEnter();
    }

    // ════════════════════════════════════════════
    //  WATCHLIST
    // ════════════════════════════════════════════
    private void showWatchlist() {
        clearScreen();
        printHeader("MY WATCHLIST");

        Watchlist wl = userService.getWatchlist(currentUser.getUserId());
        System.out.println("  [1] View Watchlist   [2] Add Stock   [3] Remove Stock   [0] Back");
        System.out.print("\n  Choice: ");

        switch (scanner.nextLine().trim()) {
            case "1" -> {
                if (wl.isEmpty()) {
                    System.out.println("\n  Your watchlist is empty. Add some stocks!");
                } else {
                    List<Stock> watched = new ArrayList<>();
                    for (String sym : wl.getSymbols()) {
                        marketService.getStock(sym).ifPresent(watched::add);
                    }
                    System.out.println();
                    printStockTable(watched);
                }
                pressEnter();
            }
            case "2" -> {
                System.out.print("  Symbol to add: ");
                String sym = scanner.nextLine().trim().toUpperCase();
                if (marketService.getStock(sym).isPresent()) {
                    userService.addToWatchlist(currentUser.getUserId(), sym);
                    System.out.println(GREEN + "  ✓ Added " + sym + " to watchlist" + RESET);
                } else {
                    System.out.println(RED + "  Stock not found: " + sym + RESET);
                }
                pressEnter();
            }
            case "3" -> {
                System.out.print("  Symbol to remove: ");
                String sym = scanner.nextLine().trim().toUpperCase();
                userService.removeFromWatchlist(currentUser.getUserId(), sym);
                System.out.println("  Removed " + sym + " from watchlist.");
                pressEnter();
            }
        }
    }

    // ════════════════════════════════════════════
    //  ALERTS
    // ════════════════════════════════════════════
    private void showAlertMenu() {
        clearScreen();
        printHeader("PRICE ALERTS");
        System.out.println("  [1] View Active Alerts   [2] Create Alert");
        System.out.println("  [3] Cancel Alert         [0] Back");
        System.out.print("\n  Choice: ");

        switch (scanner.nextLine().trim()) {
            case "1" -> {
                List<PriceAlert> alerts = alertService.getActiveAlerts(currentUser.getUserId());
                if (alerts.isEmpty()) System.out.println("\n  No active alerts.");
                else {
                    System.out.printf("%n  %-8s %-8s %-6s %12s%n", "AlertID", "Symbol", "Type", "Target");
                    System.out.println("  " + "─".repeat(40));
                    for (PriceAlert a : alerts) {
                        System.out.printf("  %-8s %-8s %-6s $%11.2f%n",
                            a.getAlertId(), a.getSymbol(), a.getAlertType(), a.getTargetPrice());
                    }
                }
                pressEnter();
            }
            case "2" -> {
                System.out.print("  Stock symbol: ");
                String sym = scanner.nextLine().trim().toUpperCase();
                System.out.print("  Alert when price goes [A]bove or [B]elow? ");
                String dir = scanner.nextLine().trim().toUpperCase();
                PriceAlert.AlertType type = dir.equals("A")
                    ? PriceAlert.AlertType.ABOVE : PriceAlert.AlertType.BELOW;
                System.out.print("  Target price ($): ");
                double target = parseDouble(scanner.nextLine().trim(), 0);
                try {
                    String id = alertService.createAlert(currentUser.getUserId(), sym, type, target);
                    System.out.println(GREEN + "  ✓ Alert created: " + id + RESET);
                } catch (Exception e) {
                    System.out.println(RED + "  ✗ " + e.getMessage() + RESET);
                }
                pressEnter();
            }
            case "3" -> {
                System.out.print("  Alert ID to cancel: ");
                String id = scanner.nextLine().trim();
                alertService.cancelAlert(currentUser.getUserId(), id);
                System.out.println("  Alert cancelled.");
                pressEnter();
            }
        }
    }

    // ════════════════════════════════════════════
    //  LIMIT ORDERS
    // ════════════════════════════════════════════
    private void showOrderMenu() {
        clearScreen();
        printHeader("LIMIT ORDERS");
        System.out.println("  [1] View Pending Orders   [2] Place Limit Order");
        System.out.println("  [3] Cancel Order          [0] Back");
        System.out.print("\n  Choice: ");

        switch (scanner.nextLine().trim()) {
            case "1" -> {
                List<PendingOrder> orders =
                    transactionService.getPendingOrders(currentUser.getUserId());
                if (orders.isEmpty()) System.out.println("\n  No pending orders.");
                else {
                    System.out.printf("%n  %-8s %-6s %-5s %6s %10s%n",
                        "OrderID", "Symbol", "Type", "Qty", "Limit $");
                    System.out.println("  " + "─".repeat(45));
                    for (PendingOrder o : orders) {
                        System.out.printf("  %-8s %-6s %-5s %6d %10.2f%n",
                            o.getOrderId(), o.getSymbol(), o.getType(),
                            o.getQuantity(), o.getLimitPrice());
                    }
                }
                pressEnter();
            }
            case "2" -> {
                System.out.print("  Symbol: ");
                String sym = scanner.nextLine().trim().toUpperCase();
                Optional<Stock> s = marketService.getStock(sym);
                if (s.isEmpty()) {
                    System.out.println(RED + "  Stock not found" + RESET);
                    pressEnter();
                    return;
                }
                System.out.printf("  Current price: $%.2f%n", s.get().getCurrentPrice());
                System.out.print("  [B]uy or [S]ell? ");
                String bs = scanner.nextLine().trim().toUpperCase();
                Transaction.TransactionType type = bs.equals("B")
                    ? Transaction.TransactionType.BUY : Transaction.TransactionType.SELL;
                System.out.print("  Quantity: ");
                int qty = parseInt(scanner.nextLine().trim(), 0);
                System.out.print("  Limit price ($): ");
                double limit = parseDouble(scanner.nextLine().trim(), 0);

                String orderId = transactionService.placeLimitOrder(
                    currentUser, s.get(), qty, limit, type);
                System.out.println(GREEN + "  ✓ Limit order placed: " + orderId + RESET);
                pressEnter();
            }
            case "3" -> {
                System.out.print("  Order ID to cancel: ");
                String id = scanner.nextLine().trim();
                transactionService.cancelOrder(currentUser.getUserId(), id);
                System.out.println("  Order cancelled.");
                pressEnter();
            }
        }
    }

    // ════════════════════════════════════════════
    //  LEADERBOARD
    // ════════════════════════════════════════════
    private void showLeaderboard() {
        clearScreen();
        printHeader("TRADER LEADERBOARD");
        List<User> board = userService.getLeaderboard();

        System.out.printf("%n  %-4s %-16s %-12s %14s %10s%n",
            "Rank", "Username", "Tier", "Portfolio $", "Net P&L");
        System.out.println("  " + "─".repeat(60));

        String[] medals = {"🥇", "🥈", "🥉"};
        for (int i = 0; i < board.size(); i++) {
            User u = board.get(i);
            double totalVal = portfolioService.getTotalPortfolioValue(u);
            double pnl = u.getNetProfitLoss();
            String rank = i < 3 ? medals[i] : String.format("  #%-2d", i + 1);
            String pnlColor = pnl >= 0 ? GREEN : RED;
            String highlight = u.getUserId().equals(currentUser.getUserId()) ? YELLOW : "";
            System.out.printf("  %-4s " + highlight + "%-16s %-12s %14.2f "
                + pnlColor + "%+10.2f" + RESET + "%n",
                rank, u.getUsername(), u.getTier().getLabel(), totalVal, pnl);
        }
        pressEnter();
    }

    // ════════════════════════════════════════════
    //  ACCOUNT SETTINGS
    // ════════════════════════════════════════════
    private void showAccountSettings() {
        clearScreen();
        printHeader("ACCOUNT SETTINGS");
        System.out.println("  [1] View Account Info");
        System.out.println("  [2] Deposit Funds");
        System.out.println("  [3] Withdraw Funds");
        System.out.println("  [4] Change Password");
        System.out.println("  [0] Back");
        System.out.print("\n  Choice: ");

        switch (scanner.nextLine().trim()) {
            case "1" -> {
                System.out.println();
                System.out.printf("  User ID:         %s%n", currentUser.getUserId());
                System.out.printf("  Username:        %s%n", currentUser.getUsername());
                System.out.printf("  Email:           %s%n", currentUser.getEmail());
                System.out.printf("  Tier:            %s%n", currentUser.getTier().getLabel());
                System.out.printf("  Total Trades:    %d%n", currentUser.getTotalTrades());
                System.out.printf("  Total Profit:    $%.2f%n", currentUser.getTotalProfit());
                System.out.printf("  Total Loss:      $%.2f%n", currentUser.getTotalLoss());
                System.out.printf("  Net P&L:         $%.2f%n", currentUser.getNetProfitLoss());
                System.out.printf("  Win Rate:        %.1f%%%n", currentUser.getWinRate());
                pressEnter();
            }
            case "2" -> {
                System.out.print("  Amount to deposit ($): ");
                double amount = parseDouble(scanner.nextLine().trim(), 0);
                if (amount > 0) {
                    currentUser.deposit(amount);
                    System.out.printf(GREEN + "  ✓ Deposited $%.2f. New balance: $%.2f%n" + RESET,
                        amount, currentUser.getCashBalance());
                }
                pressEnter();
            }
            case "3" -> {
                System.out.printf("  Available: $%.2f%n", currentUser.getCashBalance());
                System.out.print("  Amount to withdraw ($): ");
                double amount = parseDouble(scanner.nextLine().trim(), 0);
                try {
                    currentUser.withdraw(amount);
                    System.out.printf(GREEN + "  ✓ Withdrew $%.2f. New balance: $%.2f%n" + RESET,
                        amount, currentUser.getCashBalance());
                } catch (Exception e) {
                    System.out.println(RED + "  ✗ " + e.getMessage() + RESET);
                }
                pressEnter();
            }
            case "4" -> {
                System.out.print("  Current password: ");
                String old = scanner.nextLine().trim();
                System.out.print("  New password: ");
                String newPwd = scanner.nextLine().trim();
                if (userService.changePassword(currentUser.getUserId(), old, newPwd)) {
                    System.out.println(GREEN + "  ✓ Password changed." + RESET);
                } else {
                    System.out.println(RED + "  ✗ Invalid password or too short." + RESET);
                }
                pressEnter();
            }
        }
    }

    // ════════════════════════════════════════════
    //  SAVE / EXPORT
    // ════════════════════════════════════════════
    private void showSaveMenu() {
        clearScreen();
        printHeader("SAVE / EXPORT DATA");
        System.out.println("  [1] Save Portfolio Snapshot");
        System.out.println("  [2] Export Transaction History (CSV)");
        System.out.println("  [3] Generate Full Performance Report");
        System.out.println("  [0] Back");
        System.out.print("\n  Choice: ");

        switch (scanner.nextLine().trim()) {
            case "1" -> {
                try {
                    fileIOService.savePortfolio(currentUser, portfolioService, marketService);
                } catch (Exception e) {
                    System.out.println(RED + "  ✗ Save failed: " + e.getMessage() + RESET);
                }
                pressEnter();
            }
            case "2" -> {
                try {
                    fileIOService.saveTransactionHistory(currentUser, transactionService);
                } catch (Exception e) {
                    System.out.println(RED + "  ✗ Export failed: " + e.getMessage() + RESET);
                }
                pressEnter();
            }
            case "3" -> {
                try {
                    fileIOService.generateFullReport(currentUser, portfolioService,
                        transactionService, marketService);
                } catch (Exception e) {
                    System.out.println(RED + "  ✗ Report failed: " + e.getMessage() + RESET);
                }
                pressEnter();
            }
        }
    }

    // ════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════
    private void checkAlertsAndOrders() {
        // Check price alerts
        List<PriceAlert> triggered = alertService.checkAlerts(currentUser.getUserId());
        for (PriceAlert a : triggered) {
            System.out.println(YELLOW + "  🔔 " + a.getMessage() + RESET);
        }

        // Check limit orders
        List<TransactionResult> filled = transactionService.checkAndFillLimitOrders(
            currentUser, marketService);
        for (TransactionResult r : filled) {
            if (r.isSuccess()) System.out.println(GREEN + "  ✓ ORDER FILLED: " + r.getMessage() + RESET);
        }
    }

    private void printHeader(String title) {
        System.out.println();
        System.out.println("  " + BOLD + CYAN + "══ " + title + " ══" + RESET);
        System.out.println();
    }

    private void clearScreen() {
        System.out.print("\033[H\033[2J");
        System.out.flush();
    }

    private void pressEnter() {
        System.out.print("\n  [Press ENTER to continue]");
        scanner.nextLine();
    }

    private void pause(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) {}
    }

    private String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max - 2) + ".." : s;
    }

    private String formatVolume(long vol) {
        if (vol >= 1_000_000) return String.format("%.1fM", vol / 1_000_000.0);
        if (vol >= 1_000) return String.format("%.1fK", vol / 1_000.0);
        return String.valueOf(vol);
    }

    private String formatMarketCap(double cap) {
        if (cap >= 1e12) return String.format("$%.2fT", cap / 1e12);
        if (cap >= 1e9) return String.format("$%.2fB", cap / 1e9);
        if (cap >= 1e6) return String.format("$%.2fM", cap / 1e6);
        return String.format("$%.0f", cap);
    }

    private int parseInt(String s, int fallback) {
        try { return Integer.parseInt(s.trim()); }
        catch (NumberFormatException e) { return fallback; }
    }

    private double parseDouble(String s, double fallback) {
        try { return Double.parseDouble(s.trim()); }
        catch (NumberFormatException e) { return fallback; }
    }
}
