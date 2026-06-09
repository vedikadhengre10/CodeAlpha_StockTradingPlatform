

package model;

import java.util.HashMap;
import java.util.Map;
import java.util.Collections;

/**
 * Represents a user's stock portfolio with holdings and performance tracking
 */
public class Portfolio {
    private final String ownerId;
    private final Map<String, Holding> holdings; // symbol -> Holding

    public Portfolio(String ownerId) {
        this.ownerId = ownerId;
        this.holdings = new HashMap<>();
    }

    public void addHolding(String symbol, int quantity, double purchasePrice) {
        if (holdings.containsKey(symbol)) {
            Holding existing = holdings.get(symbol);
            existing.addShares(quantity, purchasePrice);
        } else {
            holdings.put(symbol, new Holding(symbol, quantity, purchasePrice));
        }
    }

    public void removeHolding(String symbol, int quantity) {
        Holding holding = holdings.get(symbol);
        if (holding == null) throw new IllegalStateException("No holding for " + symbol);
        if (holding.getQuantity() < quantity)
            throw new IllegalStateException("Not enough shares to sell");

        holding.removeShares(quantity);
        if (holding.getQuantity() == 0) holdings.remove(symbol);
    }

    public boolean hasHolding(String symbol) {
        return holdings.containsKey(symbol) && holdings.get(symbol).getQuantity() > 0;
    }

    public int getQuantity(String symbol) {
        Holding h = holdings.get(symbol);
        return h != null ? h.getQuantity() : 0;
    }

    public double getAverageCost(String symbol) {
        Holding h = holdings.get(symbol);
        return h != null ? h.getAverageCost() : 0;
    }

    public double getTotalInvested(Map<String, Stock> stockMap) {
        return holdings.values().stream()
            .mapToDouble(h -> h.getAverageCost() * h.getQuantity())
            .sum();
    }

    public double getCurrentValue(Map<String, Stock> stockMap) {
        return holdings.entrySet().stream()
            .filter(e -> stockMap.containsKey(e.getKey()))
            .mapToDouble(e -> stockMap.get(e.getKey()).getCurrentPrice() * e.getValue().getQuantity())
            .sum();
    }

    public double getUnrealizedPnL(Map<String, Stock> stockMap) {
        return getCurrentValue(stockMap) - getTotalInvested(stockMap);
    }

    public Map<String, Holding> getHoldings() {
        return Collections.unmodifiableMap(holdings);
    }

    public String getOwnerId() { return ownerId; }

    public boolean isEmpty() { return holdings.isEmpty(); }
}
