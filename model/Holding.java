

package model;

/**
 * Represents a holding of shares in a specific stock with average cost tracking
 */
public class Holding {
    private final String symbol;
    private int quantity;
    private double averageCost;
    private double totalCost;

    public Holding(String symbol, int quantity, double purchasePrice) {
        this.symbol = symbol;
        this.quantity = quantity;
        this.averageCost = purchasePrice;
        this.totalCost = quantity * purchasePrice;
    }

    // Weighted average cost method
    public void addShares(int qty, double price) {
        totalCost += qty * price;
        quantity += qty;
        averageCost = totalCost / quantity;
    }

    public void removeShares(int qty) {
        if (qty > quantity) throw new IllegalArgumentException("Cannot remove more shares than held");
        totalCost -= qty * averageCost;
        quantity -= qty;
        if (quantity == 0) totalCost = 0;
    }

    public double getUnrealizedPnL(double currentPrice) {
        return (currentPrice - averageCost) * quantity;
    }

    public double getUnrealizedPnLPercent(double currentPrice) {
        if (averageCost == 0) return 0;
        return ((currentPrice - averageCost) / averageCost) * 100;
    }

    public double getCurrentValue(double currentPrice) {
        return currentPrice * quantity;
    }

    public String getSymbol() { return symbol; }
    public int getQuantity() { return quantity; }
    public double getAverageCost() { return averageCost; }
    public double getTotalCost() { return totalCost; }
}
