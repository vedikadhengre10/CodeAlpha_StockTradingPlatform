

package model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Immutable record of a buy/sell transaction
 */
public class Transaction {
    public enum TransactionType { BUY, SELL }
    public enum OrderType { MARKET, LIMIT, STOP_LOSS }

    private static final DateTimeFormatter FORMATTER =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final String transactionId;
    private final String userId;
    private final String symbol;
    private final TransactionType type;
    private final OrderType orderType;
    private final int quantity;
    private final double pricePerShare;
    private final double commission;
    private final double totalAmount;
    private final LocalDateTime timestamp;
    private final double profitLoss; // Relevant for SELL transactions

    public Transaction(String transactionId, String userId, String symbol,
                       TransactionType type, OrderType orderType, int quantity,
                       double pricePerShare, double commission, double profitLoss) {
        this.transactionId = transactionId;
        this.userId = userId;
        this.symbol = symbol;
        this.type = type;
        this.orderType = orderType;
        this.quantity = quantity;
        this.pricePerShare = pricePerShare;
        this.commission = commission;
        this.totalAmount = (quantity * pricePerShare) + commission;
        this.timestamp = LocalDateTime.now();
        this.profitLoss = profitLoss;
    }

    // Getters
    public String getTransactionId() { return transactionId; }
    public String getUserId() { return userId; }
    public String getSymbol() { return symbol; }
    public TransactionType getType() { return type; }
    public OrderType getOrderType() { return orderType; }
    public int getQuantity() { return quantity; }
    public double getPricePerShare() { return pricePerShare; }
    public double getCommission() { return commission; }
    public double getTotalAmount() { return totalAmount; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public double getProfitLoss() { return profitLoss; }
    public String getFormattedTimestamp() { return timestamp.format(FORMATTER); }

    @Override
    public String toString() {
        return String.format("[%s] %s %d x %s @ $%.2f | Total: $%.2f | Commission: $%.2f",
            getFormattedTimestamp(), type, quantity, symbol, pricePerShare,
            totalAmount, commission);
    }
}
