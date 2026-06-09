

package service;

import model.Transaction;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Represents a pending limit or stop-loss order awaiting execution
 */
public class PendingOrder {
    private final String orderId;
    private final String userId;
    private final String symbol;
    private final Transaction.TransactionType type;
    private final int quantity;
    private final double limitPrice;
    private final Transaction.OrderType orderType;
    private final LocalDateTime createdAt;

    public PendingOrder(String orderId, String userId, String symbol,
                        Transaction.TransactionType type, int quantity,
                        double limitPrice, Transaction.OrderType orderType) {
        this.orderId = orderId;
        this.userId = userId;
        this.symbol = symbol;
        this.type = type;
        this.quantity = quantity;
        this.limitPrice = limitPrice;
        this.orderType = orderType;
        this.createdAt = LocalDateTime.now();
    }

    public String getOrderId() { return orderId; }
    public String getUserId() { return userId; }
    public String getSymbol() { return symbol; }
    public Transaction.TransactionType getType() { return type; }
    public int getQuantity() { return quantity; }
    public double getLimitPrice() { return limitPrice; }
    public Transaction.OrderType getOrderType() { return orderType; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    @Override
    public String toString() {
        return String.format("[%s] %s %s %d x %s @ $%.2f",
            orderId, orderType, type, quantity, symbol, limitPrice);
    }
}
