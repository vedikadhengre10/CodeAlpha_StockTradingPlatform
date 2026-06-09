

package service;

import model.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Handles all trade execution, order management, and transaction history
 */
public class TransactionService {
    private final Map<String, List<Transaction>> transactionsByUser;
    private final Map<String, List<PendingOrder>> pendingOrdersByUser;
    private int transactionCounter;
    private int orderCounter;

    // Commission structure
    private static final double BASE_COMMISSION = 4.95;
    private static final double PERCENT_COMMISSION = 0.001; // 0.1%
    private static final double MIN_COMMISSION = 0.99;
    private static final double FREE_TRADES_GOLD_PLUS = 0.0; // Gold+ tier gets free trades

    public TransactionService() {
        this.transactionsByUser = new HashMap<>();
        this.pendingOrdersByUser = new HashMap<>();
        this.transactionCounter = 1;
        this.orderCounter = 1;
    }

    public TransactionResult buyStock(User user, Stock stock, int quantity, Transaction.OrderType orderType) {
        if (quantity <= 0) return TransactionResult.failure("Quantity must be positive");
        if (stock.getStatus() != Stock.StockStatus.ACTIVE)
            return TransactionResult.failure("Stock is not currently tradable");

        double pricePerShare = stock.getCurrentPrice();
        double commission = calculateCommission(quantity, pricePerShare, user);
        double totalCost = (quantity * pricePerShare) + commission;

        if (user.getCashBalance() < totalCost)
            return TransactionResult.failure(
                String.format("Insufficient funds. Need $%.2f, have $%.2f (including $%.2f commission)",
                    totalCost, user.getCashBalance(), commission));

        // Execute trade
        user.deductCash(totalCost);
        user.getPortfolio().addHolding(stock.getSymbol(), quantity, pricePerShare);

        Transaction tx = createTransaction(user.getUserId(), stock.getSymbol(),
            Transaction.TransactionType.BUY, orderType, quantity, pricePerShare, commission, 0);
        recordTransaction(user.getUserId(), tx);
        user.recordTrade(0); // Buy doesn't realize P&L

        return TransactionResult.success(tx,
            String.format("✓ Bought %d shares of %s @ $%.2f | Total: $%.2f",
                quantity, stock.getSymbol(), pricePerShare, totalCost));
    }

    public TransactionResult sellStock(User user, Stock stock, int quantity, Transaction.OrderType orderType) {
        if (quantity <= 0) return TransactionResult.failure("Quantity must be positive");
        if (!user.getPortfolio().hasHolding(stock.getSymbol()))
            return TransactionResult.failure("You don't own any shares of " + stock.getSymbol());

        int owned = user.getPortfolio().getQuantity(stock.getSymbol());
        if (quantity > owned)
            return TransactionResult.failure(
                String.format("Cannot sell %d shares — you only own %d", quantity, owned));

        double pricePerShare = stock.getCurrentPrice();
        double avgCost = user.getPortfolio().getAverageCost(stock.getSymbol());
        double commission = calculateCommission(quantity, pricePerShare, user);
        double proceeds = (quantity * pricePerShare) - commission;
        double profitLoss = (pricePerShare - avgCost) * quantity - commission;

        // Execute trade
        user.getPortfolio().removeHolding(stock.getSymbol(), quantity);
        user.addCash(proceeds);

        Transaction tx = createTransaction(user.getUserId(), stock.getSymbol(),
            Transaction.TransactionType.SELL, orderType, quantity, pricePerShare, commission, profitLoss);
        recordTransaction(user.getUserId(), tx);
        user.recordTrade(profitLoss);

        String pnlStr = profitLoss >= 0
            ? String.format("+$%.2f profit", profitLoss)
            : String.format("-$%.2f loss", Math.abs(profitLoss));

        return TransactionResult.success(tx,
            String.format("✓ Sold %d shares of %s @ $%.2f | %s | Net proceeds: $%.2f",
                quantity, stock.getSymbol(), pricePerShare, pnlStr, proceeds));
    }

    public String placeLimitOrder(User user, Stock stock, int quantity,
                                   double limitPrice, Transaction.TransactionType type) {
        String orderId = "ORD" + (orderCounter++);
        PendingOrder order = new PendingOrder(orderId, user.getUserId(), stock.getSymbol(),
            type, quantity, limitPrice, Transaction.OrderType.LIMIT);

        pendingOrdersByUser.computeIfAbsent(user.getUserId(), k -> new ArrayList<>()).add(order);
        return orderId;
    }

    public List<TransactionResult> checkAndFillLimitOrders(User user, MarketService marketService) {
        List<TransactionResult> results = new ArrayList<>();
        List<PendingOrder> orders = pendingOrdersByUser.getOrDefault(user.getUserId(), new ArrayList<>());
        Iterator<PendingOrder> it = orders.iterator();

        while (it.hasNext()) {
            PendingOrder order = it.next();
            Optional<Stock> stockOpt = marketService.getStock(order.getSymbol());
            if (stockOpt.isEmpty()) continue;

            Stock stock = stockOpt.get();
            boolean shouldFill = switch (order.getType()) {
                case BUY -> stock.getCurrentPrice() <= order.getLimitPrice();
                case SELL -> stock.getCurrentPrice() >= order.getLimitPrice();
            };

            if (shouldFill) {
                TransactionResult result = switch (order.getType()) {
                    case BUY -> buyStock(user, stock, order.getQuantity(), Transaction.OrderType.LIMIT);
                    case SELL -> sellStock(user, stock, order.getQuantity(), Transaction.OrderType.LIMIT);
                };
                if (result.isSuccess()) {
                    it.remove();
                    results.add(result);
                }
            }
        }
        return results;
    }

    public void cancelOrder(String userId, String orderId) {
        List<PendingOrder> orders = pendingOrdersByUser.getOrDefault(userId, new ArrayList<>());
        orders.removeIf(o -> o.getOrderId().equals(orderId));
    }

    public List<PendingOrder> getPendingOrders(String userId) {
        return new ArrayList<>(pendingOrdersByUser.getOrDefault(userId, Collections.emptyList()));
    }

    public List<Transaction> getTransactionHistory(String userId) {
        return new ArrayList<>(transactionsByUser.getOrDefault(userId, Collections.emptyList()));
    }

    public List<Transaction> getRecentTransactions(String userId, int limit) {
        List<Transaction> all = getTransactionHistory(userId);
        int from = Math.max(0, all.size() - limit);
        List<Transaction> recent = new ArrayList<>(all.subList(from, all.size()));
        Collections.reverse(recent);
        return recent;
    }

    public double getTotalCommissionPaid(String userId) {
        return getTransactionHistory(userId).stream()
            .mapToDouble(Transaction::getCommission).sum();
    }

    public double getRealizedPnL(String userId) {
        return getTransactionHistory(userId).stream()
            .filter(t -> t.getType() == Transaction.TransactionType.SELL)
            .mapToDouble(Transaction::getProfitLoss).sum();
    }

    private double calculateCommission(int qty, double price, User user) {
        if (user.getTier() == User.UserTier.PLATINUM) return 0;
        double commission = Math.max(MIN_COMMISSION,
            Math.min(BASE_COMMISSION, qty * price * PERCENT_COMMISSION));
        return Math.round(commission * 100.0) / 100.0;
    }

    private Transaction createTransaction(String userId, String symbol,
                                           Transaction.TransactionType type,
                                           Transaction.OrderType orderType,
                                           int qty, double price,
                                           double commission, double pnl) {
        String txId = "TX" + String.format("%05d", transactionCounter++);
        return new Transaction(txId, userId, symbol, type, orderType, qty, price, commission, pnl);
    }

    private void recordTransaction(String userId, Transaction tx) {
        transactionsByUser.computeIfAbsent(userId, k -> new ArrayList<>()).add(tx);
    }

    public int getTotalTransactionCount() {
        return transactionsByUser.values().stream().mapToInt(List::size).sum();
    }
}
