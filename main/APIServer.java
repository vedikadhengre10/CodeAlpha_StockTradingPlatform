package main;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import model.*;
import service.*;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

public class APIServer {
    private static MarketService marketService;
    private static UserService userService;
    private static TransactionService transactionService;
    private static PortfolioService portfolioService;
    private static AlertService alertService;
    private static FileIOService fileIOService;

    private static User activeUser = null; // A simple simulation of a logged in active user
    private static final List<String> notifications = new ArrayList<>(); // Store triggered notifications

    public static void main(String[] args) throws IOException {
        // Initialize services
        marketService = new MarketService();
        userService = new UserService();
        transactionService = new TransactionService();
        portfolioService = new PortfolioService(marketService);
        alertService = new AlertService(marketService);
        fileIOService = new FileIOService();

        // Seed demo account and market
        marketService.seedMarket();
        try {
            activeUser = userService.register("demo", "demo1234", "demo@apex.com", 100000.00);
        } catch (Exception e) {
            // Already registered or error
        }

        // Start background price update simulator (every 3 seconds)
        Thread simThread = new Thread(() -> {
            while (true) {
                try {
                    Thread.sleep(3000);
                    if (marketService.isMarketOpen()) {
                        marketService.refreshMarketPrices();
                        // If there is an active user, check alerts and pending limit orders
                        if (activeUser != null) {
                            // Check price alerts
                            List<PriceAlert> triggered = alertService.checkAlerts(activeUser.getUserId());
                            for (PriceAlert a : triggered) {
                                synchronized (notifications) {
                                    notifications.add("🔔 " + a.getMessage());
                                }
                            }

                            // Check limit orders
                            List<TransactionResult> filled = transactionService.checkAndFillLimitOrders(activeUser, marketService);
                            for (TransactionResult r : filled) {
                                if (r.isSuccess()) {
                                    synchronized (notifications) {
                                        notifications.add("📈 ORDER FILLED: " + r.getMessage());
                                    }
                                }
                            }
                        }
                    }
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
        simThread.setDaemon(true);
        simThread.start();

        // Start HTTP Server
        int port = 8085;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/", new StaticFileHandler());
        server.createContext("/api", new ApiHandler());
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();

        System.out.println("====================================================");
        System.out.println(" APEX Stock Trading Platform Web API Server Ready   ");
        System.out.println(" Running on http://localhost:" + port + "/           ");
        System.out.println("====================================================");
    }

    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String pathStr = exchange.getRequestURI().getPath();
            if (pathStr.equals("/")) {
                pathStr = "/index.html";
            }

            // Serve from "web" directory
            Path filePath = Paths.get("web", pathStr.substring(1));
            if (!Files.exists(filePath) || Files.isDirectory(filePath)) {
                String response = "404 Not Found";
                exchange.getResponseHeaders().set("Content-Type", "text/plain");
                exchange.sendResponseHeaders(404, response.length());
                OutputStream os = exchange.getResponseBody();
                os.write(response.getBytes());
                os.close();
                return;
            }

            // Detect Content-Type
            String contentType = "text/plain";
            if (pathStr.endsWith(".html")) contentType = "text/html";
            else if (pathStr.endsWith(".css")) contentType = "text/css";
            else if (pathStr.endsWith(".js")) contentType = "text/javascript";
            else if (pathStr.endsWith(".png")) contentType = "image/png";
            else if (pathStr.endsWith(".jpg") || pathStr.endsWith(".jpeg")) contentType = "image/jpeg";
            else if (pathStr.endsWith(".ico")) contentType = "image/x-icon";

            byte[] bytes = Files.readAllBytes(filePath);
            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, bytes.length);
            OutputStream os = exchange.getResponseBody();
            os.write(bytes);
            os.close();
        }
    }

    static class ApiHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Handle CORS Preflight
            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
                exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "*");
                exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();

            try {
                if (path.equals("/api/auth/status") && method.equalsIgnoreCase("GET")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 200, "{\"authenticated\":false}");
                    } else {
                        sendJsonResponse(exchange, 200, "{\"authenticated\":true,\"user\":" + userToJson(activeUser) + "}");
                    }
                } else if (path.equals("/api/auth/login") && method.equalsIgnoreCase("POST")) {
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    String username = params.get("username");
                    String password = params.get("password");
                    Optional<User> uOpt = userService.authenticate(username, password);
                    if (uOpt.isPresent()) {
                        activeUser = uOpt.get();
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Welcome back!\",\"user\":" + userToJson(activeUser) + "}");
                    } else {
                        sendJsonResponse(exchange, 401, "{\"success\":false,\"message\":\"Invalid username or password.\"}");
                    }
                } else if (path.equals("/api/auth/register") && method.equalsIgnoreCase("POST")) {
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    String username = params.get("username");
                    String password = params.get("password");
                    String email = params.get("email");
                    double deposit = 0;
                    try {
                        deposit = Double.parseDouble(params.getOrDefault("deposit", "0"));
                    } catch (Exception ignored) {}

                    try {
                        User u = userService.register(username, password, email, deposit);
                        activeUser = u;
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Account registered successfully!\",\"user\":" + userToJson(u) + "}");
                    } catch (Exception e) {
                        sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"" + escape(e.getMessage()) + "\"}");
                    }
                } else if (path.equals("/api/auth/logout") && method.equalsIgnoreCase("POST")) {
                    activeUser = null;
                    sendJsonResponse(exchange, 200, "{\"success\":true}");
                } else if (path.equals("/api/market/stocks") && method.equalsIgnoreCase("GET")) {
                    List<Stock> stocks = marketService.getAllStocks();
                    String stocksJson = stocks.stream().map(APIServer::stockToJson).collect(Collectors.joining(","));
                    sendJsonResponse(exchange, 200, "{\"stocks\":[" + stocksJson + "],\"marketOpen\":" + marketService.isMarketOpen() + ",\"marketIndex\":" + marketService.getMarketIndex() + ",\"sentiment\":" + marketService.getMarketSentiment() + "}");
                } else if (path.equals("/api/market/stock") && method.equalsIgnoreCase("GET")) {
                    Map<String, String> query = parseQueryParams(exchange.getRequestURI().getQuery());
                    String symbol = query.get("symbol");
                    if (symbol == null) {
                        sendJsonResponse(exchange, 400, "{\"error\":\"Missing symbol parameter\"}");
                        return;
                    }
                    Optional<Stock> stockOpt = marketService.getStock(symbol);
                    if (stockOpt.isPresent()) {
                        sendJsonResponse(exchange, 200, stockToJson(stockOpt.get()));
                    } else {
                        sendJsonResponse(exchange, 404, "{\"error\":\"Stock not found\"}");
                    }
                } else if (path.equals("/api/portfolio") && method.equalsIgnoreCase("GET")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    double totalVal = portfolioService.getTotalPortfolioValue(activeUser);
                    double stockVal = portfolioService.getStockValue(activeUser);
                    double unrealizedPnL = portfolioService.getUnrealizedPnL(activeUser);
                    double totalReturn = portfolioService.getTotalReturnPercent(activeUser);
                    double unrealizedReturn = portfolioService.getUnrealizedReturnPercent(activeUser);
                    double realizedPnL = transactionService.getRealizedPnL(activeUser.getUserId());
                    String rating = portfolioService.getPortfolioRating(activeUser);

                    List<PortfolioService.HoldingSnapshot> snapshots = portfolioService.getHoldingSnapshots(activeUser);
                    String holdingsJson = snapshots.stream().map(APIServer::snapshotToJson).collect(Collectors.joining(","));

                    Map<String, Double> allocation = portfolioService.getSectorAllocation(activeUser);
                    String allocationJson = allocation.entrySet().stream()
                        .map(entry -> String.format("\"%s\":%.2f", escape(entry.getKey()), entry.getValue()))
                        .collect(Collectors.joining(","));

                    sendJsonResponse(exchange, 200, String.format(
                        "{\"cashBalance\":%.2f,\"stockValue\":%.2f,\"totalValue\":%.2f,\"unrealizedPnL\":%.2f,\"unrealizedPnLPct\":%.2f,\"totalReturnPct\":%.2f,\"realizedPnL\":%.2f,\"rating\":\"%s\",\"holdings\":[%s],\"allocation\":{%s}}",
                        activeUser.getCashBalance(), stockVal, totalVal, unrealizedPnL, unrealizedReturn, totalReturn, realizedPnL, escape(rating), holdingsJson, allocationJson
                    ));
                } else if (path.equals("/api/trade") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    String symbol = params.get("symbol");
                    String typeStr = params.get("type"); // "BUY" or "SELL"
                    int qty = 0;
                    try {
                        qty = Integer.parseInt(params.getOrDefault("qty", "0"));
                    } catch (Exception ignored) {}

                    Optional<Stock> stockOpt = marketService.getStock(symbol);
                    if (stockOpt.isEmpty()) {
                        sendJsonResponse(exchange, 404, "{\"success\":false,\"message\":\"Stock not found: " + symbol + "\"}");
                        return;
                    }
                    Stock stock = stockOpt.get();
                    Transaction.TransactionType type = Transaction.TransactionType.valueOf(typeStr.toUpperCase());

                    TransactionResult result;
                    if (type == Transaction.TransactionType.BUY) {
                        result = transactionService.buyStock(activeUser, stock, qty, Transaction.OrderType.MARKET);
                    } else {
                        result = transactionService.sellStock(activeUser, stock, qty, Transaction.OrderType.MARKET);
                    }

                    if (result.isSuccess()) {
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"" + escape(result.getMessage()) + "\",\"cashBalance\":" + activeUser.getCashBalance() + "}");
                    } else {
                        sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"" + escape(result.getMessage()) + "\"}");
                    }
                } else if (path.equals("/api/transactions") && method.equalsIgnoreCase("GET")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    List<Transaction> txList = transactionService.getTransactionHistory(activeUser.getUserId());
                    String txJson = txList.stream().map(APIServer::transactionToJson).collect(Collectors.joining(","));
                    double totalCommission = transactionService.getTotalCommissionPaid(activeUser.getUserId());
                    double totalRealized = transactionService.getRealizedPnL(activeUser.getUserId());
                    sendJsonResponse(exchange, 200, String.format(
                        "{\"transactions\":[%s],\"totalCommission\":%.2f,\"totalRealizedPnL\":%.2f}",
                        txJson, totalCommission, totalRealized
                    ));
                } else if (path.equals("/api/watchlist") && method.equalsIgnoreCase("GET")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Watchlist wl = userService.getWatchlist(activeUser.getUserId());
                    String symbolsJson = wl.getSymbols().stream().map(s -> "\"" + escape(s) + "\"").collect(Collectors.joining(","));
                    sendJsonResponse(exchange, 200, "{\"symbols\":[" + symbolsJson + "]}");
                } else if (path.equals("/api/watchlist/add") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    String symbol = params.get("symbol");
                    if (marketService.getStock(symbol).isPresent()) {
                        userService.addToWatchlist(activeUser.getUserId(), symbol);
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Added to watchlist\"}");
                    } else {
                        sendJsonResponse(exchange, 404, "{\"success\":false,\"message\":\"Stock not found\"}");
                    }
                } else if (path.equals("/api/watchlist/remove") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    String symbol = params.get("symbol");
                    userService.removeFromWatchlist(activeUser.getUserId(), symbol);
                    sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Removed from watchlist\"}");
                } else if (path.equals("/api/alerts") && method.equalsIgnoreCase("GET")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    List<PriceAlert> alerts = alertService.getActiveAlerts(activeUser.getUserId());
                    String alertsJson = alerts.stream().map(APIServer::alertToJson).collect(Collectors.joining(","));
                    sendJsonResponse(exchange, 200, "{\"alerts\":[" + alertsJson + "]}");
                } else if (path.equals("/api/alerts/create") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    String symbol = params.get("symbol");
                    String typeStr = params.get("type"); // "ABOVE" or "BELOW"
                    double target = Double.parseDouble(params.getOrDefault("targetPrice", "0"));
                    PriceAlert.AlertType type = PriceAlert.AlertType.valueOf(typeStr.toUpperCase());
                    try {
                        String alertId = alertService.createAlert(activeUser.getUserId(), symbol, type, target);
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Alert created successfully!\",\"alertId\":\"" + alertId + "\"}");
                    } catch (Exception e) {
                        sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"" + escape(e.getMessage()) + "\"}");
                    }
                } else if (path.equals("/api/alerts/cancel") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    String alertId = params.get("alertId");
                    alertService.cancelAlert(activeUser.getUserId(), alertId);
                    sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Alert cancelled\"}");
                } else if (path.equals("/api/orders") && method.equalsIgnoreCase("GET")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    List<PendingOrder> orders = transactionService.getPendingOrders(activeUser.getUserId());
                    String ordersJson = orders.stream().map(APIServer::orderToJson).collect(Collectors.joining(","));
                    sendJsonResponse(exchange, 200, "{\"orders\":[" + ordersJson + "]}");
                } else if (path.equals("/api/orders/place") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    String symbol = params.get("symbol");
                    String typeStr = params.get("type"); // "BUY" or "SELL"
                    int qty = Integer.parseInt(params.getOrDefault("qty", "0"));
                    double limit = Double.parseDouble(params.getOrDefault("limitPrice", "0"));

                    Optional<Stock> stockOpt = marketService.getStock(symbol);
                    if (stockOpt.isEmpty()) {
                        sendJsonResponse(exchange, 404, "{\"success\":false,\"message\":\"Stock not found\"}");
                        return;
                    }
                    Transaction.TransactionType type = Transaction.TransactionType.valueOf(typeStr.toUpperCase());
                    try {
                        String orderId = transactionService.placeLimitOrder(activeUser, stockOpt.get(), qty, limit, type);
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Limit order placed successfully!\",\"orderId\":\"" + orderId + "\"}");
                    } catch (Exception e) {
                        sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"" + escape(e.getMessage()) + "\"}");
                    }
                } else if (path.equals("/api/orders/cancel") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    String orderId = params.get("orderId");
                    transactionService.cancelOrder(activeUser.getUserId(), orderId);
                    sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Order cancelled\"}");
                } else if (path.equals("/api/leaderboard") && method.equalsIgnoreCase("GET")) {
                    List<User> board = new ArrayList<>(userService.getAllUsers());
                    board.sort((a, b) -> {
                        double valA = portfolioService.getTotalPortfolioValue(a);
                        double valB = portfolioService.getTotalPortfolioValue(b);
                        return Double.compare(valB, valA);
                    });
                    String boardJson = board.stream().map(u -> String.format(
                        "{\"username\":\"%s\",\"tier\":\"%s\",\"totalValue\":%.2f,\"netPnL\":%.2f}",
                        escape(u.getUsername()), escape(u.getTier().getLabel()),
                        portfolioService.getTotalPortfolioValue(u),
                        portfolioService.getTotalPortfolioValue(u) - u.getInitialDeposit()
                    )).collect(Collectors.joining(","));
                    sendJsonResponse(exchange, 200, "{\"leaderboard\":[" + boardJson + "]}");
                } else if (path.equals("/api/account/deposit") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    double amount = Double.parseDouble(params.getOrDefault("amount", "0"));
                    if (amount > 0) {
                        activeUser.deposit(amount);
                        sendJsonResponse(exchange, 200, String.format("{\"success\":true,\"message\":\"Deposited $%.2f successfully!\",\"cashBalance\":%.2f}", amount, activeUser.getCashBalance()));
                    } else {
                        sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"Invalid deposit amount.\"}");
                    }
                } else if (path.equals("/api/account/withdraw") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    double amount = Double.parseDouble(params.getOrDefault("amount", "0"));
                    try {
                        activeUser.withdraw(amount);
                        sendJsonResponse(exchange, 200, String.format("{\"success\":true,\"message\":\"Withdrew $%.2f successfully!\",\"cashBalance\":%.2f}", amount, activeUser.getCashBalance()));
                    } catch (Exception e) {
                        sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"" + escape(e.getMessage()) + "\"}");
                    }
                } else if (path.equals("/api/account/password") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    Map<String, String> params = parseJson(readRequestBody(exchange));
                    String oldPwd = params.get("oldPassword");
                    String newPwd = params.get("newPassword");
                    if (userService.changePassword(activeUser.getUserId(), oldPwd, newPwd)) {
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Password changed successfully!\"}");
                    } else {
                        sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"Invalid current password or new password too short.\"}");
                    }
                } else if (path.equals("/api/account/save") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    try {
                        fileIOService.savePortfolio(activeUser, portfolioService, marketService);
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Portfolio saved successfully!\"}");
                    } catch (Exception e) {
                        sendJsonResponse(exchange, 500, "{\"success\":false,\"message\":\"" + escape(e.getMessage()) + "\"}");
                    }
                } else if (path.equals("/api/account/export") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    try {
                        fileIOService.saveTransactionHistory(activeUser, transactionService);
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Transaction history exported successfully!\"}");
                    } catch (Exception e) {
                        sendJsonResponse(exchange, 500, "{\"success\":false,\"message\":\"" + escape(e.getMessage()) + "\"}");
                    }
                } else if (path.equals("/api/account/report") && method.equalsIgnoreCase("POST")) {
                    if (activeUser == null) {
                        sendJsonResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
                        return;
                    }
                    try {
                        fileIOService.generateFullReport(activeUser, portfolioService, transactionService, marketService);
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"Full performance report generated successfully!\"}");
                    } catch (Exception e) {
                        sendJsonResponse(exchange, 500, "{\"success\":false,\"message\":\"" + escape(e.getMessage()) + "\"}");
                    }
                } else if (path.equals("/api/notifications") && method.equalsIgnoreCase("GET")) {
                    // Endpoint to fetch real-time toast notifications
                    List<String> currentNotifs;
                    synchronized (notifications) {
                        currentNotifs = new ArrayList<>(notifications);
                        notifications.clear();
                    }
                    String notifsJson = currentNotifs.stream().map(n -> "\"" + escape(n) + "\"").collect(Collectors.joining(","));
                    sendJsonResponse(exchange, 200, "{\"notifications\":[" + notifsJson + "]}");
                } else {
                    sendJsonResponse(exchange, 404, "{\"error\":\"API route not found\"}");
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendJsonResponse(exchange, 500, "{\"error\":\"Internal Server Error: " + escape(e.getMessage()) + "\"}");
            }
        }
    }

    private static void sendJsonResponse(HttpExchange exchange, int statusCode, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
    }

    private static String readRequestBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line);
        }
        br.close();
        return sb.toString();
    }

    private static Map<String, String> parseQueryParams(String query) {
        Map<String, String> params = new HashMap<>();
        if (query == null || query.trim().isEmpty()) return params;
        String[] pairs = query.split("&");
        for (String pair : pairs) {
            String[] keyValue = pair.split("=", 2);
            if (keyValue.length == 2) {
                try {
                    String key = URLDecoder.decode(keyValue[0], StandardCharsets.UTF_8.name());
                    String value = URLDecoder.decode(keyValue[1], StandardCharsets.UTF_8.name());
                    params.put(key, value);
                } catch (UnsupportedEncodingException e) {
                    // Ignore
                }
            }
        }
        return params;
    }

    private static Map<String, String> parseJson(String body) {
        Map<String, String> map = new HashMap<>();
        if (body == null || body.trim().isEmpty()) return map;
        body = body.trim();
        if (body.startsWith("{") && body.endsWith("}")) {
            body = body.substring(1, body.length() - 1);
        }
        // Simple regex split for json keys & values
        String[] pairs = body.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
        for (String pair : pairs) {
            String[] keyValue = pair.split(":(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
            if (keyValue.length == 2) {
                String key = keyValue[0].trim().replace("\"", "");
                String value = keyValue[1].trim().replace("\"", "");
                map.put(key, value);
            }
        }
        return map;
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private static String stockToJson(Stock s) {
        String historyJson = s.getPriceHistory().stream()
            .map(h -> String.format("{\"price\":%.2f,\"time\":\"%s\"}", h.getPrice(), escape(h.getFormattedTime())))
            .collect(Collectors.joining(","));

        return String.format(
            "{\"symbol\":\"%s\",\"companyName\":\"%s\",\"sector\":\"%s\",\"currentPrice\":%.2f,\"dayChangeAmount\":%.2f,\"dayChangePercent\":%.2f,\"volume\":%d,\"openPrice\":%.2f,\"previousClose\":%.2f,\"dayLow\":%.2f,\"dayHigh\":%.2f,\"yearLow\":%.2f,\"yearHigh\":%.2f,\"marketCap\":%.0f,\"peRatio\":%.1f,\"dividendYield\":%.2f,\"status\":\"%s\",\"history\":[%s]}",
            escape(s.getSymbol()), escape(s.getCompanyName()), escape(s.getSector()),
            s.getCurrentPrice(), s.getDayChangeAmount(), s.getDayChangePercent(), s.getVolume(),
            s.getOpenPrice(), s.getPreviousClose(), s.getDayLow(), s.getDayHigh(), s.getYearLow(), s.getYearHigh(),
            s.getMarketCap(), s.getPeRatio(), s.getDividendYield(), s.getStatus().name(), historyJson
        );
    }

    private static String userToJson(User u) {
        return String.format(
            "{\"userId\":\"%s\",\"username\":\"%s\",\"email\":\"%s\",\"cashBalance\":%.2f,\"tier\":\"%s\",\"registeredAt\":\"%s\",\"totalTrades\":%d,\"totalProfit\":%.2f,\"totalLoss\":%.2f,\"netPnL\":%.2f,\"winRate\":%.1f}",
            escape(u.getUserId()), escape(u.getUsername()), escape(u.getEmail()),
            u.getCashBalance(), u.getTier().getLabel(), u.getRegisteredAt().toString(),
            u.getTotalTrades(), u.getTotalProfit(), u.getTotalLoss(), u.getNetProfitLoss(), u.getWinRate()
        );
    }

    private static String snapshotToJson(PortfolioService.HoldingSnapshot s) {
        return String.format(
            "{\"symbol\":\"%s\",\"companyName\":\"%s\",\"quantity\":%d,\"avgCost\":%.2f,\"currentPrice\":%.2f,\"currentValue\":%.2f,\"unrealizedPnL\":%.2f,\"unrealizedPnLPct\":%.2f}",
            escape(s.stock.getSymbol()), escape(s.stock.getCompanyName()), s.quantity,
            s.avgCost, s.currentPrice, s.currentValue, s.unrealizedPnL, s.unrealizedPnLPct
        );
    }

    private static String transactionToJson(Transaction tx) {
        return String.format(
            "{\"transactionId\":\"%s\",\"timestamp\":\"%s\",\"type\":\"%s\",\"orderType\":\"%s\",\"symbol\":\"%s\",\"quantity\":%d,\"pricePerShare\":%.2f,\"commission\":%.2f,\"totalAmount\":%.2f,\"profitLoss\":%.2f}",
            escape(tx.getTransactionId()), escape(tx.getFormattedTimestamp()),
            tx.getType().name(), tx.getOrderType().name(), escape(tx.getSymbol()),
            tx.getQuantity(), tx.getPricePerShare(), tx.getCommission(), tx.getTotalAmount(), tx.getProfitLoss()
        );
    }

    private static String alertToJson(PriceAlert a) {
        return String.format(
            "{\"alertId\":\"%s\",\"symbol\":\"%s\",\"alertType\":\"%s\",\"targetPrice\":%.2f,\"status\":\"%s\",\"message\":\"%s\"}",
            escape(a.getAlertId()), escape(a.getSymbol()), a.getAlertType().name(),
            a.getTargetPrice(), a.getStatus().name(), escape(a.getMessage())
        );
    }

    private static String orderToJson(PendingOrder o) {
        return String.format(
            "{\"orderId\":\"%s\",\"symbol\":\"%s\",\"type\":\"%s\",\"quantity\":%d,\"limitPrice\":%.2f,\"orderType\":\"%s\"}",
            escape(o.getOrderId()), escape(o.getSymbol()), o.getType().name(),
            o.getQuantity(), o.getLimitPrice(), o.getOrderType().name()
        );
    }
}
